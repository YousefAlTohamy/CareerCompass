# Graduation Demo Readiness Notes

CareerCompass is currently positioned as a graduation/demo system. It is not
claimed as production-ready software, and the defense should present it as an
academic system that demonstrates architecture, AI-assisted CV analysis, job
data import, recommendation, gap analysis, application tracking, and admin
diagnostics.

## Positioning

- CareerCompass is a graduation project and demo environment, not a production
  hiring platform.
- AI CV analysis and matching are explainable academic features based on
  extracted CV signals, normalized skills, and imported or demo job data.
- Match percentages and recommendations should be described as estimates from
  available data, not guarantees of employability or hiring outcomes.
- External scraping can be blocked by job boards or source policies. The system
  should report blocked, unavailable, or configuration-required sources
  honestly and continue to support demo/local sources.
- Demo administrator credentials are convenience seed data for local and
  graduation-defense setup only. They are not production authentication.

## Recommended Demo Flow

1. Start Docker with `docker compose up -d --build`.
2. Seed the database with the documented Laravel seed command.
3. Login as the demo admin or prepared demo user.
4. Upload a prepared text-based CV.
5. Review extracted skills, profile data, and parsing status.
6. View job recommendations based on the uploaded CV/profile data.
7. Run gap analysis for one imported or demo job.
8. Save an application to the tracker.
9. Open the admin dashboard and source status pages to show diagnostics.

## Known Demo Limitations

- Public job boards may block scraping or return partial results.
- Some preview modules, such as CV Builder, Mock Interview, Learning Paths,
  Career Planner, and Mentorship, are planned extensions rather than fully
  evaluated production features.
- Matching quality depends on the clarity of the uploaded CV, extracted skills,
  and the quality of imported job descriptions.
- OCR fallback may be less reliable than text-based CV parsing.
- Production-grade concerns such as formal security review, compliance,
  managed deployment, secret rotation, and live payment or booking flows remain
  future work.

## Defense Notes

- Use prepared sample CVs and sample jobs so the demo is repeatable.
- Keep screenshots or a short recorded walkthrough ready in case a public
  source, network, or Docker service is unavailable during the defense.
- When explaining AI outputs, emphasize traceable signals: extracted skills,
  missing skills, role indicators, imported job requirements, and source
  diagnostics.
