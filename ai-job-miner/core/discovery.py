"""
core/discovery.py
=================
Phase 2 — Automated Link Discovery Engine

Given a root URL (search page, listing page, sitemap-like page), extract
candidate job posting links while:
- restricting to the same domain to avoid infinite web crawling
- limiting the number of discovered links
- deduplicating already-seen links using JobDeduplicator
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Iterable, Optional
from urllib.parse import urljoin, urlparse, urldefrag

import aiohttp
from bs4 import BeautifulSoup

from pipeline.deduplicator import JobDeduplicator

logger = logging.getLogger(__name__)


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

        for a in soup.find_all("a", href=True):
            if len(discovered) >= self._max_links:
                break

            href = (a.get("href") or "").strip()
            if not href or href.startswith(("javascript:", "mailto:", "tel:")):
                skipped_invalid += 1
                continue

            absolute = urljoin(root_url, href)
            absolute, _frag = urldefrag(absolute)
            absolute = absolute.strip()

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

