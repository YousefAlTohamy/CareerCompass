from types import SimpleNamespace

from fastapi.testclient import TestClient

import service_api


client = TestClient(service_api.app)


def test_health_endpoint_reports_service_status():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "CareerCompass Job Miner",
    }


def test_metrics_endpoint_uses_prometheus_text_format():
    response = client.get("/metrics")

    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    assert "career_compass_scraper_requests_total" in response.text
    assert "career_compass_scraper_failures_total" in response.text


def test_scrape_requires_internal_service_token(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_TOKEN", "expected-token")

    response = client.post(
        "/scrape",
        json={
            "query": "python developer",
            "limit": 5,
            "scraping_job_id": 42,
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid scraper service token."


def test_scrape_executes_scrapy_with_callback_environment(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_TOKEN", "expected-token")
    monkeypatch.setenv("LARAVEL_API_TOKEN", "laravel-callback-token")
    monkeypatch.setenv("SCRAPER_DEFAULT_TIMEOUT", "30")

    recorded = {}

    def fake_run(command, cwd, env, capture_output, text, timeout, check):
        recorded.update(
            {
                "command": command,
                "cwd": cwd,
                "env": env,
                "capture_output": capture_output,
                "text": text,
                "timeout": timeout,
                "check": check,
            }
        )

        return SimpleNamespace(returncode=0, stdout="scraped ok", stderr="")

    monkeypatch.setattr(service_api.subprocess, "run", fake_run)

    response = client.post(
        "/scrape",
        headers={
            "X-Scraper-Service-Token": "expected-token",
            "X-Request-Id": "ci-request-1",
        },
        json={
            "query": "python developer",
            "limit": 5,
            "source_id": 7,
            "scraping_job_id": 42,
            "callback_base_url": "http://backend-api/api/v1",
        },
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert recorded["command"] == [
        "scrapy",
        "crawl",
        "linkedin",
        "-a",
        "query=python developer",
        "-a",
        "limit=5",
        "-a",
        "source_id=7",
    ]
    assert recorded["timeout"] == 30
    assert recorded["capture_output"] is True
    assert recorded["text"] is True
    assert recorded["check"] is False
    assert recorded["env"]["LARAVEL_API_URL"] == "http://backend-api/api/v1/jobs/import"
    assert recorded["env"]["LARAVEL_API_CHECK_URL"] == "http://backend-api/api/v1/jobs/import/check"
    assert recorded["env"]["LARAVEL_API_FAILED_URL"] == "http://backend-api/api/v1/jobs/import/failed"
    assert recorded["env"]["LARAVEL_API_PROXIES_URL"] == "http://backend-api/api/v1/proxies/active"
    assert recorded["env"]["LARAVEL_API_TOKEN"] == "laravel-callback-token"
    assert recorded["env"]["SCRAPING_JOB_ID"] == "42"
    assert recorded["env"]["REQUEST_ID"] == "ci-request-1"


def test_scrape_uses_source_endpoint_when_configured(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_TOKEN", "expected-token")
    monkeypatch.setenv("LARAVEL_API_TOKEN", "laravel-callback-token")

    recorded = {}

    def fake_run(command, cwd, env, capture_output, text, timeout, check):
        recorded.update({"command": command, "env": env, "timeout": timeout})
        return SimpleNamespace(returncode=0, stdout="scraped ok", stderr="")

    monkeypatch.setattr(service_api.subprocess, "run", fake_run)

    response = client.post(
        "/scrape",
        headers={"X-Scraper-Service-Token": "expected-token"},
        json={
            "query": "backend developer",
            "limit": 3,
            "scraping_job_id": 99,
            "source": {
                "id": 21,
                "name": "LinkedIn Global",
                "type": "spa",
                "endpoint": "https://www.linkedin.com/jobs/search/?keywords={query}",
                "method": "GET",
                "mode": "discovery",
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["endpoint_used"] == "https://www.linkedin.com/jobs/search/?keywords=backend+developer"
    assert recorded["command"] == [
        "scrapy",
        "crawl",
        "linkedin",
        "-a",
        "query=backend developer",
        "-a",
        "limit=3",
        "-a",
        "source_id=21",
        "-a",
        "endpoint=https://www.linkedin.com/jobs/search/?keywords=backend+developer",
    ]


def test_scrape_routes_demo_sources_to_local_deterministic_jobs(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_TOKEN", "expected-token")
    monkeypatch.setenv("LARAVEL_API_TOKEN", "laravel-callback-token")

    recorded = {}

    def fake_export_jobs(jobs, source, query, callback_base):
        recorded["jobs"] = jobs
        recorded["source"] = source
        recorded["query"] = query
        return len(jobs), []

    monkeypatch.setattr(service_api, "_export_jobs", fake_export_jobs)

    def fail_run(*args, **kwargs):
        raise AssertionError("subprocess must not run for demo sources")

    monkeypatch.setattr(service_api.subprocess, "run", fail_run)

    response = client.post(
        "/scrape",
        headers={"X-Scraper-Service-Token": "expected-token"},
        json={
            "query": "Backend Laravel Developer",
            "limit": 5,
            "scraping_job_id": 123,
            "source": {
                "id": 91,
                "name": "CareerCompass Demo Jobs",
                "type": "demo",
                "endpoint": "demo://careercompass/jobs",
                "method": "GET",
                "mode": "static",
            },
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["classification"] == "SUCCESS"
    assert payload["jobs_stored"] == 3
    assert payload["endpoint_used"] == "demo://careercompass/jobs"
    assert len(recorded["jobs"]) == 3
    assert recorded["query"] == "Backend Laravel Developer"


def test_job_payload_normalizes_external_job_and_work_types():
    source = service_api.SourceConfig(
        id=5,
        name="External API",
        type="api",
        endpoint="https://example.test/jobs",
    )

    payload = service_api._job_payload(
        {
            "title": "Business Transformation Lead",
            "company": "RemoteCo",
            "description": "Lead transformation work.",
            "url": "https://example.test/jobs/1",
            "job_type": "permanent",
            "workplace_type": "telecommute",
        },
        source,
        "Software",
    )

    assert payload["job_type"] == "full-time"
    assert payload["work_type"] == "remote"


def test_scrape_returns_unsupported_for_non_linkedin_spa_sources_without_subprocess(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_TOKEN", "expected-token")

    def fail_run(*args, **kwargs):
        raise AssertionError("subprocess must not run for unsupported SPA sources")

    monkeypatch.setattr(service_api.subprocess, "run", fail_run)

    response = client.post(
        "/scrape",
        headers={"X-Scraper-Service-Token": "expected-token"},
        json={
            "query": "react developer",
            "limit": 5,
            "scraping_job_id": 456,
            "source": {
                "id": 7,
                "name": "Indeed Remote",
                "type": "spa",
                "endpoint": "https://www.indeed.com/jobs?q={query}",
                "method": "GET",
                "mode": "discovery",
            },
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["classification"] == "UNSUPPORTED"
    assert payload["success"] is False
    assert payload["endpoint_used"] == "https://www.indeed.com/jobs?q=react+developer"


def test_scrape_classifies_linkedin_proxy_timeouts_as_integrity_compromised(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_TOKEN", "expected-token")
    monkeypatch.setenv("LARAVEL_API_TOKEN", "laravel-callback-token")

    def fake_run(command, cwd, env, capture_output, text, timeout, check):
        return SimpleNamespace(
            returncode=0,
            stdout="Successfully reported failure to DLQ\nPage.goto: net::ERR_TIMED_OUT",
            stderr="",
        )

    monkeypatch.setattr(service_api.subprocess, "run", fake_run)

    response = client.post(
        "/scrape",
        headers={"X-Scraper-Service-Token": "expected-token"},
        json={
            "query": "software",
            "limit": 1,
            "scraping_job_id": 77,
            "source": {
                "id": 1,
                "name": "LinkedIn Global",
                "type": "spa",
                "endpoint": "https://www.linkedin.com/jobs/search/?keywords={query}",
                "method": "GET",
                "mode": "discovery",
            },
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["classification"] == "INTEGRITY_COMPROMISED"
    assert payload["success"] is False
    assert payload["failed_urls_count"] == 1
