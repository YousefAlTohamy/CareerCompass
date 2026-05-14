# Product Flow Review

## Review Metadata

- Branch: `fix/product-flow-polish-and-performance`
- Base commit before this pass: `21cf762`
- Date: `2026-05-14 16:33:51 +03:00`
- Runtime: Docker Compose with `docker-compose.yml` and `docker-compose.prod.yml`
- Primary target: `http://localhost/`

## What Was Tested

- Public site load, home page animation targets, footer links, system status page.
- User registration and login through the browser.
- Dashboard CV upload from the actual UI with a synthetic local PDF.
- Profile data after CV parsing.
- Personalized jobs, manual search, no-result search, job details, save opportunity, applications tracker, and gap analysis.
- Normal user access to admin URLs.
- Admin login, dashboard, jobs, users, sources, and targets pages.
- Admin source diagnostic run from the browser.
- Scrape-on-demand API lifecycle for a low-risk test role.
- Queue state, service logs, and health endpoints after browser testing.

## What Was Broken

### CV Upload False Failure

The dashboard used the default API timeout for a long-running CV upload. On a cold AI service, the browser request could timeout while the backend and AI service kept processing and eventually saved the CV analysis. That created a false failure where a refresh showed that the CV had actually been parsed.

### Jobs Recommendations

The Jobs page requested `/jobs` with `{ recommended: 1 }`, while the backend already exposes a dedicated personalized recommendation endpoint. That made recommendation behavior less explicit and made the UI show stale or unclear recommendation context.

### Save Opportunity Reload State

Saved opportunities were not hydrated from the user's existing applications when the Jobs page loaded. A saved job could therefore look unsaved after a refresh even though the backend had persisted it.

### Profile Field Mismatches

The frontend did not consistently read nested profile and contact fields returned by the backend resources. Useful AI-derived fields such as parsing status, predicted role, seniority, primary domain, completeness, and contact links were underused or displayed with fallback values that looked more precise than they really were.

### Admin Scraper Diagnostics

Admin source testing could show a successful status even when the scraper output contained failed URLs, DLQ reporting, or runtime error counters. This was misleading for demos because the process had finished but the source result was not actually healthy.

### Scrape-On-Demand Result Accuracy

The on-demand scraping job could mark a run completed with zero stored jobs even when the scraper reported failed URLs. That made external source failures look like empty successful imports.

### Frontend Warnings And Demo Polish

- Home GSAP selectors targeted elements that did not exist.
- Gap analysis chart could emit Recharts width/height warnings.
- Footer social links pointed to placeholders.
- Terms copy had a typo.
- System status wording used live language beside static text.
- Some AI-extracted skill labels could arrive as comma-delimited strings, for example `PHP, LARAVEL`, and be saved as one skill.

## Fixes Applied

### CV Upload

- Added a CV-upload-specific frontend timeout of `240000ms` without globally increasing all API timeouts.
- Added dashboard recovery behavior for timeout/network/gateway cases:
  - capture the current CV analysis fingerprint before upload;
  - show "Analysis is still being checked. Please wait...";
  - poll the current user/skills briefly;
  - treat a changed `cv_analysis` as recovered success;
  - preserve hard failures for validation, authentication, unsupported file, and non-recovered server errors.
- Disabled duplicate uploads while processing.
- Removed the fixed 5-second redirect after role discovery and replaced it with clear market-discovery feedback.
- Increased the backend CV processing request budget from 180 seconds to 240 seconds.
- Increased Nginx FastCGI API read/send timeouts to 240 seconds.

Final behavior: cold and warm CV uploads now show honest processing/recovery states, and a successful saved analysis is surfaced without requiring a browser refresh.

### Jobs Recommendations

- Jobs page now calls the dedicated personalized recommended jobs endpoint when there is no manual search.
- Manual searches still use the normal jobs endpoint.
- Recommendation context now shows the role seed returned by the backend, for example `Your CV title: "Backend Laravel Developer"`.
- Match display now normalizes `match_percentage` and `match_score`.
- Gap-analysis calls now ignore stale responses and avoid duplicate analysis for the same selected job.

Final behavior: after a CV upload, the Jobs page shows personalized results based on the user's CV role/title. Manual search and no-result states remain separate and clear.

### Save Opportunity

- Application resources now include `job_id`.
- Jobs page fetches current applications on load and hydrates tracked job IDs.
- Already-saved jobs render as saved immediately after a page reload.
- Duplicate clicks show: `This opportunity is already in your tracker.`
- First-save success shows: `Opportunity saved to your tracker.`
- Application tracker responses now load `job.requiredSkills` consistently for resources.

Final behavior: saved state persists after reload, duplicate saves are blocked in the UI, and the Applications page shows the saved job.

### Profile Data

Backend user/profile data available:

- Top-level user fields: `id`, `name`, `email`, `role`, `created_at`, `job_title`, `headline`, `summary`, `location`, `total_experience_years`, `seniority`, `primary_domain`, `phone`, `linkedin_url`, `github_url`.
- Nested profile fields: `headline`, `summary`, `location`, `total_experience_years`, `seniority`, `primary_domain`, `contact_info`.
- Experiences: `id`, `title`, `company`, `location`, `start_date`, `end_date`, `is_current`, `description`, `technologies`.
- Skills: `id`, `name`, `type`, `confidence_score`, `evidence`, `added_at`.
- CV analysis: `id`, `parsing_status`, `seniority`, `predicted_role`, `primary_domain`, `confidence_score`, `summary`, `completeness_score`, `strengths`, `gaps`, `red_flags`, `metadata`, `cv_file`, `created_at`, `updated_at`.

Frontend now displays or uses:

- predicted/current role;
- parsing status;
- primary domain;
- seniority;
- profile completeness;
- real contact links from `contact_info` and fallback top-level fields;
- skill names with confidence/evidence when available;
- experience timeline data.

Remaining profile gap: Settings can still be improved with a fuller edit surface for nested contact and experience data.

### Admin And Scraping Accuracy

- Admin scraper source diagnostics now detect failure signals in scraper output even when the subprocess exits successfully.
- On-demand scraping now marks a job failed if no jobs were stored and failed URLs were reported.
- Duplicate on-demand discovery jobs for the same role are avoided while another one is pending, processing, or running.

Final behavior: external source blocks/no-results are surfaced honestly instead of being reported as healthy imports.

### Skill Normalization

- CV skill sync now splits obvious comma/semicolon-delimited skill labels before syncing.
- Skill normalization now canonicalizes common labels such as Docker, Laravel, MySQL, React, and REST APIs.
- Added a backend test proving `PHP, LARAVEL` is split into distinct skills.

### Frontend Polish And Performance

- Added `cc-skill-chip` targets for home animations.
- Replaced placeholder footer/social links with a real GitHub repository link.
- Fixed the Terms typo: "updates these terms" to "update these terms".
- Reworded System Status live timestamp text.
- Fixed the gap analysis chart sizing warning by using a fixed-size chart.
- Added stable minimum dimensions to chart containers in market/admin views.
- Reduced repeated/stale Jobs page requests and duplicate gap-analysis calls.

## Browser QA Results

### User Flow

- Registered a disposable browser-test user.
- Uploaded a synthetic CV through the dashboard UI.
- CV upload completed in approximately 25 seconds.
- Upload result: `CV parsed successfully. Your profile and skills were refreshed.`
- Profile reflected parsed role, parsing status, domain, seniority, completeness, and skills.
- Jobs page showed personalized recommendation context and related jobs.
- Manual search for `Laravel Developer` returned relevant jobs.
- No-result search for `zzzz-no-job-qa-test` showed a clear empty state.
- Save Opportunity persisted across page reload.
- Applications page showed the saved opportunity.
- Gap analysis showed match percentage, matched skills, missing skills, and recommendations.

### Admin Flow

- Seeded admin login worked locally.
- Admin dashboard, jobs, users, sources, and targets loaded.
- Normal user could not access admin dashboard content.
- Admin source test was retested after the diagnostic fix and showed `INTEGRITY_COMPROMISED` when scraper output contained failed URLs/DLQ signals.

### Scraping From Website

- Tested an admin source diagnostic from the browser.
- The scraper completed its process but reported external-source/runtime failure signals.
- UI now surfaces that as compromised instead of success.

Observed limitation: source diagnostics filtered for a specific source, but scraper output still referenced a LinkedIn URL. Future work should align each source test with the exact source type/spider/API route.

### Scrape-On-Demand After CV/API

- Triggered `/api/v1/jobs/scrape-if-missing` with a low-risk unique role query.
- Initial status moved through processing.
- Final status after the fix: `failed` with the message that no jobs were stored and failed URLs were reported.
- Queue did not leave ready jobs stuck.

This is acceptable behavior when external sites block or fail; the lifecycle is now honest and visible.

## Logs, Queues, And Health

- Docker Compose config validation passed.
- All key containers were running and healthy after targeted restarts/rebuilds.
- Health endpoints returned 200:
  - `http://localhost`
  - `http://localhost/api/health`
  - `http://localhost/api/ready`
  - `http://localhost/api/v1/health`
  - `http://localhost:8000/`
  - `http://localhost:8003/health`
  - `http://localhost:9090/-/ready`
  - `http://localhost:3000/api/health`
  - `http://localhost:9000/minio/health/live`
- Ready queue job count: `0`.
- One old failed queue entry from `2026-05-13 11:19:31` remains; it predates this product-flow pass.

## Validation Commands Run

- `docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet`
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml ps`
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan migrate --force --no-interaction`
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan optimize:clear`
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan test`
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan test --filter=CvUploadTest`
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan test --filter=Application`
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan test --filter=GapAnalysisTest`
- `npm run lint`
- `npm run build`
- `python -m compileall ai-cv-analyzer ai-job-miner`
- `python -m pytest -q tests/test_service_api.py` in `ai-cv-analyzer`
- `python -m pytest -q tests/test_ai.py tests/test_service_api.py` in `ai-job-miner`
- Browser automation against `http://localhost/` using local Chrome.

## Remaining Recommendations Before Final Presentation

1. Convert CV upload to a truly async workflow with progress polling and job IDs.
2. Add scraper source-specific diagnostics so each admin source test uses the exact configured source implementation.
3. Add frontend tests for Jobs recommendation state, saved opportunity hydration, and upload recovery.
4. Address remaining non-blocking ESLint warnings around Fast Refresh and hook dependencies.
5. Make the admin full extraction controls explicitly configurable with query, source, and max-results limits before running.
6. Add a demo seed command that creates deterministic jobs and target roles for offline presentations.

## Demo Readiness

The app is demo-ready for the core CareerCompass story:

- CV analysis and skill extraction work from the browser.
- Profile updates after CV upload.
- Personalized jobs and manual search work.
- Save Opportunity persists correctly.
- Gap analysis works and falls back without crashing.
- Admin pages load and source diagnostics are more honest.

External scraping remains dependent on third-party source availability and anti-bot behavior. The platform now reports those failures clearly rather than presenting false success.
