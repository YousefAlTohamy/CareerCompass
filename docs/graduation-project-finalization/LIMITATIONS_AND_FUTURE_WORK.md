# Limitations And Future Work

This document is written for the graduation report and final defense. It frames
limitations honestly while showing clear next steps after the academic project is
closed.

## Limitations

- Small evaluation dataset: the project may demonstrate evaluation design before
  a large benchmark is available.
- AI accuracy depends on CV quality: clean, well-structured CVs are easier to
  parse than scanned, incomplete, or highly designed documents.
- Arabic CVs need more testing: Arabic and mixed Arabic/English CVs require
  more language-specific evaluation.
- External scraping depends on public access: public websites may block
  automation, change layouts, rate-limit requests, or require login.
- Live external sources may fail during demo: reliable demo/API sources should
  be prepared as the baseline.
- Matching score is guidance, not a hiring decision: recommendations help
  students reason about fit and gaps, but they do not prove employability.
- Skill normalization is useful but incomplete: synonyms, aliases, and skill
  hierarchy need a stronger ontology for best results.
- Some preview tools are future work: document previews, richer analysis
  previews, or more advanced admin visualizations may not be fully final.
- Evaluation results should not be claimed until measured: plans and templates
  are not the same as completed metrics.

## Future Work

- Build a larger evaluation dataset with more CV styles, roles, seniority
  levels, and manually labeled skills.
- Add stronger Arabic and multilingual CV support.
- Improve the skill ontology with aliases, parent/child skill categories, and
  better synonym handling.
- Integrate more official job APIs to reduce dependence on fragile public HTML
  scraping.
- Improve explainability for AI parsing, matching scores, missing skills, and
  recommendation reasons.
- Add more robust asynchronous CV processing for large files, retries, progress
  reporting, and background status updates.
- Add a mobile app or mobile-first companion experience for students.
- Add richer analytics for admins, including source reliability trends and
  market skill demand over time.
- Run a formal ablation study comparing skill-overlap, TF-IDF, semantic, and
  hybrid matching methods.
- Prepare production deployment after graduation, including production-grade
  infrastructure, security controls, scaling, and operations.

## Suggested Defense Slide Summary

| Area | Limitation | Future Work |
| --- | --- | --- |
| AI CV parsing | Small dataset and variable CV quality | Larger labeled dataset and multilingual testing |
| Matching | Scores guide students but are not hiring decisions | Better ontology, ablation study, stronger explainability |
| Scraping | Public sites may block access | More official APIs and honest source diagnostics |
| System | Graduation-ready demo, not production operations | Production deployment after graduation |

The key defense message is simple: CareerCompass demonstrates the architecture,
AI/NLP pipeline, data normalization, matching logic, scraping design, testing
mindset, and demo workflow expected from a strong graduation project, while
remaining honest about what still requires future work.
