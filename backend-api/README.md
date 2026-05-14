# CareerCompass Backend API

The backend API is the Laravel 12 service that owns authentication, user profiles, CV uploads, structured CV analysis persistence, job recommendations, gap analysis, applications tracking, scraping orchestration, admin APIs, health checks, metrics, queues, and storage integration.

It is designed to run inside the Docker Compose stack behind Nginx. Host-based Laravel development is possible, but the project handoff path is Docker-first from the repository root.

## Runtime Responsibilities

- Serve legacy `/api` routes and versioned `/api/v1` routes.
- Authenticate users with Laravel Sanctum bearer tokens.
- Protect admin routes with role middleware.
- Protect scraper-only/internal routes with machine-token middleware.
- Validate request payloads through Form Request classes.
- Return API data through Laravel API Resources.
- Call the AI CV Analyzer over HTTP for CV parsing and hybrid matching.
- Call the AI Job Miner over HTTP for scraping workflows.
- Store CV files on the configured disk, including S3-compatible MinIO in the production-style Docker override.
- Dispatch background jobs to database queues.
- Expose health, readiness, and Prometheus-compatible metrics.

## Folder Structure

```text
backend-api/
|-- app/
|   |-- Http/
|   |   |-- Controllers/Api/       Public, protected, admin, and internal API controllers
|   |   |-- Middleware/             Auth, scraper-token, monitoring-token, request hardening
|   |   |-- Requests/               Form Request validation classes
|   |   `-- Resources/              API response resources and collections
|   |-- Jobs/                       Queue jobs such as scraping orchestration
|   |-- Models/                     Eloquent models and relationships
|   |-- Services/                   Business logic and integration services
|   `-- Support/                    Shared support helpers
|-- bootstrap/
|-- config/
|   |-- services.php                AI/scraper service URLs and tokens
|   |-- queue.php                   Database queue settings
|   `-- filesystems.php             Local/S3 storage disks
|-- database/
|   |-- migrations/                 Schema, corrective migrations, indexes, constraints
|   |-- seeders/                    Skills, jobs, sources, roles, admin users
|   `-- factories/
|-- routes/
|   |-- api.php                     `/api` and `/api/v1` route registration
|   `-- console.php                 Scheduler definitions
|-- tests/
`-- Dockerfile
```

## Key Application Layers

### Controllers

Controllers should stay thin. They coordinate Form Requests, Services, Resources, auth context, and response status codes. Examples:

- `AuthController`: register, login, logout, current user, profile update.
- `CvController`: CV upload, skill listing, skill removal, signed CV download URL.
- `JobController`: browse jobs, recommended jobs, scraping triggers, scraping status.
- `GapAnalysisController`: job/role/batch gap analysis.
- `ApplicationController`: applications tracker CRUD.
- `Admin/*`: dashboard, jobs, users, scraping sources, target roles.
- `ScrapedJobController`: scraper callback imports and failed URL reporting.

### Services

Services hold business logic and external integration details:

- `CvProcessingService`: stores CVs, calls the AI analyzer, persists structured analysis, syncs skills/experience, and discovers new roles.
- `SkillSyncService`: canonicalizes and upserts skills.
- `GapAnalysisService`: ranks skills/jobs, calls AI hybrid match when available, and falls back to database matching.
- `ApplicationTrackerService`: creates/updates application tracker rows safely.
- `ScraperClient`: calls the AI Job Miner HTTP API with internal machine auth.

### Requests And Resources

Request validation lives under `app/Http/Requests`. Resource classes live under `app/Http/Resources` and normalize response shapes for the frontend. Important resources include:

- `UserResource`
- `CvAnalysisResource`
- `SkillResource`
- `UserExperienceResource`
- `JobResource`
- `ApplicationResource`

## Authentication And Authorization

### User Auth

- Laravel Sanctum provides token authentication.
- Public auth routes:
  - `POST /api/v1/register`
  - `POST /api/v1/login`
- Protected auth routes:
  - `GET /api/v1/user`
  - `PUT /api/v1/user/profile`
  - `POST /api/v1/logout`

### Admin Auth

Admin routes are nested under `/api/v1/admin` and require both `auth:sanctum` and the admin middleware. Normal user tokens must not access admin data.

Admin areas:

- dashboard stats and system health;
- failed URL visibility and retry;
- job listing/detail/delete;
- user listing/detail/ban toggle;
- scraping source CRUD, toggle, status, diagnostics;
- target role CRUD/toggle and full scraping dispatch.

### Internal Scraper Auth

Scraper-only routes require the `scraper.token` middleware. These routes must never be exposed to normal user Sanctum tokens:

- `POST /api/v1/jobs/import/check`
- `POST /api/v1/jobs/import`
- `POST /api/v1/jobs/import/failed`
- `GET /api/v1/proxies/active`

Tokens:

- Laravel to scraper: `SCRAPER_SERVICE_TOKEN`
- Scraper to Laravel: `SCRAPY_API_TOKEN` / `LARAVEL_API_TOKEN`

## Route Overview

The same route groups are registered for legacy `/api` and versioned `/api/v1` compatibility.

### Public

- `GET /api/health`
- `GET /api/ready`
- `GET /api/metrics` with monitoring token middleware
- `GET /api/cv-files/{cvAnalysis}` signed URL download route
- `POST /api/register`
- `POST /api/login`
- `GET /api/jobs`
- `GET /api/jobs/{id}`

### Protected User Routes

- `GET /api/v1/user`
- `PUT /api/v1/user/profile`
- `POST /api/v1/logout`
- `POST /api/v1/upload-cv`
- `GET /api/v1/user/skills`
- `DELETE /api/v1/user/skills/{skillId}`
- `GET /api/v1/user/cv-analysis`
- `GET /api/v1/user/cv-analysis/download-url`
- `GET /api/v1/jobs/recommended`
- `POST /api/v1/jobs/scrape`
- `POST /api/v1/jobs/scrape-if-missing`
- `GET /api/v1/scraping-status/{jobId}`
- `GET /api/v1/gap-analysis/job/{jobId}`
- `GET /api/v1/gap-analysis/role/{roleId}`
- `POST /api/v1/gap-analysis/batch`
- `GET /api/v1/gap-analysis/recommendations`
- `GET /api/v1/target-roles`
- `GET /api/v1/market/overview`
- `GET /api/v1/market/role-statistics/{roleTitle}`
- `GET /api/v1/market/trending-skills`
- `GET /api/v1/market/skill-demand/{roleTitle}`
- `apiResource /api/v1/applications`

## CV Upload Flow

1. The frontend posts a `multipart/form-data` request to `POST /api/v1/upload-cv`.
2. `CvController` validates the upload and sets a long enough request budget for AI processing.
3. `CvProcessingService` stores the CV using the configured disk.
4. Laravel calls `AI_ENGINE_URL/api/parse-cv`.
5. The AI service returns a structured result with `parsing_status`.
6. Laravel persists a `CvAnalysis` row, user profile fields, experience rows, and skills when safe.
7. The response includes the latest analysis data for the frontend.

### Parsing Status Handling

- `success`: structured profile, skills, and experience can be refreshed.
- `ocr_fallback`: parsing succeeded via OCR fallback; data is usable but may be less precise.
- `timeout`: the AI service exceeded its limit; existing profile/skills are preserved.
- `error`: the AI service returned a structured error; existing profile/skills are preserved.
- `empty_file` or `no_text`: no useful CV text was extracted.

### Skill Preservation

Important safety rules implemented after the logical-flow hardening pass:

- Timeout/error results do not overwrite profile, experience, or skills.
- A successful parse with missing/empty `skills.items` does not call `sync([])` and does not wipe existing skills.
- Comma- or semicolon-delimited labels such as `PHP, LARAVEL` are split before syncing.
- Common names are canonicalized, for example Docker, Laravel, MySQL, React, and REST APIs.

### Role Discovery

When a new CV suggests a role without market data, `CvProcessingService` seeds role discovery using:

1. `analysis.predicted_role`
2. profile title/headline
3. `analysis.primary_domain` as the broad fallback

The service avoids creating duplicate active scrape jobs for the same role while one is pending, processing, or running.

### Storage

Local development can use `local` storage. The production-style Docker override configures S3-compatible storage through MinIO:

- `FILESYSTEM_DISK`
- `CV_STORAGE_DISK`
- `CV_STORAGE_PREFIX`
- `CV_TEMPORARY_URL_MINUTES`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_BUCKET`
- `AWS_ENDPOINT`
- `AWS_URL`
- `AWS_USE_PATH_STYLE_ENDPOINT`

Signed CV download URLs are exposed through the backend download route.

## User Data Shape

`UserResource` exposes:

- account fields: `id`, `name`, `email`, `role`, `created_at`;
- career fields: `job_title`, `headline`, `summary`, `location`, `total_experience_years`, `seniority`, `primary_domain`;
- contact fields: `phone`, `linkedin_url`, `github_url`;
- nested `profile` with profile and `contact_info`;
- `experiences` via `UserExperienceResource`;
- `skills` via `SkillResource`;
- `cv_analysis` via `CvAnalysisResource`.

`SkillResource` includes pivot metadata such as confidence, evidence, and added date when loaded.

`CvAnalysisResource` includes parsing status, predicted role, seniority, domain, score/completeness, strengths, gaps, red flags, metadata, CV file info, and timestamps.

## Jobs And Recommendations

`JobController` supports:

- public job browsing;
- personalized recommendations through `GET /api/v1/jobs/recommended`;
- manual scraping triggers;
- scrape-if-missing role discovery;
- scraping job status checks.

Recommended jobs are intentionally separate from manual search. They use user profile/CV/skills data and return metadata that the frontend can display as "based on your CV role/title".

`JobResource` exposes both `match_percentage` and the normalized `match_score` alias when available so older and newer frontend paths remain compatible.

## Gap Analysis

`GapAnalysisService` compares the user's profile/CV/skills against a job or target role.

Behavior:

- AI hybrid matching is attempted when the AI CV Analyzer is reachable.
- Database matching remains the fallback.
- Results include match percentage, matched skills, missing skills, and recommendations.
- If the user has no useful CV/profile/skills data, the API returns a clear validation response instead of fake analysis.

The AI service uses hybrid matching when local TF-IDF scoring is available and semantic-only fallback without a score penalty when it is not.

## Applications Tracker

Applications are managed by `ApplicationController` and `ApplicationTrackerService`.

Key behavior:

- Tracking is based on the authenticated user and `job_id`.
- The service uses update-or-create semantics so duplicate application rows are avoided.
- `ApplicationResource` includes `job_id` for frontend hydration.
- The Jobs page can mark saved opportunities immediately after reload.

## Scraping Integration

The backend no longer shells out to local Scrapy. Scraping is service-to-service:

1. User or admin action creates a scraping request.
2. Laravel creates/updates `ScrapingJob`.
3. A queue job is dispatched to the `scraping` queue.
4. `backend-worker-scraping` calls the Python `ai-job-miner` service through `ScraperClient`.
5. The Python service runs Scrapy inside its own container.
6. Scraper callbacks import jobs to Laravel internal endpoints.
7. Laravel creates missing skills and syncs relational `job_skills`.
8. Failed URLs are stored for visibility and retry.

After PR #79, if a scrape stores zero jobs and reports failed URLs, the scraping job is marked failed with an honest external-source message. Admin source diagnostics also detect failure signals in scraper output even if the subprocess exits successfully.

## Queues

Queue connection: `database`.

Docker worker lanes:

- `backend-worker`: `default`
- `backend-worker-high`: `high`
- `backend-worker-scraping`: `scraping`
- `backend-worker-ai`: `ai`
- `backend-worker-emails`: `emails`

Useful commands:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker-scraping
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker-ai
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend-api php artisan queue:failed
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend-api php artisan tinker --execute="dump(DB::table('jobs')->whereNull('reserved_at')->where('available_at', '<=', now()->timestamp)->count());"
```

Do not route long-running scraping or AI work to the default queue.

## Scheduler

The `backend-scheduler` container runs:

```bash
php artisan schedule:work
```

Scheduled commands are defined in `routes/console.php`. This includes source health checks and market/update tasks where configured.

## Health, Readiness, Metrics

- `GET /api/health`: lightweight liveness.
- `GET /api/ready`: checks database, cache, queue, AI analyzer, and scraper readiness.
- `GET /api/metrics`: Prometheus-compatible metrics, protected by monitoring token middleware.
- `GET /api/v1/health`: versioned health route.

Prometheus uses the configured monitoring token from the Docker override.

## Environment Variables

Core:

- `APP_KEY`
- `APP_ENV`
- `APP_DEBUG`
- `APP_URL`
- `FRONTEND_URL`

Database and queues:

- `DB_HOST`
- `DB_DATABASE`
- `DB_USERNAME`
- `DB_PASSWORD`
- `QUEUE_CONNECTION=database`
- `DB_QUEUE_RETRY_AFTER`
- `CACHE_STORE=database`
- `SESSION_DRIVER=database`

AI:

- `AI_ENGINE_URL=http://ai-cv-analyzer:8000` in Docker
- `AI_ENGINE_TIMEOUT`
- `AI_CV_ANALYZER_URL` for compatibility

Scraper:

- `SCRAPER_SERVICE_URL=http://ai-job-miner:8000` in Docker
- `SCRAPER_SERVICE_TIMEOUT`
- `SCRAPER_SERVICE_TOKEN`
- `LARAVEL_INTERNAL_API_URL=http://nginx/api/v1`
- `SCRAPY_API_TOKEN`

Storage:

- `FILESYSTEM_DISK`
- `CV_STORAGE_DISK`
- `CV_STORAGE_PREFIX`
- `CV_UPLOAD_RETENTION_DAYS`
- `CV_TEMPORARY_URL_MINUTES`
- `AWS_*` values for MinIO/S3

Monitoring:

- `MONITORING_TOKEN`
- `SENTRY_LARAVEL_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_TRACES_SAMPLE_RATE`
- `SENTRY_PROFILES_SAMPLE_RATE`

## Docker Usage

Run from the repository root.

Start:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Migrate:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend-api php artisan migrate --force --no-interaction
```

Routes:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend-api php artisan route:list
```

Clear caches:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend-api php artisan optimize:clear
```

Logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-api
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker-scraping
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker-ai
```

## Testing

Full backend test suite:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan test
```

Targeted tests used during recent hardening:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan test --filter=CvUploadTest
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan test --filter=Application
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan test --filter=GapAnalysisTest
```

Route and config smoke:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan route:list
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet
```

## Troubleshooting

### Backend readiness is degraded

Check database, queue table, cache table, AI analyzer, scraper service, and internal tokens:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-api
curl http://localhost/api/ready
```

### AI timeout during CV upload

Expected timeout/error behavior should return a structured result and preserve existing profile/skills. Check:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f ai-cv-analyzer
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-api
```

### Upload appears slow

The frontend has upload-specific recovery polling, but the API flow is still synchronous. First AI boot can be slow because the Python service initializes ML/OCR dependencies.

### Queue jobs are stuck

Check the lane-specific worker and failed jobs:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend-api php artisan queue:failed
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-worker-scraping
```

### Scraper callbacks return 401

Verify `SCRAPY_API_TOKEN` in Laravel and `LARAVEL_API_TOKEN` in `ai-job-miner` match.

### Laravel cannot call the scraper

In Docker, `SCRAPER_SERVICE_URL` must be `http://ai-job-miner:8000`, not `localhost`.

### Laravel cannot call the AI analyzer

In Docker, `AI_ENGINE_URL` must be `http://ai-cv-analyzer:8000`.

### MinIO/S3 storage fails

Check MinIO health and bucket initialization:

```bash
curl http://localhost:9000/minio/health/live
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f minio
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f minio-init
```

### Config cache seems stale

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend-api php artisan optimize:clear
```

## Related Documentation

- Root `README.md` for system architecture and Docker quickstart.
- `docs/DOCKER_QUICKSTART.md` for teammate startup.
- `docs/PRODUCT_FLOW_REVIEW.md` for the latest product-flow behavior.
- `docs/TROUBLESHOOTING.md` for operational fixes.
- `docs/PRODUCTION_READINESS.md` for deployment readiness notes.
