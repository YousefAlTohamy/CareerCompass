# Layer 2: Professional Modular Classification

This layer transforms extracted text into professional insights. It categorizes the candidate's career domain, seniority level, and skill clusters using a combination of AI models and rule-based logic.

## The Engines

### 1. Domain Engine (`domain_engine.py`)
- **Semantic Classification**: Uses BERT embeddings to compare the candidate's profile against a multi-level industry taxonomy.
- **Taxonomy-Driven**: Maps profiles to categories like "Mobile App Development", "Data Science", or "Human Resources".
- **Dynamic Clusters**: Taxonomy is stored in `data/taxonomy.json` for easy updates.

### 2. Seniority Engine (`seniority_engine.py`)
- **Hybrid Analysis**: Combines quantitative data (Total Years) with qualitative data (Action Verb density and Title keywords).
- **BERT Integration**: Uses semantic analysis of the professional summary to detect "senior-level" versus "junior-level" language patterns.
- **Adaptive Scoring**: Correctly distinguishes between a career-switcher (many years but low skill depth) and a deep expert.

### 3. Skill Engine (`skill_engine.py`)
- **Skill Categorization**: Automatically groups skills into **Hard Skills**, **Soft Skills**, and **Management Skills**.
- **Cluster Matching**: Uses the tech-cluster taxonomy to identify a candidate's core stack (e.g., identifying a "MERN Stack" developer based on individual skill matches).

## Shared AI Provider (`classifier.py`)
- **Model Singleton**: Loads the semantic embedder once and shares it across all engines to optimize memory usage and performance.

## Data-Driven Architecture (`data/taxonomy.json`)
The entire "brain" of Layer 2 is stored in a JSON taxonomy. You can add new industry domains or tech skills without touching the Python code.

## Current Integration Notes

- Layer 2 role/domain/seniority signals feed Laravel's `CvProcessingService`.
- Role discovery now prefers `analysis.predicted_role`, then profile title/headline, then `analysis.primary_domain` as a broad fallback.
- `primary_domain` should remain a domain/category signal; it should not replace a more precise predicted role in recommendation or scraping discovery flows.
- The frontend profile page now displays predicted/current role, primary domain, seniority, total experience, parsing status, and completeness when available.
