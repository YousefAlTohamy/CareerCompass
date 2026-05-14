# CareerCompass Flow Review

Date: 2026-05-14
Branch: `fix/logical-flow-hardening`

## Flows Tested

- Docker compose configuration with `docker-compose.yml` and `docker-compose.prod.yml`.
- Docker runtime services: Nginx, frontend, backend API, backend workers, scheduler, MySQL, AI CV analyzer, AI job miner, Prometheus, Grafana, and MinIO.
- Backend route loading, migrations, and feature tests inside Docker.
- Frontend lint and production build.
- Python compile and current AI/job-miner tests.
- AI hybrid matching endpoint with real service runtime.
- End-to-end API journey using the same `/api/v1` contract consumed by the React frontend:
  - register
  - login
  - import a deterministic job through the internal scraper import API
  - upload a temporary synthetic PDF CV
  - verify CV parsing status
  - verify profile, skills, CV analysis, and signed CV URL
  - load recommended jobs
  - run gap analysis
  - trigger on-demand scraping and poll scraping status

## Passed

- Docker config validation passed.
- All running containers reached healthy/running state after affected-service recreation.
- Backend health endpoints returned 200:
  - `/api/health`
  - `/api/ready`
  - `/api/v1/health`
- Frontend through Nginx and direct frontend port returned 200.
- AI CV analyzer, AI job miner, Prometheus readiness, Grafana health, MinIO health, and protected metrics all returned 200.
- Backend test suite passed: 16 tests, 107 assertions.
- AI analyzer tests passed: 6 tests.
- Job miner tests passed: 53 tests.
- Frontend lint passed with existing warnings only; production build passed.
- Runtime E2E API smoke passed:
  - disposable user registered and logged in
  - CV upload returned `parsing_status=success`
  - profile headline became `Backend Laravel Developer`
  - extracted skills persisted: PHP, JavaScript, Laravel, React, MySQL, Docker, REST APIs
  - signed CV URL endpoint succeeded
  - recommended jobs returned one deterministic match
  - gap analysis returned 59.4% match with no missing required skills for the seeded job
  - scraping job completed without queue blockage

## Fixed

- AI `_error_result()` now returns `parsing_status="error"` instead of inheriting timeout status.
- AI hybrid matching no longer depends on the `ai-job-miner` folder at runtime.
- AI hybrid matching now uses local TF-IDF scoring and falls back to semantic-only scoring without score penalty if TF-IDF is unavailable.
- AI hybrid matching now constructs `IntelligentMatcher` with its required embedder/domain dependencies and adapts request data to the matcher contract.
- CV processing no longer wipes existing user skills when AI parsing succeeds but returns an empty skills list.
- CV role discovery now prefers `analysis.predicted_role`, then profile title/headline, then `analysis.primary_domain`.
- CV upload responses expose `parsing_status` and warnings so the frontend can avoid misleading success messages.
- Frontend CV upload flow now tells users that first AI runs may be slow and shows warning states for timeout, error, OCR fallback, and no skills extracted.
- PHPUnit configuration now forces test app/database settings in Docker so tests do not accidentally target production container env values.
- Health tests now fake dependency readiness deterministically instead of depending on whether local Docker services happen to be reachable.
- Added a tracked `tests/Unit` placeholder so PHPUnit does not fail on a missing declared test suite.
- Default Docker docs now point teammates to `main`; `setup-docker` remains historical context only.

## Failed Or Limited

- A full `docker compose up -d --build` command exceeded the local 20-minute timeout while heavy images were already present. Affected images were built/recreated selectively and the running stack was validated healthy.
- A concurrent manual import of the AI analyzer during startup corrupted EasyOCR's first-time model download cache inside the container. The corrupted cache file was removed and the analyzer restarted successfully. Avoid parallel manual imports during first warm-up.
- `scripts/smoke/docker-smoke.sh` could not run on this Windows shell because `/bin/bash` is not available. The PowerShell HTTP and queue smoke scripts were run instead.
- Browser automation packages are not installed in the repo. The frontend was validated by HTTP load, lint/build, and API E2E against the same endpoints used by the UI; full click-through Playwright coverage remains a follow-up.
- One older failed queue entry exists from before this pass: `Illuminate\Queue\CallQueuedClosure` on `database@default` at `2026-05-13 11:19:31`. No ready/pending jobs are stuck now.
- The scraper smoke completed but found zero jobs for the intentionally obscure query and recorded one failed discovery. This is acceptable for external-site scraping limits; internal queue/service lifecycle worked.

## UX Notes

- CV upload now communicates slow AI processing and partial parsing states more honestly.
- If parsing returns no skills, users are told existing skills were preserved.
- The current upload remains synchronous. Large PDFs or cold AI model starts can still feel slow.

## Does The Project Satisfy Its Intended Purpose?

Yes, for the validated happy path: CareerCompass can analyze a CV, extract profile and skills, store the uploaded CV privately, return signed access, load recommendations from relational job skills, run gap analysis, and execute the scraper lifecycle through the queue-backed service architecture.

The biggest remaining product limitation is not core wiring; it is operational polish around long-running AI and scraper tasks, plus realistic external scraping variability.

## Top 5 Recommended Future Improvements

1. Convert CV upload to a fully asynchronous job with polling/progress while preserving the current synchronous endpoint as a compatibility path.
2. Add Playwright E2E tests for register, login, upload, recommendations, gap analysis, and admin scraping screens.
3. Persist `scraping_job_id` on imported job postings so scraper result counts do not depend on title-based approximation.
4. Pre-bake or persist EasyOCR model assets safely to avoid first-run download races and slow cold starts.
5. Review and clear historical failed queue jobs through an operational runbook after confirming they are obsolete.
