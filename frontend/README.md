# CareerCompass Frontend

The frontend is the React + Vite browser application for CareerCompass. It provides the public website, authentication screens, user dashboard, CV upload flow, personalized jobs, gap analysis, applications tracker, market intelligence, placeholder career tools, and admin interfaces.

In normal team usage it runs through Docker and Nginx at `http://localhost`. Host-based Vite development is optional.

## Runtime Role

- Render the browser UI for public, authenticated user, and admin flows.
- Use environment-based API URLs rather than hardcoded localhost values.
- Default to `/api/v1` so browser traffic goes through Nginx.
- Store and attach Sanctum bearer tokens.
- Propagate request IDs for backend correlation.
- Recover gracefully from long CV uploads.
- Keep recommendation/search/save/gap-analysis UI state aligned with backend responses.
- Support dark-mode styling and localized text resources.

## Folder Structure

```text
frontend/
|-- src/
|   |-- api/              Axios client and endpoint wrappers
|   |-- components/       Shared UI, route guards, layout, cards, status widgets
|   |-- context/          Auth, theme, and language context providers
|   |-- locales/          Translation JSON files
|   |-- pages/            Public pages
|   |-- pages/user/       Dashboard, jobs, profile, settings, applications, tools
|   |-- pages/admin/      Admin dashboard, jobs, users, sources, target roles
|   |-- App.jsx           Router and page composition
|   `-- main.jsx          React entry point
|-- Dockerfile            Development/container runtime
|-- Dockerfile.prod       Multi-stage production static build
|-- vite.config.js
|-- eslint.config.js
|-- package.json
`-- README.md
```

## Routing

Routes are defined in `src/App.jsx`.

### Public Routes

- `/`: home page.
- `/login`: guest-only login page.
- `/register`: guest-only registration page.
- `/about`: project/about page.
- `/privacy`: privacy page.
- `/terms`: terms page.
- `/status`: public system status page.
- `*`: not-found page.

### Protected User Routes

- `/dashboard`: CV upload and career snapshot.
- `/jobs`: personalized recommendations, job search, job details, save opportunity, gap preview.
- `/gap-analysis/:jobId`: full job gap analysis.
- `/profile`: parsed profile, skills, contact info, experience, AI analysis.
- `/settings`: profile/settings edit flow.
- `/market`: market intelligence charts and sections.
- `/applications`: saved opportunity tracker.
- `/cv-builder`: CV builder area.
- `/mock-interview`: mock interview area.
- `/learning`: learning paths area.
- `/career-planner`: career planning area.
- `/mentorship`: mentorship area.
- `/tools`: tools hub.

Some non-core career-tool pages are intentionally lightweight compared with the CV/jobs/gap/admin flows. If a page is not fully implemented, the UI should make that clear rather than pretending to complete real backend work.

### Admin Routes

- `/admin/dashboard`
- `/admin/jobs`
- `/admin/jobs/:id`
- `/admin/users`
- `/admin/users/:id`
- `/admin/sources`
- `/admin/targets`

`ProtectedRoute` enforces authentication and admin requirements. Normal users should be redirected or blocked from admin content.

## Authentication Flow

Core files:

- `src/context/AuthContext.jsx`
- `src/components/GuestRoute.jsx`
- `src/components/ProtectedRoute.jsx`
- `src/api/client.js`

Flow:

1. Login/register sends credentials to the backend.
2. The backend returns a Sanctum token and user resource.
3. The token is stored client-side and attached as a bearer token by the API client.
4. `refreshUser` calls `/user` to hydrate user/profile/CV/skills state.
5. Logout revokes the token and clears local auth state.

## API Client

`src/api/client.js` builds the base URL from `VITE_API_URL`.

Default Docker value:

```env
VITE_API_URL=/api/v1
```

The client:

- sets `Accept: application/json`;
- attaches the bearer token when present;
- generates `X-Request-ID`;
- keeps a default request timeout of 30 seconds;
- retries appropriate idempotent requests;
- normalizes API errors for frontend display.

CV upload uses a dedicated longer timeout in `src/api/endpoints.js`:

```js
uploadCV: (formData) => apiClient.post('/upload-cv', formData, {
  timeout: 240000,
})
```

Do not globally raise the timeout unless every API request truly needs it.

## Environment Variables

`frontend/.env.example`:

```env
VITE_API_URL=/api/v1
VITE_API_PROXY_TARGET=http://localhost:8000
```

Meaning:

- `VITE_API_URL`: browser API base URL. Keep `/api/v1` for Docker/Nginx.
- `VITE_API_PROXY_TARGET`: Vite development server proxy target. Docker Compose overrides this to `http://nginx` for container networking.

## Dashboard And CV Upload

Main file: `src/pages/user/Dashboard.jsx`.

Current behavior:

- Uploads a CV through the real UI.
- Shows first-run/cold-start guidance.
- Disables duplicate upload attempts while processing.
- Uses a CV-upload-specific timeout.
- If the request times out or encounters a recoverable network/gateway condition, it does not immediately show hard failure.
- It polls the current user/skills briefly and treats a changed `cv_analysis` as recovered success.
- It shows honest final states: success, recovered success, warning/timeout, still checking, or real failure.
- It no longer blindly redirects to `/jobs` after a fixed delay when market discovery starts.

The backend still performs CV upload synchronously. A fully async upload with progress polling remains a future improvement.

## Jobs Page

Main file: `src/pages/user/Jobs.jsx`.

Current behavior:

- When the user is not searching, it calls `jobsAPI.getRecommendedJobs()` (`GET /jobs/recommended`).
- When the user searches, it calls `jobsAPI.getJobs(params)` (`GET /jobs`).
- Recommendation context shows the backend role seed, for example "Your CV title".
- Empty/no-result searches show readable states.
- Match display supports `match_percentage` and `match_score`.
- Gap-analysis requests are guarded so stale responses do not overwrite the currently selected job.
- Duplicate gap analysis for the same selected job is avoided.

## Save Opportunity And Applications

Files:

- `src/pages/user/Jobs.jsx`
- `src/pages/user/Applications.jsx`
- `src/api/applications.js`

Current behavior:

- Jobs page loads current applications on mount.
- Saved job IDs are built from `application.job_id` and fallback job data.
- Saved opportunities render as saved after a page reload.
- First save message: "Opportunity saved to your tracker."
- Duplicate message: "This opportunity is already in your tracker."
- Applications page shows the tracked job.

## Profile

Main file: `src/pages/user/Profile.jsx`.

The profile page displays available backend/AI fields:

- predicted/current role;
- headline and summary;
- primary domain;
- seniority;
- total experience;
- parsing status;
- completeness score;
- contact info from nested `profile.contact_info` and top-level fallback fields;
- skills with confidence/evidence when available;
- experience timeline and technologies;
- CV analysis summary where available.

Avoid adding fake precision or hardcoded metrics. Empty states should say what is missing and how the user can improve the profile.

## Settings

Main file: `src/pages/user/Settings.jsx`.

Settings should keep payloads backend-compatible with `PUT /user/profile`. Profile and skills edits should not fight the CV parsing flow. If adding nested contact or experience editing, align the payload with backend request validation first.

## Gap Analysis

Main file: `src/pages/user/GapAnalysis.jsx`.

Behavior:

- Loads analysis for `/gap-analysis/:jobId`.
- Displays match percentage, matched skills, missing skills, and recommendations.
- Uses stable chart sizing to avoid ResponsiveContainer width/height warnings.
- Handles AI fallback results without crashing.
- Should show a clear upload/profile-needed state if backend returns that the user has no usable CV/profile data.

## Market Intelligence

Main file: `src/pages/user/MarketIntelligence.jsx`.

The market page shows overview, trending skills, role statistics, and demand sections. Chart containers have stable minimum sizes so Recharts does not warn about zero dimensions during loading.

## Admin UI

Admin files:

- `src/pages/admin/AdminDashboard.jsx`
- `src/pages/admin/AdminJobs.jsx`
- `src/pages/admin/AdminJobDetails.jsx`
- `src/pages/admin/AdminUsers.jsx`
- `src/pages/admin/AdminUserDetails.jsx`
- `src/pages/admin/AdminSources.jsx`
- `src/pages/admin/AdminTargets.jsx`

Important behaviors:

- Admin routes require an admin user.
- Sources page Diagnostics tests all active sources with the fixed diagnostic query `Software`.
- Single Source Test checks exactly the selected source, including inactive sources before activation.
- Run Extractions dispatches active scraping sources x active target roles and shows global/per-source progress.
- Source diagnostics now treat scraper failure signals as compromised, even if the lower-level process exits successfully.
- The demo/local source gives a reliable demo path when LinkedIn/proxies or unsupported external sources fail.
- Target roles can be created/toggled/deleted with care.
- Do not delete non-disposable data during demos or QA.

## Internationalization And Direction

Translation files live in `src/locales`.

The app supports language-aware text resources and RTL/LTR layout considerations. When adding copy, update the relevant locale file and check both direction modes if the UI exposes a language toggle.

## Theme

Theme state is managed by frontend context/components. When adding components:

- test both light and dark states;
- avoid unreadable contrast;
- avoid hardcoded colors that ignore the design system;
- keep loading and empty states consistent.

## Docker Usage

From the repository root:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend nginx
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f frontend
```

Open:

```text
http://localhost
```

For a frontend code-only change:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart frontend nginx
```

For dependency or Dockerfile changes:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend nginx
```

The production override uses `Dockerfile.prod`, which builds static Vite assets and serves them through an unprivileged Nginx image.

## Optional Host Development

Only use this if you intentionally want local Vite development:

```bash
cd frontend
npm ci
npm run dev
```

Validation:

```bash
npm run lint
npm run build
```

Docker operation does not require host `node_modules`.

## Available Scripts

- `npm run dev`: start Vite dev server.
- `npm run lint`: run ESLint.
- `npm run build`: create production build.
- `npm run preview`: preview the production build locally.

## Troubleshooting

### Frontend cannot reach backend

Check:

```bash
curl http://localhost/api/v1/health
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f nginx
```

`VITE_API_URL` should normally be `/api/v1`.

### Local Vite proxy fails

Check `VITE_API_PROXY_TARGET`. For local host development it usually points to a host backend URL. In Docker Compose it is overridden to `http://nginx`.

### Production build looks stale

The production Docker image bakes Vite output into the image. Rebuild the frontend image:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend nginx
```

### Auth redirects loop

Check that a valid token is stored, the backend `/user` route returns 200, and the route guard is using the expected admin/user flags.

### Upload appears to fail but profile later updates

This used to be a false-failure case. The current dashboard should attempt recovery polling. If it still happens, inspect:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend-api
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f ai-cv-analyzer
```

### Chart warnings

Use stable container dimensions before using Recharts responsive charts.

## Known Frontend Limitations

- CV upload is improved but not fully async.
- A few non-blocking lint warnings remain around Fast Refresh and hook dependency patterns.
- Some career-tool pages are lighter than the core CV/jobs/gap/admin flows.
- Scraping results depend on external sources; the UI should not promise jobs will always be imported.

## Related Documentation

- Root `README.md` for the full architecture.
- `docs/DOCKER_QUICKSTART.md` for team startup.
- `docs/QA_BROWSER_WALKTHROUGH.md` for broad browser QA.
- `docs/PRODUCT_FLOW_REVIEW.md` for the latest product-flow fixes.
