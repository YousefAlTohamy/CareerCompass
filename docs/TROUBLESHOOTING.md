# Troubleshooting

## Stack Status

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 backend-api
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 nginx
```

## Backend

Check routes and readiness:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan route:list
curl http://localhost/api/ready
```

If readiness fails, inspect MySQL, queue tables, storage, and service tokens.

## Frontend

The Docker frontend should call `/api/v1`. If the UI loads but API calls fail:

```bash
curl http://localhost/api/v1/health
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 nginx
```

## AI Analyzer

```bash
curl http://localhost:8000/
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f ai-cv-analyzer
```

First boot can be slow because model dependencies may initialize lazily.

## Scraper

```bash
curl http://localhost:8003/health
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f ai-job-miner
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker-scraping
```

401 responses usually mean token mismatch between `SCRAPER_SERVICE_TOKEN`, `SCRAPY_API_TOKEN`, and `LARAVEL_API_TOKEN`.

## Queue Workers

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan queue:failed
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan tinker --execute="echo DB::table('jobs')->select('queue', DB::raw('count(*) as total'))->groupBy('queue')->get()->toJson(JSON_PRETTY_PRINT);"
```

If a job is stuck, verify the matching worker container is running.

## Storage

```bash
curl http://localhost:9000/minio/health/live
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 minio
```

Signed CV URLs depend on the configured `CV_STORAGE_DISK` and S3/MinIO credentials.

## Safe Reset Without Data Loss

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --force-recreate
```

Do not use `docker compose down -v` for normal troubleshooting.
