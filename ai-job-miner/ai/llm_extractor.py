"""
ai/llm_extractor.py
===================
Phase 3 — Hybrid extraction fallback.

If heuristic extraction is low-quality, send a compact prompt to an LLM
and parse a JSON response with:
title, company, location, description, salary_range
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

from bs4 import BeautifulSoup

from ai.llm_client import LlmClient

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class QualityThreshold:
    min_title_len: int = 4
    min_company_len: int = 2
    min_description_len: int = 120


def _clean_text(s: str) -> str:
    s = s.strip()
    s = re.sub(r"\s+", " ", s)
    return s


def html_to_compact_text(html: str, max_chars: int = 6000) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(["script", "style", "noscript", "svg"]):
        tag.decompose()
    text = soup.get_text(" ", strip=True)
    text = _clean_text(text)
    return text[:max_chars]


class LlmFallbackExtractor:
    def __init__(self, client: LlmClient, threshold: QualityThreshold | None = None) -> None:
        self._client = client
        self._th = threshold or QualityThreshold()

    def needs_fallback(self, title: str | None, company: str | None, description: str | None) -> bool:
        title_ok = bool(title and len(title.strip()) >= self._th.min_title_len)
        company_ok = bool(company and len(company.strip()) >= self._th.min_company_len)
        desc_ok = bool(description and len(description.strip()) >= self._th.min_description_len)
        return not (title_ok and company_ok and desc_ok)

    async def extract(self, url: str, html: str) -> dict[str, Any] | None:
        if not self._client.enabled:
            return None

        compact = html_to_compact_text(html)

        prompt = (
            "Extract structured fields from the following job posting content.\n"
            "Return ONLY valid JSON with these keys:\n"
            "title, company, location, description, salary_range\n\n"
            "Rules:\n"
            "- If a field is unknown, use null.\n"
            "- description should be a clean plain-text summary of the role (not HTML).\n"
            "- salary_range should be a short string if present (e.g. '$80k-$110k') else null.\n\n"
            f"URL: {url}\n"
            "CONTENT:\n"
            f"{compact}\n"
        )

        data = await self._client.extract_json(prompt)
        if not isinstance(data, dict):
            return None

        # Normalize expected keys
        out: dict[str, Any] = {}
        for k in ("title", "company", "location", "description", "salary_range"):
            v = data.get(k)
            if isinstance(v, str):
                v = _clean_text(v)
            out[k] = v

        logger.info("[LLM] Fallback extracted fields for %s", url)
        return out

