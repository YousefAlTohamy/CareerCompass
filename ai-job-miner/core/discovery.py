"""
core/discovery.py
=================
Phase 2 — Automated Link Discovery Engine

Given a root URL (search page, listing page, sitemap-like page), extract
candidate job posting links while:
- restricting to the same domain to avoid infinite web crawling
- limiting the number of discovered links
- deduplicating already-seen links using JobDeduplicator
- prioritising links found inside repeating list structures over
  singleton header elements
- ignoring elements inside <header>, <nav>, or search-summary containers
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Iterable, Optional
from urllib.parse import urljoin, urlparse, urldefrag

import aiohttp
from bs4 import BeautifulSoup, Tag

from core.heuristics import (
    find_job_containers,
    is_likely_job_title,
    is_search_summary_element,
)
from pipeline.deduplicator import JobDeduplicator

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tags that are pure navigation / chrome — links inside these are deprioritised
# ---------------------------------------------------------------------------
_NOISE_ANCESTOR_TAGS: frozenset[str] = frozenset(
    {"header", "nav", "footer", "aside"}
)

# CSS class fragments that indicate a search-result-summary container
_SUMMARY_CLASS_FRAGMENTS: list[str] = [
    "search-result-summary", "result-summary", "search-summary",
    "results-header", "search-header", "jobs-count", "result-count",
    "search-count", "total-results", "job-count", "pagination",
    "breadcrumb", "filter", "sort-bar", "toolbar",
]


@dataclass(frozen=True)
class DiscoveryResult:
    root_url: str
    discovered_links: list[str]
    skipped_duplicates: int
    skipped_off_domain: int
    skipped_invalid: int


class DiscoveryEngine:
    """
    Extract job-posting links from a root URL.

    Matching logic:
    - if a regex pattern is provided, links must match it
    - otherwise, uses heuristics (contains '/job' or '/jobs' segments)

    Improved container detection:
    - Prioritises <a> links found inside repeating list structures
      (identified via ``find_job_containers``)
    - Applies a two-pass approach: first collect high-confidence links
      from job containers, then fall back to full-page scan
    - Penalises/skips links residing inside <header>, <nav>, or
      search-summary <div> elements
    """

    def __init__(
        self,
        deduplicator: JobDeduplicator,
        max_links: int = 300,
    ) -> None:
        self._deduplicator = deduplicator
        self._max_links = max_links

    async def discover(
        self,
        root_url: str,
        pattern: str | None = None,
    ) -> DiscoveryResult:
        compiled: Optional[re.Pattern[str]] = re.compile(pattern, re.IGNORECASE) if pattern else None

        root_host = urlparse(root_url).netloc.lower()
        if not root_host:
            return DiscoveryResult(
                root_url=root_url,
                discovered_links=[],
                skipped_duplicates=0,
                skipped_off_domain=0,
                skipped_invalid=1,
            )

        discovered: list[str] = []
        seen_urls: set[str] = set()
        skipped_duplicates = 0
        skipped_off_domain = 0
        skipped_invalid = 0

        html = await self._fetch(root_url)
        if not html:
            return DiscoveryResult(
                root_url=root_url,
                discovered_links=[],
                skipped_duplicates=0,
                skipped_off_domain=0,
                skipped_invalid=1,
            )

        soup = BeautifulSoup(html, "html.parser")

        # ------------------------------------------------------------------
        # Pass 1: Prioritise links found inside repeating job containers.
        # These are structurally validated as repeated list items — the
        # strongest signal that they represent individual job listings.
        # ------------------------------------------------------------------
        container_links: list[Tag] = []
        job_containers = find_job_containers(soup)

        if job_containers:
            logger.info(
                "[DiscoveryEngine] Found %d job containers via heuristic detection.",
                len(job_containers),
            )
            for container in job_containers:
                for a in container.find_all("a", href=True):
                    container_links.append(a)

        # ------------------------------------------------------------------
        # Pass 2: Collect ALL <a> tags from the page, but score them.
        # Links already seen in Pass 1 get a priority boost.
        # Links inside <header>, <nav>, or summary divs are penalised.
        # ------------------------------------------------------------------
        all_anchors: list[tuple[Tag, float]] = []

        for a in soup.find_all("a", href=True):
            score = 0.0

            # Boost: link was found inside a repeating job container
            if a in container_links:
                score += 100.0

            # Penalty: link is inside a noise ancestor tag
            if self._is_inside_noise_zone(a):
                score -= 200.0

            # Penalty: link text looks like a search summary
            link_text = re.sub(r"\s+", " ", a.get_text(separator=" ")).strip()
            if link_text and not is_likely_job_title(link_text):
                # Mild penalty — the link text itself looks like noise
                score -= 30.0

            # Penalty: link is inside a search-summary container
            if is_search_summary_element(a):
                score -= 150.0

            all_anchors.append((a, score))

        # Sort by score descending — highest-confidence links first
        all_anchors.sort(key=lambda x: x[1], reverse=True)

        for a, score in all_anchors:
            if len(discovered) >= self._max_links:
                break

            href = (a.get("href") or "").strip()
            if not href or href.startswith(("javascript:", "mailto:", "tel:")):
                skipped_invalid += 1
                continue

            absolute = urljoin(root_url, href)
            absolute, _frag = urldefrag(absolute)
            absolute = absolute.strip()

            # Skip links with heavily negative scores (inside noise zones)
            if score < -100.0:
                logger.debug(
                    "[DiscoveryEngine] Skipping low-score link (%.1f): %s",
                    score,
                    absolute[:120],
                )
                skipped_invalid += 1
                continue

            try:
                parsed = urlparse(absolute)
            except Exception:  # noqa: BLE001
                skipped_invalid += 1
                continue

            if parsed.scheme not in ("http", "https") or not parsed.netloc:
                skipped_invalid += 1
                continue

            if parsed.netloc.lower() != root_host:
                skipped_off_domain += 1
                continue

            if compiled is not None:
                if not compiled.search(absolute):
                    continue
            else:
                if not self._looks_like_job_link(parsed.path):
                    continue

            # In-batch dedup (avoid processing the same URL twice in one run)
            if absolute in seen_urls:
                continue
            seen_urls.add(absolute)

            # Deduplicate by URL hash (treat URLs as "jobs" for discovery)
            url_hash = JobDeduplicator.generate_hash(absolute, "discovery", root_host)
            if self._deduplicator.is_duplicate(url_hash):
                skipped_duplicates += 1
                continue
            self._deduplicator.mark_seen(url_hash)

            discovered.append(absolute)

        logger.info(
            "[DiscoveryEngine] root=%s discovered=%d dup=%d off_domain=%d invalid=%d",
            root_url,
            len(discovered),
            skipped_duplicates,
            skipped_off_domain,
            skipped_invalid,
        )

        return DiscoveryResult(
            root_url=root_url,
            discovered_links=discovered,
            skipped_duplicates=skipped_duplicates,
            skipped_off_domain=skipped_off_domain,
            skipped_invalid=skipped_invalid,
        )

    async def _fetch(self, url: str) -> str:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=20)) as resp:
                    resp.raise_for_status()
                    return await resp.text()
        except Exception as exc:  # noqa: BLE001
            logger.error("[DiscoveryEngine] Failed to fetch %s: %s", url, exc)
            return ""

    @staticmethod
    def _looks_like_job_link(path: str) -> bool:
        p = path.lower()
        # Heuristics: avoid listing/search pages and focus on detail pages
        if any(x in p for x in ("/careers", "/career", "/search", "/category", "/categories", "/page/")):
            return False
        return ("/job" in p) or ("/jobs/" in p) or (p.endswith("/jobs"))

    @staticmethod
    def _is_inside_noise_zone(node: Tag) -> bool:
        """
        Check whether a node resides inside a ``<header>``, ``<nav>``,
        ``<footer>``, ``<aside>``, or a ``<div>`` whose CSS class suggests
        it is a search-result-summary container.

        Parameters
        ----------
        node : Tag
            The DOM node to evaluate.

        Returns
        -------
        bool
            ``True`` if the node is inside a noise zone.
        """
        for parent in node.parents:
            if not isinstance(parent, Tag):
                continue

            # Direct noise tag
            if parent.name in _NOISE_ANCESTOR_TAGS:
                return True

            # CSS class heuristic
            classes = " ".join(parent.get("class", [])).lower()
            for fragment in _SUMMARY_CLASS_FRAGMENTS:
                if fragment in classes:
                    return True

            # ID attribute heuristic
            parent_id = (parent.get("id") or "").lower()
            for fragment in _SUMMARY_CLASS_FRAGMENTS:
                if fragment in parent_id:
                    return True

        return False
