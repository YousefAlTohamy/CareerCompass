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
- **Microservices Routing** — Configurable AI_CV_ANALYZER_URL (8002) and AI_GATEWAY_URL (8001)
- **Strict RBAC** — `/user/*` vs `/admin/*` via IsAdmin middleware

---

## 🏗️ Microservices Routing & .env Configuration

The Laravel backend communicates with **two Python AI microservices**. Both must be correctly configured in `.env`:

| Variable | Default | Port | Service | Purpose |
| -------- | ------- | ---- | ------- | ------- |
| `AI_CV_ANALYZER_URL` | `http://127.0.0.1:8002` | 8002 | ai-cv-analyzer | `/api/v2/analyze-cv`, `/api/v2/match-job` — V3 pipeline, Layer 3 matching |
| `AI_CV_ANALYZER_TIMEOUT` | 120 | - | - | Request timeout (seconds) |
| `AI_GATEWAY_URL` / `AI_ORCHESTRATOR_URL` | `http://127.0.0.1:8001` | 8001 | ai-hybrid-orchestrator | `/api/v1/parse-cv`, `/api/v1/scrape-on-demand`, `/api/v1/hybrid-match` |

**Example `.env`:**
```env
AI_CV_ANALYZER_URL=http://127.0.0.1:8002
AI_CV_ANALYZER_TIMEOUT=120
AI_GATEWAY_URL=http://127.0.0.1:8001
AI_GATEWAY_TIMEOUT=30
```

> **Critical**: `start_all.bat` launches both ai-cv-analyzer (8002) and ai-hybrid-orchestrator (8001). Gap analysis uses ai-cv-analyzer for Layer 3 matching; CV upload and scraping use the orchestrator.

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

## 🏗️ Architecture

```
backend-api/
├── app/
│   ├── Http/
│   │   ├── Controllers/Api/
│   │   ├── Middleware/IsAdmin.php
│   │   ├── Requests/
│   │   └── Resources/        # UserResource, SkillResource, CvAnalysisResource, etc.
│   ├── Models/
│   ├── Services/
│   │   ├── CvProcessingService.php   # CV upload → AI Gateway, persist profile/experiences/skills
│   │   └── GapAnalysisService.php    # Zero PDF Re-parsing: build payload from DB, call Layer 3
│   ├── Jobs/
│   └── ...
├── database/migrations/
├── routes/api.php
└── config/services.php       # ai_cv_analyzer, ai_gateway config
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
AI_CV_ANALYZER_URL=http://127.0.0.1:8002
AI_GATEWAY_URL=http://127.0.0.1:8001
FRONTEND_URL=http://localhost:5173
```

```bash
php artisan migrate
php artisan db:seed --class=SkillSeeder
php artisan db:seed --class=AdminUserSeeder
```

### Run Server

```bash
php artisan serve --port=8000
```

---

## 🔌 API Endpoints (Summary)

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/api/health` | ❌ | Health check |
| POST | `/api/register` | ❌ | Create account |
| POST | `/api/login` | ❌ | Login |
| GET | `/api/user` | ✅ | Current user (UserResource) |
| POST | `/api/upload-cv` | ✅ | Upload CV → V3 parse → persist profile/skills/experiences |
| GET | `/api/user/skills` | ✅ | Skills with confidence_score, evidence |
| GET | `/api/gap-analysis/job/{id}` | ✅ | Zero PDF Re-parsing gap analysis |
| GET | `/api/jobs/recommended` | ✅ | AI-matched jobs |
| GET/POST | `/api/applications` | ✅ | Application tracker |

See [TESTING.md](TESTING.md) for full endpoint list.

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

**Last Updated**: March 2026  
**Version**: 1.4.0  
**Status**: ✅ V3 AI Pipeline + Database Normalization + Zero PDF Re-parsing
