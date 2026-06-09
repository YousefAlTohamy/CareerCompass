# AI CV Analyzer Smoke Evaluation Summary

This is a small deterministic smoke evaluation for the graduation book. It is not a full NER benchmark and it does not evaluate the transformer model weights.

## Runtime Boundary

- Full analyzer import: unavailable
- Full analyzer import error: `ModuleNotFoundError: No module named 'numpy'`
- TF-IDF probe: available; score=0.5101

## Summary Metrics

| Metric | Value |
|---|---:|
| Macro skill precision | 0.971 |
| Macro skill recall | 1.000 |
| Macro skill F1 | 0.985 |
| Role match rate | 1.000 |
| Domain match rate | 1.000 |
| Seniority match rate | 0.800 |
| Parsing status match rate | 1.000 |

## Per-Sample Results

| Sample | Skills F1 | Role | Domain | Seniority | Status |
|---|---:|---|---|---|---|
| smoke_backend_laravel | 1.000 | pass | pass | check | pass |
| smoke_data_analyst | 1.000 | pass | pass | pass | pass |
| smoke_frontend_react | 0.923 | pass | pass | pass | pass |
| smoke_devops_cloud | 1.000 | pass | pass | pass | pass |
| smoke_low_information | 1.000 | pass | pass | pass | pass |

## Interpretation

The smoke samples are useful for proving that the documentation evaluator and schema examples are reproducible. They should not be cited as final model accuracy.
