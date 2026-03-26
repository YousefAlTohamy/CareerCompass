import os
from dotenv import load_dotenv

# لازم السطر ده يكون في الأول عشان يحمل التوكن قبل ما موديلز الذكاء الاصطناعي تشتغل
load_dotenv()

import json
import logging
import time
from fastapi import FastAPI, Form, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, Dict, List, Optional


# Import Layer 1: Understanding (V2 Pipeline)
from core.layer1_understanding.orchestrator import CVOrchestrator
from core.layer1_understanding.schema import CVParseResult

# Import Layer 2: Classification
from core.layer2_classification.classifier import CVDomainClassifier

# Import Layer 3: Matching
from core.layer3_matching.similarity import IntelligentMatcher

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - [%(levelname)s] - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CareerCompass AI Engine v2.0",
    description="The 3-Layer Intelligent Backend for CV Analysis and Job Matching",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI singletons on startup
@app.on_event("startup")
async def startup_event():
    logger.info("Initializing AI Engine v2 Models (This may take a moment)...")
    CVDomainClassifier()
    # IntelligentMatcher initializes the SemanticEmbedder automatically
    _get_matcher()
    # V2 pipeline facade (loads AdvancedNEREngine lazily/once)
    try:
        _get_orchestrator()
    except Exception as e:
        logger.warning("CVOrchestrator prewarm failed (will retry on request): %s", e)
    logger.info("All AI Models loaded successfully into memory.")

@app.get("/")
def health_check():
    return {"status": "operational", "version": "v2.0 (3-Layer Architecture)"}

@app.post("/api/v2/analyze-cv")
async def analyze_full_cv(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Layer 1 + 2 endpoint (backward-compatible).
    Now delegates document extraction + NER to the V2 CVOrchestrator pipeline.
    """
    logger.info(f"Received V2 CV Analysis request for: {file.filename}")

    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    # ─── Layer 1: CV Understanding via V2 Orchestrator ───
    logger.info("--> Executing Layer 1: V2 Spatial + NER pipeline")
    try:
        orchestrator = _get_orchestrator()
        result: CVParseResult = orchestrator.process_cv(file_bytes, file.filename)
    except Exception as e:
        logger.exception("V2 analyze-cv failed: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error during CV analysis.")

    if result.parsing_status not in ("success",):
        raise HTTPException(status_code=422, detail=f"Failed to extract text from the document (status={result.parsing_status}).")

    raw_text = f"parsed via orchestrator ({result.stats.word_count} words)"
    skills = [sk.name for sk in result.skills.items]
    roles = [result.profile.current_title] if result.profile.current_title else []
    education = []
    certifications = []

    # ─── Layer 2: Domain Classification ───
    logger.info("--> Executing Layer 2: CV Domain Classification")
    classifier = CVDomainClassifier()
    # Use the orchestrator's ordered text for classification.
    classify_text = " ".join(skills + roles)
    domain_probs = classifier.predict_domain(classify_text) if classify_text.strip() else {}
    primary_domain = max(domain_probs, key=domain_probs.get) if domain_probs else "Unknown"

    return {
        "status": "success",
        "metadata": {
            "filename": file.filename,
            "extraction_method": result.analysis.metadata.get("extraction", {}).get("spatial_status", "v2_orchestrator"),
            "text_length": result.stats.char_count
        },
        "layer1_understanding": {
            "skills": skills,
            "roles": roles,
            "education": education,
            "certifications": certifications
        },
        "layer2_classification": {
            "primary_domain": primary_domain,
            "domain_probabilities": domain_probs
        }
    }


_V2_ORCHESTRATOR: CVOrchestrator | None = None
_MATCHER: IntelligentMatcher | None = None


def _get_orchestrator() -> CVOrchestrator:
    global _V2_ORCHESTRATOR
    if _V2_ORCHESTRATOR is None:
        _V2_ORCHESTRATOR = CVOrchestrator()
    return _V2_ORCHESTRATOR


def _get_matcher() -> IntelligentMatcher:
    global _MATCHER
    if _MATCHER is None:
        _MATCHER = IntelligentMatcher()
    return _MATCHER


@app.post("/api/v3/analyze-cv", response_model=CVParseResult)
async def analyze_cv_v3(file: UploadFile = File(...)) -> CVParseResult:
    """
    V3 endpoint: executes the new V2 pipeline (Phases 1-4) via the Facade orchestrator.
    Returns the strict `CVParseResult` Pydantic model directly.
    """
    t0 = time.perf_counter()
    logger.info("Received V3 CV Analysis request for: %s", file.filename)

    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    try:
        orchestrator = _get_orchestrator()
        result = orchestrator.process_cv(file_bytes, file.filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("V3 analysis failed: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error during CV analysis.")
    finally:
        dt_ms = (time.perf_counter() - t0) * 1000.0
        try:
            status = result.parsing_status  # type: ignore[name-defined]
            role = result.profile.current_title  # type: ignore[name-defined]
        except Exception:
            status = "unknown"
            role = None
        logger.info("V3 analyze-cv completed status=%s role=%s time_ms=%.1f", status, role, dt_ms)

    return result

from pydantic import BaseModel


class MatchRequest(BaseModel):
    """Legacy request body for /api/v2/match-job."""
    cv_text: str
    cv_skills: list[str]
    job_description: str
    job_skills: list[str]


@app.post("/api/v2/match-job")
def match_job(request: MatchRequest) -> Dict[str, Any]:
    """
    Layer 3 endpoint (v2, legacy): raw-text-based job matching.
    """
    logger.info("--\u003e Executing Layer 3 (legacy): Intelligent Matching")
    matcher = _get_matcher()
    cv_data = {"raw_text": request.cv_text, "skills": request.cv_skills}
    job_data = {"description": request.job_description, "skills": request.job_skills}
    match_results = matcher.calculate_match_legacy(cv_data, job_data)
    return {"status": "success", "layer3_matching": match_results}


@app.post("/api/v3/match-job")
async def match_job_v3(
    file: UploadFile = File(..., description="CV PDF file"),
    job_data: str = Form(..., description="JSON string with job description fields"),
) -> Dict[str, Any]:
    """
    V3 Hybrid Matching endpoint.

    Accepts a CV PDF and a JSON job description, runs the full V2 pipeline
    on the CV, then applies the 3-factor IntelligentMatcher.

    The ``job_data`` form field must be a JSON string with the following shape::

        {
          "title": "Backend Developer",
          "description": "We are looking for...",
          "required_skills": ["Node.js", "Docker"],
          "seniority_level": "senior",    // optional
          "domain": "Backend Development"  // optional
        }

    Response adds a ``match`` block to the standard ``CVParseResult`` JSON,
    and the ``analysis.gaps`` / ``analysis.red_flags`` fields are populated.
    """
    t0 = time.perf_counter()
    logger.info("V3 match-job request: CV='%s'", file.filename)

    # ── Read PDF ──────────────────────────────────────────────────────────
    try:
        file_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {exc}")
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    # ── Parse JD payload ─────────────────────────────────────────────────
    try:
        jd: Dict[str, Any] = json.loads(job_data)
    except Exception:
        raise HTTPException(status_code=422, detail="job_data must be valid JSON.")

    if not jd.get("description"):
        raise HTTPException(status_code=422, detail="job_data must include a 'description' field.")

    # ── Layer 1 + 2: CV Understanding (orchestrator handles both) ─────────
    try:
        orchestrator = _get_orchestrator()
        cv_result: CVParseResult = orchestrator.process_cv(file_bytes, file.filename)
    except Exception as exc:
        logger.exception("V3 match-job CV analysis failed: %s", exc)
        raise HTTPException(status_code=500, detail="CV analysis failed.")

    if cv_result.parsing_status != "success":
        raise HTTPException(
            status_code=422,
            detail=f"Could not extract text from CV (status={cv_result.parsing_status}).",
        )

    # Retrieve raw text for semantic embedding — stored in extraction metadata.
    cv_raw_text: str = ""
    extraction_meta = cv_result.analysis.metadata.get("extraction", {})
    # The spatial parser word count can confirm text was extracted.
    # We re-build a proxy text from skills + title for the embedding when raw text isn't stored.
    if cv_result.profile.current_title:
        cv_raw_text += cv_result.profile.current_title + ". "
    cv_raw_text += " ".join(sk.name for sk in cv_result.skills.items)
    if cv_result.analysis.primary_domain:
        cv_raw_text += " " + cv_result.analysis.primary_domain
    if cv_result.analysis.summary:
        cv_raw_text = cv_result.analysis.summary + " " + cv_raw_text

    # ── Layer 3: Intelligent Matching ─────────────────────────────────────
    try:
        matcher = _get_matcher()
        match_result = matcher.calculate_match(cv_result, jd, cv_raw_text=cv_raw_text)
    except Exception as exc:
        logger.exception("V3 match-job matching failed: %s", exc)
        raise HTTPException(status_code=500, detail="Matching engine failed.")

    # ── Enrich analysis with gaps & red_flags ─────────────────────────────
    # Pydantic models are immutable; serialise, patch, return as plain dict.
    result_dict: Dict[str, Any] = cv_result.model_dump(mode="json")
    result_dict["analysis"]["gaps"] = match_result.missing_skills
    result_dict["analysis"]["red_flags"] = match_result.red_flags

    dt_ms = (time.perf_counter() - t0) * 1000.0
    logger.info(
        "V3 match-job completed score=%.1f time_ms=%.1f",
        match_result.match_score, dt_ms,
    )

    return {
        "status": "success",
        "cv_analysis": result_dict,
        "match": match_result.to_dict(),
    }

if __name__ == "__main__":
    import uvicorn
    # Running on port 8002 to avoid conflicts with the legacy ai-engine (port 8001)
    uvicorn.run(app, host="0.0.0.0", port=8002)
