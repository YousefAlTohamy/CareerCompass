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
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-blink-features=AutomationControlled",
                    ],
                )
                try:
                    # ── Stealth browser context ───────────────────────────
                    context = await browser.new_context(
                        viewport={"width": 1920, "height": 1080},
                        user_agent=(
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/124.0.0.0 Safari/537.36"
                        ),
                        locale="en-US",
                        timezone_id="America/New_York",
                        color_scheme="light",
                        extra_http_headers={
                            "Accept-Language": "en-US,en;q=0.9",
                            "Referer": "https://www.google.com/",
                            "Sec-Fetch-Dest": "document",
                            "Sec-Fetch-Mode": "navigate",
                            "Sec-Fetch-Site": "cross-site",
                            "Sec-Fetch-User": "?1",
                            "Upgrade-Insecure-Requests": "1",
                        },
                    )
                    page = await context.new_page()

                    # Mask the navigator.webdriver flag that bot-detectors check
                    await page.add_init_script(
                        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
                    )

                    page.set_default_timeout(timeout_ms)
                    page.set_default_navigation_timeout(timeout_ms)
                    await page.goto(url, wait_until=wait_until, timeout=timeout_ms)

                    if wait_for_selector:
                        await page.wait_for_selector(wait_for_selector, timeout=timeout_ms)

                    html = await page.content()
                finally:
                    try:
                        await context.close()
                    except Exception:
                        pass
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

