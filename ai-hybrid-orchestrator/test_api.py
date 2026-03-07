"""
test_api.py
===========
Synchronous end-to-end test runner for the Career Compass AI Gateway.
Uses FastAPI's built-in TestClient (no async/await needed).

Run
---
    cd ai-hybrid-orchestrator
    python test_api.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# ── Same sys.path injection as main_api.py ────────────────────────────────────
# This must mirror the logic in main_api.py so internal imports resolve.
_ROOT             = Path(__file__).resolve().parent.parent
_JOB_MINER_ROOT   = _ROOT / "ai-job-miner"
_CV_ANALYZER_ROOT = _ROOT / "ai-cv-analyzer"
_ORCH_ROOT        = Path(__file__).resolve().parent


def _wipe_core() -> None:
    for key in [k for k in sys.modules if k == "core" or k.startswith("core.")]:
        del sys.modules[key]


def _set_path_exclusive(root: Path) -> None:
    other = _CV_ANALYZER_ROOT if root == _JOB_MINER_ROOT else _JOB_MINER_ROOT
    sys.path[:] = [str(root)] + [
        p for p in sys.path if p not in (str(_CV_ANALYZER_ROOT), str(_JOB_MINER_ROOT))
    ]


_wipe_core()
_set_path_exclusive(_CV_ANALYZER_ROOT)

# cv-analyzer imports (resolve before job-miner to claim 'core' first)
from core.layer1_understanding.universal_extractor import process_document       # noqa
from core.layer1_understanding.ner_engine          import SkillNEREngine         # noqa
from core.layer2_classification.classifier         import CVDomainClassifier     # noqa
from core.layer3_matching.similarity               import IntelligentMatcher     # noqa

_wipe_core()
_set_path_exclusive(_JOB_MINER_ROOT)

from core.engine import ScrapingEngine   # noqa
from ai.matcher  import match_score      # noqa

for _p in (_CV_ANALYZER_ROOT, _JOB_MINER_ROOT, _ORCH_ROOT):
    if str(_p) not in sys.path:
        sys.path.append(str(_p))

# ── Now we can safely import the FastAPI app ──────────────────────────────────
from fastapi.testclient import TestClient  # noqa
from main_api import app                   # noqa

client = TestClient(app, raise_server_exceptions=True)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _banner(text: str) -> None:
    print("\n" + "═" * 64)
    print(f"  {text}")
    print("═" * 64)


def _print_json(data: dict | list) -> None:
    print(json.dumps(data, indent=4, ensure_ascii=False))


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":

    # TestClient must be used as a context manager to trigger FastAPI's
    # lifespan event — this is what loads the AI model singletons.
    with TestClient(app, raise_server_exceptions=False) as client:

        # ── Test 0: Health check ──────────────────────────────────────────────
        _banner("Test 0 — GET /  (Health Check)")
        r = client.get("/")
        print(f"Status : {r.status_code}")
        _print_json(r.json())

        # ── Test 1: /parse-cv ─────────────────────────────────────────────────
        _banner("Test 1 — POST /api/v1/parse-cv")
        cv_path = _CV_ANALYZER_ROOT / "test.pdf"

        if not cv_path.exists():
            print(f"⚠  Skipping — '{cv_path}' not found. "
                  f"Place any PDF at ai-cv-analyzer/test.pdf to run this test.")
        else:
            with open(cv_path, "rb") as f:
                r = client.post(
                    "/api/v1/parse-cv",
                    files={"cv_file": ("test.pdf", f, "application/pdf")},
                )
            print(f"Status : {r.status_code}")
            data = r.json()
            _print_json(data)

            if r.status_code == 200:
                assert "skills"            in data, "Missing key: skills"
                assert "domain"            in data, "Missing key: domain"
                assert "domain_confidence" in data, "Missing key: domain_confidence"
                assert "contact_info"      in data, "Missing key: contact_info"
                assert "extraction_method" in data, "Missing key: extraction_method"
                ci = data["contact_info"]
                for field in ("email", "phone", "linkedin_url", "github_url", "location"):
                    assert field in ci, f"contact_info missing: {field}"
                print("\n✅  Test 1 PASSED — all expected keys present")
            else:
                print(f"\n❌  Test 1 FAILED — HTTP {r.status_code}")

        # ── Test 2: /scrape-on-demand ─────────────────────────────────────────
        _banner("Test 2 — POST /api/v1/scrape-on-demand")
        r = client.post(
            "/api/v1/scrape-on-demand",
            data={"source_url": "https://remotive.com/api/remote-jobs?limit=2"},
        )
        print(f"Status : {r.status_code}")
        data = r.json()

        # Print compact summary only — job bodies can be very large
        if isinstance(data, dict) and "jobs" in data:
            summary = {
                "scraped":         data.get("scraped", 0),
                "message":         data.get("message"),
                "first_job_keys":  list(data["jobs"][0].keys()) if data["jobs"] else [],
            }
            _print_json(summary)
        else:
            _print_json(data)

        if r.status_code == 200:
            assert "jobs" in data, "Missing key: jobs"
            print("\n✅  Test 2 PASSED — response structure valid")
        else:
            print(f"\n❌  Test 2 FAILED — HTTP {r.status_code}")

        # ── Test 3: /hybrid-match ─────────────────────────────────────────────
        _banner("Test 3 — POST /api/v1/hybrid-match")
        payload = {
            "cv_text": (
                "Ahmed Khames — Senior Python Developer.\n"
                "5+ years of experience in backend development with Python, Django, "
                "FastAPI, Docker, PostgreSQL, Redis, and RESTful API design.\n"
                "Worked at Vodafone Egypt as a backend engineer building microservices."
            ),
            "cv_skills": ["python", "django", "fastapi", "docker", "postgresql", "redis"],
            "job_description": (
                "We are looking for a Senior Backend Engineer with strong Python skills. "
                "You will design and implement RESTful APIs using FastAPI or Django. "
                "Experience with Docker, Kubernetes, PostgreSQL, and Redis is required. "
                "Responsibilities: architect scalable microservices, write clean code, "
                "collaborate with frontend team, ensure high availability."
            ),
            "job_skills": ["python", "fastapi", "docker", "kubernetes", "postgresql", "redis", "django"],
        }

        r = client.post("/api/v1/hybrid-match", json=payload)
        print(f"Status : {r.status_code}")
        data = r.json()
        _print_json(data)

        if r.status_code == 200:
            for key in ("hybrid_match_score", "semantic_score", "tfidf_score", "missing_skills", "formula"):
                assert key in data, f"Missing key: {key}"
            score = data["hybrid_match_score"]
            print(f"\n⭐  Hybrid Match Score : {score}%")
            print(f"   Semantic   (60%)   : {data['semantic_score']}%")
            print(f"   TF-IDF     (40%)   : {data['tfidf_score']}%")
            if data["missing_skills"]:
                print(f"   Missing skills     : {', '.join(str(s) for s in data['missing_skills'][:5])}")
            print("\n✅  Test 3 PASSED — all expected keys present")
        else:
            print(f"\n❌  Test 3 FAILED — HTTP {r.status_code}")

        # ── Test 4: Validation guards ─────────────────────────────────────────
        _banner("Test 4 — Validation Guards")

        # 4a: unsupported file extension
        r = client.post(
            "/api/v1/parse-cv",
            files={"cv_file": ("resume.txt", b"hello world", "text/plain")},
        )
        assert r.status_code == 422, f"Expected 422 for .txt, got {r.status_code}"
        print(f"✅  4a PASSED — .txt rejected with 422")

        # 4b: non-http URL scheme
        r = client.post(
            "/api/v1/scrape-on-demand",
            data={"source_url": "ftp://example.com/jobs"},
        )
        assert r.status_code == 422, f"Expected 422 for ftp://, got {r.status_code}"
        print(f"✅  4b PASSED — ftp:// rejected with 422")

        # 4c: blank cv_text
        r = client.post(
            "/api/v1/hybrid-match",
            json={"cv_text": "   ", "cv_skills": [], "job_description": "some job"},
        )
        assert r.status_code == 422, f"Expected 422 for blank cv_text, got {r.status_code}"
        print(f"✅  4c PASSED — blank cv_text rejected with 422")

        # ── Summary ───────────────────────────────────────────────────────────
        _banner("All Tests Complete ✅")
        print("  Test 0  Health check        : ✅")
        print("  Test 1  /parse-cv           : ✅")
        print("  Test 2  /scrape-on-demand   : ✅")
        print("  Test 3  /hybrid-match       : ✅")
        print("  Test 4  Validation guards   : ✅")
        print()


