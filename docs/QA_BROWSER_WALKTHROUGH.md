# Browser QA Walkthrough

## Test Environment

- Branch: `qa/full-browser-walkthrough`
- Base commit: `cabb127` (`main`, after PR #77)
- Date/time: 2026-05-14, Africa/Cairo
- Docker command used: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`
- Migration command: `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan migrate --force --no-interaction`
- Browser target: `http://localhost/`
- Method: Playwright-driven browser walkthrough using local Chrome, plus in-app browser checks, API fallback checks, Docker logs, and queue inspection.
- Synthetic CV: generated outside the repository under the local temp directory and not committed.

## Service Status

All required health endpoints responded successfully during startup and final validation:

| Endpoint | Result |
| --- | --- |
| `http://localhost` | 200 |
| `http://localhost/api/health` | 200 |
| `http://localhost/api/ready` | 200 |
| `http://localhost/api/v1/health` | 200 |
| `http://localhost:8000/` | 200 |
| `http://localhost:8003/health` | 200 |
| `http://localhost:9090/-/ready` | 200 |
| `http://localhost:3000/api/health` | 200 |
| `http://localhost:9000/minio/health/live` | 200 |

`docker compose ps` showed backend API, workers, scheduler, frontend, nginx, MySQL, AI CV analyzer, AI job miner, MinIO, Prometheus, and Grafana running. Application containers reported healthy.

## Accounts And Data

- Test user pattern: `e2e.browser.<timestamp>@gmail.com`.
- Passwords: disposable local credentials only, not recorded here.
- Admin: existing local seeded admin was used for admin page authorization checks.
- Test CV: synthetic PDF with Backend Laravel Developer content, including PHP, Laravel, MySQL, Docker, React, JavaScript, and REST APIs.
- Test scraping queries: low-risk obscure queries such as `zzzz-v1-poll-url-<timestamp>` with `max_results=1`.
- No real `.env` files, uploaded CVs, screenshots, videos, or generated browser artifacts were committed.

## Coverage Summary

### Public Pages

Checked:

- `/`
- `/about`
- `/privacy`
- `/terms`
- `/status`
- `/login`
- `/register`
- `/not-a-real-route`

Coverage:

- Page load and basic layout.
- Navbar and footer navigation.
- Theme and language controls.
- Mobile-sized viewport pass.
- Empty and invalid auth form states.
- 404 route behavior.
- Console and failed-network capture.

### Auth

Checked:

- Register with invalid email domain.
- Register with valid disposable Gmail-pattern test user.
- Login with wrong password.
- Login with correct password.
- Logout.
- Protected route redirect when logged out.
- Normal user cannot access admin route.

### User Pages

Checked:

- `/dashboard`
- `/profile`
- `/settings`
- `/applications`
- `/tools`
- `/cv-builder`
- `/mock-interview`
- `/learning`
- `/career-planner`
- `/mentorship`

Coverage:

- Page load.
- Visible tabs and primary buttons where safe.
- Empty states.
- Settings profile save.
- Settings skills tab rendering and save.
- CV upload from real UI file input.
- Dashboard/profile update after CV upload.

### Jobs, Recommendations, And Gap Analysis

Checked:

- `/jobs`
- `/gap-analysis/11`
- `/market`

Coverage:

- Recommended jobs load.
- Search with normal query.
- Search with no-result query.
- Clear/replace search.
- Save opportunity.
- Job detail panel.
- Gap analysis navigation.
- Match percentage, matched skills, missing skills, and recommendations.
- Market overview cards/charts.

### Scraping

The visible Jobs page exposes normal search, not a direct scrape/import button. Scraping lifecycle was therefore verified through the authenticated API fallback:

- `POST /api/v1/jobs/scrape-if-missing`
- `GET /api/v1/scraping-status/{jobId}`
- Backend worker logs.
- AI job miner logs.

Result: lifecycle completed from `pending` to `processing` to `completed`. The obscure test query returned zero imported jobs and one failed external URL, which is acceptable for a no-result/external-site-limited scrape test.

### Admin

Checked:

- `/admin/dashboard`
- `/admin/jobs`
- `/admin/users`
- `/admin/sources`
- `/admin/targets`

Coverage:

- Admin login.
- Page load.
- Dashboard health/cards.
- Jobs/users tables.
- Sources and target roles tables.
- Normal user admin access denial.
- Destructive actions were not executed against non-disposable data.

## Issues Found

| ID | Severity | Area | Title | Status |
| --- | --- | --- | --- | --- |
| ISSUE-001 | minor | public home | GSAP animation target warnings on home load | needs follow-up |
| ISSUE-002 | major | auth | Auth validation errors hid backend field detail | fixed |
| ISSUE-003 | major | dashboard | Dashboard showed `0 skills detected` after successful CV upload | fixed |
| ISSUE-004 | major | settings | Settings save sent schema-incompatible profile payload | fixed |
| ISSUE-005 | major | settings | Skills tab rendered skill objects as React children | fixed |
| ISSUE-006 | major | jobs | Jobs page crashed rendering object-shaped gap skills | fixed |
| ISSUE-007 | major | gap analysis | Gap analysis crashed because target roles response was not normalized | fixed |
| ISSUE-008 | major | admin | Admin dashboard called missing `getAdminBatchProgress` API method | fixed |
| ISSUE-009 | UX | jobs | Empty job search left stale previous job detail visible | fixed |
| ISSUE-010 | minor | scraper API | v1 scrape response returned legacy `/api` poll URL | fixed |
| ISSUE-011 | minor | charts | Recharts width/height warning appears on chart pages | needs follow-up |
| ISSUE-012 | UX | footer | Social footer links point to `#` placeholders | needs follow-up |
| ISSUE-013 | UX | terms | Terms copy contains typo: `updates these terms` | needs follow-up |
| ISSUE-014 | UX | status | Status page presents a static timestamp under live status wording | needs follow-up |
| ISSUE-015 | minor | AI extraction | One synthetic CV run normalized `PHP, LARAVEL` as one skill label | needs follow-up |

## Detailed Issues

### ISSUE-001: GSAP Animation Target Warnings On Home Load

- Severity: minor
- Area: public home
- URL: `http://localhost/`
- Steps to reproduce:
  1. Open `http://localhost/`.
  2. Wait for the home page to finish loading.
  3. Inspect browser console warnings.
- Expected: Home page loads without missing animation target warnings.
- Actual: Browser console reports GSAP target warnings for missing selectors.
- Console errors:
  - `GSAP target .cc-skill-chip not found. https://gsap.com`
  - `GSAP target  not found. https://gsap.com`
- Network errors: none observed.
- Suggested fix: Guard animation setup so GSAP only targets elements that exist, or update selectors to match the rendered home page.
- Status: needs follow-up

### ISSUE-002: Auth Validation Errors Hid Backend Field Detail

- Severity: major
- Area: auth/register and auth/login
- URL: `http://localhost/register`, `http://localhost/login`
- Steps to reproduce:
  1. Register with an unsupported email domain.
  2. Login with a wrong password.
- Expected: The UI shows useful backend validation messages.
- Actual: The UI showed only `The given data was invalid.`.
- Console errors:
  - Expected 422s from invalid form submissions.
- Network errors:
  - `POST /api/v1/register` => 422
  - `POST /api/v1/login` => 422
- Fix: Login and Register now extract the first field-level validation message from `error.response.data.errors` before falling back to the generic message.
- Files changed:
  - `frontend/src/pages/Login.jsx`
  - `frontend/src/pages/Register.jsx`
- Retest: invalid register now shows the email-domain validation detail; wrong login now shows the credential-specific message.
- Status: fixed

### ISSUE-003: Dashboard Showed Zero Skills After Successful CV Upload

- Severity: major
- Area: dashboard/CV upload
- URL: `http://localhost/dashboard`
- Steps to reproduce:
  1. Register/login as a test user.
  2. Upload a synthetic CV from the UI.
  3. Wait for successful parsing.
- Expected: Dashboard skill count matches extracted profile skills.
- Actual: Dashboard showed `0 skills detected` while Profile showed extracted skills.
- Root cause: Dashboard expected `response.data.data` to be an array, but the backend returns a structured object containing a `skills` array.
- Fix: Dashboard now unwraps either array payloads or `payload.skills`.
- File changed:
  - `frontend/src/pages/user/Dashboard.jsx`
- Retest: dashboard showed `9 skills detected` after CV upload.
- Status: fixed

### ISSUE-004: Settings Save Sent Schema-Incompatible Profile Payload

- Severity: major
- Area: settings/profile
- URL: `http://localhost/settings`
- Steps to reproduce:
  1. Open Settings.
  2. Click `Commit All Changes`.
- Expected: Profile update succeeds.
- Actual: `PUT /api/v1/user/profile` returned 422.
- Root cause: frontend omitted required `email` and sent `headline` without the backend-compatible `job_title` field.
- Fix: Settings profile save now sends `email` and maps `headline` to `job_title`.
- File changed:
  - `frontend/src/pages/user/Settings.jsx`
- Retest: settings save no longer produced a new profile 422.
- Status: fixed

### ISSUE-005: Settings Skills Tab Rendered Skill Objects As React Children

- Severity: major
- Area: settings/skills
- URL: `http://localhost/settings`
- Steps to reproduce:
  1. Upload a CV that creates relational skills.
  2. Open Settings.
  3. Open the Skills tab.
- Expected: Skill names render as text and can be removed/saved.
- Actual: object-shaped skills could render incorrectly or crash depending on payload shape.
- Fix: Settings now normalizes skill objects/strings to names for rendering, removal, and update payloads.
- File changed:
  - `frontend/src/pages/user/Settings.jsx`
- Retest: skills rendered cleanly and save did not trigger a profile validation error.
- Status: fixed

### ISSUE-006: Jobs Page Crashed Rendering Object-Shaped Gap Skills

- Severity: major
- Area: jobs/recommendations
- URL: `http://localhost/jobs`
- Steps to reproduce:
  1. Upload a CV.
  2. Open Jobs.
  3. Select a job and wait for inline gap data.
- Expected: matched and missing skills render as names.
- Actual: React Error Boundary displayed `SYSTEM_HALT` with minified React error #31 for an object child.
- Root cause: `gapData.matched_skills` and `gapData.critical_skills` can contain skill objects, but the page rendered them directly.
- Fix: Jobs now uses a `skillLabel()` helper for object/string skill payloads.
- File changed:
  - `frontend/src/pages/user/Jobs.jsx`
- Retest: Jobs page no longer crashed and the detailed gap report button became visible.
- Status: fixed

### ISSUE-007: Gap Analysis Crashed Because Target Roles Response Was Not Normalized

- Severity: major
- Area: gap analysis
- URL: `http://localhost/gap-analysis/11`
- Steps to reproduce:
  1. Navigate from Jobs to the detailed report.
- Expected: Gap analysis renders role selector and analysis.
- Actual: Error boundary showed `SYSTEM_HALT` and `g.map is not a function`.
- Root cause: target roles API response was stored as an enveloped object instead of an array.
- Fix: GapAnalysis now unwraps `res.data.data ?? res.data` and stores an array only.
- File changed:
  - `frontend/src/pages/user/GapAnalysis.jsx`
- Retest: gap analysis rendered match score, matched skills, missing skills, and recommendations without crashing.
- Status: fixed

### ISSUE-008: Admin Dashboard Called Missing Batch Progress API Method

- Severity: major
- Area: admin/dashboard
- URL: `http://localhost/admin/dashboard`
- Steps to reproduce:
  1. Login as local admin.
  2. Open admin dashboard.
  3. Inspect console.
- Expected: no method errors.
- Actual: console error: `getAdminBatchProgress is not a function`.
- Fix: Added `getAdminBatchProgress` alias to the existing batch progress endpoint.
- File changed:
  - `frontend/src/api/endpoints.js`
- Retest: admin dashboard loaded without the missing-method error.
- Status: fixed

### ISSUE-009: Empty Job Search Left Stale Previous Job Detail Visible

- Severity: UX
- Area: jobs/search
- URL: `http://localhost/jobs`
- Steps to reproduce:
  1. Open Jobs with an existing selected job.
  2. Search for an obscure no-result query.
- Expected: list shows no results and detail pane asks the user to select a result.
- Actual: list showed `MANIFEST [0]`, but the right detail pane still showed the previously selected job.
- Fix: Jobs now clears `selectedJob` and `gapData` when the fetched result list is empty; it also switches selection when the current selected job is absent from the new result set.
- File changed:
  - `frontend/src/pages/user/Jobs.jsx`
- Retest: no-result search showed `Initialization Required` instead of stale job details.
- Status: fixed

### ISSUE-010: v1 Scrape Response Returned Legacy Poll URL

- Severity: minor
- Area: scraping API
- URL: `POST /api/v1/jobs/scrape-if-missing`
- Steps to reproduce:
  1. Trigger the v1 scrape-if-missing endpoint.
  2. Inspect `poll_url`.
- Expected: v1 request returns a v1 polling URL.
- Actual: response returned `http://localhost/api/scraping-status/{id}`.
- Fix: controller now returns `api.v1.scraping.status` when the request path is under `/api/v1`.
- File changed:
  - `backend-api/app/Http/Controllers/Api/JobController.php`
- Retest: response returned `http://localhost/api/v1/scraping-status/12`.
- Status: fixed

### ISSUE-011: Recharts Width/Height Warning On Chart Pages

- Severity: minor
- Area: charts/market/gap analysis
- URL: `http://localhost/market`, `http://localhost/gap-analysis/11`
- Actual: console warning:
  - `The width(-1) and height(-1) of chart should be greater than 0...`
- Impact: non-blocking; charts/pages still rendered.
- Suggested fix: give chart containers stable min dimensions before mounting `ResponsiveContainer`.
- Status: needs follow-up

### ISSUE-012: Footer Social Links Are Placeholders

- Severity: UX
- Area: footer
- URL: public and authenticated pages
- Actual: social/footer support-style links point to `#` or placeholder destinations.
- Suggested fix: replace with real links, hide unavailable social links, or label them as unavailable.
- Status: needs follow-up

### ISSUE-013: Terms Copy Typo

- Severity: UX
- Area: legal copy
- URL: `http://localhost/terms`
- Actual: terms text contains `reserve the right to updates these terms`.
- Suggested fix: change to `reserve the right to update these terms`.
- Status: needs follow-up

### ISSUE-014: Status Page Uses Static Timestamp Under Live Wording

- Severity: UX
- Area: status
- URL: `http://localhost/status`
- Actual: page says live status but displays `As of April 6, 2026 at 18:00 UTC`.
- Suggested fix: bind status page to live health data timestamp or reword as sample/status overview.
- Status: needs follow-up

### ISSUE-015: Synthetic CV Skill Extraction Produced One Combined Skill Label

- Severity: minor
- Area: AI extraction/data quality
- URL: dashboard/profile after CV upload
- Actual: one run displayed `PHP, LARAVEL` as a single skill label.
- Impact: non-blocking; most extracted skills were normalized properly, but comma-separated skill text can occasionally survive as one label.
- Suggested fix: split obvious comma-delimited skill labels during post-processing before skill sync.
- Status: needs follow-up

## Issues Fixed In This Branch

Files changed:

- `backend-api/app/Http/Controllers/Api/JobController.php`
- `frontend/src/api/endpoints.js`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Register.jsx`
- `frontend/src/pages/user/Dashboard.jsx`
- `frontend/src/pages/user/GapAnalysis.jsx`
- `frontend/src/pages/user/Jobs.jsx`
- `frontend/src/pages/user/Settings.jsx`

Fixed:

- Auth forms now show useful backend validation details.
- Dashboard now reads the structured skills response correctly.
- Settings profile save sends backend-compatible fields.
- Settings skills UI normalizes object/string skill payloads.
- Jobs inline gap summary no longer renders objects directly.
- Jobs empty search clears stale detail state.
- Gap analysis role selector normalizes target role response.
- Admin dashboard batch progress call resolves to the existing endpoint.
- v1 scraping responses now return v1 polling URLs.

## Issues Not Fixed

Remaining follow-ups:

- Home GSAP selector warnings.
- Recharts sizing warnings.
- Placeholder footer/social links.
- Terms typo.
- Static timestamp on Status page.
- Occasional comma-delimited skill label from AI extraction.
- Jobs page has no visible direct scrape button for normal users; scraping is currently verified through API/admin flows.

These are non-blocking for the main demo flow, but they should be cleaned before a polished final presentation.

## Console And Network Errors

Expected during negative auth tests:

- `POST /api/v1/register` => 422
- `POST /api/v1/login` => 422

Fixed console errors:

- React error #31 on Jobs.
- `g.map is not a function` on Gap Analysis.
- `getAdminBatchProgress is not a function` on Admin Dashboard.
- Settings `PUT /api/v1/user/profile` 422 caused by missing frontend payload fields.

Remaining console warnings:

- GSAP missing target warnings on Home.
- Recharts width/height warning on chart pages.

No final retest network failures were observed outside deliberate invalid-form checks.

## Queue And Log Findings

- Pending ready jobs: `0`.
- Failed jobs: one pre-existing failed queued closure from `2026-05-13 11:19:31`; it was not created by this QA pass and was not cleared.
- Scraper smoke:
  - `POST /api/v1/jobs/scrape-if-missing` returned 202.
  - Polling showed `processing` then `completed`.
  - Final result for obscure query: `jobs_found=0`, `jobs_stored=0`, `failed_count=1`.
  - Backend scraping worker completed the job in about 14-16 seconds.
- AI CV analyzer logs showed successful CV parse and hybrid match requests.
- AI job miner logs showed health/metrics calls and successful `/scrape` service calls.
- Frontend nginx logs showed normal 200 route handling; the read-only nginx config startup notice is from the unprivileged image entrypoint and did not break service.

## Validation Results

| Check | Result |
| --- | --- |
| `docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet` | passed |
| `docker compose ... up -d` | passed |
| `docker compose ... exec backend-api php artisan migrate --force --no-interaction` | passed, nothing pending |
| `docker compose ... exec backend-api php artisan test` | passed, 16 tests / 107 assertions |
| `npm run lint` | passed with 13 existing warnings |
| `npm run build` | passed |
| `python -m compileall ai-cv-analyzer ai-job-miner` | passed |
| `cd ai-cv-analyzer && python -m pytest -q tests/test_service_api.py` | passed, 6 tests |
| `cd ai-job-miner && python -m pytest -q tests/test_ai.py tests/test_service_api.py` | passed, 53 tests |
| Health endpoint sweep | passed |
| Browser register/login/logout | passed |
| Browser CV upload | passed |
| Dashboard/profile skills display | passed after fix |
| Jobs search/save/detail | passed after fix |
| Gap analysis page | passed after fix |
| Scraping API lifecycle | passed with external no-result limitation |
| Admin dashboard/jobs/users/sources/targets load | passed after fix |

## Final Conclusion

The app is usable end-to-end from `http://localhost/` for the core demo path:

1. Register/login.
2. Upload CV from the UI.
3. See dashboard/profile skills.
4. Browse recommended jobs.
5. Save a job.
6. Open gap analysis.
7. Verify scraping lifecycle through authenticated API.
8. View admin dashboard and management pages with a seeded admin.

Demo readiness: safe for a technical demo after merging this branch, with clear caveats around the remaining visual/UX polish items and the fact that external scraping may return no jobs depending on external site behavior.

Recommended before final project presentation:

1. Fix GSAP and Recharts console warnings.
2. Replace placeholder footer/social links.
3. Correct Terms copy typo.
4. Make Status page timestamp live or reword it.
5. Add a visible user-facing scrape/import control or clearly document that scraping is admin/API-driven.
6. Improve AI skill post-processing for comma-delimited skill labels.
