# Layer 3 Matching Deep Dive

## Purpose

Layer 3 compares a candidate profile with a job description and produces an explainable fit result. It is used for recommendation and gap-analysis style workflows.

## Files

| File | Responsibility |
|---|---|
| `layer3/job_description_engine.py` | Extracts seniority, required years, mandatory skills, bonus skills, domain, and summary from job text. |
| `layer3/embedder.py` | Loads sentence-transformer embeddings, caches vectors, supports optional quantization, and calculates cosine similarity. |
| `layer3/similarity.py` | Combines semantic, skills, and domain scores with adaptive weights. |
| `layer3/constraint_validator.py` | Applies penalties for missing mandatory skills, experience shortfalls, and seniority mismatch. |
| `layer3/fit_analysis_generator.py` | Produces human-readable summary, strengths, gaps, red flags, and verdict. |
| `layer3/ranking_orchestrator.py` | Ranks candidates/jobs by fit score. |
| `layer3/tfidf.py` | Provides deterministic pure Python TF-IDF fallback matching. |
| `layer3/matching_config.json` | Defines weights, thresholds, and penalty settings. |

## Job Description Parsing

`JobDescriptionEngine.parse_jd` identifies:

- seniority level,
- minimum years,
- mandatory skills,
- bonus skills,
- domain,
- summary text.

It uses both phrase extraction and heuristic line parsing. This allows the matching layer to work even when job posts are not perfectly structured.

## Adaptive Scoring

`IntelligentMatcher.calculate_match` computes:

- semantic similarity between CV summary and job summary,
- skill similarity between CV skills and job skills,
- domain alignment or domain semantic similarity,
- validation penalties,
- bonus-skill boost.

The weights change by target seniority. For example, intern matching favors skills more heavily, while senior and lead matching gives more weight to domain alignment. The configured minimum pass score is 50.

## Constraint Penalties

`ConstraintValidator` subtracts:

- 15 percent per missing mandatory skill, capped at 50 percent,
- a proportional experience shortfall penalty capped at 30 percent,
- 20 percent for seniority mismatch when candidate seniority is below job seniority.

The total validation penalty is capped to avoid a single category making the score mathematically unusable.

## Fit Explanation

`FitAnalysisGenerator` maps scores into verdict language:

- 85 or above: Top Talent,
- 70 or above: Strong Match,
- 50 or above: Potential Fit,
- below 50: Not Recommended.

It also reports strengths, gaps, and red flags. Bonus highlights are currently a placeholder returning an empty list, which should be improved in future work.

## TF-IDF Fallback

`tfidf.py` lowercases text, removes stop words, builds term-frequency and inverse-document-frequency vectors, and computes sparse cosine similarity. It is deterministic and lightweight. In `/api/hybrid-match`, TF-IDF can contribute 40 percent of the combined endpoint result when available.

## Key Limitations

- Matching scores need calibration against a labeled CV/job benchmark.
- Semantic matching depends on model availability.
- TF-IDF does not understand synonyms.
- Job-description parsing can miss requirements in unusual formats.
- Fit results should be presented as guidance, not automated hiring decisions.
