from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Dict, List, Mapping, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)

try:
    from rapidfuzz import fuzz, process  # type: ignore

    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    RAPIDFUZZ_AVAILABLE = False


@dataclass(frozen=True, slots=True)
class CanonicalSkill:
    name: str
    confidence_score: float
    sources: Tuple[str, ...] = ()
    raw_variants: Tuple[str, ...] = ()


class DataCanonicalizer:
    """
    Canonicalizes extracted skills using optional fuzzy matching.

    SRP: normalize + deduplicate + attach lightweight provenance.
    """

    def __init__(
        self,
        *,
        standard_skills: Optional[Mapping[str, str]] = None,
        fuzzy_threshold: int = 86,
    ) -> None:
        # mapping raw_variant -> canonical
        self._standard_map: Dict[str, str] = {k: v for k, v in (standard_skills or _DEFAULT_SKILL_MAP).items()}
        self._keys_norm: Dict[str, str] = {_norm(k): k for k in self._standard_map.keys()}
        self._fuzzy_threshold = int(fuzzy_threshold)

        # Build canonical set for fallback matching
        self._canonical_values = sorted(set(self._standard_map.values()))

    def canonicalize_skills(
        self,
        raw_skills: Sequence[str],
        *,
        skill_confidence: float = 0.75,
        source: str = "unknown",
    ) -> List[CanonicalSkill]:
        """
        Canonicalizes a list of raw skills (single source).
        """
        out: List[CanonicalSkill] = []
        for s in raw_skills:
            if not s or not s.strip():
                continue
            canonical, conf = self._map_skill(s)
            if canonical is None:
                continue
            out.append(
                CanonicalSkill(
                    name=canonical,
                    confidence_score=float(max(0.0, min(1.0, max(skill_confidence, conf)))),
                    sources=(source,),
                    raw_variants=(s.strip(),),
                )
            )
        return self.dedupe_skills(out)

    def canonicalize_skills_multi_source(
        self,
        skills_by_source: Mapping[str, Sequence[Tuple[str, float]]],
    ) -> List[CanonicalSkill]:
        """
        Canonicalizes skills from multiple sources.
        Input: {source_name: [(raw_skill, confidence_score), ...], ...}
        """
        all_items: List[CanonicalSkill] = []
        for src, pairs in skills_by_source.items():
            for raw, conf in pairs:
                if not raw or not raw.strip():
                    continue
                canonical, map_conf = self._map_skill(raw)
                if canonical is None:
                    continue
                all_items.append(
                    CanonicalSkill(
                        name=canonical,
                        confidence_score=float(max(0.0, min(1.0, max(float(conf), map_conf)))),
                        sources=(src,),
                        raw_variants=(raw.strip(),),
                    )
                )
        return self.dedupe_skills(all_items)

    def dedupe_skills(self, items: Sequence[CanonicalSkill]) -> List[CanonicalSkill]:
        """
        Deduplicate by canonical name, keeping highest confidence and unioning sources/variants.
        """
        merged: Dict[str, CanonicalSkill] = {}
        for it in items:
            key = it.name.strip().lower()
            if not key:
                continue
            if key not in merged:
                merged[key] = it
                continue

            existing = merged[key]
            best_conf = max(existing.confidence_score, it.confidence_score)
            sources = tuple(sorted(set(existing.sources).union(it.sources)))
            variants = tuple(sorted(set(existing.raw_variants).union(it.raw_variants)))
            merged[key] = CanonicalSkill(
                name=existing.name,
                confidence_score=best_conf,
                sources=sources,
                raw_variants=variants,
            )

        # Stable output: highest confidence first, then name.
        return sorted(merged.values(), key=lambda x: (-x.confidence_score, x.name.lower()))

    def _map_skill(self, raw: str) -> Tuple[Optional[str], float]:
        """
        Map raw -> canonical with confidence.
        """
        cleaned = raw.strip()
        if not cleaned:
            return None, 0.0

        n = _norm(cleaned)
        # Exact variant match
        original_key = self._keys_norm.get(n)
        if original_key is not None:
            return self._standard_map[original_key], 0.99

        # Exact canonical match (already standard)
        if cleaned in self._canonical_values:
            return cleaned, 0.97

        # Fuzzy match on variants if rapidfuzz is installed.
        if RAPIDFUZZ_AVAILABLE:
            try:
                match = process.extractOne(
                    cleaned,
                    list(self._standard_map.keys()),
                    scorer=fuzz.ratio,
                )
            except Exception as e:
                logger.warning("RapidFuzz matching failed for %r: %s", cleaned, e)
                match = None

            if match:
                best_key, score, _idx = match
                if int(score) >= self._fuzzy_threshold:
                    # Translate score into a probability-ish confidence for mapping itself.
                    map_conf = min(0.95, max(0.70, float(score) / 100.0))
                    return self._standard_map[str(best_key)], map_conf

        # Lightweight fallback: normalize punctuation and compare against normalized keys.
        for key_norm, key in self._keys_norm.items():
            if n == key_norm:
                return self._standard_map[key], 0.90

        return cleaned, 0.60


_NORM_RE = re.compile(r"[^a-z0-9\+\#\.]+")


def _norm(s: str) -> str:
    s = s.lower().strip()
    s = s.replace("vue.js", "vuejs").replace("node.js", "nodejs").replace("react.js", "react")
    s = _NORM_RE.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


_DEFAULT_SKILL_MAP: Dict[str, str] = {
    # JavaScript ecosystem
    "js": "JavaScript",
    "javascript": "JavaScript",
    "react js": "React",
    "reactjs": "React",
    "react": "React",
    "vue": "VueJS",
    "vuejs": "VueJS",
    "vue.js": "VueJS",
    "node": "Node.js",
    "nodejs": "Node.js",
    "node.js": "Node.js",
    "ts": "TypeScript",
    "typescript": "TypeScript",
    # Python ecosystem
    "py": "Python",
    "python": "Python",
    "django": "Django",
    "flask": "Flask",
    "fastapi": "FastAPI",
    # Data / ML
    "ml": "Machine Learning",
    "machine learning": "Machine Learning",
    "deep learning": "Deep Learning",
    "nlp": "NLP",
    "pytorch": "PyTorch",
    "torch": "PyTorch",
    "tensorflow": "TensorFlow",
    "sklearn": "scikit-learn",
    "scikit learn": "scikit-learn",
    "scikit-learn": "scikit-learn",
    # Infra
    "aws": "AWS",
    "azure": "Azure",
    "gcp": "GCP",
    "docker": "Docker",
    "k8s": "Kubernetes",
    "kubernetes": "Kubernetes",
}

