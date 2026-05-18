# Final Graduation Walkthrough

Use this checklist for the last manual QA pass before the defense. Mark the
actual result on the final demo machine.

## Environment

- [ ] Docker stack starts successfully.
- [ ] Database container is healthy.
- [ ] Backend API container is running.
- [ ] Frontend container is running.
- [ ] AI CV Analyzer container is running.
- [ ] AI Job Miner container is running.
- [ ] Queue workers are running.
- [ ] MinIO/S3-style storage is reachable if enabled for the demo.
- [ ] Prometheus and Grafana are reachable if monitoring will be shown.

## Health Checks

- [ ] `http://localhost/api/health` works.
- [ ] `http://localhost:8000/` works for the AI analyzer.
- [ ] `http://localhost:8003/health` works for the job miner.
- [ ] `http://localhost:9090/` works if Prometheus is part of the demo.
- [ ] `http://localhost:3000/` works if Grafana is part of the demo.

## User Flow

- [ ] Frontend loads at `http://localhost/`.
- [ ] Public landing page loads without broken assets.
- [ ] Registration works, or prepared demo user login works.
- [ ] Login works.
- [ ] User dashboard loads.
- [ ] CV upload works with the prepared sample CV.
- [ ] AI analysis returns a structured status such as success, fallback,
      timeout, no text, or error.
- [ ] Extracted profile data appears where expected.
- [ ] Skills appear.
- [ ] Jobs appear.
- [ ] Recommendations appear when the user has enough profile/CV data.
- [ ] A job detail view opens.
- [ ] Gap analysis works for a selected job.
- [ ] Gap analysis shows matched skills, missing skills, and recommendations
      where available.
- [ ] Saving an opportunity works.
- [ ] Applications tracker shows the saved opportunity.
- [ ] Logout works.

## Admin Flow

- [ ] Admin login works.
- [ ] Admin dashboard loads.
- [ ] Admin users page loads if shown.
- [ ] Admin jobs page loads if shown.
- [ ] Scraping diagnostics load.
- [ ] Scraping source classifications are visible or explainable.
- [ ] Failed or blocked sources are shown honestly.
- [ ] Admin pages do not show raw stack traces or raw API errors.

## UI Honesty And Polish

- [ ] No obvious broken/fake UI states are visible.
- [ ] No raw errors are visible to users.
- [ ] Fake/static metrics have been removed or clearly labeled as demo/sample.
- [ ] AI wording is accurate and not exaggerated.
- [ ] Empty states are understandable.
- [ ] Loading states are understandable.
- [ ] Error states are understandable.
- [ ] No page depends on a live blocked external source for the main demo path.

## Final Smoke Test Notes

Record the final result here before the defense:

| Check | Result | Notes |
| --- | --- | --- |
| Docker stack starts | Not run yet | |
| Health endpoints work | Not run yet | |
| User flow works | Not run yet | |
| CV upload works | Not run yet | |
| Jobs/recommendations work | Not run yet | |
| Gap analysis works | Not run yet | |
| Applications tracker works | Not run yet | |
| Admin diagnostics work | Not run yet | |
