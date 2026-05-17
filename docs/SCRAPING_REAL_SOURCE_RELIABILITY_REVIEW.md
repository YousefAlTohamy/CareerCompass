# Scraping Real Source Reliability Review

Date: 2026-05-16
Branch: `fix/scraping-real-source-reliability`

## Summary

This pass hardens CareerCompass scraping around real public data extraction quality. The main change is that a source is only successful when at least one usable job is stored. Empty pages, blocked public pages, missing configuration, and quality failures are now reported as their own classifications instead of being treated as success.

No login scraping, CAPTCHA bypass, paywall bypass, stealth/fingerprint evasion, or proxy rotation was added.

## Source Matrix Before And After

| Source | Before | After mode | Live diagnostic result | Recommendation |
| --- | --- | --- | --- | --- |
| CareerCompass Demo Jobs | Deterministic demo source, usable for local validation | `reliable_api` | `SUCCESS`, 1 preview, 1 stored | Keep for smoke tests and demos |
| Remotive Remote Jobs | Public API adapter existed, needed stricter normalization and quality accounting | `reliable_api` | `SUCCESS`, 1 preview, 1 stored | Keep as reliable baseline |
| RemoteOK Remote Jobs | Public API adapter existed, needed sample coverage and empty-result handling | `reliable_api` | `SUCCESS`, 1 preview, 1 stored | Keep as reliable baseline |
| Arbeitnow Job Board | Public API adapter existed, needed sample coverage and normalization | `reliable_api` | `SUCCESS`, 1 preview, 1 stored | Keep as reliable baseline |
| Adzuna US Tech | Credentials and API errors were not clearly separated from scraper failure | `reliable_api` when configured, `config_required` when keys are missing | `SUCCESS`, 1 preview, 1 stored in this local runtime | Keep credentials local only; use `CONFIG_REQUIRED` when missing |
| Wuzzuf Egypt | HTML extraction was generic and fragile | `public_html` | `EXTERNAL_BLOCKED`, 0 stored | Keep parser, expect blocking/layout risk |
| Indeed Remote | SPA/public page extraction was generic/unsupported | `public_playwright` | `EXTERNAL_BLOCKED`, HTTP 403 | Prefer official feeds/APIs or licensed data |
| Upwork Global | SPA/public page extraction was generic/unsupported | `public_playwright` | `EXTERNAL_BLOCKED`, HTTP 403 | Prefer official feeds/APIs or licensed data |
| LinkedIn Global | Scrapy/Playwright flow existed but block reasons were noisy | `public_playwright` | `EXTERNAL_BLOCKED`, robots.txt forbidden | Do not bypass; use official/partner/licensed data |

## Source Strategy

| Mode | Sources | Behavior |
| --- | --- | --- |
| `reliable_api` | Demo, Remotive, RemoteOK, Arbeitnow, Adzuna when configured | Parse documented/public API payloads, normalize fields, validate quality, export only usable jobs |
| `public_html` | Wuzzuf | Fetch public HTML first, parse JSON-LD/embedded state/cards when visible, then classify blocked or empty pages honestly |
| `public_playwright` | Indeed, Upwork, LinkedIn | Use Playwright only to render public content, wait for public job-card selectors, parse visible HTML and embedded public payloads |
| `external_blocked` | Wuzzuf, Indeed, Upwork, LinkedIn in this runtime | Returned for CAPTCHA/login/verification/403/429/robots blocks |
| `config_required` | Adzuna when keys are absent | No credential values are logged or returned |
| `adapter_missing` | Unknown source types | Reported when no supported parser exists |

## Public Playwright Strategy

- Try safe HTTP fetch first.
- If content is empty or JavaScript-rendered and not blocked, render the public page with Playwright.
- Wait for known public job-card selectors.
- Parse visible card fields: title, company, location, URL, snippet/description, job type, work type, salary, and tags when visible.
- Parse public `script[type="application/ld+json"]` JobPosting data.
- Parse visible embedded state payloads when present in the returned public page.
- Stop and classify as `EXTERNAL_BLOCKED` for login walls, CAPTCHA/verification text, HTTP 401/403/429, robots.txt blocking, or rate limiting.

## Data Quality Rules

For real external sources, a job is accepted only when:

- Title is meaningful.
- Company is meaningful.
- Description or requirements are meaningful.
- URL is an absolute public HTTP(S) URL.
- URL is not generated/local/fake.
- Source id or source name exists.
- `job_type` is normalized.
- `work_type` is normalized.

Demo/local sources may use deterministic demo URLs. Real external jobs without a valid public URL are rejected.

Every scraper result now includes:

- `jobs_preview_count`
- `jobs_stored`
- `jobs_quality_rejected_count`
- `quality_warnings`
- `rejected_examples`
- `data_quality_summary`

Classification rules:

- `SUCCESS`: at least one usable job stored and no rejects/failures.
- `PARTIAL_SUCCESS`: at least one usable job stored and some jobs rejected or failed.
- `DATA_QUALITY_FAILED`: jobs were fetched but all failed quality.
- `EMPTY_RESULT`: no jobs visible and no block detected.
- `EXTERNAL_BLOCKED`: login/CAPTCHA/verification/403/429/robots/blocking detected.
- `CONFIG_REQUIRED`: required local credentials are missing.

## Backend Import Hardening

- Scraper import still requires the scraper service token.
- Duplicate public URLs update the existing job.
- Existing title/company fallback updates jobs when the URL match is not available.
- Real external jobs without valid public URLs are rejected.
- Demo/local URLs remain allowed.
- Validation errors return structured reasons.
- Import/report exceptions return redacted error codes.
- Scraping source responses redact sensitive header/parameter keys.

## Admin And User Display

- Admin Sources shows adapter mode, classification, fetched/stored/rejected counts, quality warnings, blocked/config-required reasons, and recommended action.
- Admin Jobs loads source data and displays source names gracefully.
- User Jobs filters obviously broken jobs before display and shows source labels.
- User job cards hide apply actions when a usable URL is not present.
- Market Intelligence now states that insights are based on imported active-source jobs and that coverage can be limited by credentials, blocking, empty results, or quality rejection.

## Runtime Results

Diagnostics All:

| Metric | Result |
| --- | --- |
| Overall | `DEGRADED` |
| Pipeline working | yes |
| Passed sources | 5 |
| Failed/external issue sources | 4 |
| Config required | 0 |
| Adapter missing | 0 |

Single-source diagnostics:

| Source | Classification | Stored | Rejected | Notes |
| --- | --- | ---: | ---: | --- |
| CareerCompass Demo Jobs | `SUCCESS` | 1 | 0 | Deterministic demo job stored |
| Remotive Remote Jobs | `SUCCESS` | 1 | 0 | Public API stored a job |
| RemoteOK Remote Jobs | `SUCCESS` | 1 | 0 | Public API stored a job |
| Arbeitnow Job Board | `SUCCESS` | 1 | 0 | Public API stored a job |
| Adzuna US Tech | `SUCCESS` | 1 | 0 | Local credentials present; values not logged |
| Wuzzuf Egypt | `EXTERNAL_BLOCKED` | 0 | 0 | Public page returned sign-in/verification content |
| Indeed Remote | `EXTERNAL_BLOCKED` | 0 | 0 | Public page returned HTTP 403 |
| Upwork Global | `EXTERNAL_BLOCKED` | 0 | 0 | Public page returned HTTP 403 |
| LinkedIn Global | `EXTERNAL_BLOCKED` | 0 | 0 | Scrapy obeyed robots.txt; no bypass attempted |

Run Extractions:

| Metric | Result |
| --- | --- |
| Batch id | `a1cb6dd2-cd98-4b14-bbf4-39702ddb9f3a` |
| Active sources | 9 |
| Runnable sources | 9 |
| Active targets | 12 |
| Planned runs | 108 |
| Batch pending jobs | 0 |
| Batch failed queue jobs | 0 |
| Recent scraping job statuses for this run window | 48 completed, 60 failed source results |
| Queue ready count | 0 |
| Imported jobs visible | 207 user-visible jobs |

The 60 failed source results are expected external-source failures from blocked public sources and empty/blocked runs. The Laravel batch itself finished with zero failed queue jobs.

Queue note: `php artisan queue:failed` still shows one old failed job from 2026-05-13. It was not created by this run and was left untouched.

## External Limitations

Public sites can change layouts, block anonymous access, require login, enforce robots.txt, rate limit, or return verification pages. This PR reports those states honestly. It does not attempt to bypass them.

Future production options:

- Official APIs.
- Partner feeds.
- Licensed job data providers.
- Source agreements.
- Per-source contracts for permissible use and reliability expectations.

## Validation Commands

Baseline and final commands used:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan test
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T ai-job-miner python -m pytest -q tests/test_service_api.py
python -m compileall ai-job-miner ai-cv-analyzer
cd frontend
npm run lint
npm run build
cd ..
git diff --check
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan queue:failed
```

Health checks passed:

- `http://localhost`
- `http://localhost/api/health`
- `http://localhost/api/ready`
- `http://localhost/api/v1/health`
- `http://localhost:8003/health`
- `http://localhost:9090/-/ready`
- `http://localhost:3000/api/health`
- `http://localhost:9000/minio/health/live`

## Secret And Runtime File Review

- No `.env` files are intended to be staged.
- No Adzuna credentials are documented.
- API errors redact credential values.
- No logs, screenshots, runtime storage, uploaded CVs, `node_modules`, `vendor`, or `dist` artifacts are intended to be staged.

## Safe-To-Merge Recommendation

Safe to merge after final CI-equivalent validation passes. The reliable public API sources now provide the production baseline, and public HTML/Playwright sources fail honestly when blocked instead of creating fake or broken jobs.
