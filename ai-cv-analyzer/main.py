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
    logger.info("CareerCompass Core-Analyzer running on Port 8002")
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




_V2_ORCHESTRATOR: CVOrchestrator | None = None


def _get_orchestrator() -> CVOrchestrator:
    global _V2_ORCHESTRATOR
    if _V2_ORCHESTRATOR is None:
        _V2_ORCHESTRATOR = CVOrchestrator()
    return _V2_ORCHESTRATOR


@app.post("/api/parse-cv", response_model=CVParseResult)
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



if __name__ == "__main__":
    import uvicorn
    # Running on port 8002 to avoid conflicts with the legacy ai-engine (port 8001)
    uvicorn.run(app, host="0.0.0.0", port=8002)
