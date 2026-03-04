"""
strategies/html_scraper.py
===========================
Concrete Strategy: HtmlSmartScraper (Phase 2)

Phase 1: Fetched raw HTML and returned it.
Phase 2: Integrates the heuristic DOM-analysis algorithms from
         ``core.heuristics`` to intelligently extract:
           • The main **job description** (highest text-density node via DFS)
           • A **salary hint** (semantic proximity / sibling walk)

No CSS class names, IDs, or XPath selectors are used.  The extraction
is driven entirely by structural and textual properties of the DOM tree.

Design Pattern: Strategy Pattern
  - Implements the `scrape` method defined by BaseScraper.
"""

import logging

import aiohttp
from bs4 import BeautifulSoup

from core.base_scraper import BaseScraper
from core.heuristics import extract_semantic_sibling, find_highest_density_node

logger = logging.getLogger(__name__)

# Keywords used by the Semantic Proximity algorithm when searching for salary.
# Listed in priority order — the first match wins.
_SALARY_KEYWORDS: list[str] = [
    "salary",
    "pay",
    "compensation",
    "remuneration",
    "wage",
    "stipend",
]


class HtmlSmartScraper(BaseScraper):
    """
    Concrete scraper strategy for HTML web pages.

    Phase 2 adds intelligent, heuristic-based content extraction on top of
    the raw HTTP fetch from Phase 1.

    Extraction pipeline
    -------------------
    1. Fetch raw HTML via ``self.fetch_content`` (inherited, async).
    2. Parse into a BeautifulSoup DOM tree (``html.parser``).
    3. Run DFS text-density analysis → **job description**.
    4. Run semantic-proximity sibling walk → **salary hint**.
    5. Return a standardised result dict.

    Usage
    -----
    >>> scraper = HtmlSmartScraper()
    >>> result  = await scraper.scrape("https://example.com/job/123")
    >>> print(result["description"])
    >>> print(result["salary_hint"])
    """

    async def scrape(self, url: str, **kwargs) -> dict:
        """
        Fetch an HTML page and extract the job description & salary hint.

        Parameters
        ----------
        url : str
            Target job-listing URL.
        **kwargs : dict
            Reserved for future Phase 3 options (LLM fallback, proxy, …).

        Returns
        -------
        dict
            ::

                {
                    "type":        "html",
                    "url":         <url>,
                    "description": <extracted_description_text> | None,
                    "salary_hint": <extracted_salary_text>      | None,
                    "status":      "success" | "error",
                    "error":       <error_message>  # only on error
                }
        """
        logger.info("[HtmlSmartScraper] Starting Phase 2 scrape for: %s", url)

        async with aiohttp.ClientSession() as session:
            try:
                # --------------------------------------------------------
                # Step 1: Fetch raw HTML
                # --------------------------------------------------------
                raw_html = await self.fetch_content(url, session)

                # --------------------------------------------------------
                # Step 2: Parse into DOM tree
                # --------------------------------------------------------
                soup = BeautifulSoup(raw_html, "html.parser")

                # Remove noise tags upfront so heuristics don't see them
                for noise_tag in soup.find_all(
                    ["script", "style", "noscript", "nav", "footer", "header"]
                ):
                    noise_tag.decompose()

                # --------------------------------------------------------
                # Step 3: DFS Text-Density → Job Description
                # --------------------------------------------------------
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

                # --------------------------------------------------------
                # Step 4: Semantic Proximity → Salary Hint
                #         Try each keyword in priority order
                # --------------------------------------------------------
                salary_hint: str | None = None
                for keyword in _SALARY_KEYWORDS:
                    salary_hint = extract_semantic_sibling(soup, keyword)
                    if salary_hint:
                        logger.info(
                            "[HtmlSmartScraper] Salary hint found via keyword '%s': %s",
                            keyword,
                            salary_hint,
                        )
                        break

                if not salary_hint:
                    logger.warning(
                        "[HtmlSmartScraper] No salary hint found for: %s", url
                    )

                return {
                    "type": "html",
                    "url": url,
                    "description": description,
                    "salary_hint": salary_hint,
                    "status": "success",
                }

            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "[HtmlSmartScraper] Scrape failed for %s: %s", url, exc
                )
                return {
                    "type": "html",
                    "url": url,
                    "description": None,
                    "salary_hint": None,
                    "status": "error",
                    "error": str(exc),
                }
