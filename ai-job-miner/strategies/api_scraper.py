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
from typing import Any

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

                field_map = kwargs.get("field_map", {})
                
                # Helper to get value by dotted path
                def get_by_path(data: Any, path: str) -> Any:
                    if not path or not isinstance(data, dict):
                        return None
                    keys = path.split(".")
                    val = data
                    for k in keys:
                        if isinstance(val, dict) and k in val:
                            val = val[k]
                        else:
                            return None
                    return val

                # If the API returns a 'results' array (like Adzuna), take the first item
                # (Assuming the engine fetches 1 URL per job or we just want the best match)
                item = json_data
                if isinstance(json_data, dict) and "results" in json_data and isinstance(json_data["results"], list):
                    if json_data["results"]:
                        item = json_data["results"][0]
                    else:
                        item = {}
                elif isinstance(json_data, list) and len(json_data) > 0:
                    item = json_data[0]

                mapped_data = {
                    "type": "api",
                    "url": url,
                    "content": json_data,
                    "status": "success",
                }

                if field_map and isinstance(item, dict):
                    mapped_data["title"] = get_by_path(item, field_map.get("title", "title"))
                    mapped_data["company"] = get_by_path(item, field_map.get("company", "company"))
                    mapped_data["location"] = get_by_path(item, field_map.get("location", "location"))
                    mapped_data["description"] = get_by_path(item, field_map.get("description", "description"))
                else:
                    # Fallback mapping if no field_map provided
                    if isinstance(item, dict):
                        mapped_data["title"] = item.get("title")
                        mapped_data["company"] = item.get("company")
                        mapped_data["location"] = item.get("location")
                        mapped_data["description"] = item.get("description")

                return mapped_data

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
