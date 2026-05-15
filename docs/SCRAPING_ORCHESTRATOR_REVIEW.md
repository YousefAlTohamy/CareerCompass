# Scraping Orchestrator Review

Date: 2026-05-15
Branch: `fix/scraping-orchestrator-sources-targets-progress`

## Summary

This pass aligned the scraping workflow with the intended admin product model:

- Admin Sources define where scraping can run.
- Admin Targets define what roles the system should scrape for.
- Diagnostics tests active source health with a fixed diagnostic query.
- Run Extractions starts the real manual source-target scraping matrix.
- Admin Sources now exposes visible progress and honest failure states.

No external-source success is faked. LinkedIn/proxy failures and unsupported source types are surfaced as failures or unsupported diagnostics.

## Original Observed Failure

The admin Diagnostics flow previously produced:

- URL attempted: `https://www.linkedin.com/jobs/search/?keywords=Software`
- Proxy used: `http://160.86.242.23:8080`
- Error: `Page.goto: net::ERR_TIMED_OUT`
- DLQ reporting: failed URL was reported
- Final classification: `INTEGRITY_COMPROMISED`

That result is acceptable for an unreliable external LinkedIn/proxy source as long as the UI reports it honestly. The broader problem was that diagnostics and manual extractions were not clearly separated, source config was not reliably carried to `ai-job-miner`, and there was no deterministic source for demos.

## Intended Architecture

### Diagnostics

Diagnostics is a source health check.

- It tests all active sources only.
- It skips inactive sources.
- It uses the fixed query `Software`.
- It does not depend on target roles.
- It returns per-source results and an aggregate status.

### Single Source Test

Single source testing is a focused admin check.

- It tests exactly the selected source.
- It works for active and inactive sources.
- It uses the selected source endpoint/type/mode/method/headers/params/pattern.
- It uses the fixed query `Software`.

### Run Extractions

Run Extractions is the real manual scraping action.

- It loads all active `ScrapingSource` records.
- It loads all active `TargetJobRole` records.
- It dispatches active sources x active targets.
- It runs immediately and independently from scheduled scraping.
- It creates `ScrapingJob` records as each source-target run executes.
- It imports jobs through the normal Laravel internal import pipeline.
- It runs on the `scraping` queue, not the default queue.

## What Was Fixed

### Diagnostics All

`ScrapingSourceController::test()` now loads all active sources and runs every active source through the scraper service with query `Software`.

The response includes:

- `overall_status`
- `diagnostic_query`
- `total_sources`
- `passed_sources`
- `failed_sources`
- per-source `results`

Inactive sources are not included.

### Single Source Test

`ScrapingSourceController::testSingle()` now runs the selected source only. It does not choose the first active source and does not force unrelated source behavior.

### Manual Run Extractions

`TargetJobRoleController::runFullScraping()` now creates a source-target matrix and dispatches one `ProcessMarketScrapingCategory` job per active source/target pair.

The response includes:

- batch id
- active source count
- active target count
- planned run count
- source names
- target queries

The batch is explicitly routed to the `scraping` queue.

### Scheduled Scraping Queue Routing

`ProcessMarketScraping` now routes scheduled scraping batches to the `scraping` queue too. This prevents long-running scraping jobs from occupying the default application queue.

### Source Config Propagation

`ScraperClient` now sends full source configuration to `ai-job-miner`:

- source id/name/type
- endpoint
- HTTP method
- headers
- params
- mode
- pattern

Empty `headers` and `params` are encoded as JSON objects, not arrays. This fixed a live FastAPI validation failure where `source.headers` and `source.params` arrived as `[]`.

### Source-Aware ai-job-miner Routing

`ai-job-miner` now routes by source config:

- `demo` / `local` / `demo://...`: deterministic local demo jobs
- `api`: generic API fetch and Laravel import
- `html`: explicit `UNSUPPORTED`
- non-LinkedIn `spa`: explicit `UNSUPPORTED`
- LinkedIn-backed `spa`: LinkedIn spider with endpoint passed intentionally

This avoids accidentally routing every SPA source through LinkedIn.

### Demo/Local Source

The seeder now creates:

`CareerCompass Demo Jobs`

This source:

- uses `demo://careercompass/jobs`
- does not depend on LinkedIn, public internet, or proxies
- creates deterministic demo jobs
- uses the normal Laravel job import path
- appears in Admin Jobs and user Jobs after import

It exists to prove the full pipeline during demos:

source + target -> scrape -> import -> store jobs -> show in UI.

### Proxy Handling

The scraper middleware now supports `SCRAPER_USE_PROXIES=false` to disable proxy rotation for diagnostics or controlled environments. Proxy failures are still reported honestly when proxies are enabled.

Observed LinkedIn behavior after this pass:

- LinkedIn still fails when the configured proxy times out or is blocked.
- The result is classified as `INTEGRITY_COMPROMISED` when DLQ/runtime signals appear.
- Admin output includes the proxy failure and failed URL count.

### Admin Progress UI

`GET /api/v1/admin/scraping-sources/status` now returns:

- global summary
- active source count
- active target count
- planned runs
- active/completed/failed jobs
- progress percent
- per-source status
- current target/query
- jobs found/stored
- failed URL count
- elapsed time
- last error

The Admin Sources page now renders:

- global progress banner
- per-source progress bars
- current target/query
- stored/failed counts
- final source state

## Classification Semantics

The current classifications are:

- `SUCCESS`: jobs stored and no critical runtime errors
- `PARTIAL_SUCCESS`: some jobs stored and some failures occurred
- `EMPTY_SUCCESS`: source responded normally but no jobs were found
- `EXTERNAL_FAILED`: timeout, proxy failure, blocking, HTTP failure, or failed URL with no stored jobs
- `UNSUPPORTED`: source type is not implemented
- `CONFIG_INVALID`: source configuration is invalid
- `INTEGRITY_COMPROMISED`: subprocess exited but output contains DLQ/runtime/downloader failures

## Validation Results

### API / Runtime Checks

Single demo source diagnostic:

- endpoint: `/api/v1/admin/scraping-sources/{demoId}/test`
- result: `SUCCESS`
- jobs previewed: 1
- jobs stored: 1
- failed URLs: 0

Diagnostics All:

- active sources tested: 7
- passed: 1
- failed/unsupported/external: 6
- diagnostic query: `Software`
- inactive sources: skipped

Manual Run Extractions:

- active sources: 7
- active targets: 12
- planned runs: 84
- batch created successfully
- queue: `scraping` after fix

Progress endpoint snapshot:

- global progress returned successfully
- per-source status returned successfully
- demo source completed and stored 3 jobs for `Backend Developer`
- LinkedIn reported proxy timeout/runtime failure honestly

API source normalization:

- Remotive initially fetched jobs but hit Laravel validation because external job types did not match the allowed values.
- `ai-job-miner` now normalizes external `job_type` / `work_type` values before import.
- Retest: Remotive single-source diagnostic passed, previewed 1 job, stored 1 job, and reported 0 failed URLs.

Queue cleanup:

- A disposable validation batch was canceled after proving the behavior.
- Only unreserved queued jobs from that validation batch were removed.
- Docker volumes and persistent storage were not deleted.
- Ready queue jobs after cleanup: 0
- One older failed job from 2026-05-13 remains in `failed_jobs` and was not modified.

### Automated Tests

Backend:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan test
```

Result: 22 tests passed, 146 assertions.

Targeted scraper orchestrator:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan test --filter=ScrapingOrchestratorTest
```

Result: 5 tests passed, 35 assertions.

Python:

```bash
python -m pytest -q tests/test_service_api.py
python -m compileall ai-cv-analyzer ai-job-miner
```

Result: passed.

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Result: passed. Existing non-blocking lint warnings remain.

## How To Validate From The Website

1. Start the stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

2. Login as an admin.
3. Open `/admin/sources`.
4. Confirm active sources and inactive sources are visible.
5. Click Diagnostics.
6. Confirm only active sources are tested with query `Software`.
7. Click Test Source on `CareerCompass Demo Jobs`.
8. Confirm the demo source passes and stores jobs.
9. Open `/admin/targets`.
10. Confirm active targets exist.
11. Return to `/admin/sources`.
12. Click Run Extractions.
13. Confirm the progress banner and per-source progress bars update.
14. Open Admin Jobs and confirm demo/imported jobs are visible.

## Remaining Limitations

- LinkedIn scraping depends on third-party availability, proxy quality, and anti-bot behavior.
- Generic HTML extraction is intentionally reported as `UNSUPPORTED`.
- Generic non-LinkedIn SPA extraction is intentionally reported as `UNSUPPORTED`.
- API source import quality depends on mapping external `job_type` values to accepted Laravel values.
- The manual extraction matrix can be large when many sources and targets are active; use source/target toggles before demos.
- Admin progress is approximate because source-target jobs are distributed queue work.

## Recommended Next Steps

1. Expand source-specific API adapters for Remotive and Adzuna so more external fields are normalized before import.
2. Add source-specific spiders for Wuzzuf, Indeed, and Upwork only if those sources are required for the demo.
3. Add a batch cancellation button in Admin Sources for long manual runs.
4. Add source-level concurrency limits to avoid overwhelming one external domain.
5. Add a UI toggle for proxy-enabled diagnostics when testing LinkedIn locally.
