# CareerCompass Project Hardening Audit

Date: 2026-05-16
Branch: `audit/project-hardening-scope`
Base branch: `main`
Base commit audited: `e9705a6` (`Merge pull request #84 from YousefAlTohamy/fix/secure-adzuna-diagnostics-import`)

## Executive Summary

CareerCompass is demo-usable today as a Docker-first graduation project. The core end-to-end story is present: users can register, upload a CV, persist AI-derived profile/skills/experience data, view jobs, save opportunities, run gap analysis, and admins can inspect users/jobs/sources/targets while the scraping pipeline imports from deterministic/API sources and reports external failures honestly.

The project is not ready to be described as a real production deployment yet. The main gaps are not missing features; they are hardening gaps: production secret handling, clearer separation between local Docker and production Docker, mature CV/AI validation, stronger upload/storage controls, browser-level UX polishing across placeholder pages, source reliability for external scraping, and an evidence-based AI evaluation plan.

This pass intentionally does not add new product features, remove pages, or rewrite flows. It records the current state, classifies risks, and proposes small implementation PRs.

## Audit Method

Evidence used:

- Live Docker startup and health checks.
- Backend, Python, frontend, and compile validation.
- `php artisan route:list --path=api`.
- Static review of Docker compose, Nginx, API routes, queue jobs, CV processing, AI analyzer, scraping source controllers, seeders, and frontend routes/pages.
- Browser spot-check of public routes and unauthenticated protected-route redirects.
- Existing project review docs:
  - `docs/QA_BROWSER_WALKTHROUGH.md`
  - `docs/PRODUCT_FLOW_REVIEW.md`
  - `docs/FLOW_REVIEW.md`
  - `docs/FULL_SCRAPING_ADAPTERS_REVIEW.md`
  - `docs/SCRAPING_ORCHESTRATOR_REVIEW.md`
  - `docs/PRODUCTION_READINESS.md`
  - `docs/TROUBLESHOOTING.md`

No application behavior was changed in this branch.

## Baseline Validation

| Check | Result | Notes |
| --- | --- | --- |
| Docker compose config | PASS | `docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet` |
| Docker startup | PASS | Stack started with `up -d`; Docker Desktop had to be started first. |
| `http://localhost` | PASS | 200 |
| `http://localhost/api/health` | PASS | 200 |
| `http://localhost/api/ready` | PASS | 200 |
| `http://localhost/api/v1/health` | PASS | 200 |
| `http://localhost:8000/` | PASS | 200 |
| `http://localhost:8003/health` | PASS | 200 |
| `http://localhost:9090/-/ready` | PASS | 200 |
| `http://localhost:3000/api/health` | PASS | 200 |
| `http://localhost:9000/minio/health/live` | PASS | 200 |
| Backend migrations | PASS | Nothing to migrate. |
| Backend tests | PASS | 24 tests, 163 assertions. |
| ai-job-miner tests | PASS | 13 tests. |
| Python compile | PASS | `python -m compileall ai-cv-analyzer ai-job-miner`. |
| Frontend lint | PASS with warnings | 0 errors, 13 warnings. |
| Frontend build | PASS | Vite production build succeeded. |
| Queue pending jobs | PASS | 0 ready jobs. |
| Failed jobs | WARNING | One old failed closure from 2026-05-13 remains. |
| AI analyzer pytest | NOT RUN | Container does not include `pytest`; health and compile validation passed. |

Frontend lint warnings remaining:

- Fast Refresh warnings in context/page files that export non-components.
- React hook dependency warnings in admin dashboard, user details, jobs, gap analysis, and market intelligence.

These warnings are not blockers for the current demo but should be addressed before production because hook dependency warnings can become stale-data bugs.

## Readiness Scores

| Area | Score | Meaning |
| --- | ---: | --- |
| Graduation demo readiness | 82/100 | Demo flow works, but presentation should avoid promising production reliability for external scraping and AI accuracy. |
| Production readiness | 56/100 | Strong Docker-first foundation, but secrets, deploy topology, backups, TLS, async CV processing, and operational controls need hardening. |
| Frontend UX readiness | 72/100 | Core flows are usable; placeholder pages and dashboard copy/data clarity need polish. |
| Scraping readiness | 70/100 | Pipeline works with demo/API sources; external sources remain legally and technically risky. |
| AI analyzer readiness | 63/100 | Good structured flow and fallbacks; needs real evaluation datasets, edge-case validation, and async processing. |
| Docker/deployment readiness | 74/100 | Team-local Docker is healthy; production compose still inherits local bind-mount assumptions and default credentials. |

## General Architecture Audit

| Item | Current behavior | Risk | Graduation impact | Production impact | Recommended fix | Proposed PR |
| --- | --- | --- | --- | --- | --- | --- |
| Local Docker vs production Docker | Local compose defines services, bind mounts source, exposes many ports. Prod override changes env, resources, frontend Dockerfile, MinIO, monitoring. | `docker-compose.prod.yml` still depends on local compose shape and inherits development bind mounts unless explicitly overridden. | Low if demo uses local Docker. | High for real deployment because images are not immutable and host files affect runtime. | Create separate production deployment profile with immutable images, no source bind mounts, real secrets, TLS, and managed volumes. | PR 4 |
| Config and secrets | Many env vars have safe placeholders, but compose still includes local default passwords/tokens. Real secrets stay in ignored `.env`. | Default credentials can accidentally be used beyond local demo. | Medium if machine is shared. | High. | Add env validation script/checklist, fail production boot when required secrets remain defaults, document rotation. | PR 4 |
| Exposed ports | MySQL, MinIO, Grafana, Prometheus, AI analyzer, scraper, frontend, and Nginx are exposed to host. | Convenient locally but broad attack surface. | Low on private laptop. | High. | Only expose Nginx publicly; bind internal services to Docker network or localhost; firewall production. | PR 4 |
| Healthchecks | Core containers have healthchecks and `/health`/`/ready` endpoints. Some worker healthchecks rely on process-level checks. | Some "healthy" states do not guarantee queue progress or external integrations. | Low. | Medium. | Add queue-depth, scheduler heartbeat, storage, and AI model readiness checks. | PR 4 |
| Production compose inheritance | Prod override sets `APP_ENV=production`, S3/MinIO, limits, restart policies. | Running both compose files is production-style, not equivalent to a deployed prod stack. | Low if documented honestly. | High if shipped as-is. | Split local, staging, and production docs/configs. | PR 4 |
| API versioning | `/api` and `/api/v1` register the same route set; route list shows 126 API routes. | Duplication increases maintenance and deprecation confusion. | Low. | Medium. | Keep both for demo compatibility, document `/api/v1` as canonical, plan deprecation headers for unversioned routes. | PR 4 |
| Route/middleware security | Sanctum auth, admin middleware, scraper token, monitoring token, throttles are present. | Need deeper authorization testing for every admin mutation and internal route. | Medium. | High. | Add policy tests for admin/user boundaries and internal token-only routes. | PR 4 |
| Upload and storage | CV upload validates through Laravel request, stores CV metadata, supports local/S3/MinIO signed URLs. | Needs stronger malware scanning, MIME/content verification, retention cleanup, and large-file tests. | Medium. | High. | Add upload security tests, retention job validation, AV hook placeholder or documented scanner integration. | PR 2 |
| Queue workers | Separate queues exist: default, high, scraping, ai, emails. Scheduler container exists. | Database queue works locally but is not ideal for high-throughput production. | Low. | Medium. | Move production queue to Redis/SQS, add Horizon or dashboard equivalent, alert on failed/stuck jobs. | PR 4 |
| Monitoring endpoints | Prometheus/Grafana stack exists; metrics endpoint requires machine token. | Metrics coverage is basic; logs need central aggregation. | Medium. | Medium. | Expand metrics for CV status, scraper classifications, queue lag, storage errors; document Grafana dashboard ownership. | PR 4 |
| Logs and redaction | Structured logs exist; scraper diagnostic redaction was added in PR #84. | Need systematic redaction tests for tokens, signed URLs, uploaded filenames, scraper headers. | Medium. | High. | Add log redaction policy and regression tests for secrets/tokens/URLs. | PR 4 |

## Frontend Page Audit

Classification key:

- READY: acceptable for graduation demo with current behavior.
- NEEDS_UX_COPY: works but copy/status/expectations need better explanation.
- NEEDS_DATA_FIX: UI should use more real backend data or avoid misleading derived/fallback values.
- BROKEN: currently blocks the intended page purpose.
- PLACEHOLDER_BUT_KEEP: valid route, but it needs honest production copy before presentation.
- ROLE_MISMATCH: route works but the user role/context is confusing.

| Page | Classification | Current notes | Recommended fix |
| --- | --- | --- | --- |
| `/` | READY | Loads publicly. Browser spot-check showed public shell, nav, and translated controls. | Keep; verify unauthenticated navbar does not leak admin links after stale local auth state. |
| `/about` | READY | Loads and explains mission. | Keep copy concrete and project-specific. |
| `/privacy` | NEEDS_UX_COPY | Loads; policy text is generic and dated. | Add graduation/demo disclaimer and production data handling caveat. |
| `/terms` | NEEDS_UX_COPY | Loads; typo was fixed earlier. | Legal review before production. |
| `/status` | NEEDS_DATA_FIX | Shows live health timestamp and basic checks. | Include component-level degraded states and source of truth for each service. |
| `/login` | READY | Auth validation was improved in prior pass. | Retest empty/invalid/password errors before demo. |
| `/register` | READY | Registration flow works with validation. | Add clearer password/domain rules if requirements are strict. |
| `404` | READY | Browser spot-check confirmed custom 404 loads. | Keep. |
| `/dashboard` | NEEDS_DATA_FIX | CV upload, recovery, and profile cards work; some dashboard cards/charts can still look more precise than the underlying data. | Use only real backend metrics or label estimates; make scrape-on-demand status persistent. |
| `/profile` | NEEDS_UX_COPY | Displays AI/backend fields after CV upload. | Improve empty states and admin-context handling. |
| `/settings` | READY | Profile payload compatibility was fixed in prior pass. | Extend nested contact/experience editing later. |
| `/jobs` | READY | Uses recommended endpoint when not searching and supports saved opportunities. | Add clearer source/data freshness indicators for imported jobs. |
| `/applications` | READY | Saved opportunity persistence fixed. | Improve empty state and delete/undo feedback. |
| `/gap-analysis/:jobId` | READY | Core match/missing skills flow works; backend returns 422 when user lacks profile/CV. | Add clearer fallback copy when AI matcher is unavailable. |
| `/market` | NEEDS_DATA_FIX | Market charts use available scraped data; some charts derive trend data from top skills when no true time-series exists. | Label derived charts honestly or add real time-series aggregation. |
| `/tools` | PLACEHOLDER_BUT_KEEP | Tools hub is acceptable as navigation/future surface. | Mark unfinished tools as preview/coming soon without hiding page. |
| `/cv-builder` | PLACEHOLDER_BUT_KEEP | Page exists but is not a mature builder. | Convert into honest MVP builder or clear preview. |
| `/mock-interview` | PLACEHOLDER_BUT_KEEP | Page exists; not production-grade interview feature. | Add preview wording and roadmap. |
| `/learning` | PLACEHOLDER_BUT_KEEP | Page exists; needs stronger data linkage to skill gaps. | Link to actual gap-analysis recommendations. |
| `/career-planner` | PLACEHOLDER_BUT_KEEP | Page exists; needs real plan persistence. | Add honest static/preview copy now, real persistence later. |
| `/mentorship` | PLACEHOLDER_BUT_KEEP | Page exists; likely not backed by real mentor inventory. | Do not hide; label as upcoming or connect to real data. |
| `/admin/dashboard` | NEEDS_DATA_FIX | Stats and health load; chart copy still uses "neural/performance" style and may overstate operational meaning. | Use plain operational labels and real time-series. |
| `/admin/jobs` | READY | Admin jobs table is functional. | Add data-quality badges for source, duplicate, and freshness. |
| `/admin/jobs/:id` | NEEDS_UX_COPY | Details page exists; prior QA called out admin job details as needing review. | Verify dark-mode contrast and all optional job fields; make missing fields explicit. |
| `/admin/users` | READY | Admin users table loads. | Add role/status filters and safe action confirmations. |
| `/admin/users/:id` | NEEDS_UX_COPY | User details page exists. | Improve audit trail and action clarity. |
| `/admin/sources` | READY | Diagnostics/progress/source metadata improved. | Keep external failures honest and show last-run retention. |
| `/admin/targets` | READY | Target roles can be managed. | Add clearer relationship to Run Extractions. |
| `/profile` as admin | ROLE_MISMATCH | Route allows admin but renders user profile context. | Add admin-aware profile copy or redirect admin to settings/admin profile. |

Cross-page UX findings:

- Protected pages correctly redirect unauthenticated users to `/login`.
- Admin/user role state should be retested after logout/login transitions to ensure nav/footer never shows stale admin links.
- Mobile responsiveness had prior coverage, but chart-heavy pages should get a final small-screen pass before presentation.
- Remaining lint hook warnings should be treated as a P1 frontend reliability item.

## CV Upload And AI Analyzer Audit

| Scenario | Current behavior | Risk | Recommendation |
| --- | --- | --- | --- |
| Valid English PDF | Works in tests and prior browser QA; profile/skills/CV analysis persist. | Low. | Keep demo sample CV ready. |
| Invalid file type | Laravel request validation should reject. | Medium if frontend message is generic. | Add browser/API tests for visible validation copy. |
| Oversized file | Request validation should reject based on configured limits. | Medium. | Add explicit max-size copy and tests. |
| Corrupted PDF | AI/backend can return structured failure or 500 depending failure point. | Medium. | Add fixture test and user-friendly "unreadable file" state. |
| Image CV | OCR fallback is supported and surfaced. | Medium due OCR accuracy. | Add scanned image fixture and show confidence warning. |
| Scanned/image-only PDF | OCR fallback likely. | Medium. | Test with synthetic scanned PDF before demo. |
| Arabic CV | Not proven in current tests. | Medium for local audience. | Add Arabic fixture and define expected extraction limitations. |
| AI timeout | Analyzer returns structured timeout; frontend recovery/polling exists. | Low/medium. | Move to fully async job status later. |
| AI partial result | Structured status/warnings exist. | Medium. | Keep partial data honest; avoid "success" wording for degraded parsing. |
| No skills extracted | Existing skills are preserved and warning logged/shown. | Low. | Keep regression test. |
| Repeated upload | Replaces analysis/profile data, preserves skills when extraction empty. | Medium. | Add browser regression for repeated upload and old CV cleanup. |
| Signed download URL | Signed download URL endpoint exists. | Medium. | Test expiry, authorization, and missing-file behavior. |
| Storage cleanup/retention | Config has retention days; full cleanup behavior needs proof. | Medium. | Add scheduled cleanup test and docs. |
| Skill sync | Comma/semicolon splitting and canonicalization exist. | Low. | Expand canonical skill dictionary gradually. |
| Profile update | Structured profile/experience/skills persist. | Low. | Add diff/preview before overwriting user-entered data in future. |
| Gap analysis after CV | Works with relational skills and AI/DB fallback. | Low. | Add browser test for AI unavailable fallback. |

AI analyzer findings:

- The 3-layer analyzer is structurally strong for a graduation system: extraction, classification, and matching are separated.
- `_error_result`, timeout handling, and TF-IDF fallback have been hardened in earlier PRs.
- The current analyzer should not be marketed as empirically accurate without evaluation.
- Model-heavy container startup and first-run latency remain important demo risks.
- CORS is permissive inside the AI service; acceptable for internal Docker, not ideal if ever exposed.

AI dataset and evaluation plan:

- Use O*NET and ESCO for standardized occupation/skill taxonomies.
- Add a curated resume/CV benchmark with manually labeled skills, seniority, domain, and role.
- Add multilingual fixtures, especially Arabic and mixed Arabic/English CVs.
- Track extraction precision/recall/F1 for skills, role prediction accuracy/top-k accuracy, seniority classification accuracy, and gap-analysis agreement against labeled job requirements.
- Add confidence calibration before using AI scores for high-stakes recommendations.
- Keep synthetic data for smoke tests, but do not use it as proof of model quality.

## Scraping Audit

Current intended behavior:

- Diagnostics tests all active sources with fixed query `Software`.
- Single Source Test tests the selected source.
- Run Extractions preflights active sources and dispatches runnable active sources across active target roles.
- Sources that need credentials, adapters, proxy, or external access are not faked as success.

| Source | Adapter exists | Credentials needed | Proxy needed | Current diagnostic expectation | Data quality | Reliability plan |
| --- | --- | --- | --- | --- | --- | --- |
| CareerCompass Demo Jobs | Yes | No | No | SUCCESS | Deterministic demo jobs; reliable but not real market data. | Keep active for demo pipeline proof. |
| Remotive | Yes | No | No | SUCCESS or honest API failure | Good remote job fields/tags. | Keep as primary live no-auth API source. |
| RemoteOK | Yes | No | No | SUCCESS or honest rate-limit/block | Good remote API data; may include metadata rows. | Keep and monitor rate limits. |
| Arbeitnow | Yes | No | No | SUCCESS or honest API failure | Good broad API data, filtered locally. | Keep and evaluate relevance. |
| Adzuna | Yes | Yes | No | SUCCESS when local env has credentials; CONFIG_REQUIRED otherwise. | Strong structured API data. | Keep credentials local/secret; document setup. |
| LinkedIn | Spider-backed | No login allowed | Optional/likely | External/proxy failures are expected. | High value but high blocking risk. | Do not rely on for demo; prefer official/partner alternatives. |
| Indeed | Source-specific public parser | No login allowed | Maybe | EXTERNAL_BLOCKED/FAILED likely. | Potentially useful if public page loads. | No CAPTCHA/login bypass; consider official alternatives. |
| Upwork | Source-specific public parser | No login allowed | Maybe | EXTERNAL_BLOCKED/FAILED likely. | Useful freelance data if public page loads. | No login scraping; consider API/partner/feed alternatives. |
| Wuzzuf | HTML parser | No | No | May block or change markup. | Important for Egypt/local relevance. | Keep fixture tests; add legal/robots review and parser maintenance. |

Scraping risks:

- External sites can block scraping, change markup, rate-limit, or require CAPTCHA/login.
- Proxy usage can fail and should never become infinite retry behavior.
- Source diagnostics can create real import records; idempotent import and redaction are now in main via PR #84.
- Data quality varies widely by source; user-facing job pages should expose source/freshness and avoid implying all jobs are equally verified.
- Run Extractions can create many jobs quickly; queue monitoring and rate limiting need production tuning.

Ethical/legal recommendations:

- Prefer public APIs, official feeds, partner integrations, or user-provided job URLs.
- Do not add credentialed scraping for LinkedIn/Indeed/Upwork.
- Do not add CAPTCHA bypass or stealth anti-bot behavior.
- Add a source policy document before production.

## P0 Issues Before Graduation

1. Final browser demo script and seed data
   - Prepare a deterministic demo route: demo/Remotive/Adzuna if credentials are present.
   - Avoid relying on LinkedIn/Indeed/Upwork live success.

2. Dashboard/admin chart honesty
   - Remove or relabel any chart/value that looks like real analytics but is derived, static, or placeholder.
   - Files likely: `frontend/src/pages/user/Dashboard.jsx`, `frontend/src/pages/user/MarketIntelligence.jsx`, `frontend/src/pages/admin/AdminDashboard.jsx`.

3. Placeholder page copy
   - Keep `/tools`, `/cv-builder`, `/mock-interview`, `/learning`, `/career-planner`, `/mentorship`, but label incomplete flows honestly.
   - Do not hide pages.

4. Admin profile role mismatch
   - `/profile` for admin should not look like a normal student profile without explanation.
   - Add admin-aware copy or route behavior.

5. CV edge-case browser messages
   - Verify invalid, oversized, corrupted, scanned, Arabic, timeout, and no-skill states show honest messages.

6. Scraping presentation guardrails
   - Admin Sources should clearly separate "pipeline works" from "external source blocked".
   - Keep source-level classifications visible.

7. Old failed queue entry
   - Investigate or clear only with documented operator action. Do not silently ignore it during final presentation.

## P1 Issues Before Production

1. Production Docker separation
   - Immutable images, no source bind mounts, no default secrets, TLS, restricted ports, managed backups.

2. Secrets management
   - Replace default tokens/passwords with mandatory secrets, secret manager, and startup validation.

3. Async CV processing
   - Convert synchronous upload to background job + status polling + cancellation/retry semantics.

4. Upload security
   - Add file signature validation, malware scan integration, content limits, retention job tests, and signed URL authorization tests.

5. API versioning strategy
   - Keep `/api/v1` canonical; deprecate unversioned `/api` with headers and docs.

6. Authorization and audit trail
   - Add tests and policies for every admin mutation and internal scraper route.

7. Queue/worker operations
   - Add queue lag metrics, worker memory alerting, scheduler heartbeat, and failed-job runbook.

8. Observability
   - Expand Prometheus metrics, structured log aggregation, request ID propagation, and redaction tests.

9. Scraping compliance and reliability
   - Prefer official APIs/feeds; add robots/legal review; add source health SLA dashboard.

10. AI evaluation
   - Build labeled datasets and publish metrics before claiming accuracy.

## P2 Future Improvements

- Multi-language CV benchmarks and UI localization QA.
- User-facing source/freshness quality indicators for jobs.
- Resume diff preview before overwriting profile data.
- More granular application tracker lifecycle.
- Role/skill ontology backed by ESCO/O*NET.
- Self-hosted CI runner for heavy full-stack Docker smoke.
- Feature flags for preview pages.
- Admin audit log and rollback UI for destructive actions.
- Real production data retention and deletion workflow.

## Proposed PR Breakdown

### PR 1: Frontend UX, pages, dashboards, admin profile, footer

Goal: Improve demo honesty and UX without removing pages.

Likely files:

- `frontend/src/pages/user/Dashboard.jsx`
- `frontend/src/pages/user/MarketIntelligence.jsx`
- `frontend/src/pages/user/Profile.jsx`
- `frontend/src/pages/admin/AdminDashboard.jsx`
- `frontend/src/pages/admin/AdminJobDetails.jsx`
- `frontend/src/pages/user/ToolsHub.jsx`
- `frontend/src/pages/user/CVBuilder.jsx`
- `frontend/src/pages/user/MockInterview.jsx`
- `frontend/src/pages/user/LearningPaths.jsx`
- `frontend/src/pages/user/CareerPlanner.jsx`
- `frontend/src/pages/user/Mentorship.jsx`
- `frontend/src/components/Footer.jsx`
- `frontend/src/locales/en.json`

Tests:

- `npm run lint`
- `npm run build`
- Browser pass for all public/user/admin pages.
- Mobile breakpoint spot-check.

### PR 2: CV upload and AI reliability

Goal: Harden upload edge cases and AI status handling; no model training.

Likely files:

- `backend-api/app/Http/Requests/CvUploadRequest.php`
- `backend-api/app/Http/Controllers/Api/CvController.php`
- `backend-api/app/Services/CvProcessingService.php`
- `backend-api/app/Services/CvStorageService.php`
- `frontend/src/pages/user/Dashboard.jsx`
- `frontend/src/pages/user/Profile.jsx`
- `ai-cv-analyzer/main.py`
- `ai-cv-analyzer/tests/test_service_api.py`
- `backend-api/tests/Feature/CvUploadTest.php`

Tests:

- Backend CV upload feature tests.
- AI service API tests if test dependencies are available.
- Invalid/oversized/corrupted/scanned/Arabic fixture tests.
- Browser CV upload smoke.

### PR 3: Scraping real source reliability and data quality

Goal: Improve source quality, diagnostics clarity, and run-extraction guardrails without faking external success.

Likely files:

- `ai-job-miner/service_api.py`
- `ai-job-miner/ai_job_miner/*`
- `ai-job-miner/tests/test_service_api.py`
- `backend-api/app/Services/ScraperClient.php`
- `backend-api/app/Http/Controllers/Api/Admin/ScrapingSourceController.php`
- `backend-api/app/Http/Controllers/Api/Admin/TargetJobRoleController.php`
- `backend-api/app/Http/Controllers/Api/ScrapedJobController.php`
- `backend-api/database/seeders/ScrapingSourceSeeder.php`
- `frontend/src/pages/admin/AdminSources.jsx`
- `frontend/src/pages/admin/AdminJobs.jsx`
- `docs/SCRAPING_CREDENTIALS.md`

Tests:

- Backend scraping orchestrator tests.
- ai-job-miner adapter tests.
- Admin Sources browser diagnostics.
- Run Extractions with demo/API sources.
- Queue failed/pending checks.

### PR 4: Docker, config, health, API production readiness

Goal: Turn production-style local Docker into a safer deployment baseline.

Likely files:

- `docker-compose.yml`
- `docker-compose.prod.yml`
- `docker/nginx/conf.d/default.conf`
- `.env.example`
- `backend-api/.env.example`
- `ai-job-miner/.env.example`
- `backend-api/config/*.php`
- `backend-api/routes/api.php`
- `backend-api/app/Http/Controllers/Api/HealthController.php`
- `backend-api/app/Http/Controllers/Api/MetricsController.php`
- `docs/PRODUCTION_READINESS.md`
- `docs/DOCKER_QUICKSTART.md`

Tests:

- Compose config validation.
- Full Docker health sweep.
- Metrics auth tests.
- Route/middleware policy tests.
- Manual verification that no destructive Docker commands are needed.

### PR 5: AI dataset and evaluation plan after graduation

Goal: Build evidence for model accuracy after the graduation demo.

Likely files:

- `ai-cv-analyzer/training/*`
- `ai-cv-analyzer/tests/fixtures/*`
- `ai-cv-analyzer/docs/*`
- `docs/AI_EVALUATION_PLAN.md`

Tests:

- Offline evaluation scripts.
- Labeled CV/JD fixture benchmark.
- Skill extraction precision/recall.
- Role/seniority/domain accuracy.

## Manual Browser Validation Plan

Before the final graduation presentation, run:

1. Public pages:
   - `/`, `/about`, `/privacy`, `/terms`, `/status`, `/login`, `/register`, 404.
2. Auth:
   - invalid register, valid register, wrong login, correct login, logout.
3. User flow:
   - dashboard, CV upload, profile, settings, jobs, applications, gap analysis, market.
4. Placeholder routes:
   - tools, CV builder, mock interview, learning, career planner, mentorship.
5. Admin:
   - dashboard, jobs, job details, users, user details, sources, targets.
6. Scraping:
   - Diagnostics All, single source test, Run Extractions with demo/API source success and external blocked source honesty.
7. Responsive:
   - Home, dashboard, jobs, admin sources, market charts on mobile width.
8. Logs/queues:
   - `php artisan queue:failed`
   - ready job count
   - backend/scraper/AI logs tail.

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| External scraping blocked during demo | High | Medium | Use demo/API sources as primary demo path; explain blocked sources honestly. |
| AI cold start delays CV upload | Medium | Medium | Prewarm before demo; keep recovery copy visible; plan async upload. |
| Default local secrets used outside laptop | Medium | High | Mandatory production secret validation. |
| Placeholder pages overpromise | Medium | Medium | Add honest preview copy, do not remove pages. |
| Chart values look more precise than data supports | Medium | Medium | Label derived values; use real aggregations. |
| Duplicate API route surfaces drift | Medium | Medium | Document `/api/v1` canonical and deprecate `/api`. |
| Upload security insufficient for real production | Medium | High | Add AV scanning, content sniffing, retention tests. |
| Queue failures are missed | Medium | High | Add queue alerting and runbook. |
| AI accuracy claims unsupported | High | High | Build real evaluation before marketing claims. |

## Non-Goals For This Pass

- No new features.
- No page removal.
- No page hiding.
- No broad frontend rewrite.
- No model training.
- No CAPTCHA bypass, stealth scraping, or login scraping.
- No real secrets in Git.
- No Docker volume deletion or destructive Docker cleanup.
- No production launch claim.

## Secret And Artifact Safety

- `.env` files were not staged.
- No secrets were added to tracked files.
- No uploaded CVs, screenshots, videos, `node_modules`, `vendor`, `dist`, logs, or runtime artifacts were staged.
- Real Adzuna credentials remain local-only and are not included here.
