# Layer 3: Matchmaking API Documentation

This document describes the public API of the Matchmaking layer. It is designed to be modular, allowing developers to use individual components or the full ranking pipeline.

---

## 1. JobDescriptionEngine
**Path**: `core.layer3_matching.job_description_engine.JobDescriptionEngine`

Responsible for parsing raw job description text into a structured format.

### Methods
- `parse_jd(jd_text: str) -> Dict[str, Any]`
    - **Input**: Raw text string of the job posting.
    - **Output**: A dictionary containing:
        - `primary_domain`: Detected industry domain.
        - `seniority`: Detected level (intern, junior, mid, senior, lead).
        - `required_years_min`: Minimum experience years.
        - `mandatory_skills`: List of required technical skills.
        - `bonus_skills`: List of optional/preferred skills.

---

## 2. IntelligentMatcher
**Path**: `core.layer3_matching.similarity.IntelligentMatcher`

The core scoring engine that combines semantic similarity with business rules.

### Methods
- `calculate_match(cv_data: Dict, parsed_jd: Dict) -> Dict[str, Any]`
    - **Input**: Parsed CV data (from Layer 2) and parsed JD data.
    - **Output**:
        - `match_score`: Final weighted score (0.0 - 100.0).
        - `is_qualified`: Boolean based on minimum threshold.
        - `breakdown`: Detailed scores for vibe, skills, and domain.
        - `fit_analysis`: Human-readable strengths, gaps, and verdict.

---

## 3. RankingOrchestrator
**Path**: `core.layer3_matching.ranking_orchestrator.RankingOrchestrator`

Handles 1:N matching (ranking multiple candidates against one job).

### Methods
- `rank_candidates(cv_results: List[Dict], jd_text: str) -> Dict[str, Any]`
    - **Input**: List of CV JSON objects and a raw JD text string.
    - **Output**:
        - `rankings`: Sorted list of candidates by score.
        - `shortlisted_count`: Number of candidates who passed the threshold.

---

## 4. ConstraintValidator
**Path**: `core.layer3_matching.constraint_validator.ConstraintValidator`

Internal engine for enforcing hard recruitment rules.

### Methods
- `validate_constraints(cv_data: Dict, parsed_jd: Dict) -> Dict[str, Any]`
    - **Output**: Penalty score (0.0 - 0.8) and a list of violations.

---

## 5. Configuration
All matchmaking logic (weights and thresholds) can be tuned via:
`core/layer3_matching/matching_config.json`

---

## Quick Start Example

```python
from core.layer3_matching.ranking_orchestrator import RankingOrchestrator
from core.layer3_matching.similarity import IntelligentMatcher
# ... initialize engines ...

results = orchestrator.rank_candidates(list_of_cvs, "Raw JD text here...")
print(f"Top Candidate: {results['rankings'][0]['candidate_name']}")
```
