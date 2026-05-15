# Frontend UX Polish Review

Date: 2026-05-16
Branch: `fix/frontend-ux-dashboards-role-polish`
Scope: Frontend UX/pages/dashboards/admin profile/footer/admin job details polish after `docs/PROJECT_HARDENING_AUDIT.md`.

## Audit Scope

Public pages reviewed:

- `/`
- `/about`
- `/privacy`
- `/terms`
- `/status`
- `/login`
- `/register`
- `404`

User pages reviewed:

- `/dashboard`
- `/profile`
- `/settings`
- `/jobs`
- `/applications`
- `/gap-analysis/:jobId`
- `/market`
- `/tools`
- `/cv-builder`
- `/mock-interview`
- `/learning`
- `/career-planner`
- `/mentorship`

Admin pages reviewed:

- `/admin/dashboard`
- `/admin/jobs`
- `/admin/jobs/:id`
- `/admin/users`
- `/admin/users/:id`
- `/admin/sources`
- `/admin/targets`
- `/profile` while logged in as admin

## Page Classification

| Page | Classification | Notes |
| --- | --- | --- |
| Public pages | READY | No removal or broad redesign needed in this PR. |
| `/dashboard` | NEEDS_DATA_LABELS | Profile score and recommendation copy needed clearer source context. |
| `/profile` user | READY | Kept existing job-seeker profile behavior. |
| `/profile` admin | ROLE_MISMATCH | Fixed with admin-specific account profile and quick links. |
| `/market` | NEEDS_DATA_LABELS | Clarified imported-job data source and derived chart limitations. |
| `/admin/dashboard` | NEEDS_DATA_LABELS | Replaced pseudo-telemetry wording with imported-job and scraping-progress labels. |
| `/admin/jobs/:id` | BROKEN | Hardened data unwrapping and field mapping for imported jobs. |
| `/tools` | PREVIEW_BUT_KEEP | Copy now marks tools as previews. |
| `/cv-builder` | PREVIEW_BUT_KEEP | Removed personal sample data and clarified local draft-only behavior. |
| `/mock-interview` | PREVIEW_BUT_KEEP | Clarified that scoring/camera analysis is illustrative. |
| `/learning` | PREVIEW_BUT_KEEP | Changed fake progress stats into preview placeholders. |
| `/career-planner` | PREVIEW_BUT_KEEP | Reworded roadmap as illustrative until generated from user data. |
| `/mentorship` | PREVIEW_BUT_KEEP | Marked sample mentors and disabled live booking. |

## Issues Found

1. Admin users saw the same CV/career profile UI as job-seeker users.
2. Footer links were not role-aware and could show irrelevant CTAs.
3. Admin job details assumed fields such as `salary` and `type`, while imported jobs may expose `salary_range`, `job_type`, `work_type`, `source`, JSON `skills`, and relation-backed skill fields.
4. Admin dashboard chart copy implied fake operational signal strength instead of actual imported job history.
5. Market page did not clearly explain that charts are derived from imported job records, not complete real-time labor-market telemetry.
6. Preview pages used confident copy or fake metrics that could be mistaken for production functionality.

## Fixes Made

- Added role-aware footer links for guests, normal users, and admins.
- Added an admin-specific `/profile` view with safe name/email editing, role/status metadata, capability summary, and admin quick links.
- Hardened `/admin/jobs/:id` to load nested or flat API payloads, tolerate missing fields, map imported job fields, show skills/requirements, and surface friendly error states.
- Clarified admin dashboard chart and manual scraping batch labels.
- Clarified dashboard profile score and recommendation context.
- Clarified `/market` as imported-job insight with honest empty states and CTAs.
- Reworded Tools Hub and preview pages so they remain available without pretending unfinished functionality is live.
- Disabled or labeled non-functional actions such as preview booking, preview report download, and planned add-section controls.

## Deferred

- No backend API changes were made.
- No new chart endpoints were added.
- Preview pages still need real persistence, scoring, or integrations in later PRs.
- Full accessibility audit and complete Arabic copy review remain future work.

## Validation Notes

- Docker config validation passed.
- Baseline backend suite passed before frontend changes: `php artisan test` reported 24 tests / 163 assertions.
- Frontend lint/build passed in a disposable Node container:
  - `npm run lint`: 0 errors, 9 pre-existing warnings outside this PR's touched files.
  - `npm run build`: passed.
- `git diff --check` passed.
- Rebuilt only the affected `frontend` service with production compose overrides.
- Health checks passed after rebuild:
  - `http://localhost`
  - `http://localhost/api/health`
  - `http://localhost/api/ready`
  - `http://localhost/api/v1/health`
  - `http://localhost:8003/health`
- Browser spot checks passed for public pages and protected-route redirects:
  - `/`
  - `/about`
  - `/privacy`
  - `/terms`
  - `/status`
  - `/market` redirects to `/login` when logged out.
  - `/admin/jobs/1` redirects to `/login` when logged out.
- Authenticated admin browser validation was limited because the browser automation input bridge failed on email/password fields. Admin job-list/job-detail response shape was validated through the authenticated API instead, confirming the detail response includes title, company, and source fields.
- Browser console logs retained old 401 admin-dashboard errors from a previous unauthenticated admin visit before this branch's rebuild; no blocking public-page load failure was observed during the fresh spot checks.
