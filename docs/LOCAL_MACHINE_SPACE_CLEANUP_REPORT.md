# Local Machine Space Cleanup Report

Date/time: 2026-05-15 Africa/Cairo
Repository scanned: `D:\Graduation\Graduation-project`

This report is local-machine specific and contains absolute personal paths. Do not commit it.

## Docker Baseline Before Cleanup

Docker Desktop was initially not running. It was started without rebuilding any project images.

Baseline checks after Docker engine startup:

- `docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet`: passed
- `http://localhost`: 200
- `http://localhost/api/health`: 200
- `http://localhost/api/ready`: 200
- `http://localhost/api/v1/health`: 200
- `http://localhost:8000/`: 200
- `http://localhost:8003/health`: 200
- `http://localhost:9090/-/ready`: 200
- `http://localhost:3000/api/health`: 200
- `http://localhost:9000/minio/health/live`: 200

No Docker volumes were touched.

## Inventory Before Cleanup

### Repository-Local Candidates

| Path | Classification | Size |
| --- | --- | ---: |
| `D:\Graduation\Graduation-project\frontend\node_modules` | SAFE_TO_REMOVE_FOR_DOCKER_ONLY | 159.26 MB |
| `D:\Graduation\Graduation-project\frontend\dist` | SAFE_TO_REMOVE_FOR_DOCKER_ONLY | 7.40 MB |
| Python `__pycache__` folders under `ai-cv-analyzer` and `ai-job-miner` | SAFE_TO_REMOVE_FOR_DOCKER_ONLY | ~0.94 MB |
| `.pytest_cache` folders under `ai-cv-analyzer` and `ai-job-miner` | SAFE_TO_REMOVE_FOR_DOCKER_ONLY | ~0 MB |
| `D:\Graduation\Graduation-project\backend-api\vendor` | SAFE_TO_REMOVE_FOR_DOCKER_ONLY | 0 MB |
| `D:\Graduation\Graduation-project\backend-api\.phpunit.result.cache` | SAFE_TO_REMOVE_FOR_DOCKER_ONLY | 0 MB |

Estimated unique repository-local removable size: ~167.60 MB.

### Host Cache Candidates

| Path | Classification | Size |
| --- | --- | ---: |
| `C:\Users\youse\.cache\huggingface\hub` | SAFE_TO_REMOVE_FOR_DOCKER_ONLY | 4.07 GB |
| `C:\Users\youse\.cache\huggingface\datasets` | NOT_FOUND | 0 GB |
| `C:\Users\youse\.cache\torch` | NOT_FOUND | 0 GB |
| `C:\Users\youse\AppData\Local\pip\Cache` | SAFE_TO_REMOVE_FOR_DOCKER_ONLY | ~0 GB |
| `C:\Users\youse\AppData\Local\npm-cache` | SAFE_TO_REMOVE_FOR_DOCKER_ONLY | 0.29 GB |
| `C:\Users\youse\AppData\Local\ms-playwright` | ASK_BEFORE_REMOVE | 2.22 GB |

Largest HuggingFace model cache folders:

| Cache folder | Size |
| --- | ---: |
| `models--valhalla--distilbart-mnli-12-1` | 1.66 GB |
| `models--facebook--bart-large-mnli` | 1.52 GB |
| `models--jjzha--jobbert-base-cased` | 0.40 GB |
| `models--dslim--bert-base-NER` | 0.40 GB |
| `models--sentence-transformers--all-MiniLM-L6-v2` | 0.09 GB |

## Cleanup Plan

Delete automatically:

- repository-local generated dependencies/caches/build output listed above;
- HuggingFace hub cache;
- pip cache;
- npm cache.

Keep:

- Docker volumes;
- Docker Desktop data;
- MySQL, MinIO, Prometheus, Grafana data;
- `backend-api/storage/app`;
- uploaded CVs;
- `.env` files and `.env.example` files;
- source code, migrations, seeders, Dockerfiles, compose files, README/docs;
- Playwright browser cache unless explicitly approved separately.

Deleting host caches may cause local non-Docker Python/ML/Node workflows to redownload dependencies. Docker runtime does not depend on these host caches.

## Cleanup Executed

Deletion was limited to repository-local generated artifacts and known host cache folders. No Docker volumes or runtime storage directories were removed.

### Repository-Local Artifacts Deleted

| Path / pattern | Estimated recovered |
| --- | ---: |
| `D:\Graduation\Graduation-project\frontend\node_modules` | 159.26 MB |
| `D:\Graduation\Graduation-project\frontend\dist` | 7.40 MB |
| `D:\Graduation\Graduation-project\backend-api\vendor` | 0 MB |
| `D:\Graduation\Graduation-project\backend-api\.phpunit.result.cache` | 0 MB |
| `D:\Graduation\Graduation-project\backend-api\bootstrap\cache\*.php` | 0.02 MB |
| Recursive `__pycache__` folders under the repository | ~0.94 MB |
| Recursive `.pytest_cache` folders under the repository | ~0 MB |
| Laravel log files matching `backend-api\storage\logs\*.log` | none found |

### Host Caches Deleted

| Path | Estimated recovered |
| --- | ---: |
| `C:\Users\youse\.cache\huggingface\hub` | 4170.38 MB |
| `C:\Users\youse\AppData\Local\npm-cache` | 293.34 MB |
| `C:\Users\youse\AppData\Local\pip\Cache` | ~0 MB |

Estimated total recovered: **4631.34 MB** (~**4.52 GB**).

## Intentionally Kept

- Docker named volumes and all Docker Desktop data.
- MySQL, MinIO, Prometheus, and Grafana runtime data.
- `D:\Graduation\Graduation-project\backend-api\storage\app`.
- Uploaded CVs and application runtime storage.
- All `.env` and `.env.example` files.
- Source code, migrations, seeders, Dockerfiles, compose files, README files, and docs.
- `C:\Users\youse\AppData\Local\ms-playwright` (~2.22 GB), because it may be useful for local browser QA and was classified as ask-before-remove.
- Global tools such as Docker Desktop, Git, Node.js, npm, Python, pip, PHP, Composer, MySQL, VS Code, and browsers.

## Docker Health After Cleanup

No Docker rebuild was performed after cleanup.

`docker compose -f docker-compose.yml -f docker-compose.prod.yml ps` showed all core services up, with Docker health checks reporting healthy for:

- `cc-backend`
- `cc-backend-scheduler`
- `cc-backend-worker`
- `cc-backend-worker-ai`
- `cc-backend-worker-emails`
- `cc-backend-worker-high`
- `cc-backend-worker-scraping`
- `cc-cv-analyzer`
- `cc-db`
- `cc-frontend`
- `cc-job-miner`
- `cc-nginx`

Runtime health checks after cleanup:

- `http://localhost`: 200
- `http://localhost/api/health`: 200
- `http://localhost/api/ready`: 200
- `http://localhost/api/v1/health`: 200
- `http://localhost:8000/`: 200
- `http://localhost:8003/health`: 200
- `http://localhost:9090/-/ready`: 200
- `http://localhost:3000/api/health`: 200
- `http://localhost:9000/minio/health/live`: 200

Services restarted: Docker Desktop was started because it was initially not running. No compose service was manually restarted after cleanup.

## Follow-Up Notes

- Docker-first usage still works with:
  `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`
- Local non-Docker frontend work will require `npm ci` again because `frontend\node_modules` was removed.
- Local non-Docker backend PHP work may require `composer install` if `backend-api\vendor` is needed.
- Local non-Docker Python/ML work may redownload HuggingFace models because the host HuggingFace hub cache was removed.
- Local browser QA can still use the kept Playwright cache.
