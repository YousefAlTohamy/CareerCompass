"""
ai/canonicalizer.py
===================
Phase 3 — Skill canonicalization.

Unifies common synonym spellings (ReactJS/React.js -> react, Vue.js -> vue)
and applies lightweight fuzzy matching against a known skill list to reduce
near-duplicate variants.
"""

from __future__ import annotations

import os
import json
from difflib import get_close_matches

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
    "javascript": "js",
    "typescript": "ts",
    "dotnet": ".net",
    "asp net": "asp.net",
    "asp.net core": "asp.net core",
}


def _norm(s: str) -> str:
    return " ".join(s.strip().lower().split())


class SkillCanonicalizer:
    def __init__(self, known_skills: list[str] | None = None) -> None:
        # Standard skills should come from a JSON config exported from Laravel.
        # Env: STANDARD_SKILLS_PATH=/path/to/standard_skills.json
        if known_skills is None:
            known_skills = self._load_standard_skills_from_file()
        self._known = sorted({_norm(s) for s in (known_skills or []) if s})
        self._threshold = float(os.getenv("SKILL_MATCH_THRESHOLD", "0.85"))

    def _load_standard_skills_from_file(self) -> list[str]:
        path = os.getenv("STANDARD_SKILLS_PATH", "").strip()
        if not path:
            return []
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                return [str(x) for x in data if str(x).strip()]
            if isinstance(data, dict) and isinstance(data.get("skills"), list):
                return [str(x) for x in data["skills"] if str(x).strip()]
        except Exception:
            return []
        return []

    def canonicalize(self, skill: str) -> str:
        raw = _norm(skill)
        if not raw:
            return raw

        mapped = _MANUAL_MAP.get(raw, raw)

        # Secondary fuzzy match using difflib.get_close_matches
        if self._known and mapped not in self._known:
            matches = get_close_matches(mapped, self._known, n=1, cutoff=self._threshold)
            if matches:
                return matches[0]

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

