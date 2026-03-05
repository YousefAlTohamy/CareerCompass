"""
strategies/html_scraper.py
===========================
Concrete Strategy: HtmlSmartScraper (Phase 2 + IE enhancements)

Extracts structured job metadata from any HTML page using only heuristic
and programmatic rules — zero hardcoded CSS classes, IDs, or XPath.

Extraction pipeline
-------------------
1. Fetch raw HTML via ``self.fetch_content`` (inherited, async).
2. Parse into a BeautifulSoup DOM tree (``html.parser``).
3. Remove noise tags (script, style, nav, footer, header).
4. DFS text-density analysis         → **job description**
5. Semantic proximity sibling walk   → **salary hint**
6. Semantic proximity sibling walk   → **location**
7. <h1> fallback to <title>          → **job title**
"""

import logging
import re

import aiohttp
from bs4 import BeautifulSoup

from core.base_scraper import BaseScraper
from core.heuristics import extract_semantic_sibling, find_highest_density_node

logger = logging.getLogger(__name__)

# ── keyword priority lists ────────────────────────────────────────────────────
_SALARY_KEYWORDS: list[str] = [
    "salary", "pay", "compensation", "remuneration", "wage", "stipend",
]

_LOCATION_KEYWORDS: list[str] = [
    "location", "headquarters", "based in", "office", "city",
]

# Regex to strip trailing noise from page <title> tags ("Job | Company" etc.)
_TITLE_SUFFIX_NOISE: re.Pattern = re.compile(
    r"\s*[-|–—]\s*.{0,60}$",    # strip " - Company Name" or " | LinkedIn"
    re.IGNORECASE,
)


class HtmlSmartScraper(BaseScraper):
    """
    Concrete scraper strategy for HTML web pages.

    Returns a rich result dict containing:
    ``type``, ``url``, ``title``, ``location``,
    ``description``, ``salary_hint``, ``status``.
    """

    async def scrape(self, url: str, **kwargs) -> dict:
        """
        Fetch an HTML page and extract all available job metadata.

        Parameters
        ----------
        url : str
            Target job-listing URL.
        **kwargs
            ``html_content`` (str) — if provided, skip the HTTP fetch
            and parse this string directly (used by ScrapingEngine to
            avoid double-fetching).

        Returns
        -------
        dict
            ::

                {
                    "type":        "html",
                    "url":         <url>,
                    "title":       <job title> | None,
                    "location":    <location string> | None,
                    "description": <body text> | None,
                    "salary_hint": <salary text> | None,
                    "status":      "success" | "error",
                    "error":       <msg>      # only on error
                }
        """
        logger.info("[HtmlSmartScraper] Starting Phase 2 scrape for: %s", url)

        # engine.py pre-fetches via SmartAsyncClient and passes the HTML here
        raw_html: str | None = kwargs.get("html_content")

        async with aiohttp.ClientSession() as session:
            try:
                # ── Step 1: Fetch ─────────────────────────────────────────────
                if not raw_html:
                    raw_html = await self.fetch_content(url, session)

                # ── Step 2: Parse DOM ─────────────────────────────────────────
                soup = BeautifulSoup(raw_html, "html.parser")

                # Remove noise upfront so heuristics don't score them
                for noise_tag in soup.find_all(
                    ["script", "style", "noscript", "nav", "footer", "header"]
                ):
                    noise_tag.decompose()

                # ── Step 3: Title (<h1> → <title> fallback) ──────────────────
                title: str | None = None
                h1 = soup.find("h1")
                if h1 and h1.get_text(strip=True):
                    title = h1.get_text(separator=" ", strip=True)
                    logger.info("[HtmlSmartScraper] Title from <h1>: '%s'", title)
                else:
                    page_title_tag = soup.find("title")
                    if page_title_tag and page_title_tag.get_text(strip=True):
                        raw = page_title_tag.get_text(separator=" ", strip=True)
                        title = _TITLE_SUFFIX_NOISE.sub("", raw).strip()
                        logger.info(
                            "[HtmlSmartScraper] Title fallback from <title>: '%s'", title
                        )

                # ── Step 4: DFS Text-Density → Description ────────────────────
                description = find_highest_density_node(soup)
                if description:
                    logger.info(
                        "[HtmlSmartScraper] Description extracted (%d chars).",
                        len(description),
                    )
                else:
                    logger.warning(
                        "[HtmlSmartScraper] No high-density node found for: %s", url
                    )

                # ── Step 5: Semantic Proximity → Salary Hint ──────────────────
                salary_hint: str | None = None
                for keyword in _SALARY_KEYWORDS:
                    salary_hint = extract_semantic_sibling(soup, keyword)
                    if salary_hint:
                        logger.info(
                            "[HtmlSmartScraper] Salary hint via keyword '%s'", keyword
                        )
                        break
                if not salary_hint:
                    logger.warning("[HtmlSmartScraper] No salary hint found for: %s", url)

                # ── Step 6: Semantic Proximity → Location ─────────────────────
                location: str | None = None
                for keyword in _LOCATION_KEYWORDS:
                    candidate = extract_semantic_sibling(soup, keyword)
                    if candidate:
                        # Trim to first line/sentence to avoid grabbing paragraphs
                        candidate = candidate.split("\n")[0].split(".")[0].strip()
                        if 0 < len(candidate) <= 120:
                            location = candidate
                            logger.info(
                                "[HtmlSmartScraper] Location via keyword '%s': '%s'",
                                keyword, location,
                            )
                            break
                if not location:
                    logger.warning("[HtmlSmartScraper] No location found for: %s", url)

                return {
                    "type":        "html",
                    "url":         url,
                    "title":       title,
                    "location":    location,
                    "description": description,
                    "salary_hint": salary_hint,
                    "status":      "success",
                }

            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "[HtmlSmartScraper] Scrape failed for %s: %s", url, exc
                )
                return {
                    "type":        "html",
                    "url":         url,
                    "title":       None,
                    "location":    None,
                    "description": None,
                    "salary_hint": None,
                    "status":      "error",
                    "error":       str(exc),
                }
