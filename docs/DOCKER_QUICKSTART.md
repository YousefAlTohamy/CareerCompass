# Docker Quickstart

This project is Docker-first. Teammates do not need host PHP, Composer, Node, npm, Python, pip, Scrapy, or MySQL to run the normal stack.

## Prerequisites

- Git
- Docker Desktop
- 8-12 GB free disk space or more
- Enough Docker Desktop memory for the AI analyzer. 2 GB is reserved for that container in the production override.

## Clone and Checkout

```bash
git clone https://github.com/YousefAlTohamy/CareerCompass.git
cd CareerCompass
git checkout main
git pull origin main
```

## Copy Environment Templates

Bash:

```bash
cp .env.example .env
cp backend-api/.env.example backend-api/.env
cp frontend/.env.example frontend/.env
cp ai-cv-analyzer/.env.example ai-cv-analyzer/.env
cp ai-job-miner/.env.example ai-job-miner/.env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item backend-api/.env.example backend-api/.env
Copy-Item frontend/.env.example frontend/.env
Copy-Item ai-cv-analyzer/.env.example ai-cv-analyzer/.env
Copy-Item ai-job-miner/.env.example ai-job-miner/.env
```

Use placeholder secrets only for local development. Rotate every token/password before staging or production.

## First Boot

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend-api php artisan migrate --force --no-interaction
```

Windows shortcut:

```powershell
.\start_all.bat
```

## Normal Boot

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Stop Without Data Loss

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop
```

Avoid:

```bash
docker compose down -v
docker system prune --volumes
```

Those commands delete persistent Docker volumes.

## Restart

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart
```

## Logs

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-api
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker-scraping
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker-ai
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f ai-cv-analyzer
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f ai-job-miner
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f nginx
```

## Health URLs

- Frontend via Nginx: `http://localhost`
- Backend health: `http://localhost/api/health`
- Backend readiness: `http://localhost/api/ready`
- API v1 health: `http://localhost/api/v1/health`
- AI analyzer health: `http://localhost:8000/`
- Scraper health: `http://localhost:8003/health`
- Prometheus readiness: `http://localhost:9090/-/ready`
- Grafana health: `http://localhost:3000/api/health`
- MinIO health: `http://localhost:9000/minio/health/live`
- MinIO console: `http://localhost:9001`

## Smoke Checks

```bash
bash scripts/smoke/http-smoke.sh http://localhost
bash scripts/smoke/queue-smoke.sh
```

Windows PowerShell:

```powershell
.\scripts\smoke\http-smoke.ps1 http://localhost
.\scripts\smoke\queue-smoke.ps1
```

## Troubleshooting

### Port Already Used

Stop the conflicting local service or change the exposed host port in compose. Common conflicts are `80`, `3306`, `8000`, `8003`, `9000`, `9001`, `9090`, and `3000`.

### Docker Is Not Running

Start Docker Desktop and wait until it reports that the engine is running.

### First AI Boot Is Slow

The AI analyzer can take time to initialize model dependencies. Wait for the healthcheck start period before restarting.

### Low Disk Space

Use Docker Desktop's disk usage view first. Remove only unused images/build cache. Do not prune volumes unless you intentionally want to remove database/object-storage/monitoring data.

### Frontend Cannot Reach Backend

Check:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f nginx
curl http://localhost/api/v1/health
```

`VITE_API_URL` should normally be `/api/v1`.

### Backend Cannot Reach AI or Scraper

Inside Docker, backend URLs must use service names:

```env
AI_ENGINE_URL=http://ai-cv-analyzer:8000
SCRAPER_SERVICE_URL=http://ai-job-miner:8000
```

### Queue Jobs Not Processing

Check the lane-specific worker:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker-scraping
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker-ai
```

### MinIO Credentials

Local defaults come from `.env`. For production, rotate `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`.

### Stale Containers

Use a safe recreate:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --force-recreate
```

Do not use `down -v` for routine cleanup.
