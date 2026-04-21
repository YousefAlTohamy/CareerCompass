"""
ai/canonicalizer.py
===================
Phase 3 — Skill canonicalization.

Unifies common synonym spellings (ReactJS/React.js -> react, Vue.js -> vue)
and applies lightweight fuzzy matching against a known skill list to reduce
near-duplicate variants.
"""

from __future__ import annotations

import logging
import os
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)


_MANUAL_MAP: dict[str, str] = {
    "reactjs": "react",
    "react.js": "react",
    "react js": "react",
    "vuejs": "vue",
    "vue.js": "vue",
    "vue js": "vue",
    "nodejs": "node.js",
    "nextjs": "next.js",
    "nuxtjs": "nuxt.js",
    "expressjs": "express",
    "express.js": "express",
    "dotnet": ".net",
    "asp net": "asp.net",
    "asp.net core": "asp.net core",
}


def _norm(s: str) -> str:
    return " ".join(s.strip().lower().split())


class SkillCanonicalizer:
    def __init__(self, known_skills: list[str] | None = None) -> None:
        self._known = [_norm(s) for s in (known_skills or []) if s]
        self._min_ratio = float(os.getenv("SKILL_CANON_MIN_RATIO", "0.88"))

    def canonicalize(self, skill: str) -> str:
        raw = _norm(skill)
        if not raw:
            return raw

        mapped = _MANUAL_MAP.get(raw, raw)

        # If we have a known list, fuzzy-match to the closest canonical term.
        if self._known:
            best = mapped
            best_ratio = 0.0
            for k in self._known:
                r = SequenceMatcher(None, mapped, k).ratio()
                if r > best_ratio:
                    best_ratio = r
                    best = k
            if best_ratio >= self._min_ratio:
                return best

        return mapped

    def canonicalize_many(self, skills: list[str]) -> list[str]:
        out: list[str] = []
        seen: set[str] = set()
        for s in skills:
            c = self.canonicalize(s)
            if c and c not in seen:
                out.append(c)
                seen.add(c)
        return out

