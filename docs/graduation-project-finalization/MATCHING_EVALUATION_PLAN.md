# Matching And Gap Analysis Evaluation Plan

This document is an academic evaluation plan for job matching and gap analysis.
It does not claim final evaluation results.

## Goal

Evaluate whether CareerCompass gives reasonable job recommendations and useful
gap-analysis explanations for a student's CV/profile.

The matching system compares:

- User profile signals, such as predicted role, title/headline, seniority, and
  domain when available.
- User skills normalized through `skills` and `user_skills`.
- Job requirements normalized through `skills` and `job_skills`.
- Job text such as title, description, requirements, and source metadata.
- Optional AI or semantic matching outputs where available.

## Expected Methods To Compare

| Method | Description |
| --- | --- |
| Skill overlap baseline | Scores jobs by direct overlap between normalized user skills and required job skills. |
| TF-IDF only | Compares CV/profile text and job text using lexical term weighting. |
| Semantic similarity only | Compares meanings of CV/profile and job content using embedding or semantic similarity behavior if available. |
| Hybrid matching | Combines normalized skill overlap with text/semantic signals and explainable gap outputs. |

The goal is not only to get a score. The goal is to show whether the score and
explanation make sense to a human reviewer.

## Proposed Ablation Table

| Method | Ranking Agreement | Score Sanity | Explanation Quality | Notes |
| --- | --- | --- | --- | --- |
| Skill overlap baseline | TBD | TBD | TBD | Simple and explainable baseline |
| TF-IDF only | TBD | TBD | TBD | Captures text similarity but may miss synonyms |
| Semantic similarity only | TBD | TBD | TBD | Captures meaning but may be harder to explain |
| Hybrid matching | TBD | TBD | TBD | Expected to balance relevance and explainability |

## Suggested Metrics

### Ranking Agreement

Ask human reviewers to rank or label job fit for a small set of user profiles.
Then compare the system ranking with the human ranking.

Possible measures:

- Top-1 agreement: whether the highest-ranked job is human-labeled High fit.
- Top-3 agreement: whether at least one of the top three jobs is High fit.
- Pairwise agreement: whether the system orders two jobs the same way as the
  human reviewer.

### Match Score Sanity

Review whether scores behave in a reasonable way:

- Jobs sharing many required skills should score higher than unrelated jobs.
- Missing core skills should reduce the score.
- Nice-to-have skills should not dominate essential skills.
- A user with no CV/skills should not receive misleadingly confident matches.

### Human-Labeled Fit Categories

Use three simple labels:

- High: the user appears well suited for the job.
- Medium: the user has some relevant skills but notable gaps.
- Low: the job is mostly unrelated or requires missing core skills.

The labels should be assigned before looking at system scores.

## Example Evaluation Table

| User/CV ID | Job ID | Human Fit | System Score | Matched Skills | Missing Skills | Reviewer Notes |
| --- | --- | --- | --- | --- | --- | --- |
| CV-001 | JOB-001 | High | TBD | React, JavaScript | Testing | Score should be high if frontend role |
| CV-001 | JOB-002 | Medium | TBD | MySQL | Laravel, APIs | Backend gap should be visible |
| CV-001 | JOB-003 | Low | TBD | None | Python, ML, NLP | Score should stay low |

## Explainability Checks

Every useful gap-analysis result should explain:

- Matched skills: skills the user already has that are relevant to the job.
- Missing skills: skills required by the job that are absent or weak in the user
  profile.
- Recommendations: practical learning or profile improvement suggestions.
- Confidence/status: whether the analysis is based on enough data.

This is important for graduation because an explainable recommendation is easier
to defend than an unexplained score.

## Suggested Manual Review Process

1. Select 5-10 user/CV profiles.
2. Select 20-40 representative jobs from demo/API/imported data.
3. Ask reviewers to label fit as High, Medium, or Low.
4. Run each matching method.
5. Compare ranking and score behavior.
6. Review matched/missing skill explanations.
7. Document disagreement examples honestly.

## Limitations

- Human labels may be subjective.
- Small graduation datasets cannot prove general hiring accuracy.
- Job descriptions may be incomplete or noisy.
- Matching scores are guidance for career planning, not hiring decisions.
- Stronger skill ontologies would improve synonym handling and requirement
  grouping.
