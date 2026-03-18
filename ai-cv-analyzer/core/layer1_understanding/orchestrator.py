from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, List, Optional, Sequence, Tuple

from core.layer1_understanding.advanced_ner import AdvancedNEREngine
from core.layer1_understanding.canonicalizer import DataCanonicalizer
from core.layer1_understanding.experience_engine import ExperienceEngine
from core.layer1_understanding.schema import (
    AnalysisSection,
    CVParseResult,
    DocumentStats,
    ExperienceItem,
    ExperienceSection,
    Profile,
    SkillItem,
    SkillsSection,
)
from core.layer1_understanding.section_segmenter import SemanticSegmenter
from core.layer1_understanding.spatial_parser import SpatialTextExtraction, extract_spatial_text_from_pdf

logger = logging.getLogger(__name__)


_WORD_RE = re.compile(r"\S+")


@dataclass(frozen=True, slots=True)
class OrchestratorConfig:
    canonical_fuzzy_threshold: int = 86
    ner_context_window_words: int = 3


class CVOrchestrator:
    """
    Facade entry point for the V2 CV pipeline (Phases 1-4).
    """

    def __init__(self, *, config: Optional[OrchestratorConfig] = None) -> None:
        self._config = config or OrchestratorConfig()

        self._segmenter = SemanticSegmenter()
        self._ner = AdvancedNEREngine()
        self._experience = ExperienceEngine()
        self._canonicalizer = DataCanonicalizer(fuzzy_threshold=self._config.canonical_fuzzy_threshold)

    def process_cv(self, pdf_bytes: bytes, filename: Optional[str] = None) -> CVParseResult:
        """
        Returns the strict `CVParseResult` model (always).
        """
        if filename:
            logger.info("V2 orchestrator processing file: %s", filename)
        spatial: SpatialTextExtraction = extract_spatial_text_from_pdf(pdf_bytes)

        if spatial.status in ("no_text", "error") or not spatial.text:
            status = "empty_file" if spatial.status == "no_text" else "error"
            logger.info("V2 orchestrator: spatial extraction status=%s", spatial.status)
            return self._empty_result(
                parsing_status=status,
                page_count=spatial.page_count,
            )

        ordered_text = spatial.text
        segments = self._segmenter.segment(ordered_text)

        # Name + title heuristics from profile-ish area first.
        profile_text = segments.sections.get("profile_summary") or segments.sections.get("uncategorized") or ordered_text
        name_candidate = self._ner.extract_candidate_name(profile_text)

        # NER entities over the whole ordered text (best recall), then canonicalize skills.
        entities = self._ner.extract_entities(
            ordered_text,
            context_window_words=self._config.ner_context_window_words,
        )

        # Canonicalization with provenance: skills can come from multiple sections later.
        skills_raw = entities.get("skills", [])
        canonical_skills = self._canonicalizer.canonicalize_skills(
            skills_raw,
            skill_confidence=0.78,
            source="ner",
        )

        skill_items: List[SkillItem] = []
        for sk in canonical_skills:
            evidence = ", ".join(sk.sources) if sk.sources else None
            skill_items.append(
                SkillItem(
                    name=sk.name,
                    confidence_score=sk.confidence_score,
                    category="hard",
                    evidence=evidence,
                )
            )

        skills_section = SkillsSection(
            items=skill_items,
            confidence_score=_aggregate_confidence([s.confidence_score for s in canonical_skills], default=0.0),
        )

        # Experience: temporal total years + best current title guess.
        exp_text = segments.sections.get("experience", "")
        total_years = self._experience.calculate_total_experience_years(exp_text) if exp_text else 0.0

        current_title = self._rank_current_title(exp_text) or (entities.get("roles") or [None])[0]

        experience_items = self._build_experience_items(exp_text)
        experience_section = ExperienceSection(
            items=experience_items,
            confidence_score=_aggregate_confidence(
                [it.confidence_score for it in experience_items],
                default=0.0,
            ),
        )

        stats = DocumentStats(
            page_count=spatial.page_count,
            char_count=len(ordered_text),
            word_count=_count_words(ordered_text),
            language_hint=None,
        )

        profile = Profile(
            full_name=name_candidate.full_name if name_candidate else None,
            current_title=current_title,
            headline=None,
            summary=segments.sections.get("profile_summary"),
            confidence_score=name_candidate.confidence_score if name_candidate else 0.0,
        )

        analysis = AnalysisSection(
            summary=None,
            predicted_role=current_title,
            seniority=None,
            primary_domain=None,
            strengths=[],
            gaps=[],
            red_flags=[],
            confidence_score=_aggregate_confidence(
                [skills_section.confidence_score, experience_section.confidence_score],
                default=0.0,
            ),
            metadata={
                "segmentation": {
                    "found_sections": list(segments.analysis.found_sections),
                    "sections_missing": list(segments.analysis.sections_missing),
                    "anomalies": list(segments.analysis.anomalies),
                },
                "experience": {
                    "total_experience_years": total_years,
                },
                "extraction": {
                    "spatial_status": spatial.status,
                    "word_count_spatial": spatial.word_count,
                },
            },
        )

        return CVParseResult(
            parsing_status="success",
            profile=profile,
            stats=stats,
            skills=skills_section,
            experience=experience_section,
            analysis=analysis,
        )

    def _empty_result(self, *, parsing_status: str, page_count: int) -> CVParseResult:
        return CVParseResult(
            parsing_status=parsing_status,  # type: ignore[arg-type]
            profile=Profile(),
            stats=DocumentStats(page_count=page_count, char_count=0, word_count=0, language_hint=None),
            skills=SkillsSection(items=[], confidence_score=0.0),
            experience=ExperienceSection(items=[], confidence_score=0.0),
            analysis=AnalysisSection(
                summary=None,
                predicted_role=None,
                seniority=None,
                primary_domain=None,
                strengths=[],
                gaps=[],
                red_flags=[],
                confidence_score=0.0,
                metadata={"reason": parsing_status},
            ),
        )

    def _build_experience_items(self, experience_text: str) -> List[ExperienceItem]:
        """
        Phase-3-lite: populate only temporal fields + raw bullets as description.
        (No company/title extraction beyond heuristics; Phase 5+ can improve.)
        """
        if not experience_text.strip():
            return []

        ranges = self._experience.extract_date_ranges(experience_text)
        merged = _merge_best_ranges(ranges)

        items: List[ExperienceItem] = []
        for r in merged:
            items.append(
                ExperienceItem(
                    title=None,
                    company=None,
                    location=None,
                    start_date=r.start,
                    end_date=r.end,
                    is_current=(r.end == date.today()),
                    description=_extract_bullets(experience_text),
                    technologies=[],
                    confidence_score=0.80,
                )
            )

        # If we couldn't detect ranges, still return a single textual item.
        if not items:
            items.append(
                ExperienceItem(
                    title=None,
                    company=None,
                    location=None,
                    start_date=None,
                    end_date=None,
                    is_current=None,
                    description=_extract_bullets(experience_text),
                    technologies=[],
                    confidence_score=0.45,
                )
            )

        return items

    def _rank_current_title(self, experience_text: str) -> Optional[str]:
        """
        Title ranking strategy:
        Prefer the title near the most recent date range, otherwise best-looking leading line.
        """
        if not experience_text.strip():
            return None

        lines = [ln.strip() for ln in experience_text.splitlines() if ln.strip()]
        if not lines:
            return None

        ranges = self._experience.extract_date_ranges(experience_text)
        if ranges:
            # Pick range with latest end date and then take the nearest preceding non-date line as "title".
            best = max(ranges, key=lambda r: r.end)
            idx = experience_text.lower().find(best.source_text.lower())
            if idx >= 0:
                prefix = experience_text[:idx]
                prefix_lines = [ln.strip() for ln in prefix.splitlines() if ln.strip()]
                for ln in reversed(prefix_lines[-6:]):
                    if not _looks_like_date_line(ln):
                        title = _clean_title_line(ln)
                        if title:
                            return title

        # Fallback: first plausible line in experience section.
        for ln in lines[:6]:
            if _looks_like_date_line(ln):
                continue
            title = _clean_title_line(ln)
            if title:
                return title
        return None


def _count_words(text: str) -> int:
    return len(_WORD_RE.findall(text or ""))


def _aggregate_confidence(values: Sequence[float], *, default: float) -> float:
    vals = [v for v in values if isinstance(v, (int, float)) and v > 0]
    if not vals:
        return float(default)
    return float(min(1.0, sum(vals) / len(vals)))


_DATEY_RE = re.compile(r"\b(?:\d{4}|present|current|now|today|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b", re.IGNORECASE)


def _looks_like_date_line(line: str) -> bool:
    return bool(_DATEY_RE.search(line))


def _clean_title_line(line: str) -> Optional[str]:
    s = re.sub(r"\s+", " ", line).strip(" -–—|•·*:")
    if not s or len(s) > 80:
        return None
    # Reject if it is clearly a header word.
    lowered = s.lower()
    if lowered in {"experience", "work experience", "employment history"}:
        return None
    # If it contains too many digits, it isn't a title.
    if sum(ch.isdigit() for ch in s) >= 4:
        return None
    return s


_BULLET_RE = re.compile(r"^\s*(?:[\-\*\u2022•·]|[0-9]{1,2}[.)])\s+")


def _extract_bullets(text: str) -> List[str]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    bullets: List[str] = []
    for ln in lines:
        ln2 = _BULLET_RE.sub("", ln).strip()
        if ln2 and ln2 != ln:
            bullets.append(ln2)
    if bullets:
        return bullets[:30]
    return lines[:30]


def _merge_best_ranges(ranges) -> List[Any]:
    # Keep unique ranges by (start,end), prefer longer spans.
    if not ranges:
        return []
    uniq: Dict[Tuple[date, date], Any] = {}
    for r in ranges:
        key = (r.start, r.end)
        if key not in uniq:
            uniq[key] = r
            continue
        existing = uniq[key]
        # Same key; keep the one with longer source text as a mild proxy for quality.
        if len(getattr(r, "source_text", "")) > len(getattr(existing, "source_text", "")):
            uniq[key] = r
    return sorted(uniq.values(), key=lambda x: (x.start, x.end))

