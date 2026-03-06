# CareerCompass Backend API 🚀

> **Laravel 12 REST API** for user authentication, CV analysis, and job management

## 📋 Overview

The Backend API is a Laravel 12-based RESTful service that handles user authentication, CV upload and skill extraction (via AI Engine), job management, and skill gap analysis. It uses Laravel Sanctum for API token authentication and communicates with the Python AI Engine microservice.

---

## ✨ Features

- **User Authentication** - Registration, login, logout with Sanctum tokens
- **CV Upload & Analysis** - Upload PDFs and extract skills via AI Engine
- **Skill Management** - Dynamic NLP skill extraction and on-the-fly creation
- **Job Management & Recommendations** - Browse, view, trigger multi-source job scraping, and request AI-powered customized matches.
- **Application Tracker** - Full CRUD API managing the application lifecycle pipe.
- **Queue Workers** - Background processing for on-demand & scheduled scraping
- **Scheduled Tasks** - Automated market data updates every 48 hours
- **Gap Analysis** - Calculate skill gaps with market-driven priority categorization
- **Market Intelligence** - Market demand, trending skills, and role statistics
- **Admin Dashboard APIs** - Manage Scraping Sources and Target Job Roles dynamically
- **Strict Role-Based Validation (RBAC)** - Segregates `/user/*` endpoints from `/admin/*` via Middleware rules.
- **RESTful API** - 40+ fully documented endpoints
- **MySQL Database** - Complex relational schema with built-in migrations
- **CORS Enabled** - Ready for frontend integration

---

## 🏗️ Architecture

```
backend-api/
├── app/
│   ├── Http/
│   │   ├── Controllers/Api/
│   │   │   ├── Admin/
│   │   │   │   ├── ScrapingSourceController.php # Admin dashboard config controller
│   │   │   │   └── TargetJobRoleController.php  # Admin scheduled target config
│   │   │   ├── ApplicationController.php        # Track user's applied jobs
│   │   │   ├── AuthController.php               # Login, Register, Logout
│   │   │   ├── CvController.php                 # PDF Analysis
│   │   │   ├── GapAnalysisController.php        # Job matcher
│   │   │   ├── JobController.php                # Fetchings and Triggers
│   │   │   ├── MarketIntelligenceController.php # Aggregations
│   │   │   └── ScrapingSourceController.php     # Public sources config read
│   │   ├── Middleware/
│   │   │   └── IsAdmin.php                      # RBAC Enum verifications
│   │   ├── Requests/                            # Validation requests
│   │   │   ├── CvUploadRequest.php
│   │   │   └── StoreScrapingSourceRequest.php
│   │   └── Resources/                           # API mapping responses
│   │       └── ScrapingSourceResource.php
│   ├── Models/
│   │   ├── Application.php                      # Application Tracker model
│   │   ├── Job.php                              # Core Job posting
│   │   ├── JobRoleStatistic.php                 # Aggregate caching
│   │   ├── ScrapingJob.php                      # Running scraper task states
│   │   ├── ScrapingSource.php                   # Scraper definitions
│   │   ├── Skill.php                            # Individual capabilities
│   │   ├── TargetJobRole.php                    # Base roles for generic fetching
│   │   └── User.php                             # Authenticated account with string enum Role
│   ├── Jobs/
│   │   ├── ProcessMarketScraping.php            # Automated scheduled execution
│   │   └── ProcessOnDemandJobScraping.php       # Live synchronous fetching via ID
├── database/
│   ├── migrations/                         # Database schema records
│   └── seeders/
│       ├── AdminUserSeeder.php             # Bootstraps initial 'admin' permissions
│       ├── ScrapingSourceSeeder.php        # Sets up default scraping scripts
│       ├── SkillSeeder.php                 # Initial 84 technical skills
│       └── TargetJobRoleSeeder.php         # Sets up broad targets
├── routes/
│   ├── api.php                             # Unified REST routes
│   └── console.php                         # Scheduled Cron executions
├── config/
│   └── cors.php                            # CORS configuration
├── .env.example                            # Environment template
└── TESTING.md                              # API testing guide
```

---

## 🚀 Getting Started

### Prerequisites

- **PHP** 8.1+ with extensions: `pdo`, `pdo_mysql`, `mbstring`, `xml`, `curl`, `zip`
- **Composer** 2.x - [Download](https://getcomposer.org/)
- **MySQL** 8.x - [Download](https://dev.mysql.com/downloads/installer/)
- **AI Engine** - Must be running on port 8001

### Installation

#### 1️⃣ Navigate to Backend Directory

```bash
cd backend-api
```

#### 2️⃣ Install Dependencies

```bash
# Install PHP packages via Composer
composer install
```

This installs:

- Laravel 12 framework
- Laravel Sanctum (API authentication)
- Guzzle HTTP client (for AI Engine communication)
- All other dependencies

#### 3️⃣ Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Generate application key
php artisan key:generate
```

**Edit `.env` file** with your configuration:

```env
# Application
APP_NAME=CareerCompass
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000

# Database Configuration
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=career_compass
DB_USERNAME=root
DB_PASSWORD=your_mysql_password

# AI Engine Configuration
AI_ENGINE_URL=http://127.0.0.1:8001
AI_ENGINE_TIMEOUT=30

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

#### 4️⃣ Create Database

Create a MySQL database for the application:

```sql
CREATE DATABASE career_compass CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Or use a MySQL client like phpMyAdmin, MySQL Workbench, etc.

#### 5️⃣ Run Migrations & Seeders

```bash
# Run all migrations (creates tables)
php artisan migrate

# Seed the database with 84 predefined skills
php artisan db:seed --class=SkillSeeder

# Or do both at once with fresh database
php artisan migrate:fresh --seed
```

**Database Tables Created:**

- `users` - User accounts (Including Enum 'Role': admin or user)
- `skills` - Technical & soft skills (Dynamically expanded via AI Engine NLP)
- `jobs` - Job listings (from multi-source hybrid scraping)
- `scraping_sources` - Configurable multi-source integrations (Wuzzuf, Adzuna, Remotive)
- `target_job_roles` - Roles targeted dynamically by the scheduled market scraper
- `scraping_jobs` - Status tracker for background queued scrapers
- `job_role_statistics` - Pre-calculated market intelligence caching
- `applications` - Tracks the job lifecycle inside user funnels (Saved -> Applied -> Offer -> Rejected)
- `user_skills` - User-skill relationships
- `job_skills` - Job-skill relationships (with importance_score)
- `personal_access_tokens` - Sanctum authentication tokens
- `jobs` (queue) & `failed_jobs` - Laravel queue worker tables

---

## ▶️ Running the Server

### Start the Laravel Development Server

```bash
# From the backend-api directory
php artisan serve --port=8000
```

**Output:**

```
INFO  Server running on [http://127.0.0.1:8000].

Press Ctrl+C to stop the server
```

### Verify Server is Running

```bash
curl http://127.0.0.1:8000/api/health
```

**Expected Response:**

```json
{
    "status": "ok",
    "service": "CareerCompass API",
    "version": "1.0.0"
}
```

---

## 🔌 API Endpoints

### Authentication (Public)

#### 1. Register New User

**POST** `/api/register`

Create a new user account.

**Request Body:**

```json
{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "password_confirmation": "password123"
}
```

**Response (201 Created):**

```json
{
    "user": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "created_at": "2026-02-16T00:00:00.000000Z",
        "updated_at": "2026-02-16T00:00:00.000000Z"
    },
    "token": "1|abcdefghijklmnopqrstuvwxyz..."
}
```

---

#### 2. Login

**POST** `/api/login`

Authenticate and receive API token.

**Request Body:**

```json
{
    "email": "john@example.com",
    "password": "password123"
}
```

**Response (200 OK):**

```json
{
    "user": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com"
    },
    "token": "2|zyxwvutsrqponmlkjihgfedcba..."
}
```

**Error Response (401 Unauthorized):**

```json
{
    "message": "Invalid credentials"
}
```

---

### User Management (Protected)

> **Note:** All protected endpoints require the `Authorization: Bearer {token}` header

#### 3. Get Current User

**GET** `/api/user`

Get authenticated user information.

**Headers:**

```
Authorization: Bearer {your_token}
```

**Response (200 OK):**

```json
{
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "email_verified_at": null,
    "created_at": "2026-02-16T00:00:00.000000Z",
    "updated_at": "2026-02-16T00:00:00.000000Z"
}
```

---

#### 4. Logout

**POST** `/api/logout`

Revoke all user tokens.

**Headers:**

```
Authorization: Bearer {your_token}
```

**Response (200 OK):**

```json
{
    "message": "Logged out successfully"
}
```

---

### CV & Skill Management (Protected)

#### 5. Upload CV

**POST** `/api/upload-cv`

Upload a CV (PDF or image) and extract skills, domain classification, and contact info via the **AI Gateway** (Phase 6).

**Headers:**

```
Authorization: Bearer {your_token}
Content-Type: multipart/form-data
```

**Request Body (Form Data):**

- `cv` (file, required) — PDF · JPEG · JPG · PNG (max 5MB)

**Response (200 OK):**

```json
{
    "success": true,
    "message": "CV parsed successfully.",
    "is_new_role": false,
    "user": {
        "id": 1,
        "name": "Ahmed Khames",
        "email": "ahmed@example.com",
        "job_title": "Backend Development",
        "domain_confidence": "72.3%",
        "phone": "+20 101 234 5678",
        "location": "Cairo, Egypt",
        "linkedin_url": "https://linkedin.com/in/ahmedkhames",
        "github_url": "https://github.com/ahmedkhames",
        "extraction_method": "pymupdf"
    },
    "skills": [
        { "id": 1, "name": "Laravel", "type": "technical" },
        { "id": 15, "name": "Communication", "type": "soft" }
    ]
}
```

> `is_new_role: true` means the AI discovered a new domain not in `target_job_roles` — background scraping was dispatched automatically.

---

#### 6. Get User Skills

**GET** `/api/user/skills`

Get all skills associated with the authenticated user.

**Headers:**

```
Authorization: Bearer {your_token}
```

**Response (200 OK):**

```json
{
    "data": [
        {
            "id": 1,
            "name": "Laravel",
            "type": "technical"
        },
        {
            "id": 2,
            "name": "PHP",
            "type": "technical"
        }
    ],
    "total": 2
}
```

---

#### 7. Remove Skill

**DELETE** `/api/user/skills/{skillId}`

Remove a skill from the user's profile.

**Headers:**

```
Authorization: Bearer {your_token}
```

**Response (200 OK):**

```json
{
    "message": "Skill removed successfully"
}
```

---

### Job Management

#### 8. Browse Jobs (Public)

**GET** `/api/jobs`

Get paginated list of all jobs.

**Query Parameters:**

- `page` (integer, optional) - Page number (default: 1)
- `per_page` (integer, optional) - Items per page (default: 15, max: 100)

**Example:**

```bash
curl "http://127.0.0.1:8000/api/jobs?page=1&per_page=10"
```

**Response (200 OK):**

```json
{
    "data": [
        {
            "id": 1,
            "title": "Senior Laravel Developer",
            "company": "Tech Corp",
            "description": "We are looking for...",
            "url": "https://wuzzuf.net/jobs/...",
            "source": "wuzzuf",
            "skills": [
                { "id": 1, "name": "Laravel", "type": "technical" },
                { "id": 2, "name": "PHP", "type": "technical" }
            ],
            "created_at": "2026-02-15T12:00:00.000000Z"
        }
    ],
    "current_page": 1,
    "total": 50,
    "per_page": 10,
    "last_page": 5
}
```

---

#### 9. Get Single Job (Public)

**GET** `/api/jobs/{id}`

Get detailed information about a specific job.

**Response (200 OK):**

```json
{
    "data": {
        "id": 1,
        "title": "Senior Laravel Developer",
        "company": "Tech Corp",
        "description": "Full job description...",
        "url": "https://wuzzuf.net/jobs/...",
        "source": "wuzzuf",
        "skills": [
            { "id": 1, "name": "Laravel", "type": "technical" },
            { "id": 2, "name": "PHP", "type": "technical" }
        ],
        "created_at": "2026-02-15T12:00:00.000000Z"
    }
}
```

---

#### 10. Scrape Jobs (Protected)

**POST** `/api/jobs/scrape`

Trigger job scraping from Wuzzuf.

**Headers:**

```
Authorization: Bearer {your_token}
Content-Type: application/json
```

**Request Body:**

```json
{
    "query": "Laravel Developer",
    "max_results": 20,
    "use_samples": false
}
```

**Response (201 Created):**

```json
{
    "message": "Jobs scraped successfully",
    "total_scraped": 18,
    "new_jobs": 15,
    "duplicate_jobs": 3,
    "source": "wuzzuf"
}
```

---

#### 11. On-Demand Scraping (Protected)

**POST** `/api/jobs/scrape-if-missing`

Check if a job title exists in the database. If not, trigger scraping for it.

**Headers:**

```
Authorization: Bearer {your_token}
Content-Type: application/json
```

**Request Body:**

```json
{
    "title": "React Native Developer",
    "location": "Cairo"  # Optional
}
```

**Response (200 OK - Job Exists):**

```json
{
    "message": "Jobs found in database",
    "count": 5,
    "status": "completed"
}
```

**Response (202 Accepted - Scraping Started):**

```json
{
    "message": "Scraping started for React Native Developer",
    "job_id": "sc_123456789",
    "status": "processing"
}
```

---

#### 12. Recommended Jobs (Protected)

**GET** `/api/jobs/recommended`

Return a set of Jobs fetched exclusively based on matching the User-CV `job_title` fields tightly.

**Headers:**

```
Authorization: Bearer {your_token}
```

**Response (200 OK):**

```json
{
    "success": true,
    "count": 10,
    "user_title": "Frontend Developer",
    "data": [{ "id": 1, "title": "Frontend React Dev..." }]
}
```

---

#### 13. Application Tracker (Protected)

**GET POST PUT DELETE** `/api/applications/...`

Creates or updates a user tracking pipeline for standard job applications. Includes enums matching statuses: `saved`, `applied`, `interviewing`, `offered`, `rejected`, `archived`.

**Headers:**

```
Authorization: Bearer {your_token}
```

---

#### 14. Check Scraping Status (Protected)

**GET** `/api/scraping-status/{jobId}`

Check the status of a background scraping job.

**Headers:**

```
Authorization: Bearer {your_token}
```

**Response (200 OK):**

```json
{
    "id": "sc_123456789",
    "status": "completed",
    "jobs_found": 12,
    "progress": 100
}
```

---

### Gap Analysis (Protected)

#### 13. Analyze Single Job

**GET** `/api/gap-analysis/job/{jobId}`

Analyze skill match between user and a specific job.

**Headers:**

```
Authorization: Bearer {your_token}
```

**Response (200 OK):**

```json
{
    "job_id": 1,
    "job_title": "Senior Laravel Developer",
    "company": "Tech Corp",
    "total_skills_required": 10,
    "user_has_skills": 7,
    "missing_skills": 3,
    "match_percentage": 70,
    "matching_skills": [
        { "id": 1, "name": "Laravel", "type": "technical" },
        { "id": 2, "name": "PHP", "type": "technical" }
    ],
    "missing_skills_details": [
        { "id": 15, "name": "Docker", "type": "technical" },
        { "id": 20, "name": "Kubernetes", "type": "technical" }
    ]
}
```

---

#### 14. Batch Analyze Jobs

**POST** `/api/gap-analysis/batch`

Analyze skill gaps for multiple jobs at once.

**Headers:**

```
Authorization: Bearer {your_token}
Content-Type: application/json
```

**Request Body:**

```json
{
    "job_ids": [1, 2, 3, 4, 5]
}
```

**Response (200 OK):**

```json
{
    "results": [
        {
            "job_id": 1,
            "job_title": "Senior Laravel Developer",
            "match_percentage": 70,
            "missing_skills_count": 3
        },
        {
            "job_id": 2,
            "job_title": "Full Stack Developer",
            "match_percentage": 85,
            "missing_skills_count": 2
        }
    ],
    "total_analyzed": 5
}
```

---

#### 15. Get Recommendations

**GET** `/api/gap-analysis/recommendations`

Get personalized skill learning recommendations based on job market.

**Headers:**

```
Authorization: Bearer {your_token}
```

**Query Parameters:**

- `limit` (integer, optional) - Number of recommendations (default: 5, max: 20)

**Response (200 OK):**

```json
{
    "user_skills_count": 12,
    "recommendations": [
        {
            "skill_id": 15,
            "skill_name": "Docker",
            "skill_type": "technical",
            "demand_score": 85,
            "jobs_requiring": 42,
            "reason": "Highly demanded in 42 job listings"
        },
        {
            "skill_id": 20,
            "skill_name": "React",
            "skill_type": "technical",
            "demand_score": 78,
            "jobs_requiring": 38,
            "reason": "Highly demanded in 38 job listings"
        }
    ],
    "total_recommendations": 5
}
```

---

### Market Intelligence (Protected)

#### 16. Market Overview

**GET** `/api/market/overview`

Get high-level market statistics including total jobs, top skills, and active roles.

**Headers:**

```
Authorization: Bearer {your_token}
```

**Response (200 OK):**

```json
{
    "total_jobs": 150,
    "total_skills": 84,
    "top_skills": [
        { "name": "Laravel", "count": 45 },
        { "name": "React", "count": 40 }
    ],
    "active_roles": 12
}
```

---

#### 17. Role Statistics

**GET** `/api/market/role-statistics/{roleTitle}`

Get statistics for a specific job role (e.g., "Full Stack Developer").

**Headers:**

```
Authorization: Bearer {your_token}
```

**Response (200 OK):**

```json
{
    "role": "Full Stack Developer",
    "job_count": 25,
    "avg_salary": "Confidential",
    "top_skills": ["PHP", "Laravel", "React", "MySQL"]
}
```

---

#### 18. Trending Skills

**GET** `/api/market/trending-skills`

Get a list of skills currently in high demand across all jobs.

**Headers:**

```
Authorization: Bearer {your_token}
```

**Response (200 OK):**

```json
{
    "data": [
        {
            "id": 1,
            "name": "Laravel",
            "type": "technical",
            "job_count": 45,
            "trend": "up"
        }
    ]
}
```

---

#### 19. Skill Demand by Role

**GET** `/api/market/skill-demand/{roleTitle}`

Get detailed skill demand breakdown for a specific role.

**Headers:**

```
Authorization: Bearer {your_token}
```

**Response (200 OK):**

```json
{
    "role": "Backend Developer",
    "skills": {
        "essential": ["PHP", "Laravel", "MySQL"],
        "important": ["Docker", "Git", "Redis"],
        "nice_to_have": ["AWS", "CI/CD"]
    }
}
```

---

#### 20. Health Check (Public)

**GET** `/api/health`

Check if the API is running.

**Response (200 OK):**

```json
{
    "status": "ok",
    "service": "CareerCompass API",
    "version": "1.0.0"
}
```

---

## 🗄️ Database Schema

### Users Table

- `id` - Primary key
- `name` - User's full name
- `email` - Unique email address
- `password` - Hashed password
- `role` - Access privilege enum: 'user', 'admin'
- `job_title` - Inferred job title string mapped from the CV
- `phone` - _(Phase 6)_ Extracted from CV by AI Gateway contact extractor
- `location` - _(Phase 6)_ Extracted from CV (keyword-anchored regex)
- `linkedin_url` - _(Phase 6)_ Extracted from CV
- `github_url` - _(Phase 6)_ Extracted from CV
- `timestamps` - created_at, updated_at

### Skills Table (Dynamic)

- `id` - Primary key
- `name` - Skill name (e.g., "Laravel", "Python")
- `type` - Enum: 'technical' or 'soft'
- `timestamps`

**Skill Sourcing:**

- **Predefined**: Seeded with 84 underlying technical/soft skills.
- **Dynamic NLP Extraction**: AI engine will extract unknown skills directly from job descriptions, and the Laravel queue worker creates them on-the-fly.

### Jobs Table

- `id` - Primary key
- `title` - Job title
- `company` - Company name
- `description` - Full job description
- `url` - Job posting URL
- `source` - Source platform
- `scraping_source_id` - Foreign key linking to the `scraping_sources` configuration
- `location`, `salary_range`, `job_type`, `experience` - Additional metadata
- `timestamps`

### Market Intelligence & Scraping Tables

- `scraping_sources`: Dynamic definitions for the Python API Fetchers and HTML Scrapers.
- `target_job_roles`: Dynamic roles used by the Laravel Scheduler every 48 hours for automated scraping.
- `scraping_jobs`: Polled tracking system for on-demand job scraping.
- `job_role_statistics`: Daily aggregations of trending skills.

### User Skills (Pivot Table)

- `user_id` - Foreign key to users
- `skill_id` - Foreign key to skills
- `timestamps` - When skill was added

### Job Skills (Pivot Table)

- `job_id` - Foreign key to jobs
- `skill_id` - Foreign key to skills
- `importance_score` - Float ranking skill demand
- `importance_category` - Enum ('essential', 'important', 'nice_to_have')

---

## 🧪 Testing

### Using the Testing Guide

Refer to [TESTING.md](TESTING.md) for comprehensive API testing instructions.

### Quick Test with curl

```bash
# Health check
curl http://127.0.0.1:8000/api/health

# Register user
curl -X POST http://127.0.0.1:8000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "password_confirmation": "password123"
  }'

# Login (save the token)
curl -X POST http://127.0.0.1:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Get current user (use token from login response)
curl http://127.0.0.1:8000/api/user \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Using Postman

Import the **CareerCompass.postman_collection.json** file (in project root) into Postman for ready-to-use API requests.

---

## 🔒 Security Features

- **SQL Injection Prevention**: Uses Laravel's Eloquent ORM and parameterized queries to prevent SQL injection attacks.
- **Role-Based Access Control (RBAC)**: Deep-level `IsAdmin` middlewares block out user-level authorization tokens mapping directly to administrative source APIs.
- **Race Condition Handling**: Implemented `withoutOverlapping()` for scheduled tasks and database transactions for critical operations.
- **Input Sanitization**: All user inputs are strictly validated through dedicated Laravel `App\Http\Requests\` FormRequests heavily relying on dynamic regex mapping and string constraints.
- **XSS Protection**: React automatically escapes frontend content, while Laravel's Backend guarantees no inner-HTML injections within string validations.
- **Secure Authentication**: Uses Laravel Sanctum for secure, token-based API authentication headers mapping globally.
- **Rate Limiting**: Critical endpoints dynamically rate limit to prevent heavy multi-threaded scrapping DoS strikes.

---

## 🛠️ Technical Details

### Authentication

Uses **Laravel Sanctum** for API token authentication:

- Tokens are stored in `personal_access_tokens` table
- Tokens are returned on registration and login
- Include token in `Authorization: Bearer {token}` header for protected routes
- Tokens can be revoked by logging out

### AI Engine Integration

The backend communicates with **one** Python microservice:

#### AI Gateway — Hybrid Orchestrator (Port 8001) _(Phase 6)_

Handles CV parsing with full ML pipeline, along with background job scraping. Configured via `.env`:

```env
AI_GATEWAY_URL=http://127.0.0.1:8001
AI_GATEWAY_TIMEOUT=30
```

| Endpoint                | Used by                       | Returns                                                                      |
| ----------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| `POST /api/v1/parse-cv` | `CvController::callGateway()` | `skills`, `domain`, `domain_confidence`, `contact_info`, `extraction_method` |

`CvController` flow on CV upload:

1. Sends raw file stream (via `fopen` to prevent cURL hangs) + filename to `POST /api/v1/parse-cv`
2. Persists `domain` → `job_title`, `phone`, `location`, `linkedin_url`, `github_url` to `users` table
3. Finds-or-creates skills; syncs to `user_skills` pivot
4. Runs **self-expanding role discovery** — if `domain` is not in `target_job_roles`, creates it and dispatches `ProcessOnDemandJobScraping` to the `high` queue

### CORS Configuration

CORS is enabled for all origins in development (`config/cors.php`):

- Allowed origins: `*` (configure for production)
- Allowed methods: All
- Supports credentials: Yes

### File Upload

CV upload validation (`CvUploadRequest.php`):

- Max file size: **5MB**
- Allowed types: **PDF · JPEG · JPG · PNG** _(OCR for image-based CVs added in Phase 6)_
- Stored temporarily during processing
- Auto-deleted after analysis

---

## 🐛 Troubleshooting

### Server Won't Start

```bash
# Clear all caches
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Regenerate autoloader
composer dump-autoload

# Try again
php artisan serve --port=8000
```

### Database Connection Error

**Check MySQL is running:**

```bash
mysql -u root -p
```

**Verify credentials in `.env`:**

```env
DB_DATABASE=career_compass
DB_USERNAME=root
DB_PASSWORD=your_password
```

**Reset database:**

```bash
php artisan migrate:fresh --seed
```

### AI Engine Connection Timeout

**Ensure AI Engine is running:**

```bash
# Check if AI Engine is accessible
curl http://127.0.0.1:8001/

# Start AI Engine if not running
cd ../ai-engine
venv\Scripts\activate
uvicorn main:app --reload --port 8001
```

**Update timeout in `.env`:**

```env
AI_ENGINE_TIMEOUT=60  # Increase to 60 seconds
```

### Token Authentication Failed

**Error:** `Unauthenticated`

**Solutions:**

1. Ensure token is in the header: `Authorization: Bearer {token}`
2. Token may have expired - login again to get a new token
3. Check if token is valid:
    ```bash
    # Should return user info
    curl http://127.0.0.1:8000/api/user \
      -H "Authorization: Bearer YOUR_TOKEN"
    ```

### Composer Install Errors

```bash
# Update Composer itself
composer self-update

# Clear Composer cache
composer clear-cache

# Install with verbose output
composer install -vvv
```

### Permission Errors (Linux/macOS)

```bash
# Set correct permissions
sudo chmod -R 775 storage bootstrap/cache
sudo chown -R $USER:www-data storage bootstrap/cache
```

### Port 8000 Already in Use

```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:8000 | xargs kill -9

# Or use a different port
php artisan serve --port=8080
```

---

## 🔧 Configuration

### Environment Variables

Key environment variables in `.env`:

```env
# Application
APP_NAME=CareerCompass
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=career_compass
DB_USERNAME=root
DB_PASSWORD=

# AI Engine Integration
AI_ENGINE_URL=http://127.0.0.1:8001
AI_ENGINE_TIMEOUT=30

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:5173

# Session & Cache
SESSION_DRIVER=database
CACHE_STORE=database
```

---

## 🚀 Production Deployment

### Security Checklist

1. **Update `.env` for production:**

    ```env
    APP_ENV=production
    APP_DEBUG=false
    ```

2. **Set strong APP_KEY:**

    ```bash
    php artisan key:generate
    ```

3. **Configure CORS** in `config/cors.php`:

    ```php
    'allowed_origins' => [
        'https://your-frontend-domain.com'
    ],
    ```

4. **Use HTTPS** for all endpoints

5. **Set up database backups**

6. **Enable rate limiting** in routes

### Performance Optimization

```bash
# Optimize for production
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Install production dependencies only
composer install --optimize-autoloader --no-dev
```

### Database Indexing

The migrations already include necessary indexes on:

- Foreign keys (user_id, skill_id, job_id)
- Email (users table - unique)

---

## 📚 Additional Documentation

- **API Testing Guide**: [TESTING.md](TESTING.md)
- **Laravel Documentation**: https://laravel.com/docs/12.x
- **Sanctum Documentation**: https://laravel.com/docs/12.x/sanctum

---

## 🔗 Phase 6 Integration — AI Gateway

> **Migration required:** `php artisan migrate --path=database/migrations/2026_03_06_000000_add_contact_info_to_users_table.php`

### What changed

| File                                                                        | Change                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `database/migrations/2026_03_06_000000_add_contact_info_to_users_table.php` | Adds 4 nullable columns to `users`: `phone`, `location`, `linkedin_url`, `github_url` |
| `app/Models/User.php`                                                       | Added the 4 new columns to `$fillable` for mass-assignment                            |
| `app/Http/Requests/CvUploadRequest.php`                                     | `mimes:pdf` → `mimes:pdf,jpeg,jpg,png` (supports image CVs via OCR)                   |

### How `CvController` will use the AI Gateway (Phase 7)

When a user uploads a CV, `CvController` will:

1. Forward the file to `POST http://127.0.0.1:8000/api/v1/parse-cv` (AI Gateway)
2. Receive `skills`, `domain`, `domain_confidence`, and `contact_info`
3. Persist contact info directly to the `users` table:
    ```php
    auth()->user()->update([
        'phone'        => $contact['phone'],
        'location'     => $contact['location'],
        'linkedin_url' => $contact['linkedin_url'],
        'github_url'   => $contact['github_url'],
    ]);
    ```
4. Sync extracted skills via `$user->skills()->syncWithoutDetaching(...)`

### AI Gateway `.env` variable to add

```env
AI_GATEWAY_URL=http://127.0.0.1:8000
AI_GATEWAY_TIMEOUT=60
```

---

## 📦 Dependencies

Main packages (from `composer.json`):

| Package           | Version | Purpose                 |
| ----------------- | ------- | ----------------------- |
| laravel/framework | ^12.0   | Core framework          |
| laravel/sanctum   | ^4.0    | API authentication      |
| guzzlehttp/guzzle | ^7.9    | HTTP client (AI Engine) |
| php               | ^8.2    | Runtime                 |

---

## 📄 License

This Backend API is part of the CareerCompass graduation project - MIT License

---

## 👥 Authors

CareerCompass Team - Graduation Project 2026

---

**Last Updated**: March 2026
**Version**: 1.3.0
**Status**: ✅ Phase 23 Complete (AI Gateway Integration — DB migration, validation & contact extraction support)
**API Endpoints**: 50+ total
