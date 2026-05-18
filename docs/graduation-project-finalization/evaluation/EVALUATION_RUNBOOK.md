# Evaluation Runbook

This runbook explains how to run the graduation evaluation without claiming
numbers before they are actually measured.

## Steps

1. Collect anonymized or synthetic CV samples.
2. Assign each CV an ID such as `CV-001`.
3. Manually label expected skills, target role, and expected parsing status.
4. Run the real CareerCompass AI CV Analyzer manually or through the existing app
   flow.
5. Export or manually copy predictions into `cv_predictions.json`.
6. Run `evaluate_cv_extraction.py` against gold labels and predictions.
7. Prepare job-fit labels for matching and gap analysis.
8. Run `evaluate_matching.py`.
9. Record output in `results/` without editing labels after seeing predictions.
10. Use measured output in the final report only after validation.

## Example Commands

The following commands use sample/template files only. They verify that the
framework works; they are not final benchmark results.

```bash
python docs/graduation-project-finalization/evaluation/scripts/evaluate_cv_extraction.py \
  --gold docs/graduation-project-finalization/evaluation/data/cv_gold_labels.sample.json \
  --pred docs/graduation-project-finalization/evaluation/data/cv_predictions.template.json
```

```bash
python docs/graduation-project-finalization/evaluation/scripts/evaluate_matching.py \
  --gold docs/graduation-project-finalization/evaluation/data/matching_gold_labels.sample.json \
  --pred docs/graduation-project-finalization/evaluation/data/matching_predictions.template.json
```

To save machine-readable sample verification output:

```bash
python docs/graduation-project-finalization/evaluation/scripts/evaluate_cv_extraction.py \
  --gold docs/graduation-project-finalization/evaluation/data/cv_gold_labels.sample.json \
  --pred docs/graduation-project-finalization/evaluation/data/cv_predictions.template.json \
  --json-output docs/graduation-project-finalization/evaluation/results/cv_evaluation_results.sample.json
```

```bash
python docs/graduation-project-finalization/evaluation/scripts/evaluate_matching.py \
  --gold docs/graduation-project-finalization/evaluation/data/matching_gold_labels.sample.json \
  --pred docs/graduation-project-finalization/evaluation/data/matching_predictions.template.json \
  --json-output docs/graduation-project-finalization/evaluation/results/matching_evaluation_results.sample.json
```

For final defense metrics, create separate real evaluation files from the
validated dataset and keep the sample/template files unchanged.
