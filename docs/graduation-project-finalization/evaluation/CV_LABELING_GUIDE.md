# CV Labeling Guide

This guide keeps CV labels consistent across reviewers.

## Labeling Skills

Label skills that are clearly supported by the CV. Prefer explicit skills,
frameworks, tools, and technologies over vague claims.

Good labels:

- `Laravel`
- `React`
- `MySQL`
- `Docker`
- `REST API`

Avoid labeling unsupported inferences. For example, do not label `Kubernetes`
unless the CV mentions it directly or describes equivalent work clearly.

## Skill Normalization Rules

Use consistent names before scoring:

- `JS` -> `JavaScript`
- `React.js` / `ReactJS` -> `React`
- `REST APIs` -> `REST API`
- Treat `SQL` and `MySQL` carefully:
  - Use `SQL` for general query/database skill.
  - Use `MySQL` only when MySQL is specifically mentioned.

## Labeling Role

Choose the closest expected role from the CV evidence:

- Backend Developer.
- Frontend Developer.
- Full Stack Developer.
- Data Analyst.
- AI/ML Engineer.
- DevOps Engineer.

If a CV fits more than one role, choose the strongest primary role and add a
reviewer note.

## Labeling Parsing Status

Use one of these statuses:

- `success`: readable CV and meaningful structured output is expected.
- `partial_success`: readable content exists, but formatting or missing sections
  may limit extraction.
- `ocr_fallback`: scanned/image-heavy CV where OCR/fallback is expected.
- `no_text`: document has no extractable text.
- `empty_file`: file is empty or invalid as a CV.
- `timeout`: processing should be considered timed out.
- `error`: processing should fail for a non-timeout reason.

## Reviewer Disagreement

If reviewers disagree:

1. Compare the exact CV evidence.
2. Normalize naming first.
3. Keep the label only if the evidence is clear.
4. Record unresolved ambiguity in reviewer notes.
5. Do not change gold labels after seeing predictions.

## Scoring Terms

- True positive: predicted skill appears in the gold labels.
- False positive: predicted skill is not supported by the gold labels.
- False negative: gold skill was missed by the prediction.
