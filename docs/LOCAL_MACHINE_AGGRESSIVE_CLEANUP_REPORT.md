# Local Machine Aggressive Cleanup Report

Date/time: 2026-05-15 Africa/Cairo
Repository scanned: `D:\Graduation\Graduation-project`

This report is local-machine specific and contains absolute personal paths. Do not commit it.

## Baseline Docker Health

Docker was started with the normal Docker-first command:

`docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`

Baseline checks before cleanup:

- `git status --short`: only local cleanup report artifacts were untracked.
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet`: passed.
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml ps`: all CareerCompass services were running; core app containers reported healthy.

Baseline health URLs:

- `http://localhost`: 200
- `http://localhost/api/health`: 200
- `http://localhost/api/ready`: 200
- `http://localhost/api/v1/health`: 200
- `http://localhost:8000/`: 200
- `http://localhost:8003/health`: 200
- `http://localhost:9090/-/ready`: 200
- `http://localhost:3000/api/health`: 200
- `http://localhost:9000/minio/health/live`: 200

## Host / Local Cache Inventory Before Cleanup

| Path | Status | Size |
| --- | --- | ---: |
| `C:\Users\youse\AppData\Local\ms-playwright` | found | 2278.33 MB |
| `C:\Users\youse\.cache\huggingface` | found | 3.19 MB |
| `C:\Users\youse\.cache\torch` | not found | 0 MB |
| `C:\Users\youse\AppData\Local\pip\Cache` | not found | 0 MB |
| `C:\Users\youse\AppData\Local\npm-cache` | not found | 0 MB |
| `C:\Users\youse\AppData\Roaming\npm-cache` | not found | 0 MB |
| `C:\Users\youse\AppData\Local\Temp` | found, inventoried only | 46.47 MB |

Repository-local generated artifact inventory after the previous cleanup found no remaining `node_modules`, `vendor`, `dist`, `build`, `coverage`, `.venv`, `venv`, `__pycache__`, `.pytest_cache`, or `.cache` directories outside protected paths.

## Host / Local Caches Deleted

The user explicitly confirmed Docker-only usage for CareerCompass, so non-Docker host caches were removed.

| Path | Recovered |
| --- | ---: |
| `C:\Users\youse\AppData\Local\ms-playwright` | 2278.33 MB |
| `C:\Users\youse\.cache\huggingface` | 3.19 MB |

Host/local recovered in this pass: **2281.52 MB** (~**2.23 GB**).

Playwright cache deletion: confirmed.

## Repository-Local Artifacts Deleted

No significant repository-local generated folders remained after the previous cleanup. Safe cleanup commands were run again for:

- `frontend\node_modules`
- `frontend\dist`
- `frontend\build`
- `frontend\coverage`
- `backend-api\vendor`
- project `.venv` / `venv`
- service `.venv` / `venv`
- recursive `__pycache__`
- recursive `.pytest_cache`
- recursive `.cache`
- recursive `coverage`
- Laravel generated cache/log files

None of the protected project runtime paths were touched.

## Docker Disk Usage Before Cleanup

`docker system df` before Docker cleanup:

| Type | Total | Active | Size | Reclaimable |
| --- | ---: | ---: | ---: | ---: |
| Images | 19 | 16 | 42.46 GB | 9.808 GB |
| Containers | 16 | 15 | 195.5 MB | 40.96 kB |
| Local Volumes | 6 | 6 | 510.1 MB | 0 B |
| Build Cache | 155 | 0 | 25.98 GB | 3.456 GB |

Running CareerCompass images before cleanup included:

- `graduation-project-backend-api`
- `graduation-project-backend-worker`
- `graduation-project-backend-worker-high`
- `graduation-project-backend-worker-scraping`
- `graduation-project-backend-worker-ai`
- `graduation-project-backend-worker-emails`
- `graduation-project-backend-scheduler`
- `graduation-project-frontend`
- `graduation-project-ai-cv-analyzer`
- `graduation-project-ai-job-miner`
- `mysql:8.0`
- `nginx:stable-alpine`
- `minio/minio:latest`
- `grafana/grafana-oss:11.4.0`
- `prom/prometheus:v2.55.1`

## Docker Cleanup Commands Run

Safe Docker cleanup only:

- `docker container prune -f`
- `docker image prune -f`
- `docker network prune -f`
- `docker builder prune -a -f`

Not run:

- `docker volume prune`
- `docker system prune --volumes`
- `docker compose down -v`
- `docker image prune -a`

Docker cleanup reclaimed:

- Stopped containers: 40.96 kB
- Dangling images: 0 B
- Unused networks: no reported reclaim
- Build cache: 25.98 GB

After verifying the running container image list, three non-runtime images were removed explicitly because they were not used by the current CareerCompass Docker stack:

- `careercompass-ai-cv-ci-test:latest`
- `careercompass-backend-ci-test:latest`
- `node:22-alpine`

The `minio/mc` image was intentionally kept because it is used by the Compose MinIO initialization helper even though that helper exits after startup.

## Docker Disk Usage After Cleanup

`docker system df` after all Docker cleanup:

| Type | Total | Active | Size | Reclaimable |
| --- | ---: | ---: | ---: | ---: |
| Images | 16 | 15 | 15.52 GB | 91.92 MB |
| Containers | 15 | 15 | 195.4 MB | 0 B |
| Local Volumes | 6 | 6 | 510.3 MB | 0 B |
| Build Cache | 0 | 0 | 0 B | 0 B |

`docker builder du` after cleanup reported total build cache: `0B`.

Docker recovered in this pass: **~35.47 GB** estimated:

- Build cache: ~25.98 GB
- Unused non-runtime images: ~9.49 GB
- Stopped container metadata: 40.96 kB

## What Was Not Deleted

- Docker named volumes.
- Docker Desktop application data.
- MySQL data.
- MinIO data.
- Prometheus data.
- Grafana data.
- `D:\Graduation\Graduation-project\backend-api\storage\app`.
- Uploaded CVs.
- `.env` and `.env.example` files.
- Source code.
- Migrations and seeders.
- Dockerfiles and compose files.
- README and docs.
- Current running CareerCompass Docker images.
- Compose helper image `minio/mc:latest`.
- Global tools such as Docker Desktop, Git, VS Code, browsers, Node, npm, Python, pip, PHP, Composer, or MySQL.
- `C:\Users\youse\AppData\Local\Temp`; it was inventoried but not deleted because it can contain active Windows/application temporary files.

## Docker Health After Cleanup

No Docker volumes were touched and no full rebuild was performed.

`docker compose -f docker-compose.yml -f docker-compose.prod.yml ps` after cleanup showed all CareerCompass services still running. Core services remained healthy:

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

Health URLs after cleanup:

- `http://localhost`: 200
- `http://localhost/api/health`: 200
- `http://localhost/api/ready`: 200
- `http://localhost/api/v1/health`: 200
- `http://localhost:8000/`: 200
- `http://localhost:8003/health`: 200
- `http://localhost:9090/-/ready`: 200
- `http://localhost:3000/api/health`: 200
- `http://localhost:9000/minio/health/live`: 200

Services restarted during this pass: none. Docker Compose services were already running and stayed running.

## Total Estimated Recovered

- Host/local caches: ~2.23 GB
- Docker cleanup: ~35.47 GB
- Total this pass: **~37.70 GB**

Combined with the previous cleanup pass (~4.52 GB), total cleanup across both passes is approximately **42.22 GB**.

## Notes

- CareerCompass still works through Docker at `http://localhost`.
- Future Docker rebuilds may be slower because build cache was pruned.
- Local non-Docker workflows will need reinstalls/redownloads if used later:
  - Playwright browser QA would need browser downloads again.
  - HuggingFace/Python ML runs would redownload models.
  - Frontend local work would require `npm ci`.
  - Backend local PHP work may require `composer install`.
