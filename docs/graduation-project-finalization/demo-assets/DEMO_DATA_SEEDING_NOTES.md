# Demo Data Seeding Notes

This file is documentation only. It does not add seed code or change database
behavior.

## Data To Prepare Before The Demo

- Demo student/user account.
- Demo admin account.
- Sample jobs for the main role categories.
- Active demo or reliable API scraping sources.
- Target job roles for recommendations and profile interpretation.
- Optional previous applications for showing the tracker quickly.
- Optional previous successful CV analysis for fallback if live upload is slow.

## Manual UI Verification

- Log in as the student demo user and confirm the dashboard loads.
- Upload or verify a known synthetic CV analysis.
- Confirm extracted skills appear in the user flow.
- Confirm the jobs page has visible jobs before the defense starts.
- Save one opportunity and confirm it appears in the applications tracker.
- Log in as admin and confirm dashboard and source diagnostics load.
- Confirm source statuses are honest: demo/API, active, inactive, blocked, or
  failed as appropriate.

## Reliability Notes

- Do not rely on fragile live external scraping during the defense.
- Prepare demo/API baseline jobs before the defense.
- If public sources are blocked, explain the source classification and show the
  source matrix instead of trying risky live scraping.
- Do not reset production-like or important local data during the defense.
- If the project does not already have a safe seeding workflow, document manual
  preparation now and treat automated demo seeding as future work.
