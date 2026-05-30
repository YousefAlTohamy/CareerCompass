# Mini Evaluation Summary

This evaluation uses synthetic demo data created for the graduation book. It is an offline keyword and skill-overlap evaluation, not a production benchmark and not a live AI service accuracy claim.

## Dataset

- CV samples: 5
- Job samples: 8

## Summary Metrics

| Area | Metric | Value |
|---|---|---:|
| CV Analyzer offline | Macro skill precision | 1.000 |
| CV Analyzer offline | Macro skill recall | 1.000 |
| CV Analyzer offline | Macro skill F1 | 1.000 |
| CV Analyzer offline | Role match rate | 1.000 |
| CV Analyzer offline | Seniority match rate | 1.000 |
| CV Analyzer offline | Domain match rate | 1.000 |
| Recommendation offline | Top-1 relevance | 1.000 |
| Recommendation offline | Top-3 relevance | 1.000 |
| Recommendation offline | Mean precision@3 | 0.800 |
| Gap analysis offline | Matched skill agreement F1 | 1.000 |
| Gap analysis offline | Missing skill agreement F1 | 1.000 |

## Limitations

- Synthetic CVs and jobs are intentionally small and fake.
- Metrics are computed from deterministic keyword and overlap logic.
- Results are useful for graduation validation and regression checks, not for production model claims.
- Live AI CV Analyzer endpoint evaluation can be added later if the service test dependencies and runtime are standardized.
