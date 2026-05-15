# Full Scraping Source Adapters Review

Date: 2026-05-15
Branch: `fix/full-scraping-source-adapters`

## Original Diagnostics Snapshot

Observed before this pass:

| Source | Type | Result | Stored | Failed URLs | Cause |
| --- | --- | --- | ---: | ---: | --- |
| LinkedIn Global | spa | `INTEGRITY_COMPROMISED` | 0 | 1 | Proxy timeout on LinkedIn public page |
| Indeed Remote | spa | `UNSUPPORTED` | 0 | 0 | Generic SPA extraction was not implemented |
| Upwork Global | spa | `UNSUPPORTED` | 0 | 0 | Generic SPA extraction was not implemented |
| Remotive Remote Jobs | api | `SUCCESS` | 1 | 0 | Public API worked |
| Adzuna US Tech | api | `EXTERNAL_FAILED` | 0 | 1 | API credentials missing caused 400 |
| Wuzzuf Egypt | html | `UNSUPPORTED` | 0 | 0 | Generic HTML extraction was not implemented |
| CareerCompass Demo Jobs | demo | `SUCCESS` | 1 | 0 | Deterministic local source worked |

The pipeline itself was working because Demo and Remotive imported jobs. The gaps were source-specific adapters, credential handling, and diagnostics wording.

## Intended Product Behavior

- Keep useful sources visible.
- Do not deactivate a source just because the current environment cannot run it.
- Diagnostics tests source health using fixed query `Software`.
- Run Extractions scrapes active targets against runnable active sources.
- Sources that need credentials or adapters are skipped during Run Extractions with visible reasons.
- External site/proxy blocking is reported honestly.

## Source Support Matrix

| Source | Adapter | Status | Credentials | Proxy | Run Extractions |
| --- | --- | --- | --- | --- | --- |
| CareerCompass Demo Jobs | `demo` | `demo` | no | no | runnable |
| Remotive Remote Jobs | `remotive` | `supported` | no | no | runnable |
| RemoteOK Remote Jobs | `remoteok` | `supported` | no | no | runnable |
| Arbeitnow Job Board | `arbeitnow` | `supported` | no | no | runnable |
| Adzuna US Tech | `adzuna` | `config_required` until env keys exist | yes | no | skipped until configured |
| Wuzzuf Egypt | `wuzzuf` | `external_risk` | no | no | runnable, may fail if layout/blocking changes |
| Indeed Remote | `indeed` | `external_risk` | no login | no | runnable, may return `EXTERNAL_BLOCKED` |
| Upwork Global | `upwork` | `external_risk` | no login | no | runnable, may return `EXTERNAL_BLOCKED` |
| LinkedIn Global | `linkedin` | `external_risk` | no login | optional | runnable, likely proxy/blocking sensitive |

## Adapters Implemented

### Demo

Creates deterministic jobs locally and exports them through the same Laravel import endpoint as real sources.

### Remotive

Parses `jobs[]` and maps:

- title
- company
- candidate location
- job type
- category/tags
- HTML description
- URL

Tags are normalized to job skills.

### Adzuna

Reads:

- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`

Missing credentials return `CONFIG_REQUIRED` with zero failed URLs. Configured responses parse `results[]` and map company, location, redirect URL, category, salary range, contract type, and skills inferred from text.

### RemoteOK

Parses the RemoteOK API list, skips metadata rows, filters locally by query, and maps position/company/location/tags/description/URL.

### Arbeitnow

Parses `data[]`, filters locally by query, and maps title/company/location/job types/tags/description/URL.

### Wuzzuf

Fetches Wuzzuf search HTML and extracts visible job cards using Wuzzuf-specific selectors and fallback `/jobs/p/` links. If live HTML changes or blocking occurs, the source reports an external failure instead of fake success.

### Indeed And Upwork

These are now routed to source-specific public page parsers instead of generic SPA unsupported handling. They do not use login or CAPTCHA bypass. If the public page returns blocking/sign-in/verification content, diagnostics reports `EXTERNAL_BLOCKED`.

### LinkedIn

Still uses the Scrapy/Playwright LinkedIn spider intentionally. Proxy use is controlled with:

```env
SCRAPER_USE_PROXIES=true
```

Proxy timeout or DLQ signals remain honest external/runtime failures.

## Backend Changes

- `ScrapingSource` exposes dynamic support metadata:
  - `support_status`
  - `adapter_name`
  - `requires_credentials`
  - `requires_proxy`
  - `is_runnable`
  - `recommended_action`
  - `implementation_notes`
- `ScrapingSourceResource` returns support metadata to the frontend.
- Diagnostics overall status now uses:
  - `HEALTHY`
  - `DEGRADED`
  - `FAILED`
  - `CONFIG_REQUIRED`
  - `NO_ACTIVE_SOURCES`
- `DEGRADED` means the pipeline works, but some active sources need credentials/adapters/proxy/external access.
- Run Extractions now preflights active sources and skips non-runnable sources with reasons.
- Seeder preserves existing source templates and adds RemoteOK and Arbeitnow.
- Internal scraper callback rate limiting is configurable with `SCRAPER_RATE_LIMIT_PER_MINUTE`.
  The default was raised to 600/minute so bulk imports from a manual extraction run are not incorrectly rejected with HTTP 429.

## Frontend Changes

Admin Sources now shows:

- support badges;
- adapter name;
- credential/proxy indicators;
- recommended action;
- grouped diagnostics counts;
- DEGRADED pipeline wording instead of global integrity failure when some sources pass.

Run Extractions confirmation now explains how many active sources are runnable and how many will be skipped.

## Remaining External Limitations

- LinkedIn, Indeed, and Upwork can block public scraping.
- No login scraping or CAPTCHA bypass is implemented or intended.
- Wuzzuf HTML parsing depends on live markup.
- Adzuna needs user-supplied credentials.
- Public API providers can rate-limit or change response formats.

## Validation Results From Docker

Diagnostics from `POST /api/v1/admin/scraping-sources/test`:

| Source | Result | Stored | Failed URLs | Notes |
| --- | --- | ---: | ---: | --- |
| LinkedIn Global | `INTEGRITY_COMPROMISED` | 0 | 1 | Proxy timeout was reported honestly. |
| Indeed Remote | `EXTERNAL_FAILED` | 0 | 1 | Public page returned HTTP 403. |
| Upwork Global | `EXTERNAL_FAILED` | 0 | 1 | Public page returned HTTP 403. |
| Remotive Remote Jobs | `SUCCESS` | 1 | 0 | API adapter imported one diagnostic job. |
| Adzuna US Tech | `CONFIG_REQUIRED` | 0 | 0 | Missing `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`. |
| Wuzzuf Egypt | `EXTERNAL_BLOCKED` | 0 | 1 | Live page showed sign-in/anti-bot content. |
| CareerCompass Demo Jobs | `SUCCESS` | 1 | 0 | Demo adapter imported one diagnostic job. |
| RemoteOK Remote Jobs | `SUCCESS` | 1 | 0 | API adapter imported one diagnostic job. |
| Arbeitnow Job Board | `SUCCESS` | 1 | 0 | API adapter imported one diagnostic job. |

Overall result: `DEGRADED`, `pipeline_working=true`, with 4 passing sources, 1 config-required source, and 4 external-risk failures.

Run Extractions from `POST /api/v1/admin/scraping/run-full`:

- Active sources: 9.
- Runnable sources: 8.
- Skipped sources: 1 (`Adzuna US Tech`, `config_required`).
- Active targets during validation: 12.
- Planned dispatched runs: 96.
- Batch completed without failed queue jobs.
- Runnable API/demo sources imported jobs. LinkedIn/Indeed/Upwork/Wuzzuf failures were classified as external/proxy/blocking issues.
- A bulk-import 429 was observed before raising the internal scraper callback limit; this was fixed by adding `SCRAPER_RATE_LIMIT_PER_MINUTE=600`.

## Validation Notes

Automated tests cover:

- Python service health/metrics/auth.
- Demo source routing.
- Remotive adapter normalization.
- Adzuna missing credentials classification.
- Wuzzuf fixture parsing.
- Indeed external-blocked routing without running LinkedIn.
- LinkedIn proxy timeout classification.
- Backend diagnostics and Run Extractions preflight behavior.

Manual browser validation should confirm:

1. Admin Sources lists all templates.
2. Diagnostics shows Demo/Remotive/API adapters separately from external/config issues.
3. Run Extractions reports runnable and skipped sources.
4. Admin Jobs/User Jobs show imported jobs from runnable sources.
