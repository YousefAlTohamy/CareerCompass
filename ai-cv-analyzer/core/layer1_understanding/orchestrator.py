from __future__ import annotations

import gc
import logging
import os
import re
import threading
from dataclasses import dataclass
from datetime import date
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple

from core.layer1_understanding.advanced_ner import AdvancedNEREngine
from core.layer1_understanding.canonicalizer import DataCanonicalizer
from core.layer1_understanding.experience_engine import ExperienceEngine
from core.layer1_understanding.utils import load_layer1_config
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

try:
    from ..layer3_matching.embedder import SemanticEmbedder
    EMBEDDER_AVAILABLE = True
except ImportError:
    SemanticEmbedder = None  # type: ignore[misc,assignment]
    EMBEDDER_AVAILABLE = False

# Lazy import for Layer 2 Classification Orchestrator
try:
    from core.layer2_classification.orchestrator import ClassificationOrchestrator
    from core.layer2_classification.classifier import CVDomainClassifier
    from .advanced_ner import _looks_like_contact_line
    CLASSIFIER_AVAILABLE = True
except ImportError as e:
    logger = logging.getLogger(__name__)
    logger.warning("Failed to import Layer 2 orchestrator: %s", str(e))
    ClassificationOrchestrator = None  # type: ignore[misc,assignment]
    CLASSIFIER_AVAILABLE = False

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
    # Phase 3: Semantic thresholds (cosine similarity)
    semantic_header_threshold: float = 0.82
    semantic_skill_threshold: float = 0.85


class CVOrchestrator:
    """
    Facade entry point for the V2 CV pipeline (Phases 1-4).
    """

    def __init__(self, *, config: Optional[OrchestratorConfig] = None) -> None:
        self._config = config or OrchestratorConfig()

        # Phase 5: Thread-safety lock for multi-worker environments (Celery etc.)
        self._process_lock = threading.Lock()

        # Phase 3: Initialize shared SemanticEmbedder (Singleton).
        # Lazily loaded — the model is only downloaded on first construction.
        self._embedder = None
        if EMBEDDER_AVAILABLE:
            try:
                self._embedder = SemanticEmbedder()
                logger.info("Shared SemanticEmbedder initialized for orchestrator.")
            except Exception as e:
                logger.warning("SemanticEmbedder failed to initialize: %s. Falling back to non-semantic pipeline.", e)
                self._embedder = None

        self._segmenter = SemanticSegmenter(
            embedder=self._embedder,
            semantic_header_threshold=self._config.semantic_header_threshold,
        )
        self._ner = AdvancedNEREngine()
        self._experience = ExperienceEngine()
        self._canonicalizer = DataCanonicalizer(
            fuzzy_threshold=self._config.canonical_fuzzy_threshold,
            embedder=self._embedder,
            semantic_skill_threshold=self._config.semantic_skill_threshold,
        )

        self._layer2_orchestrator = None
        if CLASSIFIER_AVAILABLE:
            try:
                # We still need the underlying singleton classifier for the engines
                domain_classifier = CVDomainClassifier()
                self._layer2_orchestrator = ClassificationOrchestrator(domain_classifier)
                logger.info("Layer 2 Orchestrator initialized for main orchestrator.")
            except Exception as e:
                logger.warning("ClassificationOrchestrator failed to initialize: %s", e)
                self._layer2_orchestrator = None

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def process_cv(self, pdf_bytes: bytes, filename: Optional[str] = None) -> CVParseResult:
        """
        Returns the strict ``CVParseResult`` model (always).

        Phase 5: Thread-safe — acquires ``_process_lock`` so concurrent
        Celery workers sharing the same process don't corrupt state.
        Logs memory usage and phase-level latency.
        """
        t_total = time.perf_counter()
        if filename:
            logger.info("V2 orchestrator processing file: %s", filename)

        _log_memory("before_processing")

        with self._process_lock:
            result = self._process_cv_unlocked(pdf_bytes, filename)

        total_ms = (time.perf_counter() - t_total) * 1000
        logger.info(
            "Pipeline total: %.1fms | status=%s | file=%s",
            total_ms, result.parsing_status, filename or "<bytes>",
        )
        _log_memory("after_processing")

        # Phase 5: Trigger GC to reclaim transient allocations (OCR images etc.)
        gc.collect()

        return result

    def process_image_cv(self, image_bytes: bytes, filename: Optional[str] = None) -> CVParseResult:
        """
        Process a standalone image CV through the existing OCR + NLP pipeline.

        The Laravel upload contract allows PNG/JPEG CVs. This method keeps that
        path explicit instead of forcing image bytes through the PDF parser.
        """
        if filename:
            logger.info("V2 orchestrator processing image file: %s", filename)

        if not OCR_AVAILABLE or extract_text_from_image is None:
            result = self._empty_result(parsing_status="error", page_count=1)
            result.analysis.metadata["error"] = "OCR is not available for image CV uploads."
            return result

        try:
            ocr_text = (extract_text_from_image(image_bytes) or "").strip()
        except Exception as e:
            logger.warning("Image CV OCR failed: %s", e)
            result = self._empty_result(parsing_status="error", page_count=1)
            result.analysis.metadata["error"] = "Image CV OCR failed."
            return result

        if len(ocr_text) < 20:
            result = self._empty_result(parsing_status="no_text", page_count=1)
            result.analysis.metadata["error"] = "No readable text was extracted from the image CV."
            return result

        return self._run_nlp_pipeline(
            ordered_text=ocr_text,
            raw_text_with_hints=ocr_text,
            page_count=1,
            extraction_source="ocr",
            spatial_status="image_ocr",
            spatial_word_count=_count_words(ocr_text),
            filename=filename,
        )

    def _process_cv_unlocked(self, pdf_bytes: bytes, filename: Optional[str] = None) -> CVParseResult:
        """Inner implementation without the lock — called by ``process_cv``."""
        # -- Phase 1a: Attempt fast spatial extraction --
        t0 = time.perf_counter()
        try:
            spatial: SpatialTextExtraction = extract_spatial_text_from_pdf(pdf_bytes)
            spatial_ms = (time.perf_counter() - t0) * 1000
            logger.info("⏱ Spatial Parsing: %.1fms", spatial_ms)
        except Exception as e:
            logger.exception("Spatial parsing failed: %s", e)
            return self._attempt_ocr_fallback(pdf_bytes, page_count=0, reason="spatial_exception", filename=filename)

        # -- Phase 1b: Evaluate spatial quality --
        extraction_source = "spatial"
        ordered_text = spatial.text or ""
        char_count = len(ordered_text)

        needs_ocr = self._should_trigger_ocr(spatial, char_count)

        if needs_ocr:
            t_ocr_start = time.perf_counter()
            ocr_result = self._attempt_ocr_fallback(pdf_bytes, page_count=spatial.page_count, reason=self._ocr_reason(spatial, char_count), filename=filename)
            ocr_ms = (time.perf_counter() - t_ocr_start) * 1000
            logger.info("⏱ OCR Fallback: %.1fms", ocr_ms)
            if ocr_result is not None:
                return ocr_result
            if not ordered_text:
                status = "empty_file" if spatial.status == "no_text" else "error"
                logger.info("V2 orchestrator: no usable text after spatial + OCR; status=%s", status)
                return self._empty_result(parsing_status=status, page_count=spatial.page_count)

        # -- Phase 2+: NLP pipeline on the extracted text --
        t_nlp = time.perf_counter()
        # Store raw_text_with_hints before stripping for metadata, then strip for NLP
        raw_text_with_hints = ordered_text
        ordered_text_clean = re.sub(r'^\[H\] ', '', ordered_text, flags=re.MULTILINE)
        nlp_result = self._run_nlp_pipeline(
            ordered_text=ordered_text_clean,
            raw_text_with_hints=raw_text_with_hints,
            page_count=spatial.page_count,
            extraction_source=extraction_source,
            spatial_status=spatial.status,
            spatial_word_count=spatial.word_count,
            filename=filename,
        )
        nlp_ms = (time.perf_counter() - t_nlp) * 1000
        logger.info("⏱ NLP Pipeline: %.1fms", nlp_ms)
        return nlp_result

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
        filename: Optional[str] = None,
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
            raw_text_with_hints=ocr_text,
            page_count=page_count or len(page_images),
            extraction_source="ocr",
            spatial_status="no_text",
            spatial_word_count=0,
            filename=filename,
        )

    # ------------------------------------------------------------------
    # Core NLP Pipeline  (extracted to honour SRP)
    # ------------------------------------------------------------------

    def _run_nlp_pipeline(
        self,
        *,
        ordered_text: str,
        raw_text_with_hints: str,
        page_count: int,
        extraction_source: str,
        spatial_status: str,
        spatial_word_count: int,
        filename: Optional[str] = None,
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

        # Fix 1: NER Noise Filter — remove hallucinated skills before canonicalization
        skills_raw = _filter_noise_skills(skills_raw, full_name=name_candidate.full_name if name_candidate else "")

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

        # Title Detection Logic: Header -> Experience -> NER Fallback
        header_title = None
        first_lines = [ln.strip() for ln in ordered_text.splitlines() if ln.strip()][:5]
        
        # Load Title Blacklist from config
        from .utils import load_layer1_config
        _L1_CONFIG = load_layer1_config()["title_config"]
        TITLE_BLACKLIST = set(_L1_CONFIG["blacklist"])

        # Look for a title in the first 5 lines (skipping the name)
        for ln in first_lines[1:]: 
            # If the line looks like a role (not contact info, not too long)
            if not _looks_like_contact_line(ln) and 5 < len(ln) < 50:
                clean_ln = _clean_title_line(ln)
                if clean_ln and clean_ln.lower() not in TITLE_BLACKLIST:
                    header_title = clean_ln
                    break

        current_title = header_title or self._rank_current_title(exp_text, segments.sections) or (entities.get("roles") or [None])[0]
        
        # Fallback if title is still missing or blocked
        if (not current_title or current_title.lower() in TITLE_BLACKLIST) and entities.get("roles"):
            # Take the first role from NER that isn't blacklisted
            for r in entities.get("roles", []):
                if r.lower() not in TITLE_BLACKLIST:
                    current_title = r
                    break

        experience_items = self._build_experience_items(exp_text, predicted_title=current_title)
        
        # Feature 3: Alternative Titles — collect from NER + experience items
        all_ner_roles = {r.strip() for r in entities.get("roles", []) if r.strip() and len(r) < 50}
        exp_roles = {it.title for it in experience_items if it.title and it.title != "Professional Experience"}
        alt_titles_set = all_ner_roles | exp_roles
        if current_title in alt_titles_set:
            alt_titles_set.remove(current_title)
        # Filter out single-word or trivially short titles (noise from NER)
        alternative_titles = sorted([
            t for t in alt_titles_set
            if len(t.split()) >= 2 and len(t) >= 8
        ])
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

        # Phase 4: Career health analysis (gaps, overlaps, job hopping)
        career_health: Dict[str, List[str]] = {"gaps": [], "overlaps": [], "red_flags": []}
        try:
            career_health = self._experience.analyze_career_health(experience_items)
        except Exception as e:
            logger.warning("Career health analysis failed: %s", e)

        # Phase 4: Action verb score
        action_verb_score: float = 0.0
        try:
            action_verb_score = self._experience.calculate_action_verb_score(experience_items)
        except Exception as e:
            logger.warning("Action verb scoring failed: %s", e)

        # Phase 4: Seniority inference
        seniority = _infer_seniority(
            total_years=total_years,
            current_title=current_title,
            action_verb_score=action_verb_score,
        )

        # Phase 4: Top skills by years (from Phase 2 durations)
        top_skills_by_years: List[Dict[str, Any]] = []
        if skill_durations:
            sorted_skills = sorted(skill_durations.items(), key=lambda x: -x[1])[:3]
            top_skills_by_years = [
                {"skill": name, "years": yrs} for name, yrs in sorted_skills
            ]

        # Combine red flags and gaps from career health into AnalysisSection
        all_red_flags = career_health.get("red_flags", []) + career_health.get("overlaps", [])
        all_gaps = career_health.get("gaps", [])

        # Build strengths from action verbs and experience
        strengths: List[str] = []
        if action_verb_score >= 0.7:
            strengths.append("Strong use of action verbs in job descriptions — demonstrates clear ownership and impact.")
        if total_years >= 5:
            strengths.append(f"Substantial career experience ({total_years} years) indicating deep domain knowledge.")
        if len(skill_durations) >= 5:
            strengths.append(f"Diverse technical portfolio with {len(skill_durations)} technologies used across roles.")

        stats = DocumentStats(
            page_count=page_count,
            char_count=len(ordered_text),
            word_count=_count_words(ordered_text),
            language_hint=None,
        )

        # Headline & Location Fallback from Header/NER
        # Aggressive Header Parsing: Look for locations in lines with separators (| or •)
        final_location = contact_dict.get("location")
        if not final_location:
            # Check first 5 lines for common location patterns or split by pipe
            for ln in first_lines:
                if "|" in ln or "•" in ln:
                    parts = [p.strip() for p in re.split(r"[|•]", ln)]
                    for p in parts:
                        # If a part looks like "City, Country"
                        if "," in p and len(p) < 30 and len(p.split()) <= 4 and not any(x in p.lower() for x in ["app", "short", "distance", "http", "www"]):
                            final_location = p
                            break
                if final_location: break

        # NER Fallback if still missing
        if not final_location and entities.get("locations"):
            header_area = ordered_text[:1000].lower()
            for loc in entities["locations"]:
                if loc.lower() in header_area:
                    final_location = loc
                    break

        # Capture Headline: Any informative line in header that isn't name/contact/location
        headline = None
        for ln in first_lines[1:5]: 
            ln_low = ln.lower()
            if not _looks_like_contact_line(ln) and ln != current_title and ln != final_location:
                # Basic length and content check
                if 8 < len(ln) < 100 and not any(x in ln_low for x in ("gmail", "linkedin", "github")):
                    headline = ln
                    break

        profile = Profile(
            full_name=name_candidate.full_name if name_candidate else None,
            current_title=current_title,
            alternative_titles=alternative_titles,
            headline=headline,
            summary=segments.sections.get("profile_summary"),
            confidence_score=name_candidate.confidence_score if name_candidate else 0.0,
            contact=ContactInfo(
                email=contact_dict.get("email"),
                phone=contact_dict.get("phone"),
                linkedin_url=contact_dict.get("linkedin_url"),
                github_url=contact_dict.get("github_url"),
                portfolio_url=contact_dict.get("portfolio_url"),
                location=final_location
            ),
        )

        # Determine parsing_status based on extraction source
        parsing_status = "ocr_fallback" if extraction_source == "ocr" else "success"

        # -- Phase 2: Classification Enrichment (Layer 2) --
        if self._layer2_orchestrator is not None:
            try:
                # Prepare data for Layer 2
                cv_data_for_l2 = {
                    "filename": filename or "unknown",
                    "profile": profile.model_dump(),
                    "skills": skills_section.model_dump(),
                    "experience": experience_section.model_dump(),
                    "analysis": {"metadata": {"experience": {"total_experience_years": total_years}}}
                }
                # Enrich!
                enriched_data = self._layer2_orchestrator.enrich_cv_analysis(cv_data_for_l2)
                
                # Update local analysis variables
                l2_analysis = enriched_data.get("analysis", {})
                primary_domain = l2_analysis.get("primary_domain")
                seniority = l2_analysis.get("seniority")
                metadata_l2 = l2_analysis.get("metadata", {})
            except Exception as e:
                logger.warning("Layer 2 Enrichment failed: %s", e)
                primary_domain = None
                seniority = None
                metadata_l2 = {}
        else:
            primary_domain = None
            seniority = None
            metadata_l2 = {}

        analysis = AnalysisSection(
            summary=None,
            predicted_role=current_title,
            seniority=self._normalize_seniority(seniority),
            primary_domain=primary_domain,
            strengths=strengths,
            gaps=all_gaps,
            red_flags=all_red_flags,
            confidence_score=_aggregate_confidence(
                [skills_section.confidence_score, experience_section.confidence_score],
                default=0.0,
            ),
            metadata={
                "segmentation": {
                    "found_sections": list(segments.analysis.found_sections),
                    "sections_missing": list(segments.analysis.sections_missing),
                    "anomalies": list(segments.analysis.anomalies),
                    "sections_text": {
                        k: re.sub(r'^\[H\] ', '', v, flags=re.MULTILINE)
                        for k, v in segments.sections.items()
                    },
                },
                "experience": {
                    "total_experience_years": total_years,
                    "skill_durations": skill_durations,
                    "top_skills_by_years": top_skills_by_years,
                    "action_verb_score": action_verb_score,
                    "gap_details": all_gaps,
                },
                "extraction": {
                    "source": extraction_source,
                    "spatial_status": spatial_status,
                    "word_count_spatial": spatial_word_count,
                    "raw_text": ordered_text,
                },
                "layer2": metadata_l2
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

    def _normalize_seniority(self, seniority: Optional[str]) -> Optional[str]:
        if not seniority: return None
        s = seniority.lower()
        if "intern" in s: return "intern"
        if "junior" in s: return "junior"
        if "mid" in s: return "mid"
        if "senior" in s: return "senior"
        if "lead" in s or "manager" in s: return "lead"
        return "mid" # Fallback

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
            clean_fallback_text = re.sub(r'https?://\S+|www\.\S+|github\.com/\S+', '', experience_text, flags=re.IGNORECASE)
            entities = self._ner.extract_entities(clean_fallback_text)
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

            # Sanitize URLs to prevent NER misclassification (Problem 3)
            clean_block_text = re.sub(r'https?://\S+|www\.\S+|github\.com/\S+', '', block_text, flags=re.IGNORECASE)

            # Extract specific entities for THIS block using the initialized NER engine
            entities = self._ner.extract_entities(clean_block_text)

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

def _log_memory(label: str) -> None:
    """Log current process RSS memory usage (best-effort, needs psutil)."""
    try:
        import psutil
        process = psutil.Process(os.getpid())
        rss_mb = process.memory_info().rss / (1024 * 1024)
        logger.info("Memory [%s]: RSS=%.1f MB", label, rss_mb)
    except ImportError:
        pass  # psutil not installed — skip silently
    except Exception as e:
        logger.debug("Memory logging failed (%s): %s", label, e)


def _count_words(text: str) -> int:
    return len(_WORD_RE.findall(text or ""))


def _aggregate_confidence(values: Sequence[float], *, default: float) -> float:
    vals = [v for v in values if isinstance(v, (int, float)) and v > 0]
    if not vals:
        return float(default)
    return float(min(1.0, sum(vals) / len(vals)))


# ---------------------------------------------------------------------------
# Fix 1: NER Noise Skill Filter
# ---------------------------------------------------------------------------

# Generic non-skill words that NER often mis-tags
_SKILL_BLOCKLIST: set = set(load_layer1_config()["skill_config"]["noise_blocklist"])

# Pattern: alphanumeric codes like "Fep2024", "React18", "py3", "v2"
_ALPHANUMERIC_CODE_RE = re.compile(r'^[A-Za-z]{1,5}\d{2,}$|^\d+[A-Za-z]{1,5}$')


def _filter_noise_skills(skills: List[str], full_name: str = "") -> List[str]:
    """
    Remove hallucinated or noisy skill entries produced by the NER model.
    Applies four independent rejection rules — each valid for any CV:

    1. Person-name blocklist (common Arabic + English first names).
    2. Alphanumeric codes (Fep2024, py3, v2…).
    3. Generic non-skill nouns (passenger, driver, instructor…).
    4. Tokens that are substrings of the candidate's own name.
    """
    # Build name token set from the candidate's full name (case-insensitive)
    name_tokens: set = set()
    if full_name:
        name_tokens = {t.lower().strip() for t in full_name.split() if t.strip()}

    filtered: List[str] = []
    for skill in skills:
        skill_lower = skill.lower().strip()

        # Rule 4: reject if any word in the skill matches a name token
        skill_words = {w.lower().strip(".,;:()") for w in skill.split()}
        if skill_words & name_tokens:
            logger.debug("NER noise filter: dropped '%s' (matches person name)", skill)
            continue

        # Rule 1: reject if whole skill is a known person name / generic noun
        if skill_lower in _SKILL_BLOCKLIST:
            logger.debug("NER noise filter: dropped '%s' (blocklist)", skill)
            continue

        # Rule 2: reject alphanumeric codes (course IDs, version strings)
        if _ALPHANUMERIC_CODE_RE.match(skill.strip()):
            logger.debug("NER noise filter: dropped '%s' (alphanumeric code)", skill)
            continue

        # Rule 3: single-char tokens are noise
        if len(skill.strip()) < 2:
            continue

        filtered.append(skill)

    return filtered


# ---------------------------------------------------------------------------
# Phase 4: Seniority inference (pure function)
# ---------------------------------------------------------------------------

# Title keyword → seniority mapping (checked against the most recent title)
_TITLE_SENIORITY_KEYWORDS: Dict[str, str] = load_layer1_config()["seniority_config"]["title_keywords"]

_SENIORITY_ORDER = ["intern", "junior", "mid", "senior", "lead", "principal"]


def _infer_seniority(
    *,
    total_years: float,
    current_title: Optional[str],
    action_verb_score: float,
) -> Optional[str]:
    """
    Weighted seniority inference using:
    1. Title keywords (strongest signal — especially "intern" override)
    2. Total experience years (primary quantitative signal)
    3. Action verb density (tiebreaker / micro-adjustment)

    Returns one of: "intern", "junior", "mid", "senior", "lead", "principal"
    """
    # --- Step 1: Title-based override ---
    title_seniority: Optional[str] = None
    if current_title:
        title_lower = current_title.lower()
        # Check multi-word keywords first (longer matches), then single words
        for keyword in sorted(_TITLE_SENIORITY_KEYWORDS.keys(), key=len, reverse=True):
            if keyword in title_lower:
                title_seniority = _TITLE_SENIORITY_KEYWORDS[keyword]
                break

    # Hard override: if the most recent title is "Intern", keep it as intern
    # regardless of total years (might be a career-switching intern)
    if title_seniority == "intern":
        return "intern"

    # --- Step 2: Years-based baseline ---
    if total_years < 1:
        years_seniority = "intern"
    elif total_years < 2:
        years_seniority = "junior"
    elif total_years < 5:
        years_seniority = "mid"
    elif total_years < 8:
        years_seniority = "senior"
    elif total_years < 12:
        years_seniority = "lead"
    else:
        years_seniority = "principal"

    # --- Step 3: Combine title + years ---
    if title_seniority is not None:
        title_idx = _SENIORITY_ORDER.index(title_seniority)
        years_idx = _SENIORITY_ORDER.index(years_seniority)
        # Weighted average: title has 60% weight, years 40%
        combined_idx = round(title_idx * 0.6 + years_idx * 0.4)
    else:
        combined_idx = _SENIORITY_ORDER.index(years_seniority)

    # --- Step 4: Action verb micro-adjustment ---
    # Strong verb usage can bump up by one level (max)
    if action_verb_score >= 0.8 and combined_idx < len(_SENIORITY_ORDER) - 1:
        combined_idx += 1
    # Very weak verb usage might nudge down (only if not at bottom)
    elif action_verb_score < 0.2 and combined_idx > 0:
        combined_idx -= 1

    combined_idx = max(0, min(len(_SENIORITY_ORDER) - 1, combined_idx))
    return _SENIORITY_ORDER[combined_idx]


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
    """
    Fix 3: Robust experience bullet extraction.
    Handles:
    1. Splitting merged words (Architectedanddelivered -> Architected and delivered).
    2. Proper bullet point identification.
    3. Cleaning trailing/leading noise.
    """
    if not text:
        return []
        
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    bullets: List[str] = []
    
    for ln in lines:
        # Step 1: Detect and fix "glued" words (always run for experience lines)
        ln = _fix_glued_text(ln)
        
        # Step 2: Strip bullet markers
        ln_clean = _BULLET_RE.sub("", ln).strip()
        
        # Step 3: Final polish
        if len(ln_clean) > 5:
            bullets.append(ln_clean)
            
    if bullets:
        return bullets[:30]
    return lines[:30]


def _fix_glued_text(text: str) -> str:
    """
    Heuristic-based splitting of words glued together by PDF extraction.
    Splits on CamelCase, and common word boundaries.
    """
    # 1. Split on lowercase followed by Uppercase (CamelCase)
    text = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)
    
    # 2. Split on lowercase followed by digit
    text = re.sub(r"([a-z])(\d)", r"\1 \2", text)
    
    # 3. Split on digit followed by letter
    text = re.sub(r"(\d)([A-Za-z])", r"\1 \2", text)

    # 4. Fix common glued words (and, for, the, with, using, etc.)
    # We look for these words embedded in longer strings
    common_glued = [
        "and", "for", "the", "with", "using", "from", "into", "delivery", "delivered",
        "API", "REST", "MySQL", "PHP", "System", "Laravel", "Stripe", "GitHub", "backend", "frontend"
    ]
    for word in common_glued:
        # Only split if it's inside a longer string
        text = re.sub(rf"([a-z])({word})([a-z])", r"\1 \2 \3", text, flags=re.IGNORECASE)
        # Or at the end/start of a glued block
        text = re.sub(rf"([a-z])({word})", r"\1 \2", text, flags=re.IGNORECASE)
        text = re.sub(rf"({word})([a-z])", r"\1 \2", text, flags=re.IGNORECASE)
        
    return text.strip()


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
