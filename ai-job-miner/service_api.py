import os
import subprocess
import time
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Response, status
from pydantic import AnyHttpUrl, BaseModel, Field


app = FastAPI(
    title="CareerCompass Job Miner",
    version="1.0.0",
    description="Internal HTTP wrapper around the Scrapy job mining pipeline.",
)

SCRAPE_REQUESTS_TOTAL = 0
SCRAPE_FAILURES_TOTAL = 0
SCRAPE_DURATION_MS_TOTAL = 0


class ScrapeRequest(BaseModel):
    query: str = Field(min_length=1, max_length=255)
    limit: int = Field(default=30, ge=1, le=100)
    source_id: Optional[int] = Field(default=None, ge=1)
    scraping_job_id: int = Field(ge=1)
    callback_base_url: Optional[AnyHttpUrl] = None


def _require_service_token(token: Optional[str]) -> None:
    expected = os.getenv("SCRAPER_SERVICE_TOKEN") or os.getenv("SCRAPY_API_TOKEN", "")
    if not expected or token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid scraper service token.",
        )


def _callback_base_url(requested: Optional[AnyHttpUrl]) -> str:
    if requested is not None:
        return str(requested).rstrip("/")

    return os.getenv("LARAVEL_API_BASE_URL", "http://127.0.0.1:8000/api").rstrip("/")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "CareerCompass Job Miner"}


@app.get("/metrics")
def metrics() -> Response:
    lines = [
        "# HELP career_compass_scraper_requests_total Total scraper executions.",
        "# TYPE career_compass_scraper_requests_total counter",
        f"career_compass_scraper_requests_total {SCRAPE_REQUESTS_TOTAL}",
        "# HELP career_compass_scraper_failures_total Failed scraper executions.",
        "# TYPE career_compass_scraper_failures_total counter",
        f"career_compass_scraper_failures_total {SCRAPE_FAILURES_TOTAL}",
        "# HELP career_compass_scraper_duration_ms_total Total scraper execution duration in milliseconds.",
        "# TYPE career_compass_scraper_duration_ms_total counter",
        f"career_compass_scraper_duration_ms_total {SCRAPE_DURATION_MS_TOTAL}",
    ]

    return Response("\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")


@app.post("/scrape")
def scrape(
    payload: ScrapeRequest,
    x_scraper_service_token: Optional[str] = Header(default=None),
    x_request_id: Optional[str] = Header(default=None),
) -> dict[str, object]:
    global SCRAPE_DURATION_MS_TOTAL, SCRAPE_FAILURES_TOTAL, SCRAPE_REQUESTS_TOTAL

    _require_service_token(x_scraper_service_token)
    SCRAPE_REQUESTS_TOTAL += 1

    started = time.monotonic()
    timeout = int(os.getenv("SCRAPER_DEFAULT_TIMEOUT", "600"))
    callback_base = _callback_base_url(payload.callback_base_url)

    command = [
        "scrapy",
        "crawl",
        "linkedin",
        "-a",
        f"query={payload.query}",
        "-a",
        f"limit={payload.limit}",
    ]

    if payload.source_id is not None:
        command.extend(["-a", f"source_id={payload.source_id}"])

    env = os.environ.copy()
    env.update(
        {
            "LARAVEL_API_URL": f"{callback_base}/jobs/import",
            "LARAVEL_API_CHECK_URL": f"{callback_base}/jobs/import/check",
            "LARAVEL_API_FAILED_URL": f"{callback_base}/jobs/import/failed",
            "LARAVEL_API_PROXIES_URL": f"{callback_base}/proxies/active",
            "LARAVEL_API_TOKEN": os.getenv("LARAVEL_API_TOKEN", ""),
            "SCRAPING_JOB_ID": str(payload.scraping_job_id),
            "REQUEST_ID": x_request_id or "",
        }
    )

    try:
        result = subprocess.run(
            command,
            cwd=os.getcwd(),
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        SCRAPE_FAILURES_TOTAL += 1
        SCRAPE_DURATION_MS_TOTAL += elapsed_ms
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "message": "Scrapy execution timed out.",
                "elapsed_ms": elapsed_ms,
                "stdout": exc.stdout[-4000:] if exc.stdout else "",
                "stderr": exc.stderr[-4000:] if exc.stderr else "",
            },
        ) from exc

    elapsed_ms = int((time.monotonic() - started) * 1000)
    SCRAPE_DURATION_MS_TOTAL += elapsed_ms
    if result.returncode != 0:
        SCRAPE_FAILURES_TOTAL += 1

    return {
        "success": result.returncode == 0,
        "request_id": x_request_id,
        "query": payload.query,
        "source_id": payload.source_id,
        "scraping_job_id": payload.scraping_job_id,
        "exit_code": result.returncode,
        "elapsed_ms": elapsed_ms,
        "stdout": result.stdout[-8000:],
        "stderr": result.stderr[-8000:],
    }
