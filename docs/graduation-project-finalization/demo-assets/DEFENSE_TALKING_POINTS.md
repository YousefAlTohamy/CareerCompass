# Defense Talking Points

Use these points to answer examiner questions without drifting into production
deployment claims.

## Architecture

- Docker-first distributed system for repeatable academic demonstration.
- Laravel API acts as the main orchestrator for users, CV uploads, jobs,
  applications, admin diagnostics, and service coordination.
- React/Vite frontend provides the student and admin experience.
- Python AI service handles CV parsing, skill extraction, role prediction, and
  structured analysis status.
- Python scraping/job-miner service demonstrates scraping and import pipeline
  design.
- Queues and workers separate longer-running work from direct user requests.
- Monitoring with Prometheus/Grafana supports system visibility during the
  project demonstration.

## AI/NLP

- CV parsing extracts structured profile information from uploaded documents.
- Skill extraction converts CV text into normalized skills used by matching.
- Role prediction gives an estimated target role or domain.
- Parsing statuses make success, partial success, fallback, timeout, and error
  cases visible.
- OCR fallback is a concept for handling scanned or low-text CVs, depending on
  available flow.
- The evaluation framework measures provided labels and predictions; it does
  not create final benchmark claims automatically.

## Matching

- Skill overlap provides an interpretable baseline.
- TF-IDF can compare textual job/profile signals where available.
- Semantic or hybrid matching can improve comparison beyond exact words when
  available.
- Gap analysis explains matched and missing skills.
- Explainability matters: users should see why a job was recommended and what
  skills are missing.

## Data

- Normalized skills reduce duplicated noisy strings.
- User skills and job skills make matching and gap analysis queryable.
- Applications tracker connects recommendations to a user workflow.
- Scraping sources store source identity and diagnostics for honest reporting.

## Scraping

- Reliable demo/API sources are the baseline for live defense.
- Public HTML sources can be blocked by access controls, layout changes, or
  network conditions.
- Honest classifications are part of the system design.
- No fake external jobs should be generated to hide blocked scraping.
- No login scraping, CAPTCHA bypass, or stealth/fingerprint evasion is part of
  the graduation demo.

## Testing

- Backend tests demonstrate API and business-logic confidence where available.
- Frontend lint/build verifies the React/Vite surface.
- Python tests or compile checks verify evaluation scripts and service code
  where available.
- Smoke walkthrough checks the live demo path.
- Docker validation confirms the distributed stack can be started for defense.

## Limitations

- Evaluation dataset is intentionally small unless the team expands it before
  the defense.
- Arabic and mixed-language CVs need more testing.
- Public scraping can be blocked or return empty results.
- Matching score is career guidance, not a hiring decision.

## Future Work

- Larger labeled evaluation dataset.
- Arabic and multilingual CV support.
- Stronger skill ontology and alias handling.
- More official job APIs.
- Improved explainability.
- Mobile app.
- Production deployment after graduation.
