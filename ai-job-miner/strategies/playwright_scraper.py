"""
strategies/playwright_scraper.py
================================
Concrete Strategy: PlaywrightScraper (Phase 2)

Targets JavaScript-heavy pages (SPAs) by rendering the page in a headless
browser and extracting the resulting HTML for the existing HTML parsing
pipeline.
"""

from __future__ import annotations

import logging

from core.base_scraper import BaseScraper
from strategies.html_scraper import HtmlSmartScraper

logger = logging.getLogger(__name__)


class PlaywrightScraper(BaseScraper):
    """
    Scraper strategy for SPA / JS-rendered pages using Playwright (async).

    This strategy:
    - launches a headless Chromium instance
    - navigates to the URL
    - waits for the page to settle (networkidle or selector)
    - extracts rendered HTML and reuses HtmlSmartScraper parsing
    """

    async def scrape(self, url: str, **kwargs) -> dict:
        wait_until: str = kwargs.get("wait_until", "networkidle")
        wait_for_selector: str | None = kwargs.get("wait_for_selector")
        timeout_ms: int = int(kwargs.get("timeout_ms", 30_000))

        logger.info("[PlaywrightScraper] Rendering SPA page: %s", url)

        try:
            from playwright.async_api import async_playwright  # type: ignore

            html: str
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                try:
                    context = await browser.new_context()
                    page = await context.new_page()

                    await page.goto(url, wait_until=wait_until, timeout=timeout_ms)

                    if wait_for_selector:
                        await page.wait_for_selector(wait_for_selector, timeout=timeout_ms)

                    html = await page.content()
                finally:
                    await browser.close()

            # Reuse the existing HTML strategy to extract structured fields
            parsed = await HtmlSmartScraper().scrape(url, html_content=html)
            parsed["type"] = "spa"
            return parsed

        except Exception as exc:  # noqa: BLE001
            logger.error("[PlaywrightScraper] Scrape failed for %s: %s", url, exc)
            return {
                "type": "spa",
                "url": url,
                "title": None,
                "location": None,
                "description": None,
                "salary_hint": None,
                "status": "error",
                "error": str(exc),
            }

