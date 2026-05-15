# AI Job Miner

The AI Job Miner is the Python FastAPI service wrapper around the Scrapy-based job-mining workflow. Laravel does not run Scrapy locally; it calls this service over HTTP, and this service runs Scrapy inside its own container.

The service exists so scraping can scale and fail independently from the Laravel API container.

## Runtime Role

- Receive authenticated scrape requests from Laravel.
- Validate scrape payloads.
- Run Scrapy with query, limit, source, and scraping job context.
- Configure Laravel callback URLs through environment variables.
- Export imported jobs back to Laravel internal endpoints.
- Report failed URLs back to Laravel for visibility and retry.
- Expose health and Prometheus metrics endpoints.
- Keep scraper dependencies out of the backend container.

## Folder Structure

```text
ai-job-miner/
|-- service_api.py              FastAPI HTTP wrapper used by Laravel
|-- ai_job_miner/
|   |-- spiders/                Scrapy spiders and base failure reporting
|   |-- pipelines.py            Export, deduplication, validation, backend callbacks
|   |-- middlewares.py          Proxy and request middleware
|   |-- items.py                Scrapy item schema
|   `-- settings.py             Scrapy settings
|-- ai/                         Matching/extraction helper modules
|-- tests/                      Current service and AI tests
|-- requirements.txt
|-- scrapy.cfg
|-- Dockerfile
`-- README.md
```

## FastAPI Endpoint Map

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | none | Service health |
| `GET` | `/metrics` | none | Prometheus-compatible scrape counters |
| `POST` | `/scrape` | `X-Scraper-Service-Token` | Start a Scrapy run |

Host/container ports:

- host: `http://localhost:8003`
- container: `http://ai-job-miner:8000`

Laravel reaches this service inside Docker with:

```env
SCRAPER_SERVICE_URL=http://ai-job-miner:8000
```

## Scrape Request Shape

`POST /scrape` accepts:

```json
{
  "query": "Laravel Developer",
  "limit": 10,
  "source_id": 1,
  "scraping_job_id": 123,
  "callback_base_url": "http://nginx/api/v1",
  "source": {
    "id": 1,
    "name": "CareerCompass Demo Jobs",
    "type": "demo",
    "endpoint": "demo://careercompass/jobs",
    "method": "GET",
    "headers": {},
    "params": {},
    "mode": "static",
    "pattern": null
  }
}
```

Rules:

- `query`: required, 1-255 chars.
- `limit`: 1-100, default 30.
- `source_id`: optional positive integer.
- `scraping_job_id`: required positive integer.
- `callback_base_url`: optional; defaults to `LARAVEL_API_BASE_URL`.
- `source`: optional source config. Laravel sends this for admin diagnostics and source-target extraction runs.

Headers:

```text
X-Scraper-Service-Token: <SCRAPER_SERVICE_TOKEN>
X-Request-ID: <optional correlation id>
```

## Scraping Lifecycle

1. A user/admin action in Laravel requests scraping.
2. Laravel creates or updates a `ScrapingJob`.
3. Laravel dispatches work to the `scraping` database queue.
4. `backend-worker-scraping` calls `POST /scrape` on `ai-job-miner`.
5. The FastAPI wrapper validates the internal token and payload.
6. The wrapper routes by source type/config.
7. Demo/API/spider-backed handlers export jobs to Laravel internal import endpoints.
8. Spider-backed handlers report failed URLs to Laravel.
9. Laravel normalizes imported data, creates missing skills, syncs job-skill pivots, and updates the scraping job.
10. Failed URLs and zero-job failure cases are visible in admin dashboards and status endpoints.

After PR #79, Laravel marks a scraping job failed when the scraper reports failed URLs and stores zero jobs. That prevents "completed successfully" messaging for external-source failures.

## Source Routing

The service no longer assumes every request should run LinkedIn.

- `demo`, `local`, or `demo://...`: creates deterministic local jobs and imports them through Laravel.
- `remotive`: fetches Remotive's public API and maps `jobs[]`, tags, company, location, job type, description, and URL.
- `adzuna`: uses Adzuna's API when `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` are configured; otherwise returns `CONFIG_REQUIRED`.
- `remoteok`: fetches RemoteOK's public API and filters results locally by query.
- `arbeitnow`: fetches Arbeitnow's public API and filters results locally by query.
- `wuzzuf`: parses Wuzzuf search HTML with a dedicated parser; live layout/blocking can still cause `EXTERNAL_FAILED`.
- `indeed` / `upwork`: use source-specific public page parsers without login, stealth, or CAPTCHA bypass. Blocking is reported as `EXTERNAL_BLOCKED`.
- generic `api`: fetches the configured API endpoint, normalizes common external `job_type` / `work_type` vocabulary, and imports parsed job-like records.
- generic `html` / unmapped non-LinkedIn `spa`: returns `ADAPTER_MISSING` until a source-specific parser exists.
- LinkedIn-backed `spa`: runs the LinkedIn spider intentionally and passes the configured endpoint.

This routing keeps Diagnostics honest: config-required sources ask for credentials, adapter gaps are named explicitly, demo/local sources prove the pipeline, and LinkedIn/proxy failures are reported as external/runtime failures.

## Laravel Callback URLs

The wrapper derives callback URLs from `callback_base_url` or `LARAVEL_API_BASE_URL`.

For Docker:

```env
LARAVEL_API_BASE_URL=http://nginx/api/v1
```

Generated callback URLs:

- job existence check: `/jobs/import/check`
- job import: `/jobs/import`
- failed URL reporting: `/jobs/import/failed`
- active proxies: `/proxies/active`

The active proxies endpoint is protected by Laravel machine-token middleware and must not be reachable with normal user tokens.

## Internal Authentication

Laravel to scraper:

- Header: `X-Scraper-Service-Token`
- Expected env: `SCRAPER_SERVICE_TOKEN`

Scraper to Laravel:

- Header: internal bearer/token header used by the pipeline.
- Env: `LARAVEL_API_TOKEN`
- Laravel expects the matching `SCRAPY_API_TOKEN`.

If tokens do not match:

- Laravel calling the scraper receives 401 from `/scrape`.
- Scraper callbacks to Laravel receive 401 from import/check/failed/proxies endpoints.

## Environment Variables

HTTP wrapper:

- `SCRAPER_SERVICE_TOKEN`: token Laravel must send to `/scrape`.
- `SCRAPER_DEFAULT_TIMEOUT`: subprocess timeout in seconds.
- `SCRAPER_USE_PROXIES`: enables or disables the Laravel proxy feed for Playwright/Scrapy sources.
- `ADZUNA_APP_ID`: Adzuna application ID. Required only for Adzuna.
- `ADZUNA_APP_KEY`: Adzuna application key. Required only for Adzuna.

Laravel callbacks:

- `LARAVEL_API_BASE_URL`: base callback URL.
- `LARAVEL_API_URL`: explicit import URL for lower-level Scrapy pipeline paths.
- `LARAVEL_API_CHECK_URL`: duplicate check URL.
- `LARAVEL_API_FAILED_URL`: failed URL reporting URL.
- `LARAVEL_API_PROXIES_URL`: active proxy URL.
- `LARAVEL_API_TOKEN`: token sent from scraper to Laravel.

Optional/deduplication:

- `REDIS_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_DB`
- `REDIS_PASSWORD`
- `JOB_DEDUP_REDIS_PREFIX`
- `JOB_DEDUP_TTL_SECONDS`
- `SKILL_MATCH_THRESHOLD`
- `STANDARD_SKILLS_PATH`

Docker Compose sets the key service values automatically for the normal stack.

## Scrapy Export Pipeline

The Scrapy pipeline is responsible for:

- validating required job fields;
- checking whether a job URL already exists in Laravel;
- exporting valid jobs to Laravel;
- passing `SCRAPING_JOB_ID` so Laravel can associate imports with the scraping job;
- reporting failed URLs through the base spider failure path;
- allowing Laravel to create normalized skill records and sync relational skills.

Do not bypass the Laravel import endpoint for normal operation; it owns database consistency and skill pivot synchronization.

## Metrics

`GET /metrics` exposes:

- `career_compass_scraper_requests_total`
- `career_compass_scraper_failures_total`
- `career_compass_scraper_duration_ms_total`

Prometheus scrapes this service through Docker networking.

## Docker Usage

Start/rebuild from repository root:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build ai-job-miner
```

Health:

```bash
curl http://localhost:8003/health
```

Logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f ai-job-miner
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker-scraping
```

Restart after Python code-only changes:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart ai-job-miner backend-worker-scraping
```

Rebuild after dependency or Dockerfile changes:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build ai-job-miner
```

## Testing

Run compile validation from the repository root:

```bash
python -m compileall ai-cv-analyzer ai-job-miner
```

Run current job-miner tests:

```bash
cd ai-job-miner
python -m pytest -q tests/test_ai.py tests/test_service_api.py
cd ..
```

The current CI intentionally does not revive old legacy tests that import removed `core.*` or `pipeline.*` modules. Current tests validate the modern `service_api.py` and AI helper behavior.

## Manual API Smoke

From a local shell, with the stack running and a real scraping job ID available:

```bash
curl -X POST http://localhost:8003/scrape \
  -H "Content-Type: application/json" \
  -H "X-Scraper-Service-Token: change-me-scraper-service-token" \
  -d '{
    "query": "Laravel Developer",
    "limit": 5,
    "scraping_job_id": 1,
    "callback_base_url": "http://nginx/api/v1"
  }'
```

For normal testing, prefer triggering scraping through Laravel/UI so the `ScrapingJob` exists and callbacks can update real status.

## External Source Limitations

Scraping depends on third-party sites. A run may return zero jobs or failed URLs because of:

- site blocking;
- changed markup;
- network failures;
- rate limits;
- Playwright/browser startup issues;
- proxy failures;
- source-specific restrictions.

The platform should not fake success in these cases. Laravel now surfaces failed URL/no-job outcomes more honestly in admin diagnostics and scrape status.

Current limitation: generic HTML and non-LinkedIn SPA extraction are intentionally unsupported until source-specific adapters/spiders are implemented.

## Troubleshooting

### 401 from `/scrape`

Laravel's `SCRAPER_SERVICE_TOKEN` does not match the scraper service token. Check root `.env`, `backend-api/.env`, and `ai-job-miner/.env`.

### 401 from Laravel callbacks

`LARAVEL_API_TOKEN` in `ai-job-miner` does not match `SCRAPY_API_TOKEN` in Laravel.

### Scraper starts but no jobs are stored

Check:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f ai-job-miner
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker-scraping
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-api
```

Look for failed URL reporting, export errors, duplicate checks, source blocking, and callback 401/422 responses.

### Scraper times out

Increase `SCRAPER_DEFAULT_TIMEOUT` only after verifying the source is making progress. Long-running scrape work should remain isolated on the `scraping` queue.

### Queue job is pending but service is idle

Check the Laravel scraping worker:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker-scraping
```

### Proxy credentials are not available

Proxy credentials are served only through the internal Laravel proxy endpoint with scraper machine auth. Normal user tokens cannot access them.

### Source diagnostics show compromised status

That means the scraper process completed but output contained failed URL, DLQ, traceback, or runtime error signals. This is usually an external/source issue, not a Laravel route failure.

## Related Documentation

- Root `README.md` for full architecture and Docker startup.
- `backend-api/README.md` for Laravel scraper orchestration and internal routes.
- `docs/PRODUCT_FLOW_REVIEW.md` for PR #79 scraping behavior.
- `docs/TROUBLESHOOTING.md` for operational debugging.
