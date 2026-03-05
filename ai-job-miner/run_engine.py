"""
run_engine.py
=============
Local microservice test runner for the Smart AI Scraper Engine.

Runs the full 5-phase pipeline against:
  1. A live public REST API  (Remotive remote-jobs API — no auth required)
  2. A self-contained HTML string served via a tiny in-process HTTP server

Usage
-----
    python run_engine.py

Requirements
------------
    pip install -r requirements.txt
"""

import asyncio
import json
import logging
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

# ---------------------------------------------------------------------------
# Logging — show INFO from the engine so you can watch the pipeline live
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s  %(name)s — %(message)s",
    stream=sys.stdout,
)

from core.engine import ScrapingEngine

# ---------------------------------------------------------------------------
# Reference CV text used for TF-IDF relevance scoring
# ---------------------------------------------------------------------------
REFERENCE_CV = """
Senior Python Developer with 6 years of experience building scalable REST APIs
using Django, FastAPI, and Flask. Strong background in PostgreSQL, Redis,
Docker, Kubernetes, and AWS. Proficient in machine learning pipelines with
scikit-learn and TensorFlow. Experienced with CI/CD, Git, and Agile workflows.
"""

# ---------------------------------------------------------------------------
# 1. API source — live Remotive endpoint (no API key needed)
# ---------------------------------------------------------------------------
REMOTE_JOBS_API_URLS = [
    "https://remotive.com/api/remote-jobs?limit=3",
]

# ---------------------------------------------------------------------------
# 2. HTML source — minimal in-process HTTP server with realistic job HTML
# ---------------------------------------------------------------------------
SAMPLE_JOB_HTML = b"""
<!DOCTYPE html>
<html lang="en">
<head><title>Senior Backend Engineer at TechCorp</title></head>
<body>
  <nav>Home Jobs About Contact</nav>
  <main>
    <h1>Senior Backend Engineer</h1>

    <p><strong>Company:</strong> TechCorp</p>
    <p><strong>Location:</strong> Cairo, Egypt</p>
    <p><strong>Job Type:</strong> Full-time</p>
    <p><strong>Work Model:</strong> Remote</p>
    <p><strong>Working Hours:</strong> Flexible hours, 40 hours/week</p>
    <p><strong>Salary:</strong> $90,000 - $120,000 per year</p>

    <div class="job-description">
      We are looking for a Senior Backend Engineer to join our platform team.
      This is a full-time, fully remote position with flexible hours (40 hours/week).

      You will design and implement high-throughput REST APIs using Python,
      Django, and FastAPI. You will work closely with our data engineering team
      to build pipelines using Apache Kafka and PostgreSQL.

      Strong proficiency in Docker and Kubernetes is required. Experience with
      Redis caching, AWS (EC2, S3, RDS), and CI/CD pipelines (GitHub Actions)
      is highly preferred.

      You should have at least 4-6 years of professional Python experience.

      Location: Cairo, Egypt (Remote / Work from Home accepted)
      Responsibilities:
      - Designing microservice architectures
      - Writing unit and integration tests with pytest
      - Code review and mentoring junior engineers
      - Performance profiling and optimisation

      Salary: $90,000 - $120,000 per year
      Experience: 4-6 years
    </div>
  </main>
  <footer>Copyright TechCorp 2024</footer>
</body>
</html>
"""


class _SilentHandler(BaseHTTPRequestHandler):
    """Minimal HTTP handler — always returns the sample job HTML."""

    def do_GET(self):  # noqa: N802
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(SAMPLE_JOB_HTML)

    def log_message(self, *_):
        """Suppress default request log lines."""


def _start_local_server(port: int = 8765) -> HTTPServer:
    """Start a throwaway HTTP server in a daemon thread."""
    server = HTTPServer(("127.0.0.1", port), _SilentHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------

async def main() -> None:
    print("\n" + "=" * 64)
    print("  Smart AI Scraper Engine — Local Test Runner")
    print("=" * 64)

    engine = ScrapingEngine(
        rate=3.0,                          # Token Bucket: 3 req/s
        reference_text=REFERENCE_CV,       # TF-IDF reference for match scores
        dlq_max_attempts=2,
    )

    # -----------------------------------------------------------------------
    # Pass 1: HTML scraper against the local in-process server
    # -----------------------------------------------------------------------
    local_port = 8765
    server = _start_local_server(local_port)
    html_urls = [f"http://127.0.0.1:{local_port}/job/senior-backend-engineer"]

    print(f"\n{'─' * 64}")
    print(f"  [PASS 1] HTML scraper → {html_urls[0]}")
    print(f"{'─' * 64}\n")

    html_jobs = []
    async for job in engine.stream_jobs(html_urls, scraper_type="html"):
        html_jobs.append(job)
        print(json.dumps(job, indent=4, ensure_ascii=False))
        print()

    server.shutdown()
    print(f"  → {len(html_jobs)} unique job(s) yielded from HTML source.\n")

    # -----------------------------------------------------------------------
    # Pass 2: API scraper against the live Remotive endpoint
    # -----------------------------------------------------------------------
    print(f"{'─' * 64}")
    print(f"  [PASS 2] API scraper → {REMOTE_JOBS_API_URLS[0]}")
    print(f"{'─' * 64}\n")

    api_jobs = []
    try:
        async for job in engine.stream_jobs(REMOTE_JOBS_API_URLS, scraper_type="api"):
            api_jobs.append(job)
            print(json.dumps(job, indent=4, ensure_ascii=False))
            print()
    except Exception as exc:  # noqa: BLE001
        print(f"  [WARN] API pass skipped (no internet / rate-limited): {exc}")

    print(f"  → {len(api_jobs)} unique job(s) yielded from API source.\n")

    # -----------------------------------------------------------------------
    # Post-run DLQ report
    # -----------------------------------------------------------------------
    dlq_summary = engine.dlq.summary
    print(f"{'─' * 64}")
    print("  Dead Letter Queue summary:")
    print(f"    Total failed URLs  : {dlq_summary['total']}")
    print(f"    Retryable          : {dlq_summary['retryable']}")
    print(f"    Permanently failed : {dlq_summary['permanently_failed']}")

    if dlq_summary["total"]:
        print("\n  Failed URLs:")
        for task in engine.dlq:
            print(f"    [{task.attempts} attempt(s)] {task.url}  — {task.error}")

    print(f"\n{'=' * 64}")
    print(f"  Run complete.  Jobs yielded: HTML={len(html_jobs)}  API={len(api_jobs)}")
    print(f"  Total unique seen: {engine.seen_count}")
    print(f"{'=' * 64}\n")


if __name__ == "__main__":
    asyncio.run(main())
