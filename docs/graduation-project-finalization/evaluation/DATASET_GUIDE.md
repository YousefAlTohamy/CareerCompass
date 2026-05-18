# Dataset Guide

CareerCompass needs a small but honest graduation dataset. The goal is to
demonstrate measurable behavior, not to claim a large benchmark.

## Recommended Graduation Dataset Size

| Dataset Part | Suggested Count |
| --- | --- |
| Clean technical CVs | 10-15 |
| Imperfect CVs | 5-10 |
| Arabic or mixed-language CVs | 3-5 |
| Total target | 20-30 |

This size is enough for a graduation demonstration and discussion of methods. It
is not enough to prove broad production accuracy.

## Privacy Rules

- Do not commit real private CVs to git.
- Remove names, emails, phone numbers, addresses, links, and IDs.
- Use synthetic CVs when permission is unclear.
- Keep raw CV files outside the repository unless they are public, licensed, and
  anonymized.
- Store only labels and predictions needed for evaluation.

## Recommended Roles

- Backend Developer.
- Frontend Developer.
- Full Stack Developer.
- Data Analyst.
- AI/ML Engineer.
- DevOps Engineer.

## Recommended Job-Fit Cases

Prepare examples where the expected job fit is:

- High: the candidate has most core required skills.
- Medium: the candidate has related skills but visible gaps.
- Low: the job is mostly unrelated or missing core skills.

Label the expected fit before looking at CareerCompass scores.
