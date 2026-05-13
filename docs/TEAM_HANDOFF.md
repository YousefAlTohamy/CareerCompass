# Team Handoff

## Branch

Use:

```bash
git checkout setup-docker
```

Do not push directly to `main` for Docker handoff work.

## Stable Checkpoint

Final Docker handoff checkpoint:

```text
setup-docker-stable-final-handoff-20260513-2059
```

## Current Docker Startup

```bash
cp .env.example .env
cp backend-api/.env.example backend-api/.env
cp frontend/.env.example frontend/.env
cp ai-cv-analyzer/.env.example ai-cv-analyzer/.env
cp ai-job-miner/.env.example ai-job-miner/.env

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend-api php artisan migrate --force --no-interaction
```

Windows:

```powershell
.\start_all.bat
```

## URLs

- App: `http://localhost`
- API health: `http://localhost/api/health`
- API ready: `http://localhost/api/ready`
- API v1 health: `http://localhost/api/v1/health`
- AI analyzer: `http://localhost:8000/`
- Scraper: `http://localhost:8003/health`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`
- MinIO console: `http://localhost:9001`

## Operational Rules

- Preserve Docker named volumes.
- Do not run `docker compose down -v`.
- Do not run `docker system prune --volumes`.
- Do not commit real `.env` files.
- Rotate default tokens/passwords before staging or production.
- Prefer service names inside containers, not `localhost`.

## Validation

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
bash scripts/smoke/http-smoke.sh http://localhost
bash scripts/smoke/queue-smoke.sh
```

Windows PowerShell:

```powershell
.\scripts\smoke\http-smoke.ps1 http://localhost
.\scripts\smoke\queue-smoke.ps1
```

## Rollback

```bash
git fetch origin --tags
git checkout setup-docker
git reset --hard <stable-checkpoint-tag>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Use the stable checkpoint tag above for rollback after this handoff pass.
