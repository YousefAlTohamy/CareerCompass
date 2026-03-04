"""
strategies/html_scraper.py
===========================
Concrete Strategy: HtmlSmartScraper

Handles scraping of standard HTML web pages.

Phase 1 implementation fetches raw HTML and returns it as-is.
Phase 2 will add DOM traversal (DFS) and CSS/XPath extraction logic.

Design Pattern: Strategy Pattern
  - Implements the `scrape` method defined by BaseScraper (the Strategy interface).
"""

import logging

import aiohttp

from core.base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class HtmlSmartScraper(BaseScraper):
    """
    Concrete scraper strategy for HTML web pages.

    Fetches the raw HTML of a page using the shared `fetch_content`
    helper defined in BaseScraper.  In Phase 2, this class will be
    extended with a DOM DFS walker that intelligently extracts
    structured data from the page tree.

    Usage
    -----
    scraper = HtmlSmartScraper()
    result  = await scraper.scrape("https://example.com")
    """

    async def scrape(self, url: str, **kwargs) -> dict:
        """
        Fetch an HTML page and return the raw content.

        Parameters
        ----------
        url : str
            Target web-page URL.
        **kwargs : dict
            Reserved for Phase 2 options (e.g., ``css_selector``,
            ``wait_for_js``, ``headers``).

        Returns
        -------
        dict
            ::

                {
                    "type":    "html",
                    "url":     <url>,
                    "content": <raw_html_string>,
                    "status":  "success" | "error",
                    "error":   <error_message>   # only present on error
                }
        """
        logger.info("[HtmlSmartScraper] Starting scrape for: %s", url)

        # Use a fresh session per scrape call.
        # In Phase 2 this will be injected / pooled via a dependency-injection layer.
        async with aiohttp.ClientSession() as session:
            try:
                raw_html = await self.fetch_content(url, session)
                logger.info(
                    "[HtmlSmartScraper] Scrape completed for %s (%d chars)",
                    url,
                    len(raw_html),
                )
                return {
                    "type": "html",
                    "url": url,
                    "content": raw_html,
                    "status": "success",
                }
            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "[HtmlSmartScraper] Scrape failed for %s: %s", url, exc
                )
                return {
                    "type": "html",
                    "url": url,
                    "content": None,
                    "status": "error",
                    "error": str(exc),
                }
