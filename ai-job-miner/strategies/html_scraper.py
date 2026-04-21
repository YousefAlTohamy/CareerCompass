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
import json

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

                # ── Step 3.5: Company (best-effort) ──────────────────────────
                company: str | None = None
                og_site = soup.find("meta", attrs={"property": "og:site_name"})
                if og_site and og_site.get("content"):
                    company = og_site.get("content")
                if not company:
                    og_title = soup.find("meta", attrs={"property": "og:title"})
                    if og_title and og_title.get("content"):
                        # Sometimes "Role at Company"
                        txt = str(og_title.get("content"))
                        if " at " in txt.lower():
                            company = txt.split(" at ", 1)[-1].strip()

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

                # ── Step 4.5: Deep heuristic fallback (JSON-LD / meta tags) ───
                # If primary heuristics are weak, try schema.org JobPosting and OG/meta tags.
                if (not title) or (not description or len(description) < 120) or (not company):
                    deep = self._extract_from_jsonld_and_meta(soup)
                    title = title or deep.get("title")
                    company = company or deep.get("company")
                    location = location or deep.get("location")
                    if (not description) or (len(description) < 120):
                        description = deep.get("description") or description
                    salary_hint = salary_hint or deep.get("salary_hint")

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
                    "company":     company,
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
                    "company":     None,
                    "location":    None,
                    "description": None,
                    "salary_hint": None,
                    "status":      "error",
                    "error":       str(exc),
                }

    @staticmethod
    def _extract_from_jsonld_and_meta(soup: BeautifulSoup) -> dict:
        def meta(prop: str) -> str | None:
            t = soup.find("meta", attrs={"property": prop})
            if t and t.get("content"):
                return str(t.get("content")).strip()
            return None

        def meta_name(name: str) -> str | None:
            t = soup.find("meta", attrs={"name": name})
            if t and t.get("content"):
                return str(t.get("content")).strip()
            return None

        out: dict[str, str | None] = {
            "title": None,
            "company": None,
            "location": None,
            "description": None,
            "salary_hint": None,
        }

        # --- JSON-LD JobPosting ---
        for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
            raw = tag.get_text(strip=True)
            if not raw:
                continue
            try:
                data = json.loads(raw)
            except Exception:
                continue

            candidates = data if isinstance(data, list) else [data]
            for c in candidates:
                if not isinstance(c, dict):
                    continue
                # Handle @graph wrapper
                if "@graph" in c and isinstance(c["@graph"], list):
                    candidates.extend([x for x in c["@graph"] if isinstance(x, dict)])
                    continue

                t = str(c.get("@type") or "")
                if "JobPosting" not in t:
                    continue

                out["title"] = out["title"] or (c.get("title") or c.get("name"))

                org = c.get("hiringOrganization")
                if isinstance(org, dict):
                    out["company"] = out["company"] or org.get("name")

                loc = c.get("jobLocation")
                # Can be dict or list of dicts
                loc0 = None
                if isinstance(loc, list) and loc:
                    loc0 = loc[0]
                elif isinstance(loc, dict):
                    loc0 = loc
                if isinstance(loc0, dict):
                    addr = loc0.get("address")
                    if isinstance(addr, dict):
                        city = addr.get("addressLocality")
                        region = addr.get("addressRegion")
                        country = addr.get("addressCountry")
                        parts = [p for p in [city, region, country] if p]
                        if parts:
                            out["location"] = out["location"] or ", ".join(map(str, parts))

                desc = c.get("description")
                if isinstance(desc, str) and desc.strip():
                    # JSON-LD description is often HTML; strip tags quickly
                    out["description"] = out["description"] or BeautifulSoup(desc, "html.parser").get_text(" ", strip=True)

                base_salary = c.get("baseSalary")
                if isinstance(base_salary, dict):
                    val = base_salary.get("value")
                    if isinstance(val, dict):
                        mn = val.get("minValue")
                        mx = val.get("maxValue")
                        cur = val.get("currency")
                        if mn or mx:
                            out["salary_hint"] = out["salary_hint"] or f"{cur or ''} {mn or ''}-{mx or ''}".strip()

        # --- OpenGraph / meta fallback ---
        out["title"] = out["title"] or meta("og:title")
        out["description"] = out["description"] or meta("og:description") or meta_name("description")
        out["company"] = out["company"] or meta("og:site_name")

        return out
