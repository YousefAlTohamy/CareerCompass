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

echo 3. Starting AI Engine (Python / Port 8002)...
start "CareerCompass AI Engine" cmd /k "cd ai-cv-analyzer && python -m uvicorn main:app --host 127.0.0.1 --port 8002 --reload"

echo 4. Starting Queue Worker (Laravel)...
start "CareerCompass Queue Worker" cmd /k "cd backend-api && php artisan queue:work --queue=high,default --tries=3 --timeout=600"

echo 5. Starting Task Scheduler (Laravel)...
start "CareerCompass Scheduler" cmd /k "cd backend-api && php artisan schedule:work"

echo.
echo ====================================================
echo   All services launched in separate windows!
echo   - Frontend:         http://localhost:5173
echo   - Backend API:      http://127.0.0.1:8000  (php artisan serve)
echo   - AI Engine:        http://127.0.0.1:8002  (ai-cv-analyzer: parse-cv, hybrid-match)
echo   - Queue Worker:     Processing background jobs [On-Demand]
echo   - Scheduler:        Running periodic tasks [Daily at 03:00]
echo ====================================================
echo.
echo Note: Keep all 5 windows open while using the app.
echo Swagger UI (AI Engine):  http://127.0.0.1:8002/docs
echo.
pause



