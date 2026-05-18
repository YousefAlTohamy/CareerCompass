# Final Demo Flow

This is the polished defense script for a repeatable CareerCompass graduation
demo. Keep the live walkthrough calm and evidence-based: show the system, then
explain the design decisions.

## Core Flow

1. Introduce the problem.
   - Students often have a CV but need structured guidance about skills, jobs,
     and gaps.
   - CareerCompass turns CV information into profile signals, job
     recommendations, and learning direction.

2. Explain architecture briefly.
   - Mention Laravel API, React/Vite frontend, Python AI analyzer, Python job
     miner, MySQL, queue workers, storage, and monitoring.
   - Keep this short; the live app should be the main evidence.

3. Login as student.
   - Use the prepared student demo account or register a fresh user if time
     allows.

4. Upload synthetic CV.
   - Use a known-good synthetic or anonymized CV.
   - Mention that no private CV data is required for the defense.

5. Explain AI parsing.
   - The Python AI service extracts skills, predicts role/profile signals, and
     returns structured parsing status.
   - Use careful language: extracted, predicted, estimated, partial, and
     service-dependent.

6. Show extracted profile/skills.
   - Point to skills, role prediction, profile completeness, or analysis status
     if visible.

7. Open Jobs.
   - Explain that jobs come from imported/demo/API data and the scraping/import
     pipeline.

8. Explain recommendations.
   - Recommendations compare extracted CV/profile signals with job skill
     requirements using available matching methods.

9. Select a job.
   - Choose a job that clearly matches the uploaded CV persona.

10. Show gap analysis.
    - Explain matched skills, missing skills, and suggested improvements.
    - State that the score is guidance, not a hiring decision.

11. Save opportunity.
    - Save the job to connect recommendations with a tracking workflow.

12. Show Applications tracker.
    - Confirm the saved opportunity appears and can be tracked.

13. Switch to admin.
    - Use a separate browser session or incognito window if possible.

14. Show admin dashboard.
    - Discuss users, jobs, source diagnostics, and system visibility without
      overstating any metric.

15. Show scraping sources diagnostics.
    - Show source type, status, recent failures, and diagnostics if available.

16. Explain reliable API/demo sources vs blocked public sources.
    - Reliable demo/API sources are the baseline.
    - Public HTML sources may fail due to blocking, layout changes, network
      restrictions, CAPTCHA, or access controls.
    - The project classifies those honestly instead of bypassing protections.

17. Show system status/health page.
    - Use the status page and health endpoints if the examiners ask about
      distributed-system reliability.

18. Explain evaluation framework.
    - Point to the graduation evaluation framework for CV extraction and
      matching.
    - Clarify that final metrics should only be claimed after running scripts
      on manually labeled data.

19. End with limitations and future work.
    - Mention small evaluation dataset, Arabic/mixed-language CV testing,
      public-source fragility, and match scores as guidance.
    - Mention future work: larger dataset, multilingual support, stronger skill
      ontology, more official APIs, mobile app, and production deployment after
      graduation.

## 8 Minute Version

- Problem and architecture: 1 minute.
- Student login and CV upload: 2 minutes.
- Skills, jobs, recommendation, and gap analysis: 3 minutes.
- Admin diagnostics and source honesty: 1 minute.
- Evaluation, limitations, and future work: 1 minute.

Use this version if the defense schedule is tight. Skip optional monitoring tabs
unless asked.

## 12 Minute Version

- Problem and architecture: 2 minutes.
- Student flow through CV upload and extracted skills: 3 minutes.
- Jobs, recommendation, gap analysis, and tracker: 3 minutes.
- Admin dashboard and scraping diagnostics: 2 minutes.
- Evaluation framework, limitations, and future work: 2 minutes.

This is the recommended version for a balanced defense.

## 15 Minute Version

- Problem and architecture: 2 minutes.
- Student flow with more detail on AI parsing: 4 minutes.
- Jobs, matching, gap analysis, and applications tracker: 4 minutes.
- Admin diagnostics, sources, and health/status page: 3 minutes.
- Evaluation framework, limitations, and future work: 2 minutes.

Use this version when examiners want more technical explanation during the live
walkthrough.
