from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import (
    Any,
    Callable,
    Dict,
    Iterable,
    List,
    Literal,
    Optional,
    Sequence,
    Tuple,
    Union,
)

import numpy as np

logger = logging.getLogger(__name__)


SectionType = Literal[
    "profile_summary",
    "experience",
    "education",
    "skills",
    "projects",
    "uncategorized",
]


@dataclass(frozen=True, slots=True)
class SectionBlock:
    section: SectionType
    lines: Tuple[str, ...]
    header_line: Optional[str]
    confidence_score: float
    start_line_idx: int
    end_line_idx: int

    @property
    def text(self) -> str:
        return "\n".join(self.lines).strip()


@dataclass(frozen=True, slots=True)
class SegmentationAnalysis:
    found_sections: Tuple[SectionType, ...]
    sections_missing: Tuple[SectionType, ...]
    header_hits: Tuple[Tuple[int, str, SectionType, float], ...]
    anomalies: Tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class SegmentationResult:
    blocks: Tuple[SectionBlock, ...]
    sections: Dict[SectionType, str]
    analysis: SegmentationAnalysis


HeaderResolver = Callable[[str], Optional[Tuple[SectionType, float]]]

# ---------------------------------------------------------------------------
# Reference phrases for semantic header matching
# ---------------------------------------------------------------------------
# Each SectionType maps to several representative phrases that MiniLM will
# embed once during __init__.  At detection time, the candidate line's
# embedding is compared against these references via cosine similarity.

_SECTION_REFERENCE_PHRASES: Dict[SectionType, List[str]] = {
    "profile_summary": [
        "Professional Summary",
        "About Me",
        "Career Summary",
        "Career Objective",
        "Profile Overview",
        "Personal Statement",
        "Executive Summary",
    ],
    "experience": [
        "Work Experience",
        "Professional Experience",
        "Employment History",
        "Career History",
        "Work History",
        "Relevant Experience",
    ],
    "education": [
        "Education",
        "Academic Background",
        "Academic Qualifications",
        "Educational Background",
        "Degrees and Certifications",
    ],
    "skills": [
        "Technical Skills",
        "Core Competencies",
        "Skills and Technologies",
        "Areas of Expertise",
        "Key Skills",
        "Professional Skills",
        "Tools and Technologies",
    ],
    "projects": [
        "Projects",
        "Selected Projects",
        "Project Experience",
        "Portfolio",
        "Academic Projects",
        "Personal Projects",
    ],
}


class SemanticSegmenter:
    """
    Splits ordered CV text into semantic sections using header heuristics.

    SRP: classify and group lines into section blocks ONLY.
    No skill extraction, date parsing, or entity recognition here.

    Phase 3 enhancement: if an optional ``SemanticEmbedder`` is provided,
    non-standard headers that fail exact/regex matching are resolved via
    cosine similarity against pre-computed reference embeddings.
    """

    _DEFAULT_REQUIRED: Tuple[SectionType, ...] = (
        "profile_summary",
        "experience",
        "education",
        "skills",
        "projects",
    )

    def __init__(
        self,
        *,
        required_sections: Optional[Sequence[SectionType]] = None,
        header_resolver: Optional[HeaderResolver] = None,
        max_header_len: int = 80,
        embedder: Any = None,
        semantic_header_threshold: float = 0.82,
    ) -> None:
        self._required_sections: Tuple[SectionType, ...] = tuple(
            required_sections or self._DEFAULT_REQUIRED
        )
        self._header_resolver = header_resolver
        self._max_header_len = max(20, int(max_header_len))
        self._semantic_threshold = float(semantic_header_threshold)

        self._compiled = _HeaderPatterns.compile()

        # -- Phase 3: Semantic header resolution --------------------------
        self._embedder = embedder
        # Pre-computed reference embeddings keyed by SectionType.
        # Each value is a 2-D numpy array of shape (N, dim).
        self._ref_embeddings: Dict[SectionType, np.ndarray] = {}
        self._ref_sections: List[SectionType] = []
        if self._embedder is not None:
            self._precompute_reference_embeddings()

    # ------------------------------------------------------------------
    # Pre-computation (runs once at init, not per CV)
    # ------------------------------------------------------------------

    def _precompute_reference_embeddings(self) -> None:
        """Embed all reference phrases for each section type."""
        try:
            for section, phrases in _SECTION_REFERENCE_PHRASES.items():
                vecs: List[np.ndarray] = []
                for phrase in phrases:
                    vec = self._embedder.get_embedding(phrase)
                    if vec is not None and np.any(vec != 0):
                        vecs.append(vec)
                if vecs:
                    self._ref_embeddings[section] = np.stack(vecs)
                    self._ref_sections.append(section)
            logger.info(
                "Semantic header references pre-computed for %d section types.",
                len(self._ref_embeddings),
            )
        except Exception as e:
            logger.warning("Failed to pre-compute semantic header embeddings: %s", e)
            self._ref_embeddings = {}
            self._ref_sections = []

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def segment(self, text_or_lines: Union[str, Iterable[str]]) -> SegmentationResult:
        lines = _normalize_to_lines(text_or_lines)
        if not lines:
            analysis = SegmentationAnalysis(
                found_sections=(),
                sections_missing=self._required_sections,
                header_hits=(),
                anomalies=("empty_input",),
            )
            return SegmentationResult(blocks=(), sections={}, analysis=analysis)

        header_hits: List[Tuple[int, str, SectionType, float]] = []
        blocks: List[SectionBlock] = []
        anomalies: List[str] = []

        current_section: SectionType = "profile_summary"
        current_header: Optional[str] = None
        current_conf: float = 0.35
        buf: List[str] = []
        start_idx = 0

        def flush(end_idx_exclusive: int) -> None:
            nonlocal buf, start_idx, current_header, current_conf, current_section
            if not buf:
                start_idx = end_idx_exclusive
                return
            block_lines = tuple(buf)
            blocks.append(
                SectionBlock(
                    section=current_section,
                    lines=block_lines,
                    header_line=current_header,
                    confidence_score=float(max(0.0, min(1.0, current_conf))),
                    start_line_idx=start_idx,
                    end_line_idx=end_idx_exclusive - 1,
                )
            )
            buf = []
            start_idx = end_idx_exclusive

        for i, raw in enumerate(lines):
            line = raw.strip()
            if not line:
                # Preserve paragraph structure inside sections, but don't let blank lines
                # create empty blocks or confuse header detection.
                if buf and (len(buf) == 0 or buf[-1] != ""):
                    buf.append("")
                continue

            detected = self._detect_header(line)
            if detected is not None:
                next_section, conf = detected

                # Guard against over-triggering on short bullet-like lines
                if _looks_like_bullet(line) and next_section != "skills":
                    buf.append(line)
                    continue

                flush(i)
                current_section = next_section
                current_header = line
                current_conf = conf
                header_hits.append((i, line, next_section, conf))
                continue

            buf.append(line)

        flush(len(lines))

        if not header_hits:
            # Robust fallback: continuous text with no headers.
            # Keep everything in profile_summary; don't fail.
            all_text = "\n".join([ln for ln in lines if ln.strip()])
            block = SectionBlock(
                section="profile_summary",
                lines=tuple(all_text.splitlines()),
                header_line=None,
                confidence_score=0.25,
                start_line_idx=0,
                end_line_idx=max(0, len(lines) - 1),
            )
            blocks = [block]
            anomalies.append("no_headers_detected")

        if len(header_hits) > 18:
            logger.warning("Unusually high number of section headers detected: %d", len(header_hits))
            anomalies.append("many_headers_detected")

        sections_text = _merge_blocks(blocks)
        found = tuple(sorted({b.section for b in blocks}))
        missing = tuple(s for s in self._required_sections if s not in sections_text or not sections_text[s].strip())

        analysis = SegmentationAnalysis(
            found_sections=found,
            sections_missing=missing,
            header_hits=tuple(header_hits),
            anomalies=tuple(anomalies),
        )
        return SegmentationResult(blocks=tuple(blocks), sections=sections_text, analysis=analysis)

    # ------------------------------------------------------------------
    # Header detection  (exact → regex → semantic)
    # ------------------------------------------------------------------

    def _detect_header(self, line: str) -> Optional[Tuple[SectionType, float]]:
        if len(line) > self._max_header_len:
            return None

        # Optional external resolver (future embeddings-based disambiguation).
        if self._header_resolver is not None:
            try:
                resolved = self._header_resolver(line)
            except Exception as e:
                logger.exception("Header resolver failed: %s", e)
                resolved = None
            if resolved is not None:
                sec, conf = resolved
                return sec, float(max(0.0, min(1.0, conf)))

        normalized = _normalize_header_candidate(line)
        if not normalized:
            return None

        # Exact match (highest confidence).
        exact = self._compiled.exact.get(normalized)
        if exact is not None:
            return exact, 0.99

        # Regex / fuzzy header detection.
        for section, rx in self._compiled.regex_order:
            if rx.fullmatch(normalized):
                return section, 0.95
            if rx.search(normalized):
                return section, 0.85

        # Phase 3: Semantic fallback — only if embedder and references exist.
        if self._embedder is not None and self._ref_embeddings:
            semantic_result = self._semantic_header_match(line)
            if semantic_result is not None:
                return semantic_result

        return None

    def _semantic_header_match(
        self, line: str
    ) -> Optional[Tuple[SectionType, float]]:
        """
        Embed the candidate line and compare against pre-computed reference
        embeddings for each section type via cosine similarity.

        Returns (SectionType, confidence) if the best match exceeds the
        configured threshold, else None.
        """
        try:
            candidate_vec = self._embedder.get_embedding(line)
        except Exception as e:
            logger.debug("Semantic embedding failed for header candidate: %s", e)
            return None

        if candidate_vec is None or np.all(candidate_vec == 0):
            return None

        best_section: Optional[SectionType] = None
        best_score: float = 0.0

        for section, ref_matrix in self._ref_embeddings.items():
            # Cosine similarity against each reference phrase, take max.
            similarities = _cosine_similarity_batch(candidate_vec, ref_matrix)
            max_sim = float(np.max(similarities))
            if max_sim > best_score:
                best_score = max_sim
                best_section = section

        if best_section is not None and best_score >= self._semantic_threshold:
            # Cap confidence slightly below regex-level to reflect uncertainty.
            confidence = min(0.90, best_score)
            logger.debug(
                "Semantic header match: '%s' → %s (sim=%.3f)",
                line,
                best_section,
                best_score,
            )
            return best_section, confidence

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
    # Avoid division by zero
    row_norms = np.where(row_norms == 0, 1.0, row_norms)
    dots = matrix @ vec
    return dots / (row_norms * vec_norm)


# ---------------------------------------------------------------------------
# Header pattern tables (unchanged from original)
# ---------------------------------------------------------------------------

class _HeaderPatterns:
    """
    Compiled header patterns. Normalization is applied before matching.
    """

    def __init__(
        self,
        exact: Dict[str, SectionType],
        regex_order: List[Tuple[SectionType, re.Pattern[str]]],
    ) -> None:
        self.exact = exact
        self.regex_order = regex_order

    @staticmethod
    def compile() -> "_HeaderPatterns":
        # All keys must be already normalized via `_normalize_header_candidate`.
        exact: Dict[str, SectionType] = {
            "summary": "profile_summary",
            "profile": "profile_summary",
            "about": "profile_summary",
            "about me": "profile_summary",
            "professional summary": "profile_summary",
            "career summary": "profile_summary",
            "work experience": "experience",
            "experience": "experience",
            "employment history": "experience",
            "professional experience": "experience",
            "education": "education",
            "academic background": "education",
            "technical skills": "skills",
            "skills": "skills",
            "core skills": "skills",
            "key skills": "skills",
            "projects": "projects",
            "project experience": "projects",
            "selected projects": "projects",
        }

        def rx(*alts: str) -> re.Pattern[str]:
            joined = "|".join(alts)
            return re.compile(rf"(?:{joined})", re.IGNORECASE)

        # Order matters: more specific first.
        regex_order: List[Tuple[SectionType, re.Pattern[str]]] = [
            (
                "experience",
                rx(
                    r"\bwork experience\b",
                    r"\bprofessional experience\b",
                    r"\bemployment history\b",
                    r"\bexperience\b",
                    r"\bcareer history\b",
                ),
            ),
            (
                "education",
                rx(
                    r"\beducation\b",
                    r"\bacademic\b",
                    r"\bacademic background\b",
                    r"\bqualifications\b",
                ),
            ),
            (
                "skills",
                rx(
                    r"\btechnical skills\b",
                    r"\bskills\b",
                    r"\bcore competencies\b",
                    r"\bcompetencies\b",
                    r"\btechnologies\b",
                    r"\btools\b",
                ),
            ),
            (
                "projects",
                rx(
                    r"\bprojects\b",
                    r"\bproject experience\b",
                    r"\bselected projects\b",
                    r"\bportfolio\b",
                ),
            ),
            (
                "profile_summary",
                rx(
                    r"\bsummary\b",
                    r"\bprofessional summary\b",
                    r"\bprofile\b",
                    r"\babout\b",
                    r"\bobjective\b",
                ),
            ),
        ]

        # Normalize the exact dict keys once.
        exact_norm = {_normalize_header_candidate(k): v for k, v in exact.items()}
        return _HeaderPatterns(exact=exact_norm, regex_order=regex_order)


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

_HEADER_SANITIZE_RE = re.compile(r"[\s\-\–\—\|\:\•\·\*\u2022]+")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9 ]+")


def _normalize_to_lines(text_or_lines: Union[str, Iterable[str]]) -> List[str]:
    if isinstance(text_or_lines, str):
        raw_lines = text_or_lines.splitlines()
    else:
        raw_lines = list(text_or_lines)
    # Keep original order but strip right-side whitespace noise.
    return [ln.rstrip("\r\n\t ") for ln in raw_lines]


def _normalize_header_candidate(line: str) -> str:
    """
    Normalizes a candidate header line to make matching robust:
    - lowercase
    - collapse separators
    - drop non-alphanumeric noise (keeps spaces)
    """
    s = line.strip().lower()
    if not s:
        return ""
    s = _HEADER_SANITIZE_RE.sub(" ", s)
    s = _NON_ALNUM_RE.sub("", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _looks_like_bullet(line: str) -> bool:
    s = line.lstrip()
    return bool(re.match(r"^(?:[\-\*\u2022•·]|[0-9]{1,2}[.)])\s+\S+", s))


def _merge_blocks(blocks: Sequence[SectionBlock]) -> Dict[SectionType, str]:
    merged: Dict[SectionType, List[str]] = {}
    for b in blocks:
        if not b.text.strip():
            continue
        merged.setdefault(b.section, [])
        merged[b.section].append(b.text)

    return {k: "\n\n".join(v).strip() for k, v in merged.items()}
