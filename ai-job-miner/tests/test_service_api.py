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
