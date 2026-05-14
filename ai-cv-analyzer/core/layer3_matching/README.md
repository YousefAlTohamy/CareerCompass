# Layer 3: Intelligent Decision Matchmaking

This is the final decision-making layer. It evaluates how well a candidate fits a specific Job Description (JD) by analyzing multiple semantic and quantitative factors.

## Core Features

### 1. Intelligent Matcher (`similarity.py`)
- **Multi-Factor Scoring**: Calculates a final score based on:
    - **Semantic Vibe**: Contextual alignment of the summary.
    - **Skill Overlap**: Exact and fuzzy hard-skill matching.
    - **Domain Alignment**: Verification that the candidate's domain matches the industry.
- **Constraint Validation**: Checks for "Red Flags" like seniority mismatches or domain shifts.

### 2. Fit Analysis Generator (`fit_analysis_generator.py`)
- **Professional Insights**: Translates mathematical scores into human-readable recruitment reports.
- **Output Components**:
    - **Verdict**: A final recommendation (e.g., "Top Talent", "Potential Fit").
    - **Strengths**: Highlights of what the candidate does well.
    - **Gaps**: Identification of missing mandatory skills or experience shortfalls.
    - **Red Flags**: Critical warnings for recruiters.

### 3. Job Description Engine (`job_description_engine.py`)
- **JD Parsing**: Converts raw JD text into a structured requirement model including mandatory skills, bonus skills, and required seniority.

## Configuration (`matching_config.json`)
The matchmaking weights are fully tunable:
- Adjust the importance of "Skill Overlap" vs "Semantic Similarity".
- Define the minimum passing scores and penalty values for seniority mismatches.

## Current Integration Notes

- Public matching is exposed through `POST /api/hybrid-match` in `ai-cv-analyzer/main.py`.
- When TF-IDF scoring is available, the API combines semantic and TF-IDF scores with a 60/40 formula.
- When TF-IDF scoring is unavailable, the API returns the semantic score directly using `matching_mode="semantic_only_fallback"` and does not penalize the user.
- Laravel's `GapAnalysisService` calls this endpoint when available and falls back to database matching if the AI service is unavailable.
- The frontend ignores stale gap-analysis responses when users switch jobs quickly.
