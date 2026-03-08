"""
main_api.py
===========
Career Compass AI Gateway — FastAPI Microservice
Port: 8000  (consumed by Laravel backend)

Endpoints
---------
  POST /api/v1/parse-cv          Upload CV → text + skills + domain + contacts
  POST /api/v1/scrape-on-demand  URL → list of parsed job dicts (max 5)
  POST /api/v1/hybrid-match      cv_text + jd_text → weighted match score

Run
---
    uvicorn main_api:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import sys
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

# ── Path injection — must happen before any engine imports ────────────────────
_ROOT             = Path(__file__).resolve().parent.parent
_JOB_MINER_ROOT   = _ROOT / "ai-job-miner"
_CV_ANALYZER_ROOT = _ROOT / "ai-cv-analyzer"


def _wipe_core() -> None:
    """Remove all 'core' and 'core.*' entries from sys.modules."""
    for key in [k for k in sys.modules if k == "core" or k.startswith("core.")]:
        del sys.modules[key]


def _set_path_exclusive(root: Path) -> None:
    """Put `root` at the front of sys.path, removing the other engine root."""
    other = _CV_ANALYZER_ROOT if root == _JOB_MINER_ROOT else _JOB_MINER_ROOT
    # Remove both engine roots, then re-insert only `root`
    sys.path[:] = [str(root)] + [
        p for p in sys.path if p not in (str(_CV_ANALYZER_ROOT), str(_JOB_MINER_ROOT))
    ]


# ── Phase 1: load ai-cv-analyzer exclusively ─────────────────────────────────
_wipe_core()
_set_path_exclusive(_CV_ANALYZER_ROOT)

from core.layer1_understanding.universal_extractor import process_document      # noqa: E402
from core.layer1_understanding.ner_engine          import SkillNEREngine        # noqa: E402
from core.layer2_classification.classifier         import CVDomainClassifier    # noqa: E402
from core.layer3_matching.similarity               import IntelligentMatcher    # noqa: E402

# ── Phase 2: load ai-job-miner exclusively ───────────────────────────────────
# CRITICAL: wipe cv-analyzer's core.* before importing job-miner's core.engine
_wipe_core()
_set_path_exclusive(_JOB_MINER_ROOT)

from core.engine import ScrapingEngine   # noqa: E402
from ai.matcher  import match_score      # noqa: E402

# ── Phase 3: restore both roots for intra-package runtime imports ─────────────
for _p in (_CV_ANALYZER_ROOT, _JOB_MINER_ROOT):
    if str(_p) not in sys.path:
        sys.path.append(str(_p))

# ── Local orchestrator utilities ─────────────────────────────────────────────
_ORCH_ROOT = Path(__file__).resolve().parent
if str(_ORCH_ROOT) not in sys.path:
    sys.path.insert(0, str(_ORCH_ROOT))
from contact_extractor import extract_contacts   # noqa: E402


# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s  %(name)s — %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("gateway")
logger.setLevel(logging.DEBUG)

# ── FastAPI ───────────────────────────────────────────────────────────────────
from fastapi import FastAPI, File, Form, HTTPException, UploadFile   # noqa: E402
from fastapi.middleware.cors import CORSMiddleware                    # noqa: E402
from pydantic import BaseModel                                        # noqa: E402
from typing import Any, Dict, Optional, Union                                # noqa: E402

# ── Singleton AI models (load once on startup) ────────────────────────────────
_ner_engine: SkillNEREngine | None     = None
_classifier: CVDomainClassifier | None = None
_matcher:    IntelligentMatcher | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load heavy AI models once at startup; keep them alive for all requests."""
    global _ner_engine, _classifier, _matcher
    logger.info("🚀 Loading AI models…")
    _ner_engine = SkillNEREngine()
    _classifier = CVDomainClassifier()
    _matcher    = IntelligentMatcher()
    logger.info("✅ All models ready — Gateway is live.")
    yield
    logger.info("🛑 Shutting down Gateway.")


app = FastAPI(
    title="Career Compass AI Gateway",
    description=(
        "FastAPI microservice wrapping ai-job-miner and ai-cv-analyzer. "
        "Consumed by the Laravel backend at port 8000."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # restrict in production to Laravel's domain
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def health_check():
    return {"status": "operational", "version": "1.0.0", "service": "Career Compass AI Gateway"}


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 1 — POST /api/v1/parse-cv
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/parse-cv", tags=["CV Analysis"])
async def parse_cv(cv_file: UploadFile = File(...)):
    """
    Upload a CV file (PDF / DOCX / PNG / JPG).

    Returns:
    - **skills** extracted by BERT NER
    - **domain** classified by BART-MNLI
    - **domain_confidence** as a percentage string
    - **contact_info** (email, phone, linkedin, github, location)
    - **extraction_method** used (pymupdf, python-docx, easyocr, …)
    """
    # ── Validate file type ────────────────────────────────────────────────────
    allowed_extensions = {"pdf", "docx", "doc", "png", "jpg", "jpeg"}
    filename  = cv_file.filename or "upload"
    extension = filename.rsplit(".", 1)[-1].lower()
    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type '.{extension}'. Accepted: {sorted(allowed_extensions)}",
        )

    # ── Write to temp file ────────────────────────────────────────────────────
    tmp_path: str | None = None
    try:
        file_bytes = await cv_file.read()
        if not file_bytes:
            raise HTTPException(status_code=422, detail="Uploaded file is empty.")

        # Layer 1 — extract raw text
        raw_text, extraction_method = process_document(filename, file_bytes)
        if not raw_text:
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from the CV. Please upload a readable PDF, DOCX, or image.",
            )

        # Layer 1 — NER
        entities  = _ner_engine.extract_entities(raw_text)
        cv_skills = entities.get("skills", [])

        # Layer 2 — domain classification
        domain_probs      = _classifier.predict_domain(raw_text)
        primary_domain    = max(domain_probs, key=domain_probs.get) if domain_probs else "Unknown"
        domain_confidence = f"{round(domain_probs.get(primary_domain, 0.0) * 100, 1)}%"

        # Contact extraction
        contact_info = extract_contacts(raw_text)

        return {
            "skills":             cv_skills,
            "domain":             primary_domain,
            "domain_confidence":  domain_confidence,
            "contact_info":       contact_info,
            "extraction_method":  extraction_method,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("parse-cv failed")
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}") from exc


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 2 — POST /api/v1/scrape-on-demand
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/scrape-on-demand", tags=["Job Scraping"])
async def scrape_on_demand(source_url: str = Form(...)):
    """
    Scrape a job listing URL using the full 5-phase ai-job-miner pipeline.

    Returns a JSON list of up to **5** parsed job dictionaries, each containing:
    title, job_type, work_model, location, working_hours, salary, experience,
    skills, match_score, url.
    """
    if not source_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="source_url must start with http:// or https://")

    try:
        engine = ScrapingEngine(rate=3.0)
        jobs: list[dict] = []

        async for job in engine.stream_jobs([source_url], scraper_type="html"):
            jobs.append(job)
            if len(jobs) >= 5:
                break

        if not jobs:
            # Return DLQ summary so the caller knows why it failed
            return {
                "jobs":    [],
                "scraped": 0,
                "dlq":     engine.dlq.summary,
                "message": "No jobs could be scraped from the provided URL.",
            }

        return {"jobs": jobs, "scraped": len(jobs)}

    except Exception as exc:
        logger.exception("scrape-on-demand failed")
        raise HTTPException(status_code=500, detail=f"Scraping error: {exc}") from exc


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 2.5 — POST /test-source
# ─────────────────────────────────────────────────────────────────────────────

class TestSourceSourceProxy(BaseModel):
    id: Optional[int] = None
    name: str = ""
    endpoint: str
    type: str = "html"
    headers: Union[dict, list, str, None] = None
    params: Union[dict, list, str, None] = None

class TestSourceRequest(BaseModel):
    source: TestSourceSourceProxy
    query: str = "developer"
    max_results: int = 2

@app.post("/test-source", tags=["Job Scraping"])
async def test_source(body: TestSourceRequest):
    """
    Test a single configured job scraping source by constructing
    the final URL and firing up the ScrapingEngine.
    """
    import urllib.parse
    
    # 1. Update params with the provided search query
    
    # Safely parse params: PHP arrays may be sent as lists [] or JSON strings
    raw_params = body.source.params
    if isinstance(raw_params, dict):
        params = dict(raw_params)
    elif isinstance(raw_params, str):
        import json
        try:
            params = json.loads(raw_params)
            if not isinstance(params, dict):
                params = {}
        except:
            params = {}
    else:
        params = {}
        
    injected = False
    
    # Try common keys for searching
    for key in ["q", "search", "keyword", "keywords"]:
        if key in params:
            params[key] = body.query
            injected = True
            break
            
    # If no obvious search param key is found in the DB configs, default to "q"
    if not injected and params:
        for k in params.keys():
            params[k] = body.query
            break
    elif not injected and not params:
        params["q"] = body.query
        
    # 2. Build the target URL
    url_parts = list(urllib.parse.urlparse(body.source.endpoint))
    existing_query = dict(urllib.parse.parse_qsl(url_parts[4]))
    existing_query.update(params)
    
    # Adzuna Injector
    scraper_type_override = body.source.type
    if "adzuna.com" in body.source.endpoint:
        scraper_type_override = "api"  # Force API scraper for Adzuna despite Laravel's HTML redirect
        env_path = _ROOT / "ai-hybrid-orchestrator" / ".env"
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("ADZUNA_APP_ID="):
                        existing_query["app_id"] = line.split("=", 1)[1]
                    elif line.startswith("ADZUNA_APP_KEY="):
                        existing_query["app_key"] = line.split("=", 1)[1]
                        
        # Adzuna specific param mapping
        if "search" in existing_query:
            existing_query["what"] = existing_query.pop("search")
        elif "q" in existing_query:
            existing_query["what"] = existing_query.pop("q")
            
        if "limit" in existing_query:
            existing_query["results_per_page"] = existing_query.pop("limit")
    
    url_parts[4] = urllib.parse.urlencode(existing_query)
    
    target_url = urllib.parse.urlunparse(url_parts)
    logger.info(f"Target URL: {target_url}")
    
    # 3. Scrape
    try:
        engine = ScrapingEngine(rate=3.0)
        jobs: list[dict] = []

        async for job in engine.stream_jobs([target_url], scraper_type=scraper_type_override):
            jobs.append(job)
            if len(jobs) >= body.max_results:
                break

        if not jobs:
            return {
                "jobs":    [],
                "total_fetched": 0,
                "dlq":     engine.dlq.summary,
                "message": "No jobs returned – site may be blocking the scraper.",
            }

        return {"jobs": jobs, "total_fetched": len(jobs)}

    except Exception as exc:
        logger.exception("test-source failed")
        raise HTTPException(status_code=500, detail=f"Scraping error: {exc}") from exc


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 3 — POST /scrape-jobs (Background Market Scraping)
# ─────────────────────────────────────────────────────────────────────────────

class ScrapeJobsRequest(BaseModel):
    query: str
    max_results: int = 30
    use_samples: bool = False
    calculate_statistics: bool = True
    sources: list[TestSourceSourceProxy]


@app.post("/scrape-jobs", tags=["Job Scraping"])
async def scrape_jobs(body: ScrapeJobsRequest):
    """
    Called by Laravel's background job (ProcessMarketScraping).
    Loops through the provided active sources, constructs their URLs,
    and scrapes jobs in parallel (or sequentially) returning a unified list.
    """
    import urllib.parse
    
    all_jobs = []
    
    # We iterate over each requested source configuration
    for source_proxy in body.sources:
        try:
            # Safely parse params: PHP arrays may be sent as lists [] or JSON strings
            raw_params = source_proxy.params
            if isinstance(raw_params, dict):
                params = dict(raw_params)
            elif isinstance(raw_params, str):
                import json
                try:
                    params = json.loads(raw_params)
                    if not isinstance(params, dict):
                        params = {}
                except:
                    params = {}
            else:
                params = {}
                
            injected = False
            
            # Inject Laravel's search query
            for key in ["q", "search", "keyword", "keywords"]:
                if key in params:
                    params[key] = body.query
                    injected = True
                    break
                    
            if not injected and params:
                for k in params.keys():
                    params[k] = body.query
                    break
            elif not injected and not params:
                params["q"] = body.query
                
            # Build URL
            url_parts = list(urllib.parse.urlparse(source_proxy.endpoint))
            existing_query = dict(urllib.parse.parse_qsl(url_parts[4]))
            existing_query.update(params)
            
            # Adzuna Logic (same as /test-source)
            scraper_type_override = source_proxy.type
            if "adzuna.com" in source_proxy.endpoint:
                scraper_type_override = "api"
                env_path = _ROOT / "ai-hybrid-orchestrator" / ".env"
                if env_path.exists():
                    with open(env_path, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if line.startswith("ADZUNA_APP_ID="):
                                existing_query["app_id"] = line.split("=", 1)[1]
                            elif line.startswith("ADZUNA_APP_KEY="):
                                existing_query["app_key"] = line.split("=", 1)[1]
                                
                if "search" in existing_query:
                    existing_query["what"] = existing_query.pop("search")
                elif "q" in existing_query:
                    existing_query["what"] = existing_query.pop("q")
                    
                if "limit" in existing_query:
                    existing_query["results_per_page"] = existing_query.pop("limit")
            
            url_parts[4] = urllib.parse.urlencode(existing_query)
            target_url = urllib.parse.urlunparse(url_parts)
            
            logger.info(f"[scrape-jobs] Scraping source '{source_proxy.name}' for query '{body.query}' -> {target_url}")
            
            # Fire up the engine for this current source URL
            engine = ScrapingEngine(rate=3.0)
            source_jobs = []
            
            # Use max_results logic. If not provided, we pull up to body.max_results per source
            # The Laravel system expects batching per source or collectively. Usually collectively, but doing it per source is safer.
            async for job in engine.stream_jobs([target_url], scraper_type=scraper_type_override):
                source_jobs.append(job)
                if len(source_jobs) >= body.max_results:
                    break
                    
            # Add to the global return list
            all_jobs.extend(source_jobs)
            
        except Exception as e:
            logger.error(f"[scrape-jobs] Failed to scrape {source_proxy.name}: {e}")
            continue

    # ProcessMarketScraping in Laravel expects {"jobs": [...]} in the root JSON response 
    # and maybe 'statistics' if calculate_statistics is true. We'll return jobs directly.
    return {
        "total_jobs": len(all_jobs),
        "jobs": all_jobs,
        "statistics": {} # Placeholder for potential local AI statistics rendering later
    }


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 4 — POST /api/v1/hybrid-match
# ─────────────────────────────────────────────────────────────────────────────

class HybridMatchRequest(BaseModel):
    cv_skills:       list[str]
    cv_text:         str
    job_description: str
    job_skills:      list[str] = []


@app.post("/api/v1/hybrid-match", tags=["Matching"])
async def hybrid_match(body: HybridMatchRequest):
    """
    Compute a weighted hybrid match score between a CV and a job description.

    **Formula:** `Final = (Semantic × 60%) + (TF-IDF × 40%)`

    Returns:
    - **hybrid_match_score** (0–100)
    - **semantic_score** (60% component)
    - **tfidf_score** (40% component)
    - **missing_skills** list
    """
    if not body.cv_text.strip():
        raise HTTPException(status_code=422, detail="cv_text must not be empty.")
    if not body.job_description.strip():
        raise HTTPException(status_code=422, detail="job_description must not be empty.")

    try:
        # Semantic score — deep learning embeddings (60% weight)
        semantic_result    = _matcher.calculate_match(
            cv_data  = {"raw_text": body.cv_text,         "skills": body.cv_skills},
            job_data = {"description": body.job_description, "skills": body.job_skills},
        )
        semantic_score_pct = semantic_result.get("semantic_score", 0.0)
        missing_skills     = semantic_result.get("missing_skills", [])

        # TF-IDF score — pure math cosine (40% weight)
        tfidf_raw       = match_score(body.cv_text, body.job_description)
        tfidf_score_pct = round(tfidf_raw * 100, 2)

        # Weighted final score
        final_score = round((semantic_score_pct * 0.60) + (tfidf_score_pct * 0.40), 2)

        return {
            "hybrid_match_score": final_score,
            "semantic_score":     semantic_score_pct,
            "tfidf_score":        tfidf_score_pct,
            "missing_skills":     missing_skills,
            "formula":            "Final = (Semantic × 60%) + (TF-IDF × 40%)",
        }

    except Exception as exc:
        logger.exception("hybrid-match failed")
        raise HTTPException(status_code=500, detail=f"Matching error: {exc}") from exc


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main_api:app", host="0.0.0.0", port=8000, reload=True)
