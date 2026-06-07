# Scraping API Contracts

This file records the implemented API surface for job mining and scraping. Examples use placeholders only.

## User/Auth Job Mining Endpoints

| Method | Path | Middleware | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/jobs/scrape` | `auth:sanctum` | Start an on-demand scrape for a query. |
| `POST` | `/api/v1/jobs/scrape-if-missing` | `auth:sanctum` | Return existing jobs if present; otherwise queue a scrape. |
| `GET` | `/api/v1/scraping-status/{jobId}` | `auth:sanctum` | Poll scraping lifecycle state and results. |

### Start On-Demand Scrape

```text
Authorization: Bearer <user-token>
Content-Type: application/json
```

```json
{
  "query": "Backend Developer",
  "max_results": 10
}
```

Expected response shape:

```json
{
  "success": true,
  "message": "Scraping job started.",
  "scraping_job_id": 42,
  "status": "pending"
}
```

### Scrape If Missing

```json
{
  "job_title": "Laravel Developer",
  "max_results": 10
}
```

If stored jobs already exist, the response returns `data_exists: true`. If not, it returns HTTP 202 with `scraping_job_id`, `status: pending`, and a polling URL.

### Poll Status

Completed status includes `jobs_found`, `jobs_stored`, `jobs_duplicated`, `discovered_count`, `failed_count`, `processing_time_ms`, `completed_at`, and matching stored jobs. Failed status includes `error_message`.

## Internal Scraper Callback Endpoints

| Method | Path | Middleware | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/jobs/import/check` | `scraper.token`, `throttle:scraper` | Check if a candidate job URL already exists. |
| `POST` | `/api/v1/jobs/import` | `scraper.token`, `throttle:scraper` | Validate, deduplicate, import/update a scraped job, and sync skills. |
| `POST` | `/api/v1/jobs/import/failed` | `scraper.token`, `throttle:scraper` | Store a failed source URL and error message. |
| `GET` | `/api/v1/proxies/active` | `scraper.token`, `throttle:scraper` | Return active proxy definitions to the scraper when enabled. |

Actual Laravel middleware accepts `Authorization: Bearer <internal-token>` for these callbacks. The Python `/scrape` endpoint accepts `X-Scraper-Service-Token: <internal-token>` from Laravel.

### Import Check

```json
{
  "url": "https://example.com/jobs/123"
}
```

```json
{
  "exists": false
}
```

### Import Job

```json
{
  "title": "Junior Backend Developer",
  "company": "Example Co",
  "location": "Remote",
  "description": "Build APIs with Laravel and MySQL.",
  "requirements": "Laravel, MySQL, REST APIs",
  "url": "https://example.com/jobs/123",
  "source": "remotive",
  "scraping_source_id": 5,
  "skills": ["Laravel", "MySQL", "REST APIs"],
  "work_type": "remote",
  "job_type": "full_time"
}
```

```json
{
  "success": true,
  "job_id": 101,
  "created": true
}
```

### Report Failure

```json
{
  "url": "https://example.com/jobs/broken",
  "scraping_source_id": 5,
  "scraping_job_id": 42,
  "error_message": "Timeout while fetching public job detail page."
}
```

```json
{
  "success": true
}
```

## Admin Scraping Endpoints

| Method | Path | Middleware | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/admin/dashboard/batch-progress` | `auth:sanctum`, admin | Read active/latest batch progress. |
| `GET` | `/api/v1/admin/dashboard/failed-urls/{scrapingJobId}` | `auth:sanctum`, admin | List failed URLs for a scraping job. |
| `POST` | `/api/v1/admin/dashboard/retry-failures` | `auth:sanctum`, admin | Mark selected failed URLs as retried. |
| `GET/POST/PATCH/DELETE` | `/api/v1/admin/scraping-sources` | `auth:sanctum`, admin | Manage source definitions. |
| `POST` | `/api/v1/admin/scraping-sources/test` | `auth:sanctum`, admin | Test active sources. |
| `POST` | `/api/v1/admin/scraping-sources/{id}/test` | `auth:sanctum`, admin | Test one source. |
| `POST` | `/api/v1/admin/scraping/run-full` | `auth:sanctum`, admin | Create a full target/source scraping batch. |
| `GET/POST/PATCH/DELETE` | `/api/v1/admin/target-roles` | `auth:sanctum`, admin | Manage target role/search-query records. |

## Validation Classes

The contracts are backed by Laravel form requests: `ScrapeJobsRequest`, `ScrapeJobTitleIfMissingRequest`, `StoreScrapedJobRequest`, `CheckScrapedJobRequest`, `ReportScrapingFailureRequest`, `StoreScrapingSourceRequest`, and `UpdateScrapingSourceRequest`.
