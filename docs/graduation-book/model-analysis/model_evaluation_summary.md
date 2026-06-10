# Model Evaluation Summary

## What Was Found

The repository includes:

- Runtime code that can load a local NER artifact under `ai-cv-analyzer/models/ner_weights/career_compass_ner_final`.
- A Colab-oriented NER training notebook.
- A synthetic dataset generator and cleaner.
- API tests for FastAPI status behavior and hybrid-match scoring.
- Graduation-book mini evaluation files for deterministic synthetic CV/job/gap checks.
- Graduation-book AI CV Analyzer smoke evaluation files for deterministic text-sample checks.
- A user-provided exported Colab PDF with visible output cells and overall NER training/evaluation metrics.

The local artifact folder itself is ignored by Git. Safe metadata was inspected on this workstation, but model binaries are not part of the committed repository evidence.

## What Was Not Found

The repository still does not include:

- A committed cleaned training dataset.
- A final model card or training-run report.
- Committed model weights for the optional local NER artifact.
- A reproducible held-out benchmark run for the local NER artifact.

## Metrics Position

The exported Colab PDF now provides recorded training-run metrics from the notebook output cells. The final visible epoch reports precision `0.933307`, recall `0.940521`, F1 `0.936900`, and accuracy `0.976376` on the notebook validation/test split. These values should be documented as Colab-run evidence, not as production accuracy or repository-alone reproducible benchmark results.

The existing mini evaluation is useful as a synthetic regression check for skill, recommendation, and gap-analysis logic. The AI CV Analyzer smoke evaluation is useful as a five-sample deterministic text check with dependency probing. The Colab PDF is stronger NER training evidence than the mini/smoke checks, but it still does not prove production NER accuracy on a large real-world CV benchmark.

## Recommended Next Evaluation

1. Freeze a labeled test set with real or carefully reviewed synthetic CV snippets.
2. Run the notebook or a script version from a clean environment.
3. Save per-label precision, recall, and F1 plus the confusion matrix/error-analysis samples.
4. Add a model card that records dataset source, labels, base model, hyperparameters, metrics, limitations, and privacy constraints.
5. Add a CI-friendly smoke test that loads the local model when an artifact is supplied and checks a few stable examples without requiring the full dataset.
