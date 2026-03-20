from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Callable, Dict, Iterable, List, Literal, Optional, Sequence, Tuple, Union

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


class SemanticSegmenter:
    """
    Splits ordered CV text into semantic sections using header heuristics.

    SRP: classify and group lines into section blocks ONLY.
    No skill extraction, date parsing, or entity recognition here.

    Architecture-ready: pass a custom `header_resolver` later (e.g., embeddings-based),
    without changing the `segment(...)` interface.
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
    ) -> None:
        self._required_sections: Tuple[SectionType, ...] = tuple(
            required_sections or self._DEFAULT_REQUIRED
        )
        self._header_resolver = header_resolver
        self._max_header_len = max(20, int(max_header_len))

        self._compiled = _HeaderPatterns.compile()

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

        return None


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

