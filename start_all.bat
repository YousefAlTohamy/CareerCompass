@echo off
cd /d %~dp0
title CareerCompass Launcher (Portable Environment)
echo ====================================================
echo   Starting CareerCompass Graduation Project
echo   with Market Intelligence System + AI Gateway
echo   (Using Portable Environment)
echo ====================================================

echo.
echo 1. Starting Frontend (React)...
start "CareerCompass Frontend" cmd /k "cd frontend && npm run dev"

echo 2. Starting Backend API (Laravel)...
start "CareerCompass Backend" cmd /k "cd backend-api && php artisan serve --port 8000"

echo 3. Starting AI CV Analyzer (Python / Port 8002)...
start "AI CV Analyzer" cmd /k "cd ai-cv-analyzer && python -m uvicorn main:app --host 127.0.0.1 --port 8002 --reload"

echo 4. Starting AI Gateway — Hybrid Orchestrator (Python / Port 8001)...
start "AI Gateway" cmd /k "cd ai-hybrid-orchestrator && python -m uvicorn main_api:app --host 127.0.0.1 --port 8001 --reload"

echo 5. Starting Queue Worker (Laravel)...
start "CareerCompass Queue Worker" cmd /k "cd backend-api && php artisan queue:work --queue=high,default --tries=3 --timeout=600"

echo 6. Starting Task Scheduler (Laravel)...
start "CareerCompass Scheduler" cmd /k "cd backend-api && php artisan schedule:work"

echo.
echo ====================================================
echo   All services launched in separate windows!
echo   - Frontend:         http://localhost:5173
echo   - Backend API:      http://127.0.0.1:8000  (php artisan serve)
echo   - AI CV Analyzer:   http://127.0.0.1:8002  (ai-cv-analyzer: internal parse-cv)
echo   - AI Gateway:       http://127.0.0.1:8001  (ai-hybrid-orchestrator: scrape, process-cv, hybrid-match)
echo   - Queue Worker:     Processing background jobs [On-Demand]
echo   - Scheduler:        Running periodic tasks [Every 48h/Daily]
echo ====================================================
echo.
echo Note: Keep all 6 windows open while using the app.
echo Swagger UI (AI Gateway):   http://127.0.0.1:8001/docs
echo Swagger UI (CV Analyzer):  http://127.0.0.1:8002/docs
echo.
pause



