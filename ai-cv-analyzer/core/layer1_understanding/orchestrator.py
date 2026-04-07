from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date
import time
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
    ContactInfo,
)
from core.layer1_understanding.section_segmenter import SemanticSegmenter
from core.layer1_understanding.spatial_parser import SpatialTextExtraction, extract_spatial_text_from_pdf
from core.layer1_understanding.contact_extractor import extract_contacts

# Lazy import for OCR — guarded so the pipeline doesn't crash if EasyOCR or
# PyMuPDF are not installed.
try:
    from core.layer1_understanding.ocr_pipeline import (
        extract_images_from_pdf_bytes,
        extract_text_from_image,
        OCR_AVAILABLE,
    )
except ImportError:
    OCR_AVAILABLE = False
    extract_images_from_pdf_bytes = None  # type: ignore[assignment]
    extract_text_from_image = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


_WORD_RE = re.compile(r"\S+")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Minimum total character count from spatial extraction to consider it "good
# enough".  Below this threshold we suspect the PDF is scanned / image-based.
_MIN_CHAR_DENSITY = 150


@dataclass(frozen=True, slots=True)
class OrchestratorConfig:
    canonical_fuzzy_threshold: int = 86
    ner_context_window_words: int = 3
    ocr_char_density_threshold: int = _MIN_CHAR_DENSITY


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

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def process_cv(self, pdf_bytes: bytes, filename: Optional[str] = None) -> CVParseResult:
        """
        Returns the strict `CVParseResult` model (always).
        """
        if filename:
            logger.info("V2 orchestrator processing file: %s", filename)

        # -- Phase 1a: Attempt fast spatial extraction --
        t0 = time.time()
        try:
            spatial: SpatialTextExtraction = extract_spatial_text_from_pdf(pdf_bytes)
            spatial_time = time.time() - t0
            logger.info("Latency: Spatial Parsing took %.2fs", spatial_time)
        except Exception as e:
            logger.exception("Spatial parsing failed: %s", e)
            # Even if spatial crashes, attempt OCR before giving up
            return self._attempt_ocr_fallback(pdf_bytes, page_count=0, reason="spatial_exception")

        # -- Phase 1b: Evaluate spatial quality --
        extraction_source = "spatial"
        ordered_text = spatial.text or ""
        char_count = len(ordered_text)

        needs_ocr = self._should_trigger_ocr(spatial, char_count)

        if needs_ocr:
            ocr_result = self._attempt_ocr_fallback(pdf_bytes, page_count=spatial.page_count, reason=self._ocr_reason(spatial, char_count))
            if ocr_result is not None:
                return ocr_result
            # OCR itself failed or was unavailable — fall through to use
            # whatever spatial text we have, even if thin.
            if not ordered_text:
                status = "empty_file" if spatial.status == "no_text" else "error"
                logger.info("V2 orchestrator: no usable text after spatial + OCR; status=%s", status)
                return self._empty_result(parsing_status=status, page_count=spatial.page_count)

        # -- Phase 2+: NLP pipeline on the extracted text --
        return self._run_nlp_pipeline(
            ordered_text=ordered_text,
            page_count=spatial.page_count,
            extraction_source=extraction_source,
            spatial_status=spatial.status,
            spatial_word_count=spatial.word_count,
        )

    # ------------------------------------------------------------------
    # OCR Fallback Helpers  (SRP: keeps process_cv lean)
    # ------------------------------------------------------------------

    def _should_trigger_ocr(self, spatial: SpatialTextExtraction, char_count: int) -> bool:
        """Decide whether OCR should be attempted based on spatial results."""
        if spatial.status == "no_text":
            logger.info("OCR trigger: spatial status is 'no_text'.")
            return True
        if spatial.status == "error":
            logger.info("OCR trigger: spatial status is 'error'.")
            return True
        if char_count < self._config.ocr_char_density_threshold:
            logger.info(
                "OCR trigger: character density too low (%d < %d threshold).",
                char_count,
                self._config.ocr_char_density_threshold,
            )
            return True
        return False

    @staticmethod
    def _ocr_reason(spatial: SpatialTextExtraction, char_count: int) -> str:
        """Return a short machine-readable reason for the OCR trigger."""
        if spatial.status == "no_text":
            return "spatial_no_text"
        if spatial.status == "error":
            return "spatial_error"
        return f"low_char_density_{char_count}"

    def _attempt_ocr_fallback(
        self,
        pdf_bytes: bytes,
        *,
        page_count: int,
        reason: str,
    ) -> Optional[CVParseResult]:
        """
        Try to reconstruct the full text via OCR.

        Returns a fully-formed CVParseResult on success, or *None* if OCR is
        unavailable / fails (so the caller can fall back further).
        """
        if not OCR_AVAILABLE:
            logger.warning("OCR fallback requested (reason=%s) but EasyOCR is not installed.", reason)
            return None

        logger.info("Starting OCR fallback pipeline (reason=%s).", reason)
        t_ocr = time.time()
        try:
            page_images = extract_images_from_pdf_bytes(pdf_bytes)  # type: ignore[misc]
        except Exception as e:
            logger.exception("OCR: failed to render PDF pages to images: %s", e)
            return None

        if not page_images:
            logger.warning("OCR: no page images produced from PDF.")
            return None

        ocr_parts: List[str] = []
        for i, img_bytes in enumerate(page_images):
            try:
                text = extract_text_from_image(img_bytes)  # type: ignore[misc]
                if text and text.strip():
                    ocr_parts.append(text.strip())
                    logger.debug("OCR page %d: extracted %d chars.", i + 1, len(text))
                else:
                    logger.debug("OCR page %d: no text extracted.", i + 1)
            except Exception as e:
                logger.warning("OCR page %d failed: %s", i + 1, e)

        if not ocr_parts:
            logger.warning("OCR produced no text across %d pages.", len(page_images))
            return None

        ocr_text = "\n\n".join(ocr_parts).strip()
        if len(ocr_text) < 20:
            logger.warning("OCR text too short (%d chars), treating as failure.", len(ocr_text))
            return None

        ocr_latency = time.time() - t_ocr
        logger.info("Latency: OCR Fallback took %.2fs, produced %d chars.", ocr_latency, len(ocr_text))

        return self._run_nlp_pipeline(
            ordered_text=ocr_text,
            page_count=page_count or len(page_images),
            extraction_source="ocr",
            spatial_status="no_text",
            spatial_word_count=0,
        )

    # ------------------------------------------------------------------
    # Core NLP Pipeline  (extracted to honour SRP)
    # ------------------------------------------------------------------

    def _run_nlp_pipeline(
        self,
        *,
        ordered_text: str,
        page_count: int,
        extraction_source: str,
        spatial_status: str,
        spatial_word_count: int,
    ) -> CVParseResult:
        """
        Run segmentation → NER → canonicalization → experience extraction on
        the already-extracted text.  This is source-agnostic: the same logic
        applies regardless of whether text came from spatial or OCR.
        """
        segments = self._segmenter.segment(ordered_text)

        contact_dict = extract_contacts(ordered_text)

        # Name + title heuristics from profile-ish area first.
        profile_text = segments.sections.get("profile_summary") or segments.sections.get("uncategorized") or ordered_text

        # Determine global entities first so we can use them for name candidate
        t1 = time.time()
        try:
            entities = self._ner.extract_entities(
                ordered_text,
                context_window_words=self._config.ner_context_window_words,
            )
            ner_time = time.time() - t1
            logger.info("Latency: NER Inference took %.2fs", ner_time)
        except Exception as e:
            logger.exception("NER Inference failed: %s", e)
            entities = {}

        name_candidate = self._ner.extract_candidate_name(profile_text, entities)

        # Canonicalization with provenance: skills can come from multiple sections later.
        roles_lower = {r.lower() for r in entities.get("roles", [])}
        orgs_lower = {o.lower() for o in entities.get("orgs", [])}

        # Action Verbs used to filter greedy merged skills
        ACTION_VERBS = {
            "developed", "managed", "led", "engineered", "collaborated",
            "designed", "created", "built", "implemented", "delivered",
            "facilitated", "spearheaded", "orchestrated", "architected",
            "integrated", "tested", "deployed", "maintained", "improved",
            "optimized", "resolved", "coordinated", "analyzed"
        }

        # Phase 6.2: Global Skill Safeguard (Full-Text Fallback)
        skills_text = segments.sections.get("skills", "")
        is_fallback_mode = not skills_text or len(skills_text) < 100

        skills_source = []
        if is_fallback_mode:
            logger.info("Fallback Mode ACTIVE: Skills section missing or < 100 chars. Using full CV text.")
            skills_source.extend(entities.get("skills", []))
        else:
            try:
                t_skills = time.time()
                skills_entities = self._ner.extract_entities(skills_text, context_window_words=self._config.ner_context_window_words)
                logger.info("Latency: NER Inference (Skills Section) took %.2fs", time.time() - t_skills)
                skills_source.extend(skills_entities.get("skills", []))
            except Exception as e:
                logger.exception("NER Inference (Skills Section) failed: %s", e)

            # Combine with global full-text skills to prevent missing overlapping tech
            skills_source.extend(entities.get("skills", []))

        skills_raw = []
        seen_skills = set()
        for s in skills_source:
            s_lower = s.lower()
            if s_lower in seen_skills:
                continue
            seen_skills.add(s_lower)

            # 1. Role / Org Precedence
            if s_lower in roles_lower or s_lower in orgs_lower:
                continue

            # 2. Length restrictions: > 40 characters or > 5 words (Phase 6.3)
            if len(s) > 40:
                continue
            words = s.split()
            if len(words) > 5:
                continue

            # 3. Action Verb Filtering
            word_set = {w.lower().strip(".,;:()") for w in words}
            if any(verb in word_set for verb in ACTION_VERBS):
                continue

            skills_raw.append(s)

        t2 = time.time()
        try:
            canonical_skills = self._canonicalizer.canonicalize_skills(
                skills_raw,
                skill_confidence=0.65,  # Phase 6.3: lowered from 0.78
                source="ner",
            )
            canon_time = time.time() - t2
            logger.info("Latency: Canonicalization took %.2fs", canon_time)
        except Exception as e:
            logger.exception("Canonicalization failed: %s", e)
            canonical_skills = []

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

        current_title = self._rank_current_title(exp_text, segments.sections) or (entities.get("roles") or [None])[0]

        experience_items = self._build_experience_items(exp_text, predicted_title=current_title)
        experience_section = ExperienceSection(
            items=experience_items,
            confidence_score=_aggregate_confidence(
                [it.confidence_score for it in experience_items],
                default=0.0,
            ),
        )

        # Phase 2: Compute per-skill durations from the populated experience items
        skill_durations: Dict[str, float] = {}
        try:
            skill_durations = self._experience.calculate_skill_durations(experience_items)
        except Exception as e:
            logger.warning("Skill duration calculation failed: %s", e)

        stats = DocumentStats(
            page_count=page_count,
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
            contact=ContactInfo(
                email=contact_dict.get("email"),
                phone=contact_dict.get("phone"),
                linkedin_url=contact_dict.get("linkedin_url"),
                github_url=contact_dict.get("github_url"),
                location=contact_dict.get("location")
            ),
        )

        # Determine parsing_status based on extraction source
        parsing_status = "ocr_fallback" if extraction_source == "ocr" else "success"

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
                    "skill_durations": skill_durations,
                },
                "extraction": {
                    "source": extraction_source,
                    "spatial_status": spatial_status,
                    "word_count_spatial": spatial_word_count,
                    "raw_text": ordered_text,
                },
            },
        )

        return CVParseResult(
            parsing_status=parsing_status,
            profile=profile,
            stats=stats,
            skills=skills_section,
            experience=experience_section,
            analysis=analysis,
        )

    # ------------------------------------------------------------------
    # Empty / error result
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # Experience helpers
    # ------------------------------------------------------------------

    def _build_experience_items(self, experience_text: str, predicted_title: Optional[str] = None) -> List[ExperienceItem]:
        """
        Phase-4: Advanced Segmentation.
        Splits experience text into blocks by date, then uses NER to extract
        real Company, Location, Role, AND technologies per block.

        Phase 2 enhancement: every ExperienceItem.technologies is populated
        via a targeted NER scan scoped to the block text, then canonicalized.
        """
        if not experience_text.strip():
            return []

        ranges = self._experience.extract_date_ranges(experience_text)
        merged = _merge_best_ranges(ranges)

        if not merged:
            # Fallback if no dates are found
            entities = self._ner.extract_entities(experience_text)
            comp = entities.get("orgs", ["Unknown Company"])[0] if entities.get("orgs") else "Unknown Company"
            loc = entities.get("locations", [None])[0] if entities.get("locations") else None
            role = entities.get("roles", [predicted_title or "Professional Experience"])[0] if entities.get("roles") else (predicted_title or "Professional Experience")

            desc_text = experience_text
            if comp and comp != "Unknown Company":
                desc_text = re.sub(re.escape(comp), "", desc_text, flags=re.IGNORECASE)
            if role and role != "Professional Experience":
                desc_text = re.sub(re.escape(role), "", desc_text, flags=re.IGNORECASE)

            block_techs = self._extract_block_technologies(experience_text, entities)

            return [
                ExperienceItem(
                    title=role,
                    company=comp,
                    location=loc,
                    start_date=None,
                    end_date=None,
                    is_current=None,
                    description=_extract_bullets(desc_text),
                    technologies=block_techs,
                    confidence_score=0.45,
                )
            ]

        # Order ranges by their appearance in the text to chunk the text accurately
        positioned_ranges = []
        for r in merged:
            idx = experience_text.lower().find(r.source_text.lower())
            positioned_ranges.append((max(0, idx), r))

        positioned_ranges.sort(key=lambda x: x[0])

        items: List[ExperienceItem] = []
        for i, (idx, r) in enumerate(positioned_ranges):
            # Define text block boundaries for this specific experience
            block_start = 0 if i == 0 else positioned_ranges[i-1][0] + len(positioned_ranges[i-1][1].source_text)
            block_end = positioned_ranges[i+1][0] if i + 1 < len(positioned_ranges) else len(experience_text)

            block_text = experience_text[block_start:block_end].strip()

            # Extract specific entities for THIS block using the initialized NER engine
            entities = self._ner.extract_entities(block_text)

            comp = entities.get("orgs", ["Unknown Company"])[0] if entities.get("orgs") else "Unknown Company"
            loc = entities.get("locations", [None])[0] if entities.get("locations") else None
            role = entities.get("roles", [predicted_title or "Professional Experience"])[0] if entities.get("roles") else (predicted_title or "Professional Experience")

            desc_text = block_text
            if comp and comp != "Unknown Company":
                desc_text = re.sub(re.escape(comp), "", desc_text, flags=re.IGNORECASE)
            if role and role != "Professional Experience":
                desc_text = re.sub(re.escape(role), "", desc_text, flags=re.IGNORECASE)

            # Phase 2: Populate technologies from this block's NER context
            block_techs = self._extract_block_technologies(block_text, entities)

            items.append(
                ExperienceItem(
                    title=role,
                    company=comp,
                    location=loc,
                    start_date=r.start,
                    end_date=r.end,
                    is_current=(r.end == date.today()),
                    description=_extract_bullets(desc_text),
                    technologies=block_techs,
                    confidence_score=0.85,
                )
            )

        return items

    def _extract_block_technologies(
        self,
        block_text: str,
        block_entities: Optional[Dict[str, List[str]]] = None,
    ) -> List[str]:
        """
        Extract and canonicalize technologies mentioned within a single
        experience block.

        This is scoped only to the block text so global Skills-section
        entries don't pollute individual job contexts.

        Returns:
            Deduplicated list of canonical technology names.
        """
        if not block_text.strip():
            return []

        # Reuse existing entities if the caller already ran NER on this block
        entities = block_entities
        if entities is None:
            try:
                entities = self._ner.extract_entities(
                    block_text,
                    context_window_words=self._config.ner_context_window_words,
                )
            except Exception as e:
                logger.warning("NER for block technologies failed: %s", e)
                return []

        raw_skills = entities.get("skills", [])
        if not raw_skills:
            return []

        # Filter: skip roles/orgs that NER may have tagged as skills
        roles_lower = {r.lower() for r in entities.get("roles", [])}
        orgs_lower = {o.lower() for o in entities.get("orgs", [])}

        filtered: List[str] = []
        seen: set = set()
        for s in raw_skills:
            sl = s.lower()
            if sl in seen or sl in roles_lower or sl in orgs_lower:
                continue
            if len(s) > 40 or len(s.split()) > 5:
                continue
            seen.add(sl)
            filtered.append(s)

        if not filtered:
            return []

        # Canonicalize to prevent "JS" and "JavaScript" appearing separately
        try:
            canonical = self._canonicalizer.canonicalize_skills(
                filtered,
                skill_confidence=0.60,
                source="experience_block",
            )
            return [sk.name for sk in canonical]
        except Exception as e:
            logger.warning("Canonicalization of block technologies failed: %s", e)
            return filtered

    def _rank_current_title(self, experience_text: str, segments_dict: Optional[Dict[str, str]] = None) -> Optional[str]:
        """
        Title ranking strategy:
        1. Priority: most frequent ROLE found by NER engine in experience or profile_summary segments.
        2. Fallback: Prefer the title near the most recent date range, otherwise best-looking leading line.
        """
        if segments_dict:
            target_text = ""
            if "experience" in segments_dict:
                 target_text += segments_dict["experience"] + "\n"
            if "profile_summary" in segments_dict:
                 target_text += segments_dict["profile_summary"] + "\n"

            if target_text.strip():
                extracted = self._ner.extract_entities(target_text)
                roles = extracted.get("roles", [])
                if roles:
                    from collections import Counter
                    counts = Counter(r.strip() for r in roles if r.strip())
                    if counts:
                        return counts.most_common(1)[0][0]

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


# ---------------------------------------------------------------------------
# Module-level helpers (pure functions)
# ---------------------------------------------------------------------------

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