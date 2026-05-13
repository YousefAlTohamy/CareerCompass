# CareerCompass Backend API

Laravel 12 API service for authentication, CV uploads, AI analysis, job recommendations, market intelligence, admin dashboards, scraper imports, and monitoring.

## Runtime Role

- Serves both legacy `/api` routes and versioned `/api/v1` routes.
- Uses Laravel Sanctum bearer-token authentication for users.
- Uses internal machine-token middleware for scraper-only routes.
- Stores CV files on the configured `CV_STORAGE_DISK` (`local` for development, `s3`/MinIO for production-style Docker).
- Calls the AI CV analyzer through `AI_ENGINE_URL`.
- Calls the scraper wrapper through `SCRAPER_SERVICE_URL`.
- Dispatches background work through database queues.

## Queue Architecture

The Docker stack runs separate queue workers:

- `high`: urgent interactive jobs.
- `scraping`: scraper orchestration and long-running crawl coordination.
- `ai`: AI-heavy work.
- `emails`: notification work.
- `default`: general background work.

Queue defaults are configured in `config/queue.php` and compose worker commands. Do not route long-running scraping or AI jobs to `default`.

## Key Endpoints

- `GET /api/health`
- `GET /api/ready`
- `GET /api/metrics`
- `GET /api/v1/health`
- `POST /api/v1/register`
- `POST /api/v1/login`
- `POST /api/v1/upload-cv`
- `GET /api/v1/user/cv-analysis/download-url`
- `GET /api/v1/gap-analysis/job/{jobId}`
- `POST /api/v1/jobs/scrape`

Internal scraper endpoints require the configured machine token:

- `POST /api/v1/jobs/import/check`
- `POST /api/v1/jobs/import`
- `POST /api/v1/jobs/import/failed`
- `GET /api/v1/proxies/active`

## Docker Usage

Run from the repository root:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend-api php artisan migrate --force --no-interaction
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend-api php artisan route:list
```

Backend logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-api
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker-scraping
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker-ai
```

## Testing

Production images install optimized runtime dependencies. For full PHPUnit tests with dev dependencies, use a disposable Docker test command or CI. The compose runtime check is:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan route:list
```

## Important Environment Variables

- `APP_KEY`
- `DB_HOST=db`
- `QUEUE_CONNECTION=database`
- `AI_ENGINE_URL=http://ai-cv-analyzer:8000`
- `SCRAPER_SERVICE_URL=http://ai-job-miner:8000`
- `LARAVEL_INTERNAL_API_URL=http://nginx/api/v1`
- `SCRAPER_SERVICE_TOKEN`
- `SCRAPY_API_TOKEN`
- `FILESYSTEM_DISK`
- `CV_STORAGE_DISK`
- `AWS_ENDPOINT=http://minio:9000` for MinIO
- `MONITORING_TOKEN`
- `SENTRY_LARAVEL_DSN`

## Troubleshooting

- Readiness failures usually mean MySQL, storage, queue tables, or internal tokens are not ready.
- Stuck jobs usually mean the matching worker container is stopped.
- Scraper imports failing with 401 means `SCRAPY_API_TOKEN` does not match Laravel's internal token.
- AI timeouts should return `parsing_status=timeout` and should not overwrite existing user profile/skills.
- Do not expose `/api/v1/proxies/active` to normal user tokens; it is machine-auth only.
