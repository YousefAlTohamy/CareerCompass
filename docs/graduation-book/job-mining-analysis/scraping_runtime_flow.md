# Scraping Runtime Flow

The scraping runtime is deliberately split between Laravel and the Python AI Job Miner service.

## Service Boundary

| Responsibility | Laravel Backend | AI Job Miner |
|---|---|---|
| Authentication and authorization | Yes | No public user auth; internal service token only. |
| System of record | Owns jobs, skills, sources, target roles, scraping jobs, and failed URLs. | Sends candidate job payloads only. |
| Long-running orchestration | Creates `ScrapingJob` records and dispatches queue workers. | Executes adapter work after a worker call. |
| Source adapters | Stores source definitions and support metadata. | Runs demo/API/HTML/Scrapy adapter logic. |
| Import quality gate | Validates request schemas, URL safety, source identity, duplicate checks, and DB transactions. | Performs adapter-level quality checks before callback. |
| User/admin visibility | Status polling, dashboard, diagnostics, screenshots. | `/health` and Prometheus-style metrics. |

## On-Demand Runtime Flow

1. A student or frontend feature calls `POST /api/v1/jobs/scrape` or `POST /api/v1/jobs/scrape-if-missing`.
2. `JobController` validates the request, optionally checks whether stored usable jobs already exist, creates a pending `ScrapingJob`, and dispatches `ProcessOnDemandJobScraping`.
3. The queue worker runs on the `scraping` queue. Docker production wiring starts `backend-worker-scraping` with `queue:work database --queue=scraping --timeout=1200`.
4. `ScraperClient` calls AI Job Miner `/scrape` using `SCRAPER_SERVICE_URL`, `SCRAPER_SERVICE_TIMEOUT`, and `X-Scraper-Service-Token`.
5. AI Job Miner selects the adapter from source metadata, query, and source type. Demo/local data is deterministic; API and HTML sources are external and can fail.
6. Accepted candidate jobs are imported through Laravel protected endpoints. Laravel validates and deduplicates before storing anything.
7. `ProcessOnDemandJobScraping` marks the `ScrapingJob` completed or failed and records counters such as found, stored, duplicate, failed, and processing time.
8. The frontend polls `GET /api/v1/scraping-status/{jobId}` or admin dashboard endpoints to display status.

## Admin Full Scraping Flow

1. Admin target roles and active scraping sources are read from Laravel.
2. `TargetJobRoleController::runFullScraping` computes runnable source/role pairs and skips unsupported or missing-credential sources.
3. Laravel dispatches a batch of `ProcessMarketScrapingCategory` jobs to the scraping queue.
4. Each category job creates its own `ScrapingJob`, calls AI Job Miner, imports accepted jobs, records classifications, and updates source cache/status.
5. The admin dashboard polls batch progress and failed URLs.

## Docker Runtime Evidence

| Service / Variable | Evidence |
|---|---|
| `cc-job-miner` | Docker Compose service maps `8003:8000` and exposes `/health`. |
| `SCRAPER_SERVICE_URL` | Laravel uses `http://ai-job-miner:8000` in Docker. |
| `LARAVEL_API_BASE_URL` | AI Job Miner callback base is set to `http://nginx/api/v1` in Docker. |
| `SCRAPER_SERVICE_TOKEN` | Laravel-to-miner internal request header. |
| `SCRAPY_API_TOKEN` / `LARAVEL_API_TOKEN` | Miner-to-Laravel protected callback token. |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Optional external API credentials. |
| `SCRAPER_USE_PROXIES` | Optional proxy behavior flag; proxy lists are served by Laravel only through protected route. |
| `SCRAPER_RATE_LIMIT_PER_MINUTE` | Configuration value surfaced for rate-limit policy, not a proof of external website permission. |

## Operational Notes

- Current on-demand stored-count metrics are operational counters derived around a scrape run. They are useful for demo status but are not a full source-quality benchmark.
- Admin retry for failed URLs currently marks selected failed records as retried. A stronger production DLQ would dispatch targeted reprocessing jobs and track retry attempts.
- External adapters should be tested close to the defense because public websites and APIs can change without notice.
