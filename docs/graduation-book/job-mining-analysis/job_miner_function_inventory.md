# AI Job Miner Function Inventory

This inventory maps the job-mining behavior to concrete files, classes, and functions inspected for the standalone scraping chapter.

## Python / FastAPI Service

| Component | Functions / Classes | Purpose |
|---|---|---|
| `service_api.py` | FastAPI app, `/health`, `/metrics`, `/scrape` | Exposes the job-mining service and accepts protected scrape requests from Laravel. |
| `service_api.py` | `_require_service_token` | Validates `X-Scraper-Service-Token` against `SCRAPER_SERVICE_TOKEN` or `SCRAPY_API_TOKEN`. |
| `service_api.py` | `ScrapeRequest`, `SourceConfig` | Defines request payloads for query, limit, source ID, scraping job ID, callback URL, and source configuration. |
| `service_api.py` | demo/API/HTML adapter helpers | Routes source types to deterministic demo data, public JSON APIs, or HTML parsers. |
| `service_api.py` | `_quality_gate`, classification helpers | Classifies successful, partial, empty, blocked, config-required, failed, compromised, and adapter-missing outcomes. |
| `service_api.py` | Scrapy subprocess path | Starts the LinkedIn Scrapy spider with Laravel callback URLs and token environment variables. |
| `service_api.py` | `_sanitize_sensitive` | Redacts service tokens, API keys, authorization values, and credential query parameters from logs. |

## Scrapy Layer

| Component | Functions / Classes | Purpose |
|---|---|---|
| `ai_job_miner/settings.py` | Scrapy settings | Enables robots.txt obeying, delays, retries, Playwright handlers, and the pipeline chain. |
| `spiders/base_spider.py` | `BaseJobSpider`, `report_failed_url` | Provides common failed-URL callback behavior to Laravel. |
| `spiders/linkedin_spider.py` | `LinkedinSpider` | Parses public search/detail pages for title, company, location, description, URL, and metadata. |
| `pipelines.py` | `DeduplicationPipeline` | Drops in-run duplicate URLs and asks Laravel whether a URL already exists. |
| `pipelines.py` | `NERPipeline` | Applies the local skill extractor to job descriptions. |
| `pipelines.py` | `LaravelExportPipeline` | Exports accepted job payloads to Laravel with retry behavior. |
| `items.py` | `JobItem` | Defines the Scrapy item fields imported into Laravel. |

## Laravel Integration

| Component | Functions / Classes | Purpose |
|---|---|---|
| `JobController.php` | `scrapeAndStore` | Creates an on-demand `ScrapingJob` and dispatches the scraping queue job. |
| `JobController.php` | `scrapeJobTitleIfMissing` | Checks whether matching stored jobs already exist before queuing scraping. |
| `JobController.php` | `checkScrapingStatus` | Returns job lifecycle state, counters, completion time, stored jobs, and errors. |
| `ScraperClient.php` | `scrape` | Calls AI Job Miner `/scrape` with token header, callback base URL, source payload, retry, and timeout settings. |
| `ProcessOnDemandJobScraping.php` | `handle`, `failed` | Runs the on-demand queue job, marks status, estimates stored count, reads failed URLs, and updates source cache. |
| `ProcessMarketScraping.php` | `handle` | Builds full market scraping batches from active target roles and active/runnable sources. |
| `ProcessMarketScrapingCategory.php` | `handle`, classification mapping | Runs one target/source scrape, records status/counters, and maps adapter classifications to admin-visible states. |
| `ScrapedJobController.php` | `checkExistence` | Protected URL existence check used before import. |
| `ScrapedJobController.php` | `import` | Validates, deduplicates, creates/updates jobs inside a transaction, and syncs skills. |
| `ScrapedJobController.php` | `reportFailure` | Stores failed source URLs for diagnostics and retry visibility. |
| `SkillSyncService.php` | `syncJobSkills` | Normalizes job skill names and links them to the `job_skills` pivot. |

## Admin and Frontend Integration

| Area | Files | Purpose |
|---|---|---|
| Source diagnostics | `Admin/ScrapingSourceController.php`, `frontend/src/pages/admin/AdminSources.jsx` | Source CRUD, active/inactive state, source testing, diagnostics, support metadata, and UI status. |
| Target roles | `Admin/TargetJobRoleController.php`, `frontend/src/pages/admin/AdminTargets.jsx` | Role/search-query management and full scraping run orchestration. |
| Dashboard | `Admin/DashboardController.php`, `frontend/src/pages/admin/AdminDashboard.jsx` | Job/source stats, scraper health, batch progress, failed URLs, and retry marking. |
| API clients | `frontend/src/api/scrapingSources.js`, `frontend/src/api/endpoints.js` | Browser-side calls for source diagnostics, target roles, scrape-if-missing, and status polling. |

## Request Validation

| Request Class | Purpose |
|---|---|
| `ScrapeJobsRequest` | Validates authenticated on-demand scrape query and result limit. |
| `ScrapeJobTitleIfMissingRequest` | Validates job-title scrape-if-missing workflow. |
| `StoreScrapedJobRequest` | Sanitizes/validates imported jobs, normalizes job/work type, rejects unsafe external URLs, and requires source identity. |
| `CheckScrapedJobRequest` | Validates URL existence checks. |
| `ReportScrapingFailureRequest` | Validates failed URL reports and optional source/job IDs. |
| `StoreScrapingSourceRequest`, `UpdateScrapingSourceRequest` | Validate admin-managed source definitions. |

## Database / Model Inventory

| Model / Table | Important Fields |
|---|---|
| `Job` / `job_postings` | `title`, `company`, `description`, `requirements`, `url`, `source`, `scraping_source_id`, `skills`, `work_type`, `job_type`; unique URL and title/company constraints. |
| `ScrapingJob` / `scraping_jobs` | `job_title`, `status`, `type`, `jobs_found`, `jobs_stored`, `jobs_duplicated`, `discovered_count`, `failed_count`, `processing_time_ms`, `error_message`. Source identity is associated through source records, adapter payloads, and failed URL records rather than a `scraping_jobs.scraping_source_id` column. |
| `ScrapingSource` / `scraping_sources` | `name`, `endpoint`, `method`, `type`, `mode`, `status`, `headers`, `params`, support metadata and health scoring helpers. |
| `ScrapingFailedUrl` / `scraping_failed_urls` | `scraping_job_id`, `scraping_source_id`, `url`, `error_message`, `retried`, `failed_at`. |
| `TargetJobRole` / `target_job_roles` | Role/search-query records and active flag. |
| `Skill` and `job_skills` | Canonical skill catalog and required-skill pivot metadata. |
