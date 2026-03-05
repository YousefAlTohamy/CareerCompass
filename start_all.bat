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
start "CareerCompass Backend" cmd /k "cd backend-api && php artisan serve"

echo 3. Starting Legacy AI Engine (Python / Port 8001)...
start "CareerCompass AI Engine" cmd /k "cd ai-engine && call venv\Scripts\activate && uvicorn main:app --reload --port 8001"

echo 4. Starting AI Gateway — Hybrid Orchestrator (Python / Port 8000)...
start "AI Gateway" cmd /k "uvicorn ai-hybrid-orchestrator.main_api:app --host 0.0.0.0 --port 8000 --reload"

echo 5. Starting Queue Worker (Laravel)...
start "CareerCompass Queue Worker" cmd /k "cd backend-api && php artisan queue:work --queue=high,default --tries=3 --timeout=300"

echo 6. Starting Task Scheduler (Laravel)...
start "CareerCompass Scheduler" cmd /k "cd backend-api && php artisan schedule:work"

echo.
echo ====================================================
echo   All services launched in separate windows!
echo   - Frontend:         http://localhost:5173
echo   - Backend API:      http://127.0.0.1:8000  (php artisan serve)
echo   - Legacy AI Engine: http://127.0.0.1:8001  (ai-engine venv)
echo   - AI Gateway:       http://127.0.0.1:8000  (ai-hybrid-orchestrator)
echo   - Queue Worker:     Processing background jobs [On-Demand]
echo   - Scheduler:        Running periodic tasks [Every 48h/Daily]
echo ====================================================
echo.
echo Note: Keep all 6 windows open while using the app.
echo Swagger UI (AI Gateway): http://127.0.0.1:8000/docs
echo.
pause
