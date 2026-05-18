# AI CV Analyzer Evaluation Plan

This document is an academic evaluation plan. It does not claim final evaluation
results.

## Goal

Evaluate how well the AI CV Analyzer converts a CV into structured career data:

- Extracted skills.
- Predicted role or target role.
- Seniority/domain signals where available.
- Parsing status.
- Structured profile information useful for recommendations and gap analysis.

The evaluation should show that the analyzer is measurable, not magical. The
defense explanation should distinguish between system capability and measured
accuracy.

## Dataset Proposal

Prepare a small manually labeled dataset for graduation evaluation:

- Student CVs from the team or volunteer classmates, with private information
  removed.
- Synthetic-but-realistic CVs written by the team for controlled cases.
- Public sample CV templates converted into PDF/DOCX where license and privacy
  allow.
- Edge cases: missing skills section, two-column layouts, long experience
  sections, weak formatting, and mixed-language CVs.

Do not include private CVs in the repository unless permission and anonymization
are handled.

## Sample Size Recommendation

For a graduation defense, a practical minimum is:

| Dataset Part | Suggested Size |
| --- | --- |
| Clean technical CVs | 10-15 |
| Imperfect or unusual formatting CVs | 5-10 |
| Arabic or mixed-language CVs | 3-5 |
| Total initial evaluation set | 20-30 |

This is enough to demonstrate method and measurement, while still being honest
that it is not a large benchmark.

## Evaluation Metrics

### Skill Extraction Precision

Precision measures how many extracted skills are actually correct.

```text
precision = true_positive_skills / (true_positive_skills + false_positive_skills)
```

Example question: when the analyzer says the CV contains `Laravel`, how often is
that correct?

### Skill Extraction Recall

Recall measures how many manually labeled skills the analyzer found.

```text
recall = true_positive_skills / (true_positive_skills + false_negative_skills)
```

Example question: if the CV clearly contains `React`, did the analyzer extract
it?

### Skill Extraction F1-Score

F1-score balances precision and recall.

```text
F1 = 2 * (precision * recall) / (precision + recall)
```

Use F1-score when comparing analyzer versions or parsing strategies.

### Role Prediction Accuracy

Role prediction accuracy measures how often the predicted role matches the
manual label or an accepted equivalent label.

Because job titles can vary, define acceptable aliases before evaluation. For
example, `Frontend Developer` and `React Developer` may be counted as compatible
if the manual labeling guide allows it.

### Parsing Status Correctness

Parsing status correctness measures whether the returned status matches what a
human reviewer expects:

- `success` for a readable CV with meaningful extracted content.
- `ocr_fallback` if OCR/fallback processing was needed and content was recovered.
- `no_text` or similar status for a scanned/empty document with no usable text.
- `timeout` or `error` when processing genuinely fails.

This matters because honest status reporting is part of system quality.

## Manual Labeling Process

1. Assign each CV an anonymous ID such as `CV-001`.
2. Two reviewers manually label:
   - Main technical skills.
   - Tools/frameworks.
   - Likely role.
   - Seniority if obvious.
   - Expected parsing status.
3. Resolve disagreements in a short review meeting.
4. Store final labels in a spreadsheet or evaluation CSV.
5. Run the analyzer on the same CV set.
6. Compare extracted outputs against labels.
7. Record metrics without editing labels after seeing the output.

## Example Skill Evaluation Table

| CV ID | Manual Skills | Extracted Skills | True Positives | False Positives | False Negatives | Precision | Recall | F1 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CV-001 | React, Laravel, MySQL | React, Laravel, PHP | React, Laravel | PHP | MySQL | TBD | TBD | TBD |
| CV-002 | Python, NLP, FastAPI | Python, FastAPI | Python, FastAPI | None | NLP | TBD | TBD | TBD |

## Example Role Evaluation Table

| CV ID | Manual Role | Analyzer Predicted Role | Accepted? | Notes |
| --- | --- | --- | --- | --- |
| CV-001 | Frontend Developer | React Developer | TBD | Alias policy needed |
| CV-002 | Backend Developer | Python Developer | TBD | Review role granularity |

## Example Parsing Status Table

| CV ID | Expected Status | Analyzer Status | Correct? | Notes |
| --- | --- | --- | --- | --- |
| CV-001 | success | TBD | TBD | Clean text PDF |
| CV-010 | no_text or ocr_fallback | TBD | TBD | Scanned document |

## Limitations

- The graduation dataset will likely be small.
- AI accuracy depends on CV quality and formatting.
- CV formats vary widely across students, templates, and languages.
- Arabic and mixed-language CVs need more testing.
- Skill labels can be ambiguous without a stronger ontology.
- This plan evaluates output quality, not real hiring outcomes.

## Defense Summary

During the defense, present this as a planned or initial academic evaluation
method unless the metrics have actually been calculated. Do not invent final
numbers.
