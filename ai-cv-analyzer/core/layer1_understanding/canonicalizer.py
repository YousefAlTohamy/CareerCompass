from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

import numpy as np

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
    Canonicalizes extracted skills using optional fuzzy matching and
    optional semantic (embedding-based) matching.

    SRP: normalize + deduplicate + attach lightweight provenance.
    """

    def __init__(
        self,
        *,
        standard_skills: Optional[Mapping[str, str]] = None,
        fuzzy_threshold: int = 86,
        embedder: Any = None,
        semantic_skill_threshold: float = 0.85,
    ) -> None:
        # mapping raw_variant -> canonical
        self._standard_map: Dict[str, str] = {k: v for k, v in (standard_skills or _DEFAULT_SKILL_MAP).items()}
        self._keys_norm: Dict[str, str] = {_norm(k): k for k in self._standard_map.keys()}
        self._fuzzy_threshold = int(fuzzy_threshold)

        # Build canonical set for fallback matching
        self._canonical_values = sorted(set(self._standard_map.values()))

        # -- Phase 3: Semantic skill matching --
        self._embedder = embedder
        self._semantic_threshold = float(semantic_skill_threshold)

        # Pre-computed embeddings for canonical skill names.
        # Shape: (N, dim) where N = len(_canonical_values)
        self._canonical_embeddings: Optional[np.ndarray] = None
        self._canonical_names_ordered: List[str] = []

        if self._embedder is not None:
            self._precompute_canonical_embeddings()

    # ------------------------------------------------------------------
    # Pre-computation (runs once, not per CV)
    # ------------------------------------------------------------------

    def _precompute_canonical_embeddings(self) -> None:
        """Embed each canonical skill name once and stack into a matrix."""
        try:
            vecs: List[np.ndarray] = []
            names: List[str] = []
            for name in self._canonical_values:
                vec = self._embedder.get_embedding(name)
                if vec is not None and np.any(vec != 0):
                    vecs.append(vec)
                    names.append(name)
            if vecs:
                self._canonical_embeddings = np.stack(vecs)
                self._canonical_names_ordered = names
                logger.info(
                    "Semantic skill embeddings pre-computed for %d canonical skills.",
                    len(names),
                )
        except Exception as e:
            logger.warning("Failed to pre-compute semantic skill embeddings: %s", e)
            self._canonical_embeddings = None
            self._canonical_names_ordered = []

    # ------------------------------------------------------------------
    # Public API  (unchanged signatures)
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # Skill mapping  (exact → fuzzy → semantic)
    # ------------------------------------------------------------------

    def _map_skill(self, raw: str) -> Tuple[Optional[str], float]:
        """
        Map raw -> canonical with confidence.

        Resolution order:
        1. Exact variant match       (conf 0.99)
        2. Exact canonical match     (conf 0.97)
        3. RapidFuzz fuzzy match     (conf ~0.70-0.95)
        4. Normalized key fallback   (conf 0.90)
        5. Semantic embedding match  (conf ~0.80-0.90)  ← Phase 3
        6. Pass-through              (conf 0.60)
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

        # Phase 3: Semantic embedding fallback
        semantic_result = self._semantic_skill_match(cleaned)
        if semantic_result is not None:
            return semantic_result

        return cleaned, 0.60

    def _semantic_skill_match(
        self, raw_skill: str
    ) -> Optional[Tuple[str, float]]:
        """
        Embed the raw skill and compare against pre-computed canonical skill
        embeddings via cosine similarity.

        Returns (canonical_name, confidence) if the best match exceeds the
        configured threshold, else None.
        """
        if (
            self._embedder is None
            or self._canonical_embeddings is None
            or len(self._canonical_names_ordered) == 0
        ):
            return None

        try:
            raw_vec = self._embedder.get_embedding(raw_skill)
        except Exception as e:
            logger.debug("Semantic embedding failed for skill %r: %s", raw_skill, e)
            return None

        if raw_vec is None or np.all(raw_vec == 0):
            return None

        # Cosine similarity against all canonical embeddings
        similarities = _cosine_similarity_batch(raw_vec, self._canonical_embeddings)
        best_idx = int(np.argmax(similarities))
        best_score = float(similarities[best_idx])

        if best_score >= self._semantic_threshold:
            canonical_name = self._canonical_names_ordered[best_idx]
            # Confidence caps at 0.90 since semantic is less certain than exact/fuzzy
            confidence = min(0.90, max(0.80, best_score))
            logger.debug(
                "Semantic skill match: '%s' → '%s' (sim=%.3f)",
                raw_skill,
                canonical_name,
                best_score,
            )
            return canonical_name, confidence

        return None


# ---------------------------------------------------------------------------
# Cosine similarity helpers
# ---------------------------------------------------------------------------

def _cosine_similarity_batch(vec: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """
    Compute cosine similarity between a single vector and each row of a matrix.
    Returns a 1-D array of similarities.
    """
    vec_norm = np.linalg.norm(vec)
    if vec_norm == 0:
        return np.zeros(matrix.shape[0])
    row_norms = np.linalg.norm(matrix, axis=1)
    row_norms = np.where(row_norms == 0, 1.0, row_norms)
    dots = matrix @ vec
    return dots / (row_norms * vec_norm)


# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------

_NORM_RE = re.compile(r"[^a-z0-9\+\#\.]+")


def _norm(s: str) -> str:
    """Generic normalization: lowercase, strip, remove special chars."""
    s = s.lower().strip()
    s = _NORM_RE.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


# Empty by default to be industry-agnostic. 
# Can be populated via config files for specific domains.
_DEFAULT_SKILL_MAP: Dict[str, str] = {}
