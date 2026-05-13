# AI Job Miner

FastAPI service wrapper for the Scrapy-based job mining workflow.

## Runtime Role

- Receives scrape requests from Laravel over HTTP.
- Runs Scrapy inside the Python container.
- Sends imported jobs and failed URLs back to Laravel internal `/api/v1` endpoints.
- Uses machine-token authentication for all scraper-to-Laravel calls.
- Never requires Scrapy inside the Laravel backend container.

## Endpoints

- `GET /health`: service health.
- `GET /metrics`: Prometheus-compatible scrape metrics.
- `POST /scrape`: trigger a scrape request. Requires `X-Scraper-Token`.

## Docker Runtime

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build ai-job-miner
curl http://localhost:8003/health
```

Laravel reaches this service inside Docker through:

```env
SCRAPER_SERVICE_URL=http://ai-job-miner:8000
```

The scraper calls Laravel through:

```env
LARAVEL_API_BASE_URL=http://nginx/api/v1
```

## Internal Authentication

- Laravel to scraper: `SCRAPER_SERVICE_TOKEN`
- Scraper to Laravel: `SCRAPY_API_TOKEN` / `LARAVEL_API_TOKEN`

These tokens must match across `.env`, `backend-api/.env`, and `ai-job-miner/.env` when running outside compose overrides.

## Scrapy Flow

1. Laravel creates or updates a scraping job.
2. Laravel dispatches work to the scraping queue.
3. The scraping worker calls `POST /scrape` on `ai-job-miner`.
4. The Python service runs Scrapy and posts results to Laravel.
5. Laravel normalizes skills, creates missing skills, and syncs job-skill pivot records.
6. Failures are tracked for dashboard visibility and retries.

## Proxy Handling

Proxy credentials are available only through Laravel internal machine-auth endpoints. Normal user Sanctum tokens must not access proxy credentials.

## Troubleshooting

- 401 from Laravel means `LARAVEL_API_TOKEN` does not match `SCRAPY_API_TOKEN`.
- 401 from the scraper means Laravel's `SCRAPER_SERVICE_TOKEN` does not match.
- If scraping is queued but does not start, inspect `backend-worker-scraping` logs.
- If callbacks fail, verify `LARAVEL_API_BASE_URL=http://nginx/api/v1` inside Docker.
