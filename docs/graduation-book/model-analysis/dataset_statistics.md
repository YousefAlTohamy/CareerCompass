# Dataset Statistics and Evidence Availability

## Search Result

The final NER training dataset was not found in the committed repository or in the reviewed helper folder. The repository contains the training notebook, synthetic data generator, cleaner, and evaluation mini/smoke datasets, but not `train_real_tech.json`, `train_real_tech_cleaned.json`, saved training logs, model weights, or final metric output cells.

## Reproducible Counts

| Evidence Source | File(s) | Reproducible Count | Notes |
|---|---|---:|---|
| Final NER training dataset | `ai-cv-analyzer/training/train_real_tech_cleaned.json` | 0 available | Expected by notebook/helper docs, but not committed. |
| Notebook split logic | `ai-cv-analyzer/training/train_ner.ipynb` | 90/10 split logic | Requires cleaned dataset to compute train/test row counts. |
| Mini CV evaluation data | `docs/graduation-book/evaluation/mini_cv_dataset.json` | 5 CV samples | Synthetic deterministic documentation dataset. |
| Mini job evaluation data | `docs/graduation-book/evaluation/mini_jobs_dataset.json` | 8 job samples | Synthetic deterministic documentation dataset. |
| AI CV Analyzer smoke data | `docs/graduation-book/evaluation/ai_cv_analyzer_smoke_samples.json` | 5 CV text samples | Small deterministic smoke dataset, not a transformer benchmark. |

## NER Label Distribution Status

The real NER label distribution cannot be computed because the cleaned labeled training dataset is not committed. A label distribution chart would risk implying that the unavailable final dataset was counted. Instead, the book uses `assets/diagrams/29_dataset_evidence_availability.png` to show which evidence is present and which evidence is unavailable.

## Academic Interpretation

This is an evidence transparency result, not a project failure. For a graduation/demo system, it is acceptable to document the training workflow and evaluation limitation honestly. A stronger final model package should add a frozen labeled test set, per-label precision/recall/F1, a model card, a dataset card, and a reproducible script that can run when model weights are supplied.
