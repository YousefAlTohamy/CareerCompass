from types import SimpleNamespace

from fastapi.testclient import TestClient

import service_api


client = TestClient(service_api.app)


class FakeResponse:
    def __init__(self, *, json_data=None, text="", status_code=200):
        self._json_data = json_data
        self.text = text
        self.status_code = status_code

    def json(self):
        return self._json_data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise service_api.httpx.HTTPStatusError(
                f"{self.status_code} error",
                request=service_api.httpx.Request("GET", "https://example.test"),
                response=service_api.httpx.Response(self.status_code),
            )


class FakeClient:
    def __init__(self, response):
        self.response = response

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def get(self, *args, **kwargs):
        return self.response

    def request(self, *args, **kwargs):
        return self.response


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

        return SimpleNamespace(returncode=0, stdout="Successfully exported job to Laravel: 'Python Developer' at ExampleCo", stderr="")

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
    assert response.json()["classification"] == "SUCCESS"
    assert response.json()["jobs_stored"] == 1
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
        return SimpleNamespace(returncode=0, stdout="Successfully exported job to Laravel: 'Backend Developer' at ExampleCo", stderr="")

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


def test_quality_gate_accepts_valid_external_job():
    source = service_api.SourceConfig(id=5, name="Remotive", type="api", endpoint="https://remotive.com/api/remote-jobs")

    accepted, summary = service_api._quality_gate([
        {
            "title": "Remote Laravel Engineer",
            "company": "RemoteCo",
            "description": "Build and maintain Laravel APIs for distributed product teams.",
            "url": "https://remotive.com/jobs/remote-laravel-engineer",
            "job_type": "full_time",
            "work_type": "remote",
        }
    ], source, "Laravel")

    assert len(accepted) == 1
    assert summary["jobs_quality_rejected_count"] == 0


def test_quality_gate_rejects_external_job_without_valid_url():
    source = service_api.SourceConfig(id=5, name="Remotive", type="api", endpoint="https://remotive.com/api/remote-jobs")

    accepted, summary = service_api._quality_gate([
        {
            "title": "Remote Laravel Engineer",
            "company": "RemoteCo",
            "description": "Build and maintain Laravel APIs for distributed product teams.",
            "url": "",
        }
    ], source, "Laravel")

    assert accepted == []
    assert summary["jobs_quality_rejected_count"] == 1
    assert "url_missing_or_not_absolute" in summary["rejected_examples"][0]["reasons"]


def test_quality_gate_allows_demo_generated_url():
    source = service_api.SourceConfig(id=1, name="CareerCompass Demo Jobs", type="demo", endpoint="demo://careercompass/jobs")

    accepted, summary = service_api._quality_gate([
        {
            "title": "Backend Laravel Developer",
            "company": "CareerCompass Labs",
            "description": "Deterministic demo role for validating the CareerCompass scraping pipeline.",
            "url": "https://careercompass.local/demo-jobs/backend-laravel-developer-1",
        }
    ], source, "Backend Laravel Developer")

    assert len(accepted) == 1
    assert summary["jobs_quality_rejected_count"] == 0


def test_scrape_routes_indeed_to_public_adapter_without_subprocess(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_TOKEN", "expected-token")

    def fail_run(*args, **kwargs):
        raise AssertionError("subprocess must not run for Indeed public adapter")

    monkeypatch.setattr(service_api.subprocess, "run", fail_run)
    monkeypatch.setattr(
        service_api.httpx,
        "Client",
        lambda *args, **kwargs: FakeClient(FakeResponse(text="<html>captcha verify you are human</html>")),
    )

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
    assert payload["classification"] == "EXTERNAL_BLOCKED"
    assert payload["success"] is False
    assert payload["endpoint_used"] == "https://www.indeed.com/jobs?q=react+developer"


def test_adzuna_missing_credentials_returns_config_required(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_TOKEN", "expected-token")
    monkeypatch.delenv("ADZUNA_APP_ID", raising=False)
    monkeypatch.delenv("ADZUNA_APP_KEY", raising=False)

    response = client.post(
        "/scrape",
        headers={"X-Scraper-Service-Token": "expected-token"},
        json={
            "query": "software",
            "limit": 1,
            "scraping_job_id": 78,
            "source": {
                "id": 6,
                "name": "Adzuna US Tech",
                "type": "api",
                "endpoint": "https://api.adzuna.com/v1/api/jobs/us/search/1?what={query}",
                "method": "GET",
                "mode": "static",
            },
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["classification"] == "CONFIG_REQUIRED"
    assert payload["failed_urls_count"] == 0
    assert "ADZUNA_APP_ID" in payload["error_summary"]


def test_adzuna_adapter_normalizes_configured_response(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_TOKEN", "expected-token")
    monkeypatch.setenv("ADZUNA_APP_ID", "app-id")
    monkeypatch.setenv("ADZUNA_APP_KEY", "app-key")

    monkeypatch.setattr(
        service_api.httpx,
        "Client",
        lambda *args, **kwargs: FakeClient(FakeResponse(json_data={
            "results": [
                {
                    "title": "Remote Laravel Developer",
                    "company": {"display_name": "AdzunaCo"},
                    "location": {"display_name": "United States"},
                    "category": {"label": "Software Jobs"},
                    "description": "<p>Build PHP and Laravel APIs remotely.</p>",
                    "contract_type": "permanent",
                    "redirect_url": "https://adzuna.example/job/1",
                    "salary_min": 100000,
                    "salary_max": 130000,
                }
            ]
        })),
    )

    exported = {}

    def fake_export_jobs(jobs, source, query, callback_base):
        exported["jobs"] = jobs
        return len(jobs), []

    monkeypatch.setattr(service_api, "_export_jobs", fake_export_jobs)

    response = client.post(
        "/scrape",
        headers={"X-Scraper-Service-Token": "expected-token"},
        json={
            "query": "Laravel",
            "limit": 5,
            "scraping_job_id": 80,
            "source": {
                "id": 6,
                "name": "Adzuna US Tech",
                "type": "api",
                "endpoint": "https://api.adzuna.com/v1/api/jobs/us/search/1?what={query}",
                "method": "GET",
                "mode": "static",
            },
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["classification"] == "SUCCESS"
    assert payload["jobs_stored"] == 1
    assert exported["jobs"][0]["company"] == "AdzunaCo"
    assert exported["jobs"][0]["work_type"] == "remote"
    assert "Laravel" in exported["jobs"][0]["skills"]


def test_adzuna_api_errors_are_redacted(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_TOKEN", "expected-token")
    monkeypatch.setenv("ADZUNA_APP_ID", "example-app-id-value")
    monkeypatch.setenv("ADZUNA_APP_KEY", "example-app-key-value")

    monkeypatch.setattr(
        service_api.httpx,
        "Client",
        lambda *args, **kwargs: FakeClient(FakeResponse(text="bad credential example-app-key-value", status_code=500)),
    )

    response = client.post(
        "/scrape",
        headers={"X-Scraper-Service-Token": "expected-token"},
        json={
            "query": "Laravel",
            "limit": 1,
            "scraping_job_id": 81,
            "source": {
                "id": 6,
                "name": "Adzuna US Tech",
                "type": "api",
                "endpoint": "https://api.adzuna.com/v1/api/jobs/us/search/1?what={query}",
            },
        },
    )

    payload = response.json()
    assert payload["classification"] == "EXTERNAL_FAILED"
    assert "example-app-id-value" not in str(payload)
    assert "example-app-key-value" not in str(payload)


def test_remotive_adapter_normalizes_and_exports_jobs(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_TOKEN", "expected-token")
    monkeypatch.setenv("LARAVEL_API_TOKEN", "laravel-callback-token")

    monkeypatch.setattr(
        service_api.httpx,
        "Client",
        lambda *args, **kwargs: FakeClient(FakeResponse(json_data={
            "jobs": [
                {
                    "title": "Remote Laravel Engineer",
                    "company_name": "RemoteCo",
                    "candidate_required_location": "Worldwide",
                    "job_type": "full_time",
                    "category": "Software Development",
                    "tags": ["PHP", "Laravel"],
                    "description": "<p>Build Laravel APIs and maintain production integrations for remote teams.</p>",
                    "url": "https://remotive.com/jobs/1",
                }
            ]
        })),
    )

    exported = {}

    def fake_export_jobs(jobs, source, query, callback_base):
        exported["jobs"] = jobs
        return len(jobs), []

    monkeypatch.setattr(service_api, "_export_jobs", fake_export_jobs)

    response = client.post(
        "/scrape",
        headers={"X-Scraper-Service-Token": "expected-token"},
        json={
            "query": "Laravel",
            "limit": 5,
            "scraping_job_id": 79,
            "source": {
                "id": 4,
                "name": "Remotive Remote Jobs",
                "type": "api",
                "endpoint": "https://remotive.com/api/remote-jobs?search={query}",
                "method": "GET",
                "mode": "static",
            },
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["classification"] == "SUCCESS"
    assert payload["jobs_stored"] == 1
    assert exported["jobs"][0]["company"] == "RemoteCo"
    assert exported["jobs"][0]["skills"] == ["PHP", "Laravel"]


def test_remoteok_parser_normalizes_sample_payload():
    jobs = service_api._remoteok_jobs([
        {"legal": "notice"},
        {
            "id": 123,
            "position": "Remote Python Developer",
            "company": "RemoteOK Co",
            "location": "Worldwide",
            "description": "Build Python APIs for remote-first teams.",
            "tags": ["Python", "FastAPI"],
            "salary_min": 90000,
            "salary_max": 120000,
        },
    ], "Python")

    assert len(jobs) == 1
    assert jobs[0]["title"] == "Remote Python Developer"
    assert jobs[0]["url"] == "https://remoteok.com/remote-jobs/123"
    assert jobs[0]["salary_range"] == "90000-120000"


def test_arbeitnow_parser_normalizes_sample_payload():
    jobs = service_api._arbeitnow_jobs({
        "data": [
            {
                "title": "Backend PHP Developer",
                "company_name": "Berlin Tech",
                "location": "Berlin",
                "remote": True,
                "job_types": ["full-time"],
                "description": "Build PHP services and Laravel integrations.",
                "tags": ["PHP", "Laravel"],
                "url": "https://www.arbeitnow.com/jobs/123",
            }
        ]
    }, "PHP")

    assert len(jobs) == 1
    assert jobs[0]["company"] == "Berlin Tech"
    assert jobs[0]["work_type"] == "remote"
    assert jobs[0]["skills"] == ["PHP", "Laravel"]


def test_wuzzuf_parser_extracts_jobs_from_fixture():
    html = """
    <div class="css-1gatmva">
      <h2><a href="/jobs/p/abc123">Backend Laravel Developer</a></h2>
      <a class="css-17s97q8">Egypt Tech</a>
      <span class="css-5wys0k">Cairo, Egypt</span>
      <a href="/a/PHP-Jobs-in-Egypt">PHP</a>
      <a href="/a/Laravel-Jobs-in-Egypt">Laravel</a>
    </div>
    """

    jobs = service_api._wuzzuf_jobs(html, "Laravel")

    assert len(jobs) == 1
    assert jobs[0]["title"] == "Backend Laravel Developer"
    assert jobs[0]["company"] == "Egypt Tech"
    assert jobs[0]["url"] == "https://wuzzuf.net/jobs/p/abc123"


def test_indeed_parser_extracts_jobs_from_fixture():
    html = """
    <div class="job_seen_beacon">
      <h2><a data-jk="abc" href="/viewjob?jk=abc"><span title="React Developer">React Developer</span></a></h2>
      <span data-testid="company-name">IndeedCo</span>
      <div data-testid="text-location">Remote</div>
      <div>Build React interfaces and TypeScript components for public products.</div>
    </div>
    """

    jobs = service_api._indeed_jobs(html, "React")

    assert len(jobs) == 1
    assert jobs[0]["company"] == "IndeedCo"
    assert jobs[0]["url"] == "https://www.indeed.com/viewjob?jk=abc"


def test_upwork_parser_extracts_jobs_from_fixture():
    html = """
    <section data-test="job-tile">
      <a data-test="job-tile-title-link" href="/jobs/~012345">Laravel API Consultant</a>
      <span data-test="client-country">United States client</span>
      <p>Need a Laravel consultant to improve API reliability and Docker deployment.</p>
      <span data-test="token">Laravel</span>
      <span data-test="token">Docker</span>
    </section>
    """

    jobs = service_api._upwork_jobs(html, "Laravel")

    assert len(jobs) == 1
    assert jobs[0]["company"] == "United States client"
    assert jobs[0]["url"] == "https://www.upwork.com/jobs/~012345"
    assert jobs[0]["skills"] == ["Laravel", "Docker"]


def test_json_ld_job_parser_extracts_job_posting():
    html = """
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      "title": "Senior Backend Engineer",
      "description": "Build resilient backend systems with Python, APIs, and PostgreSQL.",
      "hiringOrganization": {"name": "SchemaCo"},
      "jobLocation": {"address": {"addressLocality": "Cairo", "addressCountry": "EG"}},
      "employmentType": "FULL_TIME",
      "url": "/jobs/backend-1"
    }
    </script>
    """

    jobs = service_api._json_ld_jobs(html, "https://example.test/search", "Example")

    assert len(jobs) == 1
    assert jobs[0]["title"] == "Senior Backend Engineer"
    assert jobs[0]["company"] == "SchemaCo"
    assert jobs[0]["url"] == "https://example.test/jobs/backend-1"


def test_blocked_html_returns_external_blocked(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_TOKEN", "expected-token")
    monkeypatch.setattr(
        service_api.httpx,
        "Client",
        lambda *args, **kwargs: FakeClient(FakeResponse(text="<html>verify you are human</html>")),
    )

    response = client.post(
        "/scrape",
        headers={"X-Scraper-Service-Token": "expected-token"},
        json={
            "query": "software",
            "limit": 1,
            "scraping_job_id": 90,
            "source": {
                "id": 10,
                "name": "Wuzzuf Egypt",
                "type": "html",
                "endpoint": "https://wuzzuf.net/search/jobs/?q={query}",
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["classification"] == "EXTERNAL_BLOCKED"


def test_robots_txt_block_returns_external_blocked():
    output = "ERROR: Request failed: https://www.linkedin.com/jobs/search/, error: IgnoreRequest('Forbidden by robots.txt')"

    assert service_api._classification(False, 0, 1, output) == "EXTERNAL_BLOCKED"


def test_empty_public_page_returns_empty_result(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_TOKEN", "expected-token")
    monkeypatch.setattr(
        service_api.httpx,
        "Client",
        lambda *args, **kwargs: FakeClient(FakeResponse(text="<html><body>No jobs here</body></html>")),
    )
    monkeypatch.setattr(service_api, "_render_public_page_sync", lambda *args, **kwargs: ("<html><body>No jobs here</body></html>", None))

    response = client.post(
        "/scrape",
        headers={"X-Scraper-Service-Token": "expected-token"},
        json={
            "query": "software",
            "limit": 1,
            "scraping_job_id": 91,
            "source": {
                "id": 11,
                "name": "Wuzzuf Egypt",
                "type": "html",
                "endpoint": "https://wuzzuf.net/search/jobs/?q={query}",
            },
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["classification"] == "EMPTY_RESULT"
    assert payload["success"] is False
    assert payload["jobs_stored"] == 0


def test_no_fake_success_when_jobs_stored_is_zero(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_TOKEN", "expected-token")
    monkeypatch.setattr(
        service_api.httpx,
        "Client",
        lambda *args, **kwargs: FakeClient(FakeResponse(json_data={"jobs": []})),
    )

    response = client.post(
        "/scrape",
        headers={"X-Scraper-Service-Token": "expected-token"},
        json={
            "query": "nope",
            "limit": 1,
            "scraping_job_id": 92,
            "source": {
                "id": 12,
                "name": "Remotive Remote Jobs",
                "type": "api",
                "endpoint": "https://remotive.com/api/remote-jobs?search={query}",
            },
        },
    )

    payload = response.json()
    assert payload["classification"] == "EMPTY_RESULT"
    assert payload["success"] is False


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
