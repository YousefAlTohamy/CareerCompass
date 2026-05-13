@echo off
setlocal
cd /d "%~dp0"

echo [CareerCompass] Starting the Docker stack with production overrides...
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
if errorlevel 1 (
  echo [CareerCompass] Docker startup failed.
  exit /b 1
)

echo [CareerCompass] Running Laravel migrations...
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend-api php artisan migrate --force --no-interaction
if errorlevel 1 (
  echo [CareerCompass] Migration command failed. Check backend logs.
  exit /b 1
)

echo [CareerCompass] Current container status:
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

echo.
echo Frontend:   http://localhost
echo API health: http://localhost/api/health
echo API ready:  http://localhost/api/ready
echo API v1:     http://localhost/api/v1/health
echo AI health:  http://localhost:8000/
echo Scraper:    http://localhost:8003/health
echo Prometheus: http://localhost:9090
echo Grafana:    http://localhost:3000
echo MinIO:      http://localhost:9001
echo.
echo Stop safely without deleting data:
echo docker compose -f docker-compose.yml -f docker-compose.prod.yml stop
