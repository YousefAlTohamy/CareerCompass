# Dataset Statistics and Evidence Availability

## Search Result

The final NER training dataset was not found in the committed repository or in the reviewed helper folder. The repository contains the training notebook, synthetic data generator, cleaner, evaluation mini/smoke datasets, and now the exported Colab results PDF, but not the actual `train_real_tech.json`, `train_real_tech_cleaned.json` dataset content or model weights.

The user-provided Colab PDF (`colab_train_ner_results.pdf`) records the notebook output cells for a training run. It shows dataset row counts, labels, training parameters, and overall epoch metrics. These are recorded Colab-run results, not repository-alone reproducible dataset artifacts.

## Reproducible Counts

| Evidence Source | File(s) | Reproducible Count | Notes |
|---|---|---:|---|
| Final NER training dataset | `ai-cv-analyzer/training/train_real_tech_cleaned.json` | 0 available | Expected by notebook/helper docs, but not committed. |
| Notebook split logic | `ai-cv-analyzer/training/train_ner.ipynb` | 90/10 split logic | Requires cleaned dataset to compute train/test row counts. |
| Colab recorded total rows | `docs/graduation-book/model-analysis/colab_train_ner_results.pdf` | 45,911 rows | Visible PDF output from `train_ner.ipynb - Colab`; dataset content is not included. |
| Colab recorded train split | `docs/graduation-book/model-analysis/colab_train_ner_results.pdf` | 41,319 rows | Visible PDF output; split uses test size 0.1 and seed 42. |
| Colab recorded test split | `docs/graduation-book/model-analysis/colab_train_ner_results.pdf` | 4,592 rows | Visible PDF output; used for notebook evaluation metrics. |
| Mini CV evaluation data | `docs/graduation-book/evaluation/mini_cv_dataset.json` | 5 CV samples | Synthetic deterministic documentation dataset. |
| Mini job evaluation data | `docs/graduation-book/evaluation/mini_jobs_dataset.json` | 8 job samples | Synthetic deterministic documentation dataset. |
| AI CV Analyzer smoke data | `docs/graduation-book/evaluation/ai_cv_analyzer_smoke_samples.json` | 5 CV text samples | Small deterministic smoke dataset, not a transformer benchmark. |

## NER Label Distribution Status

The real per-label NER distribution cannot be computed from committed dataset files because the cleaned labeled training dataset is not committed. The Colab PDF shows the label list (`O`, `B-SKILL`, `I-SKILL`, `B-ROLE`, `I-ROLE`, `B-EDU`, `I-EDU`, `B-CERT`, `I-CERT`, `B-SOFT`, `I-SOFT`) but does not show per-label support counts or a classification report. A per-label distribution chart would therefore risk implying counts that were not visible in the PDF. The book uses `assets/diagrams/29_dataset_evidence_availability.png` for evidence availability and `assets/diagrams/31_colab_ner_metrics.png` for verified overall Colab metrics.

## Academic Interpretation

This is an evidence transparency result, not a project failure. For a graduation/demo system, it is acceptable to document the training workflow, the recorded Colab metric outputs, and the remaining reproducibility limitation honestly. A stronger final model package should add the frozen labeled test set, per-label precision/recall/F1, a model card, a dataset card, model weights or retrieval instructions, and a reproducible script that can run when model artifacts are supplied.
