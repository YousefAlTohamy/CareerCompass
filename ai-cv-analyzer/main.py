"""
CareerCompass AI CV Analyzer — Sub-Service (Port 8002)
------------------------------------------------------
The master API gateway runs at ai-hybrid-orchestrator/main_api.py (port 8001).
This module is the sub-service entry point with Phase 5 production hardening:

- 30-second timeout per CV (returns partial result on timeout)
- Graceful error handling — always returns structured JSON
- Comprehensive structured logging (phase latency, memory, extraction source)
- Thread-safe orchestrator for multi-worker (Celery) environments
- process_file() standalone interface for CLI/batch usage
"""

import gc
import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from core.layer1_understanding.orchestrator import CVOrchestrator, OrchestratorConfig
from core.layer1_understanding.schema import CVParseResult

# Layer 2 & 3 (warm singletons during startup)
from core.layer2_classification.classifier import CVDomainClassifier
from core.layer3_matching.similarity import IntelligentMatcher

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("careercompass.main")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
_CV_TIMEOUT_SECONDS = int(os.getenv("CV_TIMEOUT_SECONDS", "30"))

# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="CareerCompass AI Engine v2.0",
    description="Sub-Service: 3-Layer Intelligent Backend for CV Analysis",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Singleton orchestrator (loaded once, shared across requests)
# ---------------------------------------------------------------------------
_V2_ORCHESTRATOR: Optional[CVOrchestrator] = None
# Single-thread executor used to enforce timeout on blocking CV processing
_TIMEOUT_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="cv_worker")


def _get_orchestrator() -> CVOrchestrator:
    global _V2_ORCHESTRATOR
    if _V2_ORCHESTRATOR is None:
        _V2_ORCHESTRATOR = CVOrchestrator()
    return _V2_ORCHESTRATOR


# ---------------------------------------------------------------------------
# Startup — pre-warm singletons
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup_event():
    logger.info("CareerCompass Core-Analyzer starting on Port 8002 ...")

    # Pre-warm heavy singletons so first requests aren't slow
    try:
        CVDomainClassifier()
    except Exception as e:
        logger.warning("CVDomainClassifier prewarm failed: %s", e)

    try:
        IntelligentMatcher()
    except Exception as e:
        logger.warning("IntelligentMatcher prewarm failed: %s", e)

    try:
        _get_orchestrator()
    except Exception as e:
        logger.warning("CVOrchestrator prewarm failed (will retry on request): %s", e)

    logger.info("All AI models loaded into memory.")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/")
def health_check():
    return {"status": "operational", "version": "v2.0 (Phase 5)"}


# ---------------------------------------------------------------------------
# Main CV analysis endpoint (with timeout & graceful error handling)
# ---------------------------------------------------------------------------
@app.post("/api/parse-cv")
async def analyze_cv(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Analyze a CV PDF.

    - **Timeout**: If processing exceeds ``CV_TIMEOUT_SECONDS`` (default 30s),
      returns a partial/empty result with ``parsing_status="timeout"``.
    - **Crash-safe**: Any unhandled exception returns a structured JSON
      response with ``parsing_status="error"``.
    """
    t0 = time.perf_counter()
    filename = file.filename or "<upload>"
    logger.info("=== CV Analysis Request: %s ===", filename)

    # ---- Read file bytes ----
    try:
        file_bytes = await file.read()
    except Exception as e:
        logger.error("Failed to read uploaded file: %s", e)
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    logger.info("File size: %.1f KB", len(file_bytes) / 1024)

    # ---- Process with timeout ----
    try:
        result = _process_with_timeout(file_bytes, filename)
    except FuturesTimeoutError:
        elapsed = time.perf_counter() - t0
        logger.warning(
            "CV processing TIMED OUT after %.1fs for %s", elapsed, filename
        )
        result = _timeout_result()
    except Exception as e:
        elapsed = time.perf_counter() - t0
        logger.exception(
            "CV processing CRASHED after %.1fs for %s: %s", elapsed, filename, e
        )
        result = _error_result(str(e))

    # ---- Log final summary ----
    elapsed_ms = (time.perf_counter() - t0) * 1000
    if isinstance(result, CVParseResult):
        status = result.parsing_status
        role = result.profile.current_title
        result_dict = result.model_dump(mode="json")
    else:
        status = result.get("parsing_status", "unknown")
        role = None
        result_dict = result

    logger.info(
        "=== CV Analysis Complete: status=%s role=%s time=%.0fms file=%s ===",
        status, role, elapsed_ms, filename,
    )

    return result_dict


def _process_with_timeout(file_bytes: bytes, filename: str) -> CVParseResult:
    """Submit the CV processing to a thread pool with a timeout."""
    orchestrator = _get_orchestrator()
    future = _TIMEOUT_EXECUTOR.submit(orchestrator.process_cv, file_bytes, filename)
    return future.result(timeout=_CV_TIMEOUT_SECONDS)


# ---------------------------------------------------------------------------
# Standalone file interface (for CLI / batch / Laravel shell_exec)
# ---------------------------------------------------------------------------
def process_file(file_path: str, timeout_seconds: int = 30) -> Dict[str, Any]:
    """
    Process a CV from a local file path.

    This is the **final interface** for external callers (e.g., Laravel's
    ``shell_exec``, batch scripts, or Celery tasks).

    Returns:
        Strict ``CVParseResult`` as a JSON-serializable dict (always).
        On timeout: ``parsing_status="timeout"``.
        On crash: ``parsing_status="error"`` with ``error_detail``.
    """
    t0 = time.perf_counter()
    logger.info("process_file() called for: %s", file_path)

    path = Path(file_path)
    if not path.exists():
        return _error_result(f"File not found: {file_path}")
    if not path.suffix.lower() == ".pdf":
        return _error_result(f"Unsupported file type: {path.suffix}")

    try:
        file_bytes = path.read_bytes()
    except Exception as e:
        return _error_result(f"Failed to read file: {e}")

    if not file_bytes:
        return _error_result("File is empty (0 bytes).")

    logger.info("File size: %.1f KB", len(file_bytes) / 1024)

    try:
        orchestrator = _get_orchestrator()
        future = _TIMEOUT_EXECUTOR.submit(
            orchestrator.process_cv, file_bytes, path.name
        )
        result = future.result(timeout=timeout_seconds)
    except FuturesTimeoutError:
        elapsed = time.perf_counter() - t0
        logger.warning("process_file TIMED OUT after %.1fs", elapsed)
        return _timeout_result()
    except Exception as e:
        elapsed = time.perf_counter() - t0
        logger.exception("process_file CRASHED after %.1fs: %s", elapsed, e)
        return _error_result(str(e))

    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info("process_file completed in %.0fms", elapsed_ms)

    # Force GC after processing
    gc.collect()

    return result.model_dump(mode="json")


# ---------------------------------------------------------------------------
# Structured fallback results
# ---------------------------------------------------------------------------
def _timeout_result() -> Dict[str, Any]:
    """Return a structured timeout response matching CVParseResult shape."""
    return {
        "parsing_status": "error",
        "profile": {
            "full_name": None,
            "current_title": None,
            "headline": None,
            "summary": None,
            "confidence_score": 0.0,
            "contact": {
                "email": None,
                "phone": None,
                "linkedin_url": None,
                "github_url": None,
                "location": None,
            },
        },
        "stats": {
            "page_count": 0,
            "char_count": 0,
            "word_count": 0,
            "language_hint": None,
        },
        "skills": {"items": [], "confidence_score": 0.0},
        "experience": {"items": [], "confidence_score": 0.0},
        "analysis": {
            "summary": None,
            "predicted_role": None,
            "seniority": None,
            "primary_domain": None,
            "strengths": [],
            "gaps": [],
            "red_flags": [],
            "confidence_score": 0.0,
            "metadata": {"error": "Processing timed out. The CV may be too large or complex."},
        },
    }


def _error_result(error_detail: str) -> Dict[str, Any]:
    """Return a structured error response matching CVParseResult shape."""
    result = _timeout_result()
    result["analysis"]["metadata"] = {"error": error_detail}  # type: ignore[index]
    return result


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # If called with a file path argument, run process_file and print JSON
    if len(sys.argv) > 1:
        result = process_file(sys.argv[1])
        print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
    else:
        # Default: run as FastAPI server
        import uvicorn
        uvicorn.run(app, host="0.0.0.0", port=8002)
