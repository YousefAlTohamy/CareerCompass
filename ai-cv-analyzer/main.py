"""
LEGACY SUB-SERVICE NOTICE
-------------------------
This file (ai-cv-analyzer/main.py) is now a sub-service.
The master API entry point is located in the ai-hybrid-orchestrator/main_api.py folder (running on port 8001).
"""
import os
from dotenv import load_dotenv

# لازم السطر ده يكون في الأول عشان يحمل التوكن قبل ما موديلز الذكاء الاصطناعي تشتغل
load_dotenv() 

import logging
import time
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

import logging
import time
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

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
    logger.info("NOTICE: ai-cv-analyzer is now a sub-service. Master API runs via ai-hybrid-orchestrator/main_api.py")
    CVDomainClassifier()
    # IntelligentMatcher initializes the SemanticEmbedder automatically
    IntelligentMatcher()
    # V2 pipeline facade (loads AdvancedNEREngine lazily/once)
    try:
        CVOrchestrator()
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


def _get_orchestrator() -> CVOrchestrator:
    global _V2_ORCHESTRATOR
    if _V2_ORCHESTRATOR is None:
        _V2_ORCHESTRATOR = CVOrchestrator()
    return _V2_ORCHESTRATOR


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
    cv_text: str
    cv_skills: list[str]
    job_description: str
    job_skills: list[str]

@app.post("/api/v2/match-job")
def match_job(request: MatchRequest) -> Dict[str, Any]:
    """
    Layer 3 endpoint: Compares a user's CV to a specific job description.
    """
    logger.info("--> Executing Layer 3: Intelligent Matching")
    
    matcher = IntelligentMatcher()
    
    cv_data = {"raw_text": request.cv_text, "skills": request.cv_skills}
    job_data = {"description": request.job_description, "skills": request.job_skills}
    
    match_results = matcher.calculate_match(cv_data, job_data)
    
    return {
        "status": "success",
        "layer3_matching": match_results
    }

if __name__ == "__main__":
    import uvicorn
    # Running on port 8002 to avoid conflicts with the legacy ai-engine (port 8001)
    uvicorn.run(app, host="0.0.0.0", port=8002)
