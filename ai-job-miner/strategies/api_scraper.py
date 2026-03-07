"""
strategies/api_scraper.py
==========================
Concrete Strategy: JsonApiScraper

Handles scraping / consumption of JSON REST APIs.

Fetches a JSON endpoint, parses the response, and returns the structured
data as a Python dict/list (whatever the API returns).

Design Pattern: Strategy Pattern
  - Implements the `scrape` method defined by BaseScraper (the Strategy interface).
"""

import json
import logging

import aiohttp

from core.base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class JsonApiScraper(BaseScraper):
    """
    Concrete scraper strategy for JSON REST APIs.

    Uses the shared `fetch_content` helper to retrieve the raw response
    body, then parses it with the standard library ``json`` module.

    Usage
    -----
    scraper = JsonApiScraper()
    result  = await scraper.scrape("https://api.example.com/jobs")
    """

    async def scrape(self, url: str, **kwargs) -> dict:
        """
        Fetch a JSON API endpoint and return the parsed payload.

        Parameters
        ----------
        url : str
            Target API endpoint URL (must return JSON).
        **kwargs : dict
            Reserved for future options (e.g., ``headers``, ``params``,
            ``auth_token``).

        Returns
        -------
        dict
            ::

                {
                    "type":    "api",
                    "url":     <url>,
                    "content": <parsed_json>,   # dict | list
                    "status":  "success" | "error",
                    "error":   <error_message>  # only present on error
                }
        """
        logger.info("[JsonApiScraper] Starting scrape for: %s", url)

        async with aiohttp.ClientSession() as session:
            try:
                raw_text = await self.fetch_content(url, session)

                # Attempt to parse the response body as JSON
                try:
                    json_data = json.loads(raw_text)
                except json.JSONDecodeError as json_exc:
                    logger.error(
                        "[JsonApiScraper] JSON parse error for %s: %s", url, json_exc
                    )
                    return {
                        "type": "api",
                        "url": url,
                        "content": None,
                        "status": "error",
                        "error": f"JSON parse error: {json_exc}",
                    }

                logger.info(
                    "[JsonApiScraper] Scrape completed for %s — %d top-level key(s)",
                    url,
                    len(json_data) if isinstance(json_data, (dict, list)) else 1,
                )
                return {
                    "type": "api",
                    "url": url,
                    "content": json_data,
                    "status": "success",
                }

            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "[JsonApiScraper] Scrape failed for %s: %s", url, exc
                )
                return {
                    "type": "api",
                    "url": url,
                    "content": None,
                    "status": "error",
                    "error": str(exc),
                }
