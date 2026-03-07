"""
hybrid_runner.py
================
AI Hybrid Orchestrator — Facade Pattern

Combines two standalone AI engines:
  • ai-job-miner   : 5-phase heuristic scraping + TF-IDF matching
  • ai-cv-analyzer : Deep-learning CV understanding + semantic embedding

Import strategy
---------------
Both engines have a top-level ``core/`` package.  We resolve the collision
by simply loading ai-cv-analyzer FIRST (so its ``core`` gets registered in
sys.modules), then loading ai-job-miner's namespaces that do NOT collide
with ``core`` — namely ``ai.matcher`` and ``core.engine``.

Because ai-job-miner's ScrapingEngine also lives under ``core/``, we swap
sys.path to job-miner-only before that specific import.

Hybrid Scoring Formula
----------------------
    Final Score = (Semantic Score × 60%) + (TF-IDF Score × 40%)

Usage
-----
    python hybrid_runner.py
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from contextlib import contextmanager
from pathlib import Path

# ─── Root paths ────────────────────────────────────────────────────────────────
_ROOT             = Path(__file__).resolve().parent.parent
_JOB_MINER_ROOT   = _ROOT / "ai-job-miner"
_CV_ANALYZER_ROOT = _ROOT / "ai-cv-analyzer"

# ─── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s  %(name)s — %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("orchestrator")


@contextmanager
def _only(root: Path):
    """Temporarily make ``root`` the sole engine root on sys.path."""
    str_root = str(root)
    # Build a fresh sys.path that contains neither engine root
    base = [p for p in sys.path
            if p not in (str(_JOB_MINER_ROOT), str(_CV_ANALYZER_ROOT))]
    sys.path[:] = [str_root] + base
    # Wipe cached 'core' so the correct package is discovered
    keys_to_del = [k for k in sys.modules if k == "core" or k.startswith("core.")]
    for k in keys_to_del:
        del sys.modules[k]
    try:
        yield
    finally:
        pass   # caller restores as needed


# ==============================================================================
# Step 1 — Load ai-cv-analyzer modules
# ==============================================================================
with _only(_CV_ANALYZER_ROOT):
    from core.layer1_understanding.universal_extractor import process_document
    from core.layer1_understanding.ner_engine          import SkillNEREngine
    from core.layer2_classification.classifier         import CVDomainClassifier
    from core.layer3_matching.similarity               import IntelligentMatcher

# Save the cv-analyzer core modules under unique aliases so they survive the
# sys.modules wipe that happens next
import sys as _sys
_cva_core_mods = {k: v for k, v in _sys.modules.items()
                  if k == "core" or k.startswith("core.")}
_cva_core_mods_aliased = {}
for k, v in _cva_core_mods.items():
    alias = "cva." + k          # e.g. "cva.core.layer1_understanding"
    _cva_core_mods_aliased[alias] = v
_sys.modules.update(_cva_core_mods_aliased)


# ==============================================================================
# Step 2 — Load ai-job-miner modules (different sub-packages: ai.*, core.engine)
# ==============================================================================
with _only(_JOB_MINER_ROOT):
    from core.engine import ScrapingEngine
    from ai.matcher  import match_score

# Also alias job-miner core under "jm.*" for safety
_jm_core_mods_aliased = {}
for k, v in _sys.modules.items():
    if k == "core" or k.startswith("core."):
        _jm_core_mods_aliased["jm." + k] = v
_sys.modules.update(_jm_core_mods_aliased)

# Restore both roots to sys.path for runtime use
for p in (_CV_ANALYZER_ROOT, _JOB_MINER_ROOT):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))


# ─── Module-level singletons ───────────────────────────────────────────────────
logger.info("Loading AI models… (first run may take ~30 s)")
_ner_engine = SkillNEREngine()
_classifier = CVDomainClassifier()
_matcher    = IntelligentMatcher()   # loads all-MiniLM-L6-v2
logger.info("All models ready.")


# ==============================================================================
# Core Hybrid Function
# ==============================================================================

async def process_hybrid_application(
    cv_path: str,
    job_url: str,
    rate: float = 3.0,
) -> dict:
    """
    Full hybrid analysis pipeline.

    Parameters
    ----------
    cv_path : str
        Absolute path to the candidate's CV (PDF, DOCX, PNG/JPG).
    job_url : str
        URL of the job listing to scrape and analyse.
    rate : float
        Token-Bucket request rate for the scraping engine (req/s).

    Returns
    -------
    dict
        Structured result with keys: ``job``, ``cv``, ``scores``.
    """
    logger.info("═" * 60)
    logger.info("Hybrid pipeline started")
    logger.info("  CV  : %s", cv_path)
    logger.info("  Job : %s", job_url)
    logger.info("═" * 60)

    # ── Read & parse CV (needed as TF-IDF reference text) ────────────────────
    cv_bytes = _read_file(cv_path)
    cv_raw_text, extraction_method = process_document(
        os.path.basename(cv_path), cv_bytes
    )

    if not cv_raw_text:
        return {"error": "CV text extraction failed — unsupported format or empty file."}

    # ── Action A: Scrape & parse job listing ──────────────────────────────────
    logger.info("[A] Scraping job via ScrapingEngine…")
    engine = ScrapingEngine(rate=rate, reference_text=cv_raw_text)

    job_dict: dict | None = None
    async for job in engine.stream_jobs([job_url], scraper_type="html"):
        job_dict = job
        break

    if job_dict is None:
        return {
            "error":   "Job scraping failed. Check engine.dlq for details.",
            "dlq":     engine.dlq.summary,
            "job_url": job_url,
        }

    logger.info("[A] ✓ Job scraped: '%s'", job_dict.get("title", job_url))

    # ── Action B: Parse CV via ai-cv-analyzer ────────────────────────────────
    logger.info("[B] Analysing CV…")

    entities          = _ner_engine.extract_entities(cv_raw_text)
    cv_skills         = entities.get("skills",        [])
    cv_roles          = entities.get("roles",         [])

    domain_probs      = _classifier.predict_domain(cv_raw_text)
    primary_domain    = max(domain_probs, key=domain_probs.get) if domain_probs else "Unknown"
    domain_confidence = round(domain_probs.get(primary_domain, 0.0) * 100, 1)

    logger.info(
        "[B] ✓ Domain: %s (%.1f%%)  |  skills: %d",
        primary_domain, domain_confidence, len(cv_skills),
    )

    # ── Action C: Hybrid Scoring ──────────────────────────────────────────────
    logger.info("[C] Computing hybrid match score…")

    job_description = job_dict.get("description", "")
    job_skills      = job_dict.get("skills",      [])

    # C1 — Semantic score via deep-learning embedder (60% weight)
    semantic_result    = _matcher.calculate_match(
        cv_data  = {"raw_text": cv_raw_text,  "skills": cv_skills},
        job_data = {"description": job_description, "skills": job_skills},
    )
    semantic_score_pct = semantic_result["semantic_score"]
    missing_skills     = semantic_result["missing_skills"]

    # C2 — Strict math TF-IDF score (40% weight)
    tfidf_raw       = match_score(cv_raw_text, job_description) if job_description else 0.0
    tfidf_score_pct = round(tfidf_raw * 100, 2)

    # C3 — Weighted final score
    final_score_pct = round((semantic_score_pct * 0.60) + (tfidf_score_pct * 0.40), 2)

    logger.info(
        "[C] ✓ Semantic=%.1f%%  TF-IDF=%.1f%%  Final=%.1f%%",
        semantic_score_pct, tfidf_score_pct, final_score_pct,
    )

    return {
        "job": {
            "url":           job_dict["url"],
            "title":         job_dict.get("title",         ""),
            "job_type":      job_dict.get("job_type",      "Unspecified"),
            "work_model":    job_dict.get("work_model",    "Unspecified"),
            "location":      job_dict.get("location",      ""),
            "working_hours": job_dict.get("working_hours", ""),
            "salary":        job_dict.get("salary",        {}),
            "experience":    job_dict.get("experience",    {}),
            "skills":        job_dict.get("skills",        []),
        },
        "cv": {
            "raw_text_preview":  cv_raw_text[:400] + "…",
            "extraction_method": extraction_method,
            "skills":            cv_skills,
            "roles":             cv_roles,
            "domain":            primary_domain,
            "domain_confidence": f"{domain_confidence}%",
        },
        "scores": {
            "semantic_score_pct": semantic_score_pct,
            "tfidf_score_pct":    tfidf_score_pct,
            "final_score_pct":    final_score_pct,
            "formula":            "Final = (Semantic × 60%) + (TF-IDF × 40%)",
            "missing_skills":     missing_skills,
        },
    }


# ─── Helper ────────────────────────────────────────────────────────────────────

def _read_file(path: str) -> bytes:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(
            f"CV file not found: '{path}'\n"
            "Update MOCK_CV_PATH in hybrid_runner.py to point to a real CV."
        )
    return p.read_bytes()


# ─── Local Test Block ──────────────────────────────────────────────────────────

MOCK_CV_PATH = str(_CV_ANALYZER_ROOT / "test.pdf")
MOCK_JOB_URL = "https://remotive.com/api/remote-jobs?limit=3"


async def _main() -> None:
    print("\n" + "═" * 64)
    print("  AI Hybrid Orchestrator — Local Integration Test")
    print("═" * 64 + "\n")

    try:
        result = await process_hybrid_application(
            cv_path=MOCK_CV_PATH,
            job_url=MOCK_JOB_URL,
        )
    except FileNotFoundError as e:
        print(f"\n⚠  {e}\n")
        return

    print("\n" + "─" * 64)
    print("  RESULT")
    print("─" * 64)
    print(json.dumps(result, indent=4, ensure_ascii=False))

    if "scores" in result:
        s = result["scores"]
        print(f"\n{'─' * 64}")
        print(f"  Semantic  : {s['semantic_score_pct']}%")
        print(f"  TF-IDF    : {s['tfidf_score_pct']}%")
        print(f"  ⭐ Final   : {s['final_score_pct']}%  ({s['formula']})")
        if s["missing_skills"]:
            print(f"  ⚠  Missing : {', '.join(s['missing_skills'][:8])}")
    print("═" * 64 + "\n")


if __name__ == "__main__":
    asyncio.run(_main())
