# Graduation Demo Script

This script is designed for a real graduation defense. Keep the pace calm:
show the working system first, then explain architecture and limitations with
evidence from the app.

For the final rehearsed version of this flow, use
[`demo-assets/FINAL_DEMO_FLOW.md`](demo-assets/FINAL_DEMO_FLOW.md). For quick
recovery steps during the defense, keep
[`demo-assets/DEMO_FAILURE_PLAYBOOK.md`](demo-assets/DEMO_FAILURE_PLAYBOOK.md)
available.

## Before Starting

- Start the Docker stack and wait for the app, backend, database, AI analyzer,
  job miner, and queue workers to be ready.
- Keep one clean sample CV and one imperfect sample CV on the demo machine.
- Prepare one normal user account and one admin account.
- Keep fallback screenshots or a short recording available in case live external
  sources fail.

## Step-by-Step Defense Flow

1. Open the app.
   - Open `http://localhost/`.
   - State that CareerCompass is running as a Docker-first distributed
     graduation system.

2. Show the public landing page.
   - Briefly explain the user problem: students need help turning a CV into
     career guidance, job recommendations, and skill-gap awareness.
   - Avoid spending too long on marketing content.

3. Login/register as user.
   - Register a new user if the demo needs a clean flow.
   - Otherwise, log in with the prepared demo user.
   - Mention that the backend uses Laravel API authentication.

4. Upload sample CV.
   - Upload the prepared technical CV.
   - Explain that Laravel receives the file, stores it, and sends it to the
     Python AI CV Analyzer.
   - If processing takes time, explain that CV analysis is service-dependent
     and may use timeout/recovery handling; a fully asynchronous progress flow
     is future work.

5. Show extracted profile/skills.
   - Open the profile or dashboard area that shows parsed CV data.
   - Point out extracted skills, predicted role/domain, confidence/status, and
     profile completeness if visible.
   - Use precise wording: "the system extracted" and "the system predicted",
     not "the AI knows perfectly".

6. Open Jobs page.
   - Navigate to Jobs.
   - Explain that jobs may come from seeded/demo data, imported API sources, or
     scraping/import pipelines.

7. Show recommendations.
   - Show recommended jobs or filtered jobs related to the user's profile.
   - Explain that recommendations compare user profile signals and skills
     against job requirements.

8. Select job.
   - Open a relevant job detail view.
   - Point out title, company, description, required skills, source, and any
     available metadata.

9. Show gap analysis.
   - Run or open gap analysis for the selected job.
   - Explain matched skills, missing skills, and suggested improvements.
   - Clarify that the score is guidance for learning and career planning, not a
     hiring decision.

10. Save opportunity.
    - Save the selected job/opportunity.
    - State that this connects recommendations to an application-tracking
      workflow.

11. Open Applications tracker.
    - Show the saved opportunity in the tracker.
    - Demonstrate that the user can monitor potential applications.

12. Login as admin.
    - Log out or open a separate prepared session.
    - Log in with the admin demo account.
    - Explain that admin pages are for diagnostics and project demonstration.

13. Show admin dashboard.
    - Show high-level admin status, users/jobs/source information, or available
      diagnostics.
    - Avoid claiming metrics are live if they are demo or cached values.

14. Show scraping sources diagnostics.
    - Open the scraping sources/admin diagnostics area.
    - Show source names, types, status, recent failures, or health indicators.

15. Explain source classifications.
    - Explain reliable demo/API sources as the baseline.
    - Explain that public HTML sources may be blocked by access controls,
      anti-bot systems, layout changes, or network restrictions.
    - State that the project classifies blocked sources honestly instead of
      bypassing login, CAPTCHA, or fingerprint protections.

16. Show health/monitoring endpoints if needed.
    - Backend health: `http://localhost/api/health`.
    - AI analyzer health: `http://localhost:8000/`.
    - Job miner health: `http://localhost:8003/health`.
    - Prometheus: `http://localhost:9090/`.
    - Grafana: `http://localhost:3000/`.
    - Use these only if the defense discussion turns to architecture,
      observability, or service health.

17. End with limitations/future work.
    - State the main limitations: small evaluation dataset, CV formatting
      variability, Arabic/mixed-language CVs needing more testing, external
      scraping depending on public access, and matching scores being guidance.
    - Close with future work: larger evaluation, multilingual support, better
      skill ontology, more official job APIs, improved explainability, async CV
      processing, mobile app, and production deployment after graduation.

## Timing Guide

| Segment | Suggested Time |
| --- | --- |
| Problem and public page | 1 minute |
| User auth and CV upload | 2 minutes |
| Profile/skills explanation | 2 minutes |
| Jobs, recommendations, gap analysis | 3 minutes |
| Applications tracker | 1 minute |
| Admin diagnostics and scraping sources | 2 minutes |
| Architecture, monitoring, limitations | 2-3 minutes |

## Defense Talking Points

- CareerCompass is not only a UI; it is a distributed system with Laravel,
  React, Python AI services, queues, MySQL, storage, scraping, and monitoring.
- The AI outputs are treated as structured predictions with uncertainty, not
  absolute truth.
- The matching layer is explainable through matched skills, missing skills, and
  recommendations.
- Scraping is presented honestly: reliable API/demo sources are the baseline,
  and public blocked sources are documented as limitations.
