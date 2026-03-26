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
from core.layer2_classification.classifier import CVDomainClassifier

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
        # Layer 2: domain classification (singleton — model loaded once).
        self._classifier = CVDomainClassifier()

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
        # NER may prefix taxonomy-confirmed skills with "__TAXONOMY__:" to signal a
        # boosted confidence score of 0.98.
        _TAXONOMY_PREFIX = "__TAXONOMY__:"
        skills_raw_inner = entities.get("skills", [])
        # Separate taxonomy-confirmed from regular; strip the prefix for canonicalization.
        taxonomy_names: set = {
            s[len(_TAXONOMY_PREFIX):].lower()
            for s in skills_raw_inner
            if s.startswith(_TAXONOMY_PREFIX)
        }
        skills_raw = [
            s[len(_TAXONOMY_PREFIX):] if s.startswith(_TAXONOMY_PREFIX) else s
            for s in skills_raw_inner
        ]
        canonical_skills = self._canonicalizer.canonicalize_skills(
            skills_raw,
            skill_confidence=0.78,
            source="ner",
        )

        skill_items: List[SkillItem] = []
        for sk in canonical_skills:
            evidence = ", ".join(sk.sources) if sk.sources else None
            # Taxonomy-verified skills always get confidence 0.98.
            conf = 0.98 if sk.name.lower() in taxonomy_names else sk.confidence_score
            skill_items.append(
                SkillItem(
                    name=sk.name,
                    confidence_score=min(1.0, conf),
                    category="hard",
                    evidence=evidence,
                )
            )

        skills_section = SkillsSection(
            items=skill_items,
            confidence_score=_aggregate_confidence([s.confidence_score for s in canonical_skills], default=0.0),
        )

        # Experience: build items, then derive total years from the items themselves
        # (so current roles are counted correctly via _compute_total_experience_years).
        exp_text = segments.sections.get("experience", "")
        current_title = self._rank_current_title(exp_text) or (entities.get("roles") or [None])[0]

        experience_items = self._build_experience_items(exp_text, predicted_title=current_title)
        experience_section = ExperienceSection(
            items=experience_items,
            confidence_score=_aggregate_confidence(
                [it.confidence_score for it in experience_items],
                default=0.0,
            ),
        )

        total_years = _compute_total_experience_years(experience_items)

        # ── Layer 2: Domain Classification ──────────────────────────────────
        domain_probs = self._classifier.predict_domain(ordered_text)
        primary_domain = _pick_best_domain(domain_probs)

        # ── Seniority ────────────────────────────────────────────────────────
        seniority = _derive_seniority(total_years)

        # ── Strengths: top-5 high-confidence skills ───────────────────────────
        strengths = [
            sk.name
            for sk in sorted(canonical_skills, key=lambda s: s.confidence_score, reverse=True)
            if sk.confidence_score > 0.85
        ][:5]

        # ── Analysis summary prose (seniority-aware) ─────────────────────────
        domain_label = primary_domain or "Technology"
        if seniority in ("intern", "junior"):
            analysis_summary = (
                f"Aspiring {domain_label} professional with foundational experience."
            )
        elif seniority == "senior":
            analysis_summary = (
                f"Expert {domain_label} leader with extensive background in the field."
            )
        else:  # mid
            years_label = f"{total_years:.1f}" if total_years != int(total_years) else str(int(total_years))
            analysis_summary = (
                f"Professional {domain_label} with {years_label} year(s) of experience."
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
            summary=analysis_summary,
            predicted_role=current_title,
            seniority=seniority,
            primary_domain=primary_domain,
            strengths=strengths,
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
                "classification": {
                    "domain_scores": domain_probs,
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

    def _build_experience_items(self, experience_text: str, predicted_title: Optional[str] = None) -> List[ExperienceItem]:
        """
        Phase-4: Advanced Segmentation.
        Splits experience text into blocks by date, then uses NER to extract real
        Company, Location, and Role per block.

        When NER cannot find an ORG in a block, a heuristic fallback scans the
        first few lines of the block for the most likely company name.
        """
        if not experience_text.strip():
            return []

        ranges = self._experience.extract_date_ranges(experience_text)
        merged = _merge_best_ranges(ranges)

        if not merged:
            # Fallback if no dates are found
            entities = self._ner.extract_entities(experience_text)
            comp = (
                entities.get("orgs", [])[0]
                if entities.get("orgs")
                else _guess_company_from_lines(experience_text)
            )
            loc = entities.get("locations", [None])[0] if entities.get("locations") else None
            role = (
                entities.get("roles", [])[0]
                if entities.get("roles")
                else (predicted_title or "Professional Experience")
            )

            return [
                ExperienceItem(
                    title=role,
                    company=comp,
                    location=loc,
                    start_date=None,
                    end_date=None,
                    is_current=None,
                    description=_extract_bullets(experience_text),
                    technologies=[],
                    confidence_score=0.45,
                )
            ]

        # Order ranges by their appearance in the text to chunk the text accurately.
        positioned_ranges = []
        for r in merged:
            idx = experience_text.lower().find(r.source_text.lower())
            positioned_ranges.append((max(0, idx), r))

        positioned_ranges.sort(key=lambda x: x[0])

        items: List[ExperienceItem] = []
        for i, (idx, r) in enumerate(positioned_ranges):
            # Define text block boundaries for this specific experience.
            block_start = 0 if i == 0 else positioned_ranges[i - 1][0] + len(positioned_ranges[i - 1][1].source_text)
            block_end = positioned_ranges[i + 1][0] if i + 1 < len(positioned_ranges) else len(experience_text)

            block_text = experience_text[block_start:block_end].strip()

            # Extract specific entities for THIS block using the initialized NER engine.
            entities = self._ner.extract_entities(block_text)

            # Company: prefer NER org, then heuristic line scan, then generic label.
            comp = (
                entities.get("orgs", [])[0]
                if entities.get("orgs")
                else _guess_company_from_lines(block_text)
            )
            loc = entities.get("locations", [None])[0] if entities.get("locations") else None
            role = (
                entities.get("roles", [])[0]
                if entities.get("roles")
                else (predicted_title or "Professional Experience")
            )

            is_current = r.end >= date.today()

            items.append(
                ExperienceItem(
                    title=role,
                    company=comp,
                    location=loc,
                    start_date=r.start,
                    end_date=None if is_current else r.end,
                    is_current=is_current,
                    description=_extract_bullets(block_text),
                    technologies=[],
                    confidence_score=0.85,
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


# Sentinel keys returned by CVDomainClassifier when the model is unavailable.
_DOMAIN_SENTINEL_KEYS: frozenset = frozenset({"Unknown", "Error"})


def _pick_best_domain(domain_probs: Dict[str, float]) -> Optional[str]:
    """
    Return the domain label with the highest probability score.
    Returns *None* if the result is a sentinel (Unknown / Error) or empty.
    """
    if not domain_probs:
        return None
    best = max(domain_probs, key=lambda k: domain_probs[k])
    if best in _DOMAIN_SENTINEL_KEYS:
        return None
    return best


def _derive_seniority(total_years: float) -> Optional[str]:
    """
    Map total years of experience to a seniority Literal that matches the schema:
    ``"intern" | "junior" | "mid" | "senior"``

    Thresholds:
    - 0 years          → ``"intern"``
    - > 0 and < 2      → ``"junior"``
    - 2 ≤ years ≤ 5   → ``"mid"``
    - > 5              → ``"senior"``
    """
    if total_years <= 0:
        return "intern"
    if total_years < 2:
        return "junior"
    if total_years <= 5:
        return "mid"
    return "senior"


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


# Matches common bullet styles:
# - Unicode bullets: •, ·, ‣, ▸, ▪, ◦, ○, –, —
# - ASCII: -, *, >
# - Numbered lists: 1. 2) a. b)
# - Custom markers like ✓, ✗, ★
_BULLET_RE = re.compile(
    r"^\s*"
    r"(?:"
    r"[\u2022\u00b7\u2023\u25b8\u25aa\u25e6\u25cb\u2013\u2014\u2012\u2043]"
    r"|[\-\*\>]"
    r"|[\u2713\u2717\u2714\u2718\u2605\u2606]"
    r"|[0-9]{1,2}[.)]"
    r"|[a-zA-Z][.)]"
    r")"
    r"\s+"
)


def _extract_bullets(text: str) -> List[str]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    bullets: List[str] = []
    for ln in lines:
        stripped = _BULLET_RE.sub("", ln).strip()
        if stripped and stripped != ln:
            bullets.append(stripped)
    if bullets:
        return bullets[:30]
    # No bullets found: return non-header, non-date lines as raw descriptions.
    return [
        ln for ln in lines[:30]
        if not _looks_like_date_line(ln) and len(ln) > 15
    ] or lines[:30]


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


# Regex: lines that are clearly job-title-like or date-like (skip for company detection).
_TITLE_KEYWORDS_RE = re.compile(
    r"\b(?:engineer|developer|architect|analyst|manager|intern|senior|junior|lead|"
    r"specialist|consultant|coordinator|director|officer|president|designer|"
    r"scientist|researcher|head|staff|associate|principal|freelance|contractor)\b",
    re.IGNORECASE,
)


def _guess_company_from_lines(block_text: str, max_lines: int = 3) -> str:
    """
    Heuristic fallback to guess a company name when NER finds no ORG entity.

    Scans the first *max_lines* non-empty lines of the block, skipping:
    - Lines that look like dates (contain years / month names).
    - Lines that look like job titles (contain role keywords).
    - Very short lines (< 3 chars) or very long lines (> 60 chars).
    - Lines that are only punctuation / symbols.

    The first surviving candidate is returned; otherwise "Professional Experience".
    """
    lines = [ln.strip() for ln in block_text.splitlines() if ln.strip()]
    for ln in lines[:max(max_lines, 5)]:
        if _looks_like_date_line(ln):
            continue
        if _TITLE_KEYWORDS_RE.search(ln):
            continue
        # Skip section headers or dividers
        lowered = ln.lower()
        if lowered in {"experience", "work experience", "employment", "employment history"}:
            continue
        # Sanity length check
        if len(ln) < 3 or len(ln) > 60:
            continue
        # Must have at least one alphabetic character
        if not any(ch.isalpha() for ch in ln):
            continue
        # Reject lines that are mostly digits (phone numbers etc.)
        alpha = sum(ch.isalpha() for ch in ln)
        digits = sum(ch.isdigit() for ch in ln)
        if digits > alpha:
            continue
        # Strip common trailing punctuation and return.
        candidate = re.sub(r"[\s,;:|/\-]+$", "", ln).strip()
        if candidate:
            return candidate
    return "Professional Experience"


def _compute_total_experience_years(items: List[Any]) -> float:
    """
    Accumulate total work experience in fractional years from ExperienceItem objects.

    - If ``is_current`` is True, treats today's date as the end date.
    - Overlapping ranges are NOT de-duplicated (keep it simple; the engine uses
      non-overlapping blocks anyway).
    """
    today = date.today()
    total_days = 0
    for item in items:
        start = getattr(item, "start_date", None)
        end = getattr(item, "end_date", None)
        is_current = getattr(item, "is_current", False)

        if start is None:
            continue
        effective_end = today if is_current or end is None else end
        delta = (effective_end - start).days
        if delta > 0:
            total_days += delta

    return round(total_days / 365.25, 2)