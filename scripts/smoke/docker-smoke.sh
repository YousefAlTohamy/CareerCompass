#!/usr/bin/env bash
set -euo pipefail

export SCRAPER_SERVICE_TOKEN="${SCRAPER_SERVICE_TOKEN:-ci-scraper-service-token}"
export SCRAPY_API_TOKEN="${SCRAPY_API_TOKEN:-ci-laravel-internal-token}"

docker compose up -d db backend-api backend-worker backend-worker-high backend-worker-scraping backend-worker-ai backend-worker-emails backend-scheduler frontend nginx ai-cv-analyzer ai-job-miner

cleanup() {
  docker compose logs --no-color backend-api backend-worker backend-worker-high backend-worker-scraping backend-worker-ai backend-worker-emails backend-scheduler nginx ai-cv-analyzer ai-job-miner || true
  docker compose down -v || true
}
trap cleanup EXIT

echo "Waiting for core services"
for url in \
  "http://localhost/api/health" \
  "http://localhost/api/v1/health" \
  "http://localhost:8000/" \
  "http://localhost:8003/health"; do
  curl -fsS --retry 30 --retry-delay 3 --retry-connrefused "$url" >/dev/null
done

docker compose exec -T backend-api php artisan migrate --force --no-interaction
docker compose exec -T backend-api php artisan route:list --path=api/v1/proxies/active >/dev/null

echo "Docker smoke test passed"
