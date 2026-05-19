# Graduation Evaluation Framework

This folder contains the graduation evaluation framework for CareerCompass. It is
designed to measure the AI CV Analyzer and job matching/gap-analysis behavior in
an honest academic setting.

The files here do not claim final benchmark results. They provide a repeatable
structure for preparing labels, collecting predictions, running calculations,
and recording measured outputs after validation.

## What This Framework Measures

- Skill extraction precision, recall, and F1-score.
- Role prediction exact and compatible accuracy.
- Parsing status correctness.
- Job-fit ranking sanity.
- Human High/Medium/Low fit labels.
- Matched and missing skill explanation checks.

## Folder Contents

| Path | Purpose |
| --- | --- |
| `EVALUATION_RUNBOOK.md` | Step-by-step process for running the evaluation. |
| `DATASET_GUIDE.md` | Dataset size, privacy, and role coverage guidance. |
| `CV_LABELING_GUIDE.md` | Rules for labeling CV skills, roles, and parsing status. |
| `MATCHING_LABELING_GUIDE.md` | Rules for labeling job-fit and explanations. |
| `data/` | Sample labels and prediction templates. |
| `scripts/` | Pure Python evaluation scripts. |
| `results/` | Place for generated evaluation outputs. |

The sample and template files are examples for verifying the framework. They are
not final measured CareerCompass results.
