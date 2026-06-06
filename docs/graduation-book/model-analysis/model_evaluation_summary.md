# Model Evaluation Summary

## What Was Found

The repository includes:

- Runtime code that can load a local NER artifact under `ai-cv-analyzer/models/ner_weights/career_compass_ner_final`.
- A Colab-oriented NER training notebook.
- A synthetic dataset generator and cleaner.
- API tests for FastAPI status behavior and hybrid-match scoring.
- Graduation-book mini evaluation files for deterministic synthetic CV/job/gap checks.

The local artifact folder itself is ignored by Git. Safe metadata was inspected on this workstation, but model binaries are not part of the committed repository evidence.

## What Was Not Found

The repository did not include:

- A committed cleaned training dataset.
- Training notebook output cells with final precision, recall, F1, or accuracy.
- A final model card or training-run report.
- Committed model weights for the optional local NER artifact.
- A reproducible held-out benchmark run for the local NER artifact.

## Metrics Position

The training notebook defines sequence-labeling metrics, but this update did not produce final model metrics. The graduation book should therefore avoid high-accuracy claims unless the team later commits a reproducible labeled dataset and final training/evaluation output.

The existing mini evaluation is useful as a synthetic regression check for skill, recommendation, and gap-analysis logic. It is not evidence of production NER accuracy.

## Recommended Next Evaluation

1. Freeze a labeled test set with real or carefully reviewed synthetic CV snippets.
2. Run the notebook or a script version from a clean environment.
3. Save per-label precision, recall, and F1.
4. Add a model card that records dataset source, labels, base model, hyperparameters, metrics, limitations, and privacy constraints.
5. Add a CI-friendly smoke test that loads the local model when an artifact is supplied and checks a few stable examples without requiring the full dataset.
