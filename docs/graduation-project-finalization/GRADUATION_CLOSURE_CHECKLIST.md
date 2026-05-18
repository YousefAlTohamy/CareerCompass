# Graduation Closure Checklist

This checklist is for final academic/demo readiness. It is not a production
deployment checklist.

## Must Do Before Defense

- [ ] Confirm the Docker stack starts on the final demo machine.
- [ ] Prepare at least two sample CVs: one clean technical CV and one imperfect
      CV with formatting or missing sections.
- [ ] Prepare a normal demo user account.
- [ ] Prepare an admin demo account.
- [ ] Prepare demo users locally with credentials kept outside git.
- [ ] Confirm the public landing page, registration, login, dashboard, jobs,
      gap analysis, applications tracker, and admin pages load.
- [ ] Remove fake/static UI metrics from dashboards and public pages, or clearly
      label any remaining placeholders as sample/demo data.
- [ ] Replace exaggerated AI wording with accurate scientific wording such as
      "estimated", "predicted", "extracted", "confidence", and "recommendation".
- [ ] Document the system architecture.
- [ ] Document the database ERD notes.
- [ ] Document the AI evaluation plan.
- [ ] Document the matching evaluation plan.
- [ ] Document the scraping source matrix.
- [ ] Prepare a limitations slide.
- [ ] Prepare a future work slide.
- [ ] Run a final browser walkthrough.
- [ ] Run a final smoke test.
- [ ] Capture fallback screenshots before the defense.

## Should Do Before Defense

- [ ] Verify the final demo can recover from refreshes and navigation changes.
- [ ] Check that CV upload failures show user-friendly messages.
- [ ] Check that jobs are visible even if live external scraping is unavailable.
- [ ] Confirm saved opportunities remain visible in the applications tracker.
- [ ] Confirm admin diagnostics show honest source status rather than false
      success.
- [ ] Prepare a short explanation of why queues are used.
- [ ] Prepare a short explanation of why skill normalization is used.
- [ ] Prepare a short explanation of the matching algorithm and its fallback
      behavior.
- [ ] Prepare screenshots of the main flows in case the live demo machine has
      network or Docker problems.
- [x] Prepare the graduation demo-assets documentation folder.
- [x] Define synthetic CV personas for the final demo.
- [x] Document the final smoke test checklist.
- [x] Prepare the demo failure playbook.

## Nice To Have

- [ ] Add a small set of manually labeled CVs for evaluation rehearsal.
- [ ] Add a small set of manually labeled job-fit examples for matching
      evaluation rehearsal.
- [ ] Prepare a one-page architecture summary for examiners.
- [ ] Prepare a one-page AI/NLP method summary.
- [ ] Prepare a one-page scraping design summary.
- [ ] Prepare a fallback demo recording.

## Demo Safety Checks

- [ ] Use a known-good sample CV stored locally on the demo machine.
- [ ] Use a known-good demo user with a recent CV analysis.
- [ ] Use a known-good admin account.
- [ ] Start Docker early and confirm all critical containers are healthy.
- [ ] Keep browser tabs ready for the app, API health, AI analyzer health,
      job miner health, Prometheus, and Grafana.
- [ ] Avoid relying on blocked public sources during the live defense.
- [ ] If an external source fails, explain it as an expected limitation of public
      source access rather than a system-wide failure.
- [ ] Do not create fake external-source results to hide blocked scraping.

## Documentation Checks

- [ ] Architecture document explains Laravel, React/Vite, Python AI Analyzer,
      Python Job Miner/Scrapy, MySQL, queue workers, MinIO, Prometheus, and
      Grafana.
- [ ] ERD notes explain users, profiles, CV analyses, skills, user skills, jobs,
      job skills, applications, scraping sources, scraping jobs, failed scraping
      URLs, and target job roles.
- [ ] AI evaluation plan clearly states that results are not claimed yet.
- [ ] Matching evaluation plan clearly states that results are not claimed yet.
- [ ] Scraping source matrix separates reliable demo/API sources from public
      HTML sources that may be blocked.
- [ ] Limitations and future work are honest and graduation-focused.
- [x] Demo assets are documented under
      `docs/graduation-project-finalization/demo-assets/`.

## UI Honesty Checks

- [ ] Remove or clearly label fake/static UI metrics.
- [ ] Avoid claims such as "guaranteed best job" or "perfect AI analysis".
- [ ] Use accurate language for AI outputs: prediction, extraction, confidence,
      recommendation, possible gap, and suggested improvement.
- [ ] Show empty, loading, timeout, and error states without raw exceptions.
- [ ] Make admin diagnostics distinguish active, inactive, blocked, failed, and
      demo-only sources.

## AI/Matching Evaluation Checks

- [x] Create the graduation evaluation framework under
      `docs/graduation-project-finalization/evaluation/`.
- [x] Provide CV extraction and matching evaluation scripts.
- [ ] Prepare manual labeling instructions for CV skills and target roles.
- [ ] Prepare an evaluation table template for precision, recall, F1-score, role
      prediction accuracy, and parsing status correctness.
- [ ] Prepare manual fit labels for matching: High, Medium, and Low.
- [ ] Prepare an ablation table template for skill overlap, TF-IDF only,
      semantic similarity only, and hybrid matching.
- [ ] Generate final measured evaluation results before the defense if the team
      wants to present numbers.
- [ ] Confirm the demo explanation distinguishes measured results from planned
      evaluation work.

## Scraping Demo Checks

- [ ] Confirm CareerCompass Demo Jobs are available for baseline demonstration.
- [ ] Confirm reliable API sources such as Remotive, RemoteOK, Arbeitnow, or
      Adzuna are ready if reachable.
- [ ] Confirm public HTML sources such as Wuzzuf, Indeed, Upwork, and LinkedIn
      are described honestly if blocked.
- [ ] Confirm no login scraping is used.
- [ ] Confirm no CAPTCHA bypass is used.
- [ ] Confirm no stealth/fingerprint evasion is used.
- [ ] Confirm blocked sources are classified honestly in diagnostics.
