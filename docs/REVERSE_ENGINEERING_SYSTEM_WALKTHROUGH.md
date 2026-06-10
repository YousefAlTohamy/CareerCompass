# CareerCompass Reverse-Engineering Walkthrough

This document is a progressive onboarding guide to the repository. It is written
from the point of view of a senior engineer introducing another engineer to the
system: what exists, why it exists, how data moves, and where the production
risks are.

Repository root: `D:\Graduation\Graduation-project`

## 1. System Mental Model

CareerCompass is a multi-service career platform. The important split is:

- React/Vite frontend: user and admin interface.
- Laravel 12 backend API: control plane, auth, database ownership, queues,
  orchestration, API versioning, internal service boundaries, metrics.
- Python AI CV analyzer: heavy CV parsing, NLP extraction, classification, and
  hybrid matching.
- Python job miner: FastAPI facade around scraping adapters and Scrapy.
- MySQL: relational system of record and database-backed queues.
- MinIO/S3: private CV object storage in production-style mode.
- Nginx: single HTTP edge for browser traffic.
- Prometheus/Grafana: local observability stack.
- GitHub Actions: validation, smoke, security, and deployment workflows.

The backend is the center of gravity. The frontend does not call Python
services directly. Python services are internal dependencies called by Laravel.
That keeps auth, persistence, auditability, and error normalization in one
place.

Important entrypoints:

- `backend-api/routes/api.php`
- `frontend/src/App.jsx`
- `frontend/src/api/client.js`
- `ai-cv-analyzer/main.py`
- `ai-job-miner/service_api.py`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `docker/nginx/conf.d/default.conf`
- `.github/workflows/*.yml`

## 2. Request Boundary And API Versioning

The API routes are registered twice in `backend-api/routes/api.php`:

- unversioned: `/api/*`
- versioned: `/api/v1/*`

The closure `registerCareerCompassRoutes()` defines the routes once and is then
mounted under both prefixes. The frontend defaults to `/api/v1` in
`frontend/src/api/client.js` and `frontend/.env.example`.

This is a compatibility strategy. Existing clients can continue using `/api`,
while the frontend and future clients can standardize on `/api/v1`.

Tradeoff:

- Good: low migration pain.
- Risk: if route behavior diverges later, duplicate registration can hide
  versioning boundaries. A mature production API would eventually isolate v1
  controllers/resources from v2.

## 3. Laravel Backend Architecture

Laravel is organized around controllers, form requests, resources, service
classes, Eloquent models, jobs, middleware, migrations, and scheduled commands.

### 3.1 Routing

`backend-api/routes/api.php` defines:

- health and readiness:
  - `GET /health`
  - `GET /ready`
- metrics:
  - `GET /metrics`, protected by monitoring token
- public auth:
  - `POST /register`
  - `POST /login`
- public job browsing:
  - `GET /jobs`
  - `GET /jobs/{id}`
- internal scraper callbacks:
  - `POST /jobs/import/check`
  - `POST /jobs/import`
  - `POST /jobs/import/failed`
  - `GET /proxies/active`
- authenticated user features:
  - `GET /user`
  - `PUT /user/profile`
  - `POST /logout`
  - `POST /upload-cv`
  - `GET /user/skills`
  - `GET /user/cv-analysis`
  - `GET /jobs/recommended`
  - `POST /jobs/scrape`
  - `POST /jobs/scrape-if-missing`
  - `GET /scraping-status/{jobId}`
  - gap analysis routes
  - market intelligence routes
  - application tracker routes
- admin routes:
  - dashboard stats and health
  - jobs and users
  - scraping source CRUD and diagnostics
  - target role CRUD
  - full scraping dispatch

### 3.2 Middleware And Cross-Cutting Concerns

Configured in `backend-api/bootstrap/app.php`:

- `RequestIdMiddleware`
  - Reads `X-Request-ID` or creates a UUID.
  - Stores it in the app container as `request.id`.
  - Adds the same header to responses.
  - Adds request context to logs.

- `LogApiRequests`
  - Logs request completion with status, duration, user ID, route, request ID.
  - Warns on slow requests or 500-level responses.

- `SecureHeaders`
  - Adds content/security headers and removes `X-Powered-By`.

- `ValidatePayloadSize`
  - Rejects large JSON mutation requests based on
    `MAX_JSON_PAYLOAD_BYTES`.

- `VerifyScraperToken`
  - Protects Python scraper to Laravel internal callbacks with
    `SCRAPY_API_TOKEN`.

- `VerifyMonitoringToken`
  - Protects `/metrics` with `MONITORING_TOKEN`.

- `IsAdmin`
  - Restricts admin routes to users with role `admin`.

### 3.3 Service Layer Pattern

The app does not put all business logic into controllers. Key services:

- `App\Services\CvProcessingService`
- `App\Services\CvStorageService`
- `App\Services\GapAnalysisService`
- `App\Services\ScraperClient`
- `App\Services\ApplicationTrackerService`
- `App\Services\SkillSyncService`

Interfaces are bound in `AppServiceProvider` for:

- `CvProcessingServiceInterface`
- `GapAnalysisServiceInterface`

This is a classic Laravel service-layer pattern: controllers handle HTTP shape,
form requests validate input, services implement workflow, models persist data.

## 4. Authentication Flow

Files:

- `frontend/src/context/AuthContext.jsx`
- `frontend/src/api/endpoints.js`
- `frontend/src/api/client.js`
- `frontend/src/components/ProtectedRoute.jsx`
- `backend-api/app/Http/Controllers/Api/AuthController.php`
- `backend-api/app/Http/Requests/LoginRequest.php`
- `backend-api/app/Http/Requests/RegisterRequest.php`
- `backend-api/app/Models/User.php`

### Execution path

1. User submits login/register in React.
2. `AuthContext` calls `authAPI.login()` or `authAPI.register()`.
3. Axios client sends request to `/api/v1/login` or `/api/v1/register`.
4. Laravel validates input with `LoginRequest` or `RegisterRequest`.
5. `AuthController` authenticates or creates the user.
6. Laravel Sanctum creates a personal access token.
7. Response includes token and serialized user.
8. Frontend stores:
   - `auth_token`
   - `user`
9. Axios request interceptor attaches `Authorization: Bearer <token>`.
10. `ProtectedRoute` uses stored user data to gate user/admin routes.

### Design notes

Register validation is intentionally strict:

- only certain email domains are accepted
- password must contain uppercase and number
- password allows a limited special-character set

Tradeoff:

- Good for a controlled graduation/demo environment.
- In broad production, email-domain restriction would be a product limitation.

## 5. CV Upload And AI Analysis Flow

Files:

- `frontend/src/pages/user/Dashboard.jsx`
- `frontend/src/api/endpoints.js`
- `backend-api/app/Http/Requests/CvUploadRequest.php`
- `backend-api/app/Http/Controllers/Api/CvController.php`
- `backend-api/app/Services/CvProcessingService.php`
- `backend-api/app/Services/CvStorageService.php`
- `ai-cv-analyzer/main.py`
- `ai-cv-analyzer/core/layer1_understanding/orchestrator.py`
- `ai-cv-analyzer/core/layer2_classification/orchestrator.py`
- `backend-api/app/Jobs/ProcessOnDemandJobScraping.php`

### Execution path

1. User selects a PDF/JPEG/PNG CV in the dashboard.
2. Frontend validates file shape and sends multipart form data as `cv`.
3. `cvAPI.uploadCV()` posts to `/api/v1/upload-cv` with a 240 second timeout.
4. Laravel route requires Sanctum auth and upload throttle.
5. `CvUploadRequest` validates:
   - required file
   - PDF/JPEG/PNG MIME
   - PDF/JPEG/JPG/PNG extension
   - max 5 MB
6. `CvController::upload()` calls `CvProcessingService::processCv()`.
7. `CvProcessingService` calls the Python analyzer:
   - `POST {AI_ENGINE_URL}/api/parse-cv`
   - multipart file
   - propagates `X-Request-ID`
8. Python analyzer processes the CV.
9. Laravel stores the uploaded CV using `CvStorageService`.
10. Laravel persists structured profile data in a DB transaction.
11. Laravel updates or creates the user's latest `cv_analyses` row.
12. If a new predicted role is found, Laravel creates/uses a target role and
    dispatches background scraping for market discovery.
13. Frontend refreshes the user and displays status-specific feedback.

### What gets stored

Relational data:

- `user_profiles`
- `user_experiences`
- `skills`
- `user_skills`
- `cv_analyses`
- possibly `target_job_roles`
- possibly `scraping_jobs`

Object storage:

- local private disk in local mode
- S3/MinIO in production-style mode
- path pattern:
  - `cv-uploads/users/{user_id}/{year}/{month}/{uuid}.{extension}`

### Resilience behavior

The CV flow is careful about partial AI failure:

- If AI returns `timeout`, `error`, `empty_file`, or `no_text`, Laravel stores
  the analysis record but does not overwrite useful existing profile/skills.
- If AI returns malformed JSON, Laravel normalizes it into a structured
  `error` status.
- If no skills or experience are extracted, existing user data is preserved.

This behavior is protected by feature tests in
`backend-api/tests/Feature/CvUploadTest.php`.

### Production implications

Current design is synchronous from the browser to Laravel to Python. That keeps
the UX simple, but the request can run long. The frontend has timeout/recovery
logic, but the production architecture would be stronger if uploads created an
analysis job, returned immediately, and used polling or events for progress.

## 6. Python AI Analyzer

Files:

- `ai-cv-analyzer/main.py`
- `ai-cv-analyzer/core/layer1_understanding/orchestrator.py`
- `ai-cv-analyzer/core/layer1_understanding/schema.py`
- `ai-cv-analyzer/core/layer1_understanding/spatial_parser.py`
- `ai-cv-analyzer/core/layer1_understanding/ocr_pipeline.py`
- `ai-cv-analyzer/core/layer1_understanding/section_segmenter.py`
- `ai-cv-analyzer/core/layer1_understanding/advanced_ner.py`
- `ai-cv-analyzer/core/layer1_understanding/experience_engine.py`
- `ai-cv-analyzer/core/layer1_understanding/contact_extractor.py`
- `ai-cv-analyzer/core/layer1_understanding/canonicalizer.py`
- `ai-cv-analyzer/core/layer2_classification/*`
- `ai-cv-analyzer/core/layer3_matching/*`

### Service endpoints

`ai-cv-analyzer/main.py` exposes:

- `GET /`
  - health/root endpoint
- `GET /metrics`
  - Prometheus text metrics
- `POST /api/parse-cv`
  - CV parsing
- `POST /api/hybrid-match`
  - semantic/TF-IDF match scoring

### CV parsing pipeline

1. FastAPI receives a file.
2. The service reads bytes and selects PDF or image path.
3. A timeout executor runs processing with `CV_TIMEOUT_SECONDS`.
4. `CVOrchestrator` extracts text:
   - PDF spatial extraction first
   - OCR fallback for scanned/low-text PDFs
   - direct OCR for image CVs
5. Text is segmented into CV sections.
6. Contact info is extracted.
7. NER and canonicalization extract skills.
8. Experience engine extracts job ranges, total years, skill durations, gaps,
   overlaps, and career-health metadata.
9. Layer 2 classifies:
   - primary domain
   - seniority
   - categorized skills
10. Output is returned in the structured `CVParseResult` shape.

### Why this design exists

AI parsing is CPU/memory heavy and dependency-heavy. Keeping it in Python avoids
pulling ML libraries into PHP. Laravel receives a normalized JSON contract and
does the persistence.

Tradeoffs:

- Good: language separation matches workload strengths.
- Good: Laravel can degrade cleanly on AI timeout.
- Risk: analyzer startup can be heavy because models and OCR dependencies are
  loaded in container startup/prewarm.
- Risk: parsing is deterministic-ish but still heuristic/ML-based, so accuracy
  must be measured with labeled data before claims.

## 7. Gap Analysis And Recommendation Flow

Files:

- `frontend/src/pages/user/Jobs.jsx`
- `frontend/src/pages/user/GapAnalysis.jsx`
- `backend-api/app/Http/Controllers/Api/GapAnalysisController.php`
- `backend-api/app/Services/GapAnalysisService.php`
- `ai-cv-analyzer/main.py`

### Execution path

1. User opens a job or gap-analysis page.
2. Frontend calls `/api/v1/gap-analysis/job/{jobId}`.
3. Laravel loads:
   - authenticated user
   - latest CV analysis
   - user skills
   - selected job
   - job required skills
4. `GapAnalysisService` builds an AI matching payload from persisted DB data.
5. Laravel calls Python `/api/hybrid-match`.
6. If AI succeeds, Laravel maps AI output into frontend format.
7. If AI fails, Laravel falls back to DB/fuzzy skill matching.
8. Response contains matched skills, missing skills, match score, and
   recommendations.

Important: gap analysis does not re-upload or re-parse the CV. It uses the
structured data already stored from the CV upload.

### Recommendation logic

`JobController::getRecommended()` uses:

- predicted role from `cv_analyses`
- fallback user job title
- title alignment
- skill overlap
- seniority alignment

It fetches candidate jobs, scores them locally, and returns the top matches.

Tradeoff:

- Good: fast and explainable.
- Risk: matching is mostly title/skill based and may miss semantically similar
  roles unless the AI match endpoint is used in the specific gap-analysis flow.

## 8. Scraping System

Files:

- `backend-api/app/Http/Controllers/Api/JobController.php`
- `backend-api/app/Http/Controllers/Api/ScrapedJobController.php`
- `backend-api/app/Jobs/ProcessOnDemandJobScraping.php`
- `backend-api/app/Jobs/ProcessMarketScraping.php`
- `backend-api/app/Jobs/ProcessMarketScrapingCategory.php`
- `backend-api/app/Services/ScraperClient.php`
- `ai-job-miner/service_api.py`
- `ai-job-miner/ai_job_miner/settings.py`
- `ai-job-miner/ai_job_miner/spiders/base_spider.py`
- `ai-job-miner/ai_job_miner/spiders/linkedin_spider.py`
- `ai-job-miner/ai_job_miner/pipelines.py`

### Two directions of communication

Laravel to miner:

- `ScraperClient` calls `POST /scrape` on `ai-job-miner`
- header: `X-Scraper-Service-Token`
- payload includes query, source, limit, scraping job ID, callback URL

Miner to Laravel:

- exports jobs to `/api/v1/jobs/import`
- checks dedupe at `/api/v1/jobs/import/check`
- reports failures to `/api/v1/jobs/import/failed`
- can fetch proxies from `/api/v1/proxies/active`
- protected by `SCRAPY_API_TOKEN`

### On-demand scraping flow

1. User searches for a role or uploads a CV that discovers a role.
2. Laravel checks whether matching jobs already exist.
3. If missing, Laravel creates `scraping_jobs` row.
4. Laravel dispatches `ProcessOnDemandJobScraping` to the `scraping` queue.
5. Worker calls job miner through `ScraperClient`.
6. Job miner selects adapter:
   - demo
   - Remotive
   - Adzuna
   - RemoteOK
   - Arbeitnow
   - Wuzzuf
   - Indeed
   - Upwork
   - LinkedIn/Scrapy
7. Miner applies quality gates:
   - meaningful title
   - meaningful company
   - meaningful description
   - valid absolute URL
   - source identity
   - normalized job/work type
8. Accepted jobs are POSTed to Laravel.
9. Laravel dedupes and stores jobs/skills.
10. Scraping job is marked completed or failed.
11. Frontend polls `/scraping-status/{id}`.

### Deduplication

There are multiple dedupe layers:

- Python in-memory URL set during one run.
- Python pipeline checks Laravel `/jobs/import/check`.
- Laravel dedupes by URL.
- Laravel also dedupes by title/company.
- DB has unique constraints on URL and title/company.

### Failure tracking

Failed scrape URLs are stored in `scraping_failed_urls`, associated with:

- scraping source
- scraping job
- URL
- error message
- failed timestamp
- retried flag

The admin dashboard exposes failed URLs and can mark failures as retried.
Currently that retry action marks state; it does not perform a precise per-URL
retry.

### Scraper design decision

The Python service does not hide external-site failures. It classifies outcomes
such as:

- `SUCCESS`
- `PARTIAL_SUCCESS`
- `EMPTY_RESULT`
- `DATA_QUALITY_FAILED`
- `CONFIG_REQUIRED`
- `ADAPTER_MISSING`
- `EXTERNAL_BLOCKED`
- `EXTERNAL_FAILED`
- `INTEGRITY_COMPROMISED`

That is a strong operational pattern. It lets the admin UI tell the truth about
whether a source is blocked, unsupported, misconfigured, or simply empty.

## 9. Database Design

Migrations live in `backend-api/database/migrations`.

### Main entity groups

Identity/auth:

- `users`
- `personal_access_tokens`
- `password_reset_tokens`
- `sessions`

User career profile:

- `user_profiles`
- `user_experiences`
- `cv_analyses`
- `skills`
- `user_skills`

Jobs and market data:

- `job_postings`
- `job_skills`
- `job_role_statistics`
- `target_job_roles`

Scraping operations:

- `scraping_sources`
- `scraping_jobs`
- `scraping_failed_urls`
- `scraping_proxies`

Application tracker:

- `applications`

Infrastructure:

- `jobs`
- `job_batches`
- `failed_jobs`
- `cache`
- `cache_locks`

### Key relationships

`users`:

- has one `user_profiles`
- has many `user_experiences`
- has one latest `cv_analyses`
- belongs to many `skills` through `user_skills`
- has many `applications`

`job_postings`:

- belongs to `scraping_sources`
- belongs to many `skills` through `job_skills`
- has many `applications`

`scraping_sources`:

- has many `job_postings`
- has many `scraping_failed_urls`

`scraping_jobs`:

- has many `scraping_failed_urls`

### Important constraints and indexes

- `skills.name` unique.
- `user_skills` unique on `user_id, skill_id`.
- `job_skills` unique on `job_id, skill_id`.
- `job_postings.url` unique.
- `job_postings.title, company` unique.
- `applications.user_id, job_id` unique.
- `cv_analyses.user_id` unique after hardening migration.
- indexes on scraping job status/type/job title.
- indexes on job source/created date.
- indexes on CV SHA/upload timestamp.

### Normalization strategy

Skills are normalized into one `skills` table and reused for both user profiles
and job postings. This lets the system compare user skills against job skills
relationally instead of parsing strings every time.

Some raw JSON is intentionally retained:

- `cv_analyses.raw_json_output`
- `cv_analyses.metadata`
- `job_role_statistics.top_skills`
- `job_role_statistics.common_locations`

That hybrid approach is practical: relational tables support matching and
queries, while JSON columns preserve AI/scraper metadata without schema churn.

## 10. Queue System

Queue config:

- `backend-api/config/queue.php`
- default connection: `database`
- `after_commit`: true
- failed driver: `database-uuids`

Docker workers:

- `backend-worker`: default queue
- `backend-worker-high`: high queue
- `backend-worker-scraping`: scraping queue
- `backend-worker-ai`: ai queue
- `backend-worker-emails`: emails queue
- `backend-scheduler`: Laravel schedule runner

Major queued jobs:

- `ProcessOnDemandJobScraping`
- `ProcessMarketScraping`
- `ProcessMarketScrapingCategory`

Retry/backoff patterns:

- on-demand scraping has tries and backoff
- scraping worker has longer timeout
- market scraping batches allow failures
- scheduler uses `withoutOverlapping`

Why database queue:

- Simple for Docker/local/demo.
- No extra Redis/SQS infrastructure.

Scalability tradeoff:

- Good for moderate load.
- At higher scale, Redis/SQS is more appropriate for throughput, visibility,
  delayed jobs, and worker isolation.

## 11. Docker Infrastructure

Main compose file: `docker-compose.yml`

Production-style overrides: `docker-compose.prod.yml`

### Containers

`db`:

- MySQL 8
- volume: `cc-db-data`
- healthcheck via `mysqladmin ping`

`backend-api`:

- PHP 8.4 FPM
- Laravel API behind Nginx
- talks to DB, AI analyzer, job miner, storage

`backend-worker*`:

- same backend image
- different `queue:work` commands
- isolates workloads by queue name

`backend-scheduler`:

- runs `php artisan schedule:work`

`frontend`:

- local/dev compose uses Vite dev server
- prod override uses built static assets served by Nginx image

`ai-cv-analyzer`:

- FastAPI on port 8000
- health at `/`

`ai-job-miner`:

- FastAPI on port 8000 inside container
- host port 8003
- health at `/health`

`nginx`:

- host port 80
- routes API to backend PHP-FPM
- routes frontend paths to frontend service

`minio` and `minio-init`:

- production-style S3-compatible CV storage
- creates `career-compass` bucket

`prometheus`:

- scrapes backend, analyzer, miner
- injects monitoring token into config template

`grafana`:

- pre-provisioned Prometheus datasource

### Networking

All services join `cc-network`. Internal service names become DNS names:

- `backend-api`
- `ai-cv-analyzer`
- `ai-job-miner`
- `nginx`
- `db`
- `minio`

That is why Docker env values use internal URLs like:

- `AI_ENGINE_URL=http://ai-cv-analyzer:8000`
- `SCRAPER_SERVICE_URL=http://ai-job-miner:8000`
- `LARAVEL_INTERNAL_API_URL=http://nginx/api/v1`
- `AWS_ENDPOINT=http://minio:9000`

### Storage

Local/default:

- CV files on Laravel private local disk.

Production-style:

- `CV_STORAGE_DISK=s3`
- MinIO bucket `career-compass`
- Laravel generates browser-safe signed app URLs, not raw internal MinIO URLs.

This avoids leaking Docker-only hostnames like `minio:9000` to the browser.

## 12. Frontend Architecture

Files:

- `frontend/src/main.jsx`
- `frontend/src/App.jsx`
- `frontend/src/api/client.js`
- `frontend/src/api/endpoints.js`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/components/ProtectedRoute.jsx`
- `frontend/src/hooks/useOnDemandScraping.js`
- `frontend/src/hooks/useScrapingStatus.js`

### Routing

`App.jsx` lazy-loads pages with React Router.

Public routes:

- `/`
- `/login`
- `/register`
- `/about`
- `/privacy`
- `/terms`
- `/status`

User routes:

- `/dashboard`
- `/jobs`
- `/gap-analysis/:jobId`
- `/profile`
- `/settings`
- `/market`
- `/applications`
- other career-tool pages

Admin routes:

- `/admin/dashboard`
- `/admin/jobs`
- `/admin/users`
- `/admin/sources`
- `/admin/targets`

### API client

`frontend/src/api/client.js`:

- base URL defaults to `/api/v1`
- attaches Bearer token from localStorage
- generates `X-Request-ID`
- clears auth on 401
- retries GET/HEAD network or 5xx errors up to two times

### State management

The app uses React context and local state rather than Redux:

- `AuthContext` for auth/user
- page state for jobs, CV upload, market, applications, admin diagnostics
- localStorage for token and cached user

This is reasonable for app size. If workflows grow more complex, a query/cache
library such as TanStack Query would reduce manual loading/error/polling code.

### CV upload UX

`Dashboard.jsx`:

- validates file before upload
- sends multipart CV
- displays parsing status
- refreshes user after upload
- has recovery polling for timeout/network cases

### Job/gap UX

`Jobs.jsx`:

- fetches recommended jobs when no search is active
- fetches normal jobs for search
- hydrates tracked application IDs
- calls gap analysis when a job is selected
- guards against stale gap-analysis responses

### Admin sources UX

`AdminSources.jsx`:

- polls source status every 5 seconds
- runs diagnostics
- runs full extraction batches
- shows classifications, rejected counts, quality warnings, adapter/support
  status, and errors

## 13. Monitoring And Observability

Backend:

- `GET /health`: liveness
- `GET /ready`: DB/cache/AI/scraper readiness
- `GET /metrics`: Prometheus metrics, token protected

Python AI analyzer:

- `GET /`
- `GET /metrics`

Python job miner:

- `GET /health`
- `GET /metrics`

Prometheus config:

- `docker/prometheus/prometheus.yml.tpl`

Grafana datasource:

- `docker/grafana/provisioning/datasources/prometheus.yml`

Structured logging:

- `backend-api/config/logging.php`
- JSON formatter channel writes to stderr.

Request correlation:

- frontend creates `X-Request-ID`
- Nginx forwards it
- Laravel stores/logs it
- Laravel propagates it to Python services
- Python analyzer returns it and includes metrics timing headers

This is a strong distributed-system pattern. It lets one user action be traced
across frontend, Nginx, Laravel, queue jobs, analyzer, miner, and logs.

## 14. CI/CD

Workflows:

- `.github/workflows/backend.yml`
- `.github/workflows/frontend.yml`
- `.github/workflows/python-services.yml`
- `.github/workflows/docker.yml`
- `.github/workflows/full-docker-smoke.yml`
- `.github/workflows/security.yml`
- `.github/workflows/deploy.yml`

### Backend workflow

- PHP 8.4
- MySQL 8 service
- Composer install
- Laravel key generation
- migrations
- `php artisan test`

### Frontend workflow

- Node 22
- `npm ci`
- lint
- build
- uploads `frontend/dist`

### Python workflow

- Python 3.11
- installs service requirements
- compiles source
- runs current service/API tests
- skips legacy/manual model tests with explicit notices

### Docker workflow

- validates compose config
- builds key runtime images
- runs Trivy filesystem scan

### Full Docker smoke

Manual workflow:

- builds all runtime images
- boots full stack
- runs `scripts/smoke/docker-smoke.sh`

### Deploy workflow

Manual dispatch:

- staging or production
- production restricted to main/master
- SCP release bundle
- updates `current` symlink
- docker compose up with prod override
- runs migrations
- caches config/routes
- runs HTTP smoke test

This is a simple server-based Compose deployment model, not Kubernetes or blue
green deployment. It is understandable and appropriate for the project scale.

## 15. Tests

Backend feature tests cover:

- auth API
- CV upload behavior
- malformed/failed AI responses
- browser-safe signed CV download URLs
- gap analysis
- internal scraper token protection
- scraped job import/dedup/validation
- queue scraper dispatch
- scraper orchestrator/admin diagnostics
- health and metrics
- application tracker dedupe

Python tests cover:

- AI analyzer service API
- job miner service API
- AI utility logic
- current pipeline behavior

Smoke scripts:

- `scripts/smoke/http-smoke.sh`
- `scripts/smoke/docker-smoke.sh`
- `scripts/smoke/queue-smoke.sh`
- PowerShell equivalents

## 16. Important Patterns

Laravel patterns:

- FormRequest validation
- JsonResource response shaping
- service layer orchestration
- Eloquent relationships
- database transactions
- queued jobs
- scheduled commands
- route middleware aliases
- Sanctum token auth
- rate limiting

Queue patterns:

- separate queues by workload class
- long timeout for scraping
- batch jobs for market scraping
- failure records in `failed_jobs`
- domain-level scrape failures in `scraping_failed_urls`

Storage patterns:

- abstract disk config
- local disk for dev
- S3-compatible disk for prod
- app-signed download route hides storage backend

Observability patterns:

- request IDs
- structured logs
- liveness/readiness split
- Prometheus metrics
- admin health dashboard
- service-level health endpoints

Internal auth pattern:

- user API uses Sanctum
- scraper-to-Laravel uses machine token
- Laravel-to-scraper uses service token
- monitoring uses monitoring token

## 17. Risks And Improvements

### Strengths

- Clear service boundaries.
- Backend owns persistence and orchestration.
- Python services are internal and isolated.
- CV parsing failures are normalized.
- Existing profile data is protected from weak AI output.
- Scraper outcomes are classified honestly.
- Admin source diagnostics are operationally useful.
- Queue workers are separated by workload.
- Versioned API exists.
- MinIO/S3 storage is abstracted.
- Health, readiness, metrics, request IDs, and structured logs exist.
- CI covers backend, frontend, Python services, Docker, and security scans.

### Risks

1. Synchronous CV upload

   The browser waits while Laravel waits for Python AI. This can work, but it is
   fragile under heavy load or slow model execution.

   Better: create an analysis job, return `202 Accepted`, poll analysis status,
   and let a worker call the analyzer.

2. Database queue scalability

   DB queues are simple and visible, but high-volume scraping or AI jobs can
   contend with application queries.

   Better: Redis/SQS for production scale.

3. Frontend/backend mismatch

   `useOnDemandScraping` checks `already_exists`, but Laravel returns
   `data_exists`. This can cause incorrect handling when data already exists.

4. Scrape result counting

   Some on-demand result counts are inferred from before/after job counts by
   title. That can be approximate when duplicates or similar titles exist.

5. Admin retry semantics

   Failed URL retry currently marks records as retried. It does not dispatch a
   precise retry job for each failed URL.

6. API version boundary

   `/api` and `/api/v1` share the same route definitions. This is fine now, but
   future API version changes need stronger separation.

7. Model accuracy claims

   The analyzer is sophisticated, but production claims require labeled
   evaluation datasets and repeatable metrics.

8. Scraper external-source fragility

   Public HTML and SPA scraping can break because of layout changes, blocking,
   login walls, robots policy, or rate limits. The app handles this honestly,
   but production data ingestion should prefer official APIs or licensed feeds.

9. Cache/database coupling

   Cache defaults to database in local config. That is simple, but for high load
   Redis would separate cache/lock traffic from relational queries.

10. Some frontend pages contain derived/demo-style analytics

   Market UI now explains data limitations, but future production should keep
   live metrics clearly separated from sample notes.

## 18. End-To-End Mental Model

For a normal student:

1. Register/login.
2. Upload CV.
3. Laravel stores original CV privately.
4. Laravel asks Python AI to parse it.
5. Python returns structured skills/profile/experience.
6. Laravel persists normalized data.
7. Laravel may dispatch scraping for the predicted role.
8. Queue worker calls job miner.
9. Job miner imports jobs back into Laravel.
10. User sees recommended jobs.
11. User selects a job for gap analysis.
12. Laravel compares persisted user skills against persisted job skills.
13. Python hybrid matcher is used when available.
14. User saves applications to tracker.
15. Admin monitors health, sources, scraping batches, failures, and market data.

For the platform:

- Laravel is the brain and ledger.
- Python AI is the document intelligence engine.
- Python miner is the ingestion engine.
- MySQL stores both business data and queue state.
- MinIO stores private binary CVs.
- Nginx is the browser-facing gateway.
- Prometheus/Grafana observe the running system.
- GitHub Actions validate changes before deployment.

That is the architecture in one sentence:

CareerCompass is a Laravel-orchestrated career intelligence platform where
React presents workflows, Python services enrich CV/job data, queues decouple
slow work, relational tables normalize skills and jobs, S3-style storage keeps
CVs private, and Docker/CI/observability make the system operable.
