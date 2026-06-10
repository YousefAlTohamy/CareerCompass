# Layer 2 Classification Deep Dive

## Purpose

Layer 2 enriches the structured CV output from Layer 1. It does not re-parse the file. Instead, it interprets the extracted profile, title, summary, experience, and skills to produce domain, seniority, and skill-category signals.

## Files

| File | Responsibility |
|---|---|
| `core/layer2_classification/orchestrator.py` | Applies Layer 2 enrichment to the parsed CV analysis. |
| `core/layer2_classification/domain_engine.py` | Predicts primary technical domain from CV context and taxonomy descriptions. |
| `core/layer2_classification/seniority_engine.py` | Estimates seniority from years, title, summary, and action verbs. |
| `core/layer2_classification/skill_engine.py` | Categorizes skills as hard, soft, or management-related. |
| `core/layer2_classification/classifier.py` | Singleton classifier wrapper around the semantic embedder. |
| `core/layer2_classification/utils.py` | Loads taxonomy JSON. |
| `core/layer2_classification/data/taxonomy.json` | Domain, skill, soft-skill, and management taxonomy. |

## Domain Classification

`DomainEngine.predict_domain` builds a compact CV context from current title, early experience titles, and summary text. It compares that context to taxonomy domain descriptions with the semantic embedder when available. The highest-scoring domain becomes the primary domain. `identify_tech_specialty` currently returns `None`, so specialty behavior should be treated as taxonomy-driven rather than a separate implemented classifier.

## Skill Categorization

`SkillEngine.categorize_skills` maps extracted skills into practical buckets:

- Soft skills are detected by matching configured soft-skill terms.
- Management skills are detected from management-oriented terms, while avoiding false positives such as database/state words.
- Remaining technical terms are treated as hard skills.

## Seniority Classification

`SeniorityEngine.analyze_seniority` combines:

- total years of experience,
- title and summary words,
- action-verb strength,
- configured seniority cues.

The resolution logic is intentionally conservative. Intern/student/trainee cues and very low experience can force Intern. More than seven years can raise a Mid-Level semantic result to Senior. Strong action verbs can raise a Junior result to Mid-Level. Final production calibration would require labeled career-level examples.

## Layer 1 vs Layer 2 Seniority

Layer 1 contains a first seniority heuristic in the orchestrator. It uses title keywords, year thresholds, and action-verb score. Layer 2 adds taxonomy and semantic-style interpretation. The book therefore documents seniority as a combined heuristic estimate, not as a certified classification.

## Key Limitations

- Domain classification depends on taxonomy coverage and embedding availability.
- Seniority labels are approximate and can be biased by title wording.
- Soft-skill detection is largely taxonomy/rule based.
- The classification layer should be evaluated against labeled CV examples before production use.
