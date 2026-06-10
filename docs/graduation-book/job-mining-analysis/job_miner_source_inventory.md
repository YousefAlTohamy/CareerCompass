# AI Job Miner Source Inventory

This inventory summarizes the job-mining sources and adapters found in the repository. It is evidence for the graduation book chapter and should not be read as proof that every external source is reachable at any point in time.

## Runtime Entry Points

| Area | Files | Evidence |
|---|---|---|
| FastAPI service | `ai-job-miner/service_api.py` | Provides `/health`, `/metrics`, and protected `/scrape`. |
| Scrapy settings | `ai-job-miner/ai_job_miner/settings.py` | Enables conservative crawling defaults such as `ROBOTSTXT_OBEY = True`, download delay, randomized delay, and retry status codes. |
| Scrapy spiders | `ai-job-miner/ai_job_miner/spiders/base_spider.py`, `linkedin_spider.py` | Implements public-page extraction and failed-URL reporting callbacks. |
| Pipelines | `ai-job-miner/ai_job_miner/pipelines.py` | Performs in-run URL deduplication, Laravel existence checks, skill extraction, and Laravel export. |
| Middleware capability | `ai-job-miner/ai_job_miner/middlewares.py` | Contains user-agent and proxy middleware classes, but the current Scrapy settings do not enable stealth or proxy middleware by default. |

## Source Adapter Inventory

| Source / Adapter | Type | Repository Evidence | Credential / Runtime Notes | Documentation Scope |
|---|---|---|---|---|
| CareerCompass Demo Jobs | demo/local | `service_api.py` demo adapter and `ScrapingSourceSeeder` | Deterministic local demo jobs; no external site dependency. | Valid demo evidence only, not labor-market coverage. |
| Remotive | API | `service_api.py` JSON adapter and `ScrapingSourceSeeder` | Public API-style adapter in code. | External availability can change; tests mock responses. |
| RemoteOK | API | `service_api.py` JSON adapter and `ScrapingSourceSeeder` | Public API-style adapter in code. | External availability can change; tests mock responses. |
| Arbeitnow | API | `service_api.py` JSON adapter and `ScrapingSourceSeeder` | Public API-style adapter in code. | External availability can change; tests mock responses. |
| Adzuna | API | `service_api.py` Adzuna adapter and `ScrapingSourceSeeder` | Requires `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`; returns config-required classification when missing. | Documented as configured integration path, not verified source coverage. |
| Wuzzuf | HTML | `service_api.py` HTML parsing path and `ScrapingSourceSeeder` | Public HTML can change or block requests. | Demo/experimental adapter, not production-grade scraping. |
| Indeed | HTML | `service_api.py` HTML parsing path and `ScrapingSourceSeeder` | Public HTML can change, block, rate-limit, or require different behavior. | Demo/experimental adapter, not source reliability evidence. |
| Upwork | HTML | `service_api.py` HTML parsing path and `ScrapingSourceSeeder` | Public HTML can change, block, rate-limit, or require different behavior. | Demo/experimental adapter, not source reliability evidence. |
| LinkedIn | Scrapy/HTML | `linkedin_spider.py`, Scrapy subprocess path in `service_api.py`, `ScrapingSourceSeeder` | Public pages only; no login, CAPTCHA bypass, or private scraping. | Demonstrates adapter structure and failure reporting boundaries. |
| Generic API/HTML/SPA | adapter classification | `service_api.py`, `ScrapingSource::adapterName()` | Unsupported adapters can be classified as adapter-missing or external-risk. | Used for honest diagnostics rather than pretending full support. |

## Source Management Records

| Backend Area | Files | Purpose |
|---|---|---|
| Source model | `backend-api/app/Models/ScrapingSource.php` | Stores name, endpoint, method, type, mode, status, headers/params, support metadata, and recent health score. |
| Source seeder | `backend-api/database/seeders/ScrapingSourceSeeder.php` | Seeds demo, API, and external-risk source templates. |
| Admin controller | `backend-api/app/Http/Controllers/Api/Admin/ScrapingSourceController.php` | Lists sources, computes status, runs diagnostics, tests sources, and updates active/inactive state. |
| Frontend source UI | `frontend/src/pages/admin/AdminSources.jsx` | Displays diagnostics, support labels, status cards, job counts, failures, and source actions. |

## Honest Interpretation

The repository contains multiple adapters and source templates, but the book should not claim whole-market reach or assured source success. The reliable local demonstration source is the CareerCompass demo adapter. API adapters depend on external service availability and credentials. HTML adapters depend on public page structure, robots/terms considerations, rate limits, and blocking behavior.
