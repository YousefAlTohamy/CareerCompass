# CareerCompass Backend API 🚀

> **Laravel 12 REST API** for user authentication, CV analysis, job management, and skill gap analysis — integrated with the V3 AI Pipeline and normalized database schema.

## 📋 Overview

The Backend API is a Laravel 12-based RESTful service that handles user authentication, CV upload and skill extraction (via AI microservices), job management, and skill gap analysis. It uses Laravel Sanctum for API token authentication and communicates with **two Python AI microservices** via environment-configured URLs.

---

## ✨ Features

- **User Authentication** — Registration, login, logout with Sanctum tokens
- **CV Upload & Analysis** — V3 AI Pipeline via ai-hybrid-orchestrator; structured output stored in normalized tables
- **Skill Management** — Dynamic NLP extraction, canonical skill storage with **confidence_score** and **evidence**
- **Job Management & Recommendations** — Browse, scrape, AI-powered matching
- **Application Tracker** — Full CRUD for job application lifecycle
- **Gap Analysis** — Zero PDF Re-parsing: uses pre-canonicalized skills from DB + Layer 3 semantic matching
- **Market Intelligence** — Trending skills, role statistics, demand breakdown
- **Database Normalization** — `users` (Auth) | `user_profiles` (CV data) | `user_experiences` | `cv_analyses` | enriched `user_skills` pivot
- **Microservices Routing** — Configurable `CV_AI_SERVICE_URL` (8001) and `AI_ORCHESTRATOR_URL` (8001)
- **Strict RBAC** — `/user/*` vs `/admin/*` via IsAdmin middleware
- **Background Queue Jobs** — `ProcessMarketScraping` and `ProcessOnDemandJobScraping` with retry/backoff
- **Scheduled Tasks** — Automated market scraping (48h) and skill importance recalculation (daily)
- **Admin Panel** — Dashboard stats, user management (ban/unban), job CRUD, scraping source management, target role orchestration
- **Self-Expanding Role Discovery** — New domains detected from CV uploads are auto-registered and trigger background scraping

---

## 🏗️ Architecture & Design Patterns

### Service-Interface Contract Pattern

The backend follows a strict **Service-Interface (Contract) Pattern** where all business logic resides in dedicated service classes, each implementing a PHP interface:

| Interface | Implementation | Purpose |
|-----------|---------------|---------|
| `CvProcessingServiceInterface` | `CvProcessingService` | CV upload → AI Gateway call → persist profile/experiences/skills/analysis |
| `GapAnalysisServiceInterface` | `GapAnalysisService` | Layer 3 matching, DB fallback, global recommendations |

**Key principles:**
- **Thin Controllers**: Controllers (`CvController`, `GapAnalysisController`, etc.) contain zero business logic — they delegate entirely to services.
- **Strict Types**: Both services declare `declare(strict_types=1)` for type safety.
- **DB Transactions**: `CvProcessingService.processCv()` wraps all 4 persistence operations (`profile`, `experiences`, `skills`, `cv_analysis`) in a single `DB::transaction()`.

### Directory Structure

```
backend-api/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   └── Api/
│   │   │       ├── AuthController.php            # Register, login, logout, updateProfile
│   │   │       ├── CvController.php              # CV upload, skill management
│   │   │       ├── GapAnalysisController.php     # Single job, batch, global recommendations
│   │   │       ├── JobController.php             # Browse, scrape, recommended
│   │   │       ├── MarketIntelligenceController  # Market overview, trending skills
│   │   │       ├── ApplicationController.php     # Application tracker (apiResource)
│   │   │       ├── ScrapingSourceController.php  # Public scraping source proxy
│   │   │       └── Admin/
│   │   │           ├── DashboardController.php   # Stats + system health
│   │   │           ├── AdminJobController.php    # Admin job CRUD
│   │   │           ├── AdminUserController.php   # User management + ban toggle
│   │   │           ├── ScrapingSourceController  # Full CRUD + toggle + test
│   │   │           └── TargetJobRoleController   # Role CRUD + run full scraping
│   │   ├── Middleware/
│   │   │   └── IsAdmin.php                       # RBAC: role === 'admin' → 403
│   │   ├── Requests/
│   │   │   ├── CvUploadRequest.php               # mimes:pdf,jpeg,jpg,png | max:5MB
│   │   │   └── StoreScrapingSourceRequest.php    # url, in:api,html validation
│   │   └── Resources/
│   │       ├── UserResource.php                  # Flattened user + profile + skills + analysis
│   │       ├── SkillResource.php                 # confidence_score, evidence pivot
│   │       ├── CvAnalysisResource.php            # completeness_score, strengths, gaps
│   │       ├── GapAnalysisResource.php           # Full gap analysis response (5.3 KB)
│   │       ├── JobResource.php                   # Job posting serialization
│   │       ├── ScrapingSourceResource.php        # Scraping source serialization
│   │       └── UserExperienceResource.php        # Work history serialization
│   ├── Models/                                    # 11 Eloquent models (see below)
│   ├── Services/
│   │   ├── Contracts/
│   │   │   ├── CvProcessingServiceInterface.php
│   │   │   └── GapAnalysisServiceInterface.php
│   │   ├── CvProcessingService.php               # CV upload → AI Gateway, persist all
│   │   └── GapAnalysisService.php                # Zero PDF Re-parsing, Layer 3 matching
│   ├── Jobs/
│   │   ├── ProcessMarketScraping.php             # Scheduled market scraping (timeout: 600s)
│   │   └── ProcessOnDemandJobScraping.php         # On-demand scraping (timeout: 180s)
│   └── Providers/
├── database/
│   ├── migrations/                                # 22 migration files
│   └── seeders/
│       ├── DatabaseSeeder.php                     # Master seeder
│       ├── AdminUserSeeder.php                    # Default admin account
│       ├── SkillSeeder.php                        # Canonical skill library
│       ├── JobSeeder.php                          # Sample job postings
│       ├── ScrapingSourceSeeder.php               # 4 default sources (Wuzzuf, Remotive, Adzuna, LinkedIn)
│       └── TargetJobRoleSeeder.php                # Initial target roles for market scraping
├── routes/
│   ├── api.php                                    # 40+ API routes (public + auth + admin)
│   └── console.php                                # Scheduled tasks (cron)
├── config/
│   ├── services.php                               # ai_engine, ai_orchestrator, ai_cv_analyzer
│   ├── cors.php                                   # CORS: FRONTEND_URL + credentials
│   └── sanctum.php                                # Sanctum configuration
└── TESTING.md                                     # API testing guide
```

### Models & Eloquent Relationships (11 Models)

| Model | Table | Key Relationships & Features |
|-------|-------|------------------------------|
| `User` | `users` | HasOne `UserProfile`, HasMany `UserExperience`, BelongsToMany `Skill` (pivot: `confidence_score`, `evidence`), HasOne `CvAnalysis`. Auto-creates profile via `booted()` lifecycle hook. Backward-compat accessors (`job_title`, `phone`, `location`, `linkedin_url`, `github_url`) proxy to `UserProfile.contact_info` JSON. |
| `UserProfile` | `user_profiles` | BelongsTo `User`. Stores `headline`, `summary`, `location`, `total_experience_years`, `seniority`, `primary_domain`, `contact_info` (JSON). |
| `UserExperience` | `user_experiences` | BelongsTo `User`. Stores `title`, `company`, `location`, `start_date`, `end_date`, `is_current`, `description`. |
| `CvAnalysis` | `cv_analyses` | BelongsTo `User`. Stores `parsing_status`, `completeness_score`, `strengths`, `gaps`, `red_flags`, `raw_json_output`. |
| `Skill` | `skills` | BelongsToMany `User`, BelongsToMany `Job`. Stores `name`, `type` (technical/soft). |
| `Job` | `job_postings` | BelongsToMany `Skill` (pivot: `importance_score`, `importance_category`). Stores `title`, `company`, `description`, `location`, `salary_range`, `job_type`, `experience`, `url`, `source`. |
| `JobRoleStatistic` | `job_role_statistics` | Aggregated market data per role: `top_skills`, `average_experience`, `common_locations`, `salary_range`. |
| `ScrapingJob` | `scraping_jobs` | Queue job tracking: `status` lifecycle (`pending` → `processing` → `completed`/`failed`), `job_title`, `type`, `error_message`. |
| `ScrapingSource` | `scraping_sources` | Configurable scraping endpoints: `name`, `endpoint`, `type` (api/html), `status` (active/inactive), `headers`, `params` (JSON). |
| `Application` | `applications` | BelongsTo `User`. Job application tracker: full CRUD lifecycle. |
| `TargetJobRole` | `target_job_roles` | Self-expanding role registry: `name`, `is_active`. Auto-created when CV analysis detects a new domain. |

### API Resources (7 Resources)

| Resource | Purpose |
|----------|---------|
| `UserResource` | Flattened user + profile + experiences + skills (with pivot) + cv_analysis |
| `SkillResource` | Skill with `confidence_score` and `evidence` from pivot |
| `CvAnalysisResource` | `completeness_score`, `strengths`, `gaps`, `red_flags` |
| `GapAnalysisResource` | Full gap analysis response: match%, matched/missing skills, recommendations |
| `JobResource` | Job posting with skills and metadata |
| `ScrapingSourceResource` | Scraping source configuration |
| `UserExperienceResource` | Work history entry |

---

## 🏗️ Microservices Routing & .env Configuration

The Laravel backend communicates with **Python AI microservices** via HTTP. The actual endpoints consumed by the code are:

| Variable | Default | Service | Consumed Endpoints |
| -------- | ------- | ------- | ------------------ |
| `CV_AI_SERVICE_URL` | `http://127.0.0.1:8001/api/parse-cv` | ai-hybrid-orchestrator | `POST /api/parse-cv` — CV upload & parsing |
| `AI_ORCHESTRATOR_URL` | `http://127.0.0.1:8001` | ai-hybrid-orchestrator | `POST /api/hybrid-match` — Layer 3 gap analysis matching |
| `AI_ENGINE_URL` | `http://127.0.0.1:8001` | ai-hybrid-orchestrator | `POST /scrape-jobs` — Background market scraping |
| `AI_CV_ANALYZER_TIMEOUT` | `120` | — | Request timeout (seconds) |

> **Note**: The legacy `/api/v1/` and `/api/v2/` prefixes were removed during the architecture consolidation. All endpoints now use unified paths without version prefixes.

**`config/services.php`** defines three service config blocks:
```php
'ai_engine'       => ['url' => env('AI_ENGINE_URL', 'http://127.0.0.1:8001'), 'timeout' => 120],
'ai_orchestrator' => ['url' => env('AI_ORCHESTRATOR_URL', 'http://127.0.0.1:8001'), 'timeout' => 120],
'ai_cv_analyzer'  => ['url' => env('AI_CV_ANALYZER_URL', 'http://127.0.0.1:8002'), 'timeout' => 120],
```

**Example `.env`:**
```env
CV_AI_SERVICE_URL=http://127.0.0.1:8001/api/parse-cv
AI_ORCHESTRATOR_URL=http://127.0.0.1:8001
AI_ENGINE_URL=http://127.0.0.1:8001
AI_CV_ANALYZER_URL=http://127.0.0.1:8002
AI_CV_ANALYZER_TIMEOUT=120
FRONTEND_URL=http://localhost:5173
```

> **Critical**: `start_all.bat` launches both ai-cv-analyzer (8002) and ai-hybrid-orchestrator (8001). Gap analysis uses the orchestrator for Layer 3 hybrid matching; CV upload uses the orchestrator's `/api/parse-cv`.

---

## 🗄️ Database Refactoring (Normalization)

### Schema Separation: Users vs Profile

| Table | Purpose |
| ----- | ------- |
| **users** | Authentication only: `id`, `name`, `email`, `password`, `role`, `is_banned`, timestamps. **No** job_title, phone, location — migrated to `user_profiles`. |
| **user_profiles** | CV-derived data: `headline`, `summary`, `location`, `total_experience_years`, `seniority`, `primary_domain`, `contact_info` (JSON). One-to-one with `users`. |

### New Tables

| Table | Purpose |
| ----- | ------- |
| **user_experiences** | Work history: `title`, `company`, `location`, `start_date`, `end_date`, `is_current`, `description`. Populated from V3 CV parse. |
| **cv_analyses** | Per-user CV analysis cache: `parsing_status`, `completeness_score`, `strengths`, `gaps`, `red_flags`, `raw_json_output`. |

### Enriched user_skills Pivot

| Column | Purpose |
| ------ | ------- |
| `confidence_score` | AI confidence (0–1) for the skill extraction |
| `evidence` | Snippet or source indicating where the skill was found |

Skills are returned by **UserResource** with pivot data; **SkillResource** exposes `confidence_score` and `evidence`.

---

## 📤 API Resources — Flattened Rich JSON

**UserResource** returns a flattened, rich structure suitable for the V3 React UI:

```json
{
  "id": 1,
  "name": "Ahmed Khames",
  "email": "ahmed@example.com",
  "role": "user",
  "job_title": "Backend Developer",
  "headline": "Backend Developer",
  "summary": "5+ years...",
  "location": "Cairo, Egypt",
  "total_experience_years": 5.5,
  "seniority": "senior",
  "primary_domain": "Backend Development",
  "phone": "+20 101 234 5678",
  "linkedin_url": "https://linkedin.com/in/...",
  "github_url": "https://github.com/...",
  "profile": { ... },
  "experiences": [ { "title", "company", "start_date", "end_date", "description", ... } ],
  "skills": [
    { "id": 1, "name": "Laravel", "type": "technical", "confidence_score": 0.85, "evidence": "..." }
  ],
  "cv_analysis": { "completeness_score", "strengths", "gaps", "red_flags" }
}
```

---

## 🔐 Security & Validation

### Authentication & Authorization

| Mechanism | Implementation | Details |
|-----------|---------------|---------|
| **API Token Auth** | Laravel Sanctum | `HasApiTokens` trait on `User` model. Token issued at login/register. |
| **Single Session** | Token revocation | Login revokes **all** existing tokens before issuing a new one — enforces single active session. |
| **RBAC** | `IsAdmin` middleware | Checks `auth('sanctum')->check()` AND `$request->user()->role !== 'admin'`. Returns `403 Forbidden: Admins only.` |
| **Ban System** | `User.is_banned` | Checked at login — banned users receive `403` with "Your account has been banned." |
| **Route Guards** | `guest:sanctum` | Registration and login only accessible to unauthenticated users. |

### Input Validation Rules

| Endpoint | Field | Rule | Notes |
|----------|-------|------|-------|
| `POST /register` | `email` | `email:rfc,dns` + regex whitelist | **Only** Gmail, Yahoo, Outlook, Hotmail, iCloud domains accepted |
| `POST /register` | `password` | `min:8` + regex | Must contain ≥1 uppercase letter + ≥1 digit. Allowed specials: `@ & _ -` |
| `POST /upload-cv` | `cv` | `file`, `mimes:pdf,jpeg,jpg,png`, `max:5120` | 5 MB limit. Validated via `CvUploadRequest` Form Request. |
| `POST /admin/scraping-sources` | `endpoint` | `required`, `url`, `max:512` | Validated via `StoreScrapingSourceRequest`. |
| `POST /admin/scraping-sources` | `type` | `in:api,html` | Only two source types allowed. |

### CORS Configuration (`config/cors.php`)

```php
'paths'                => ['api/*', 'sanctum/csrf-cookie'],
'allowed_origins'      => [env('FRONTEND_URL', 'http://localhost:5173'), 'http://127.0.0.1:5173'],
'allowed_methods'      => ['*'],
'allowed_headers'      => ['*'],
'supports_credentials' => true,
```

> Set `FRONTEND_URL` in `.env` to match your React dev server URL.

---

## ⚙️ Background Jobs & Queue System

### `ProcessMarketScraping` — Scheduled Market Intelligence

| Property | Value |
|----------|-------|
| **Queue** | Default |
| **Timeout** | 600 seconds (10 min) |
| **Retries** | 2 |
| **Backoff** | 5 seconds |
| **Trigger** | Scheduled cron (every 48h) OR manual via `POST /admin/scraping/run-full` |

**Pipeline**: Loops through active `TargetJobRole` entries → calls AI Engine `POST /scrape-jobs` with dynamic scraping sources → stores jobs with duplicate detection → calculates skill importance (Essential >70%, Important ≥40%, Nice-to-have <40%) → updates `JobRoleStatistic`.

### `ProcessOnDemandJobScraping` — User-Triggered Scraping

| Property | Value |
|----------|-------|
| **Queue** | `high` (priority) |
| **Timeout** | 180 seconds (3 min) |
| **Retries** | 2 |
| **Backoff** | 5 seconds |
| **Trigger** | Dispatched by `CvProcessingService.discoverNewRole()` when a new domain is detected |

**Features**: URL normalization (strips tracking parameters like `utm_source`), race-condition protection via `QueryException` duplicate-entry catch (MySQL error code 23000).

### Self-Expanding Role Discovery

When a user uploads a CV and the V3 AI detects a new `primary_domain` that doesn't exist in `target_job_roles`:
1. `CvProcessingService.discoverNewRole()` creates a new `TargetJobRole` entry.
2. A `ScrapingJob` record is created with `type: on_demand`.
3. `ProcessOnDemandJobScraping` is dispatched to the `high` priority queue.
4. The background job scrapes relevant positions and populates the job database.

---

## 🕐 Scheduled Tasks

Defined in `routes/console.php`:

| Task | Schedule | Command/Job | Notes |
|------|----------|-------------|-------|
| **Market Scraping** | Every 48h at 02:00 AM | `ProcessMarketScraping` job | `withoutOverlapping` to prevent concurrent runs |
| **Skill Importance** | Daily at 04:00 AM | `skills:calculate-importance --all` | Recalculates importance scores for all job titles |

### Running the Scheduler

```bash
# Development (foreground daemon):
php artisan schedule:work

# Production (add to crontab):
* * * * * cd /path-to-your-project && php artisan schedule:run >> /dev/null 2>&1
```

---

## 🚀 Getting Started

### Prerequisites

- PHP 8.1+ (pdo, pdo_mysql, mbstring, xml, curl, zip)
- Composer 2.x
- MySQL 8.x
- **AI microservices**: ai-cv-analyzer (8002) and ai-hybrid-orchestrator (8001) for full functionality

### Installation

```bash
cd backend-api
composer install
cp .env.example .env
php artisan key:generate
```

**Configure `.env`:**
```env
DB_DATABASE=career_compass
DB_USERNAME=root
DB_PASSWORD=your_password
CV_AI_SERVICE_URL=http://127.0.0.1:8001/api/parse-cv
AI_ORCHESTRATOR_URL=http://127.0.0.1:8001
AI_ENGINE_URL=http://127.0.0.1:8001
FRONTEND_URL=http://localhost:5173
```

```bash
# Run all migrations
php artisan migrate

# Seed all tables (runs DatabaseSeeder which calls all child seeders)
php artisan db:seed
```

**Individual seeders (if needed):**

| Seeder | Command | Purpose |
|--------|---------|---------|
| `AdminUserSeeder` | `php artisan db:seed --class=AdminUserSeeder` | Default admin account |
| `SkillSeeder` | `php artisan db:seed --class=SkillSeeder` | Canonical skill library |
| `JobSeeder` | `php artisan db:seed --class=JobSeeder` | Sample job postings |
| `ScrapingSourceSeeder` | `php artisan db:seed --class=ScrapingSourceSeeder` | 4 default sources (Wuzzuf, Remotive, Adzuna, LinkedIn) |
| `TargetJobRoleSeeder` | `php artisan db:seed --class=TargetJobRoleSeeder` | Initial target roles |

### Run Server

```bash
php artisan serve --port=8000
```

---

## 🔌 API Endpoints

### Public Routes (No Auth)

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/api/health` | Health check (`status: ok`) |
| POST | `/api/register` | Create account (strict email + password validation) |
| POST | `/api/login` | Login (returns Sanctum token + UserResource) |
| GET | `/api/jobs` | Browse all job postings (paginated) |
| GET | `/api/jobs/{id}` | View single job posting |

### Authenticated User Routes (`auth:sanctum`)

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/api/user` | Current user (full UserResource with profile, skills, experiences, cv_analysis) |
| PUT | `/api/user/profile` | Update profile (name, email, phone, job_title, location, linkedin, github, skills) |
| POST | `/api/logout` | Logout (revoke all tokens) |
| POST | `/api/upload-cv` | Upload CV → V3 AI parse → persist profile/skills/experiences |
| GET | `/api/user/skills` | User skills with confidence_score & evidence |
| DELETE | `/api/user/skills/{skillId}` | Remove a skill from user |
| GET | `/api/user/cv-analysis` | Latest CV analysis (completeness, strengths, gaps, red flags) |
| GET | `/api/jobs/recommended` | AI-matched recommended jobs |
| POST | `/api/jobs/scrape` | Trigger job scraping for a title |
| POST | `/api/jobs/scrape-if-missing` | Scrape only if job title has no existing results |
| GET | `/api/scraping-status/{jobId}` | Check background scraping job status |
| GET | `/api/gap-analysis/job/{jobId}` | Single-job gap analysis (Layer 3 semantic matching) |
| POST | `/api/gap-analysis/batch` | Batch gap analysis for multiple jobs |
| GET | `/api/gap-analysis/recommendations` | Global market recommendations (aggregate analysis) |
| GET | `/api/market/overview` | Market intelligence overview |
| GET | `/api/market/role-statistics/{roleTitle}` | Statistics for a specific role |
| GET | `/api/market/trending-skills` | Trending skills across all roles |
| GET | `/api/market/skill-demand/{roleTitle}` | Skill demand breakdown per role |
| * | `/api/applications` | Application tracker — full `apiResource` (index, store, show, update, destroy) |

### Admin Routes (`auth:sanctum` + `admin` middleware)

All admin routes are prefixed with `/api/admin/`.

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/api/admin/dashboard/stats` | Platform statistics |
| GET | `/api/admin/dashboard/health` | System health check |
| GET | `/api/admin/jobs` | List all jobs (admin view) |
| GET | `/api/admin/jobs/{id}` | View job details |
| DELETE | `/api/admin/jobs/{id}` | Delete a job posting |
| GET | `/api/admin/users` | List all users |
| GET | `/api/admin/users/{id}` | View user details |
| POST | `/api/admin/users/{id}/toggle-ban` | Ban/unban a user |
| * | `/api/admin/scraping-sources` | Full `apiResource` CRUD for scraping sources |
| PATCH | `/api/admin/scraping-sources/{id}/toggle` | Toggle source active/inactive |
| POST | `/api/admin/scraping-sources/test` | Test a scraping source |
| GET | `/api/admin/target-roles` | List target job roles |
| POST | `/api/admin/target-roles` | Create target role |
| PATCH | `/api/admin/target-roles/{id}/toggle` | Toggle role active/inactive |
| DELETE | `/api/admin/target-roles/{id}` | Delete target role |
| POST | `/api/admin/scraping/run-full` | Execute full market scraping immediately |

See [TESTING.md](TESTING.md) for detailed request/response examples.

---

## 🧪 Testing

```bash
curl http://127.0.0.1:8000/api/health
```

Import `CareerCompass.postman_collection.json` for comprehensive API testing.

---

## 📚 Additional Documentation

- [TESTING.md](TESTING.md) — API testing guide
- [Laravel 12 Docs](https://laravel.com/docs/12.x)

---

**Last Updated**: April 2026  
**Version**: 1.5.0  
**Status**: ✅ V3 AI Pipeline + Database Normalization + Zero PDF Re-parsing + Admin Panel + Background Jobs + Scheduled Tasks
