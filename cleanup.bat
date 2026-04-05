@echo off
echo ===================================================
echo     CareerCompass Global Cleanup Script
echo ===================================================
echo.

:: Ensure we are starting from the script's directory
cd /d "%~dp0"

echo Terminating Python Processes...
taskkill /f /im python.exe >nul 2>&1
echo.

echo Cleaning Backend...
if exist backend-api (
    cd backend-api
    call php artisan optimize:clear
    cd ..
) else (
    echo   - backend-api directory not found.
)
echo.

echo Purging Python Caches...

if exist "ai-cv-analyzer" (
    echo   - Cleaning ai-cv-analyzer...
    for /d /r "ai-cv-analyzer" %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d"
    del /s /q "ai-cv-analyzer\*.pyc" >nul 2>&1
    del /s /q "ai-cv-analyzer\*.pyo" >nul 2>&1
    del /s /q "ai-cv-analyzer\*.pyd" >nul 2>&1
)

if exist "ai-hybrid-orchestrator" (
    echo   - Cleaning ai-hybrid-orchestrator...
    for /d /r "ai-hybrid-orchestrator" %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d"
    del /s /q "ai-hybrid-orchestrator\*.pyc" >nul 2>&1
    del /s /q "ai-hybrid-orchestrator\*.pyo" >nul 2>&1
    del /s /q "ai-hybrid-orchestrator\*.pyd" >nul 2>&1
)

if exist "ai-job-miner" (
    echo   - Cleaning ai-job-miner...
    for /d /r "ai-job-miner" %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d"
    del /s /q "ai-job-miner\*.pyc" >nul 2>&1
    del /s /q "ai-job-miner\*.pyo" >nul 2>&1
    del /s /q "ai-job-miner\*.pyd" >nul 2>&1
)
echo.

echo Cleaning Frontend...
if exist "frontend\node_modules\.vite" (
    echo   - Deleting frontend\node_modules\.vite...
    rd /s /q "frontend\node_modules\.vite"
) else (
    echo   - Vite cache not found or already deleted.
)
echo.

echo Removing Notebook Checkpoints...
if exist "ai-cv-analyzer" (
    for /d /r "ai-cv-analyzer" %%d in (.ipynb_checkpoints) do @if exist "%%d" rd /s /q "%%d" >nul 2>&1
)
if exist "ai-hybrid-orchestrator" (
    for /d /r "ai-hybrid-orchestrator" %%d in (.ipynb_checkpoints) do @if exist "%%d" rd /s /q "%%d" >nul 2>&1
)
if exist "ai-job-miner" (
    for /d /r "ai-job-miner" %%d in (.ipynb_checkpoints) do @if exist "%%d" rd /s /q "%%d" >nul 2>&1
)
echo   - Removed Jupyter Notebook checkpoints.
echo.

echo ===================================================
echo     Cleanup Complete!
echo ===================================================
