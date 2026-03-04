"""
core/engine.py
==============
Phase 5 — Unified Scraping Engine with Async Generator Data Streaming

Orchestrates every component built across all four phases into a single
cohesive pipeline:

    Phase 1  →  ScraperFactory           (Strategy + Factory patterns)
    Phase 2  →  HtmlSmartScraper         (DOM heuristics)
    Phase 3  →  JobDeduplicator          (SHA-256 + Bloom Filter)
               pipeline.cleaners         (Regex FSM normalisation)
    Phase 4  →  CustomSkillExtractor     (longest-match lexicon NER)
               ai.matcher.match_score    (TF-IDF cosine similarity)
    Phase 5  →  SmartAsyncClient         (Token Bucket + Exponential Backoff)
               DeadLetterQueue           (fault-tolerance)
               async generator           (O(1) memory streaming)

Memory Management — Asynchronous Generator
------------------------------------------
The ``stream_jobs`` method is declared with ``async def … yield`` — an
**asynchronous generator** (PEP 525).  Instead of building the entire
results list in RAM, it *yields* one processed job record at a time.

Space complexity of the results collection:

    • Bulk list approach  →  O(N) — all N jobs live in memory simultaneously
    • Async generator     →  O(1) — only the current job is in memory

This is critical when scraping tens of thousands of listings.

CS Concept: Coroutine + Generator Fusion (PEP 525)
---------------------------------------------------
Python's ``async def`` coroutine + ``yield`` statement creates an
*asynchronous generator*.  The caller iterates with ``async for``, and
the generator suspends (returns control to the event loop) at each
``await`` expression, enabling other I/O tasks to interleave.  The
``yield`` expression additionally suspends until the consumer requests
the next item — *back-pressure* is provided for free.
"""

from __future__ import annotations

import logging
from typing import AsyncIterator, Optional

from core.dlq import DeadLetterQueue
from core.http_client import SmartAsyncClient
from factories.scraper_factory import ScraperFactory
from pipeline.cleaners import clean_text, extract_experience, extract_salary, remove_noise
from pipeline.deduplicator import JobDeduplicator
from ai.ner_extractor import CustomSkillExtractor
from ai.matcher import match_score

logger = logging.getLogger(__name__)


class ScrapingEngine:
    """
    Unified scraping engine — entry point for real-world usage.

    Combines all engine components and exposes a single high-level
    ``stream_jobs`` async generator that:

    1. Fetches each URL using ``SmartAsyncClient`` (rate-limited, retrying).
    2. Parses the HTML with ``HtmlSmartScraper`` (DOM heuristics).
    3. Cleans & normalises the extracted fields (Regex FSM cleaners).
    4. Deduplicates via SHA-256 + Bloom Filter (``JobDeduplicator``).
    5. Extracts skills from the description (``CustomSkillExtractor``).
    6. Computes an optional TF-IDF match score against a reference text.
    7. Yields one ``dict`` record per unique job (**O(1) memory footprint**).
    8. Logs failures into the ``DeadLetterQueue`` — no URL is silently lost.

    Parameters
    ----------
    rate : float
        Requests per second for the Token Bucket limiter.  Default: 2.0.
    bloom_capacity : int
        Expected number of unique jobs (sizes the Bloom Filter).
    bloom_fpr : float
        Bloom Filter false-positive rate.
    dlq_max_attempts : int
        Max retry attempts stored in the Dead Letter Queue.
    use_spacy : bool
        Whether to attempt loading spaCy for enhanced NER.
    reference_text : str, optional
        If provided, each job's description is scored against this text
        using TF-IDF cosine similarity (useful for relevance ranking).

    Usage
    -----
    ::

        engine = ScrapingEngine(rate=3.0, reference_text="Python Django REST API")

        async for job in engine.stream_jobs(url_list):
            print(job["title"], job["match_score"])

        # After the run, inspect failures
        print(engine.dlq.summary)
        retryable = await engine.dlq.get_retryable()
    """

    def __init__(
        self,
        rate: float = 2.0,
        bloom_capacity: int = 10_000,
        bloom_fpr: float = 0.01,
        dlq_max_attempts: int = 3,
        use_spacy: bool = False,
        reference_text: Optional[str] = None,
    ) -> None:
        self._rate = rate
        self._deduplicator = JobDeduplicator(bloom_capacity, bloom_fpr)
        self._dlq = DeadLetterQueue(max_attempts=dlq_max_attempts)
        self._extractor = CustomSkillExtractor(use_spacy=use_spacy)
        self._reference_text = reference_text

    # ------------------------------------------------------------------
    # Public properties
    # ------------------------------------------------------------------

    @property
    def dlq(self) -> DeadLetterQueue:
        """Access the Dead Letter Queue for post-run inspection."""
        return self._dlq

    @property
    def seen_count(self) -> int:
        """Number of unique jobs processed (deduplicated) so far."""
        return self._deduplicator.seen_count

    # ------------------------------------------------------------------
    # Main streaming pipeline — O(1) memory via async generator
    # ------------------------------------------------------------------

    async def stream_jobs(
        self,
        urls: list[str],
        scraper_type: str = "html",
    ) -> AsyncIterator[dict]:
        """
        Stream processed, deduplicated job records one-by-one.

        This is an **asynchronous generator** — it uses ``yield`` inside
        an ``async def`` function.  The caller consumes it with::

            async for job in engine.stream_jobs(url_list):
                await save_to_db(job)

        Memory is O(1) for the results: only the current in-flight job
        occupies memory.  This contrasts with a bulk ``return [...]``
        approach which would be O(N).

        Parameters
        ----------
        urls : list[str]
            List of job-listing URLs to scrape.
        scraper_type : str
            Strategy key for ``ScraperFactory`` (``"html"`` or ``"api"``).

        Yields
        ------
        dict
            A processed job record with keys:
            ``url``, ``title``, ``description``, ``salary``, ``experience``,
            ``skills``, ``match_score``, ``raw_salary_hint``.
        """
        scraper = ScraperFactory.get_scraper(scraper_type)

        async with SmartAsyncClient(rate=self._rate) as client:
            for url in urls:
                logger.info("[Engine] Processing: %s", url)

                # --------------------------------------------------------
                # Step 1: Fetch HTML (rate-limited, auto-retrying)
                # --------------------------------------------------------
                try:
                    html = await client.get(url)
                except RuntimeError as exc:
                    logger.error("[Engine] Fetch failed for %s: %s", url, exc)
                    await self._dlq.add_failure(url, str(exc))
                    continue    # move to next URL — don't crash the stream

                # --------------------------------------------------------
                # Step 2: Parse with heuristic scraper
                # --------------------------------------------------------
                try:
                    result = await scraper.scrape(url, html_content=html)
                except Exception as exc:  # noqa: BLE001
                    logger.error("[Engine] Parse failed for %s: %s", url, exc)
                    await self._dlq.add_failure(url, f"parse error: {exc}")
                    continue

                if result.get("status") != "success":
                    await self._dlq.add_failure(url, result.get("error", "unknown parse error"))
                    continue

                # --------------------------------------------------------
                # Step 3: Normalise & clean (Phase 3 cleaners)
                # --------------------------------------------------------
                raw_title = result.get("title") or result.get("type", "")
                cleaned_title = remove_noise(clean_text(raw_title))
                description = clean_text(result.get("description") or "")
                salary_hint = result.get("salary_hint") or ""

                salary = extract_salary(salary_hint)
                experience = extract_experience(description)

                # --------------------------------------------------------
                # Step 4: Deduplicate  (SHA-256 + Bloom Filter)
                # --------------------------------------------------------
                company = result.get("company", "")
                location = result.get("location", "")
                job_hash = JobDeduplicator.generate_hash(cleaned_title, company, location)

                if self._deduplicator.is_duplicate(job_hash):
                    logger.debug("[Engine] Duplicate skipped: %s", url)
                    continue

                self._deduplicator.mark_seen(job_hash)

                # --------------------------------------------------------
                # Step 5: Skill extraction (Phase 4 NER)
                # --------------------------------------------------------
                skills = self._extractor.extract_skills(description)

                # --------------------------------------------------------
                # Step 6: TF-IDF match score (Phase 4 matcher)
                # --------------------------------------------------------
                score = 0.0
                if self._reference_text and description:
                    score = match_score(self._reference_text, description)

                # --------------------------------------------------------
                # Step 7: Yield the processed record — O(1) memory
                # --------------------------------------------------------
                job_record = {
                    "url": url,
                    "title": cleaned_title,
                    "description": description[:500],   # truncated for preview
                    "raw_salary_hint": salary_hint,
                    "salary": salary,
                    "experience": experience,
                    "skills": skills,
                    "match_score": round(score, 4),
                }

                logger.info(
                    "[Engine] ✓ Yielding job: '%s' skills=%d match=%.3f",
                    cleaned_title or url, len(skills), score,
                )
                yield job_record   # ← the generator suspends here; memory stays O(1)
