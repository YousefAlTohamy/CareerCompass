# Local Host Cleanup

CareerCompass runs through Docker. Host-installed project dependencies can be removed when you are not doing local development.

This cleanup guidance is for project-local artifacts only. It does not uninstall global tools.

## Safe To Remove From This Repository

- `frontend/node_modules`
- `frontend/dist`
- `frontend/build`
- `frontend/coverage`
- `backend-api/vendor`
- `backend-api/storage/logs/*.log`
- generated PHP cache files in `backend-api/bootstrap/cache/*.php`
- Python `__pycache__`
- Python `.pytest_cache`
- project-local `.venv` or `venv`
- project-local `.cache`
- generated coverage folders
- OS junk such as `Thumbs.db` and `.DS_Store`

## Do Not Remove

- Docker named volumes
- MySQL data
- MinIO data
- Prometheus data
- Grafana data
- uploaded CVs or storage app data
- source code
- migrations
- seeders
- Dockerfiles
- compose files
- README/docs
- `.env.example` files
- local real `.env` files unless you intentionally no longer need them
- model files required by your local AI experiments

## Inventory Commands

PowerShell:

```powershell
$names = @('node_modules','vendor','__pycache__','.pytest_cache','.venv','venv','dist','build','coverage','.cache')
Get-ChildItem -Path . -Recurse -Force -Directory |
  Where-Object { $names -contains $_.Name -and $_.FullName -notmatch '\\.git(\\|$)' } |
  Select-Object FullName
```

Bash:

```bash
find . \( -name node_modules -o -name vendor -o -name __pycache__ -o -name .pytest_cache -o -name .venv -o -name venv -o -name dist -o -name build -o -name coverage -o -name .cache \) -print
```

## Optional Global Cleanup

Do not uninstall global Node.js, npm, PHP, Composer, Python, pip, MySQL, Git, Docker Desktop, VS Code, or browsers automatically. They may be used by other projects.

Docker-only operation for this project does not require host npm/composer/pip installs. If you are certain a global tool is unused by anything else, remove it manually through the normal OS package manager or installer.

## Cleanup Performed In This Handoff

On 2026-05-13, the handoff pass removed only project-local artifacts and recovered about 266 MB:

- `frontend/node_modules`
- `frontend/dist`
- `backend-api/vendor`
- generated Python `__pycache__` folders under `ai-cv-analyzer` and `ai-job-miner`
- `backend-api/storage/logs/laravel.log`
- `backend-api/.phpunit.result.cache`
- stale Laravel bootstrap cache files
- stale test artifacts under `backend-api/storage/framework/testing/disks`
- ignored local files `backend-api/test_all.log` and `ai-cv-analyzer/test.pdf`

No Docker volumes, upload data, database data, MinIO data, Prometheus data, Grafana data, model folders, or real `.env` files were removed.
