# ai-hybrid-orchestrator

> **Facade Pattern** — a single entry-point combining `ai-job-miner` + `ai-cv-analyzer` into one unified hybrid pipeline, now exposed as a **FastAPI microservice** for Laravel integration.

---

## Overview

| Engine             | Directory            | Role                                                                    |
| ------------------ | -------------------- | ----------------------------------------------------------------------- |
| **AI Job Miner**   | `../ai-job-miner/`   | 5-phase heuristic scraping + TF-IDF matching                            |
| **AI CV Analyzer** | `../ai-cv-analyzer/` | BERT NER · BART-MNLI domain classification · MiniLM semantic embeddings |

---

## Directory Structure

```
ai-hybrid-orchestrator/
├── __init__.py              # Package marker
├── contact_extractor.py     # Regex contact info extractor (email, phone, LinkedIn, GitHub, location)
├── hybrid_runner.py         # Standalone CLI pipeline runner (for testing)
├── main_api.py              # FastAPI gateway — 3 endpoints consumed by Laravel
├── test_api.py              # End-to-end test runner using FastAPI TestClient (5 test groups)
├── hybrid_output.txt        # Output from last CLI test run
└── README.md                # This file
```

---

## FastAPI Microservice — `main_api.py`

### Run Server

```bash
cd ai-hybrid-orchestrator
uvicorn main_api:app --host 0.0.0.0 --port 8000 --reload
```

- Swagger UI: **http://127.0.0.1:8000/docs**
- Health check: **http://127.0.0.1:8000/**

### Startup Behaviour

On startup, the gateway loads all 3 heavy AI models **once** into memory (Singleton via FastAPI `lifespan`):

| Model                      | Loaded By            | Purpose                                |
| -------------------------- | -------------------- | -------------------------------------- |
| `dslim/bert-base-NER`      | `SkillNEREngine`     | Skills · Roles · Orgs extraction       |
| `facebook/bart-large-mnli` | `CVDomainClassifier` | Zero-shot domain classification        |
| `all-MiniLM-L6-v2`         | `IntelligentMatcher` | Semantic embedding + cosine similarity |

---

## API Endpoints

### `GET /`

**Health check.**

```json
{
  "status": "operational",
  "version": "1.0.0",
  "service": "Career Compass AI Gateway"
}
```

---

### `POST /api/v1/parse-cv`

**Upload a CV file → extract skills, domain, and contact info.**

| Parameter | Type         | Description            |
| --------- | ------------ | ---------------------- |
| `cv_file` | `UploadFile` | PDF · DOCX · PNG · JPG |

**Example response:**

```json
{
  "skills": ["Python", "TensorFlow", "Flutter"],
  "domain": "Mobile App Development",
  "domain_confidence": "65.7%",
  "extraction_method": "pymupdf",
  "contact_info": {
    "email": "ahmed@example.com",
    "phone": "+20 101 234 5678",
    "linkedin_url": "https://linkedin.com/in/ahmedkhames",
    "github_url": "https://github.com/ahmedkhames",
    "location": "Cairo, Egypt"
  }
}
```

**Laravel call (Guzzle):**

```php
$response = Http::attach('cv_file', $fileContents, $fileName)
                ->post(config('services.ai_gateway.url') . '/api/v1/parse-cv');
```

---

### `POST /api/v1/scrape-on-demand`

**Scrape a job listing URL — returns up to 5 parsed job dicts.**

| Parameter    | Type        | Description                              |
| ------------ | ----------- | ---------------------------------------- |
| `source_url` | `Form(str)` | Full URL of the job listing or job board |

**Example response:**

```json
{
  "scraped": 2,
  "jobs": [
    {
      "url": "https://example.com/jobs/python-dev",
      "title": "Senior Python Developer",
      "job_type": "Full-time",
      "work_model": "Remote",
      "location": "Cairo, Egypt",
      "working_hours": "40 hours/week",
      "salary": {
        "min_salary": 90000,
        "max_salary": 120000,
        "currency": "USD"
      },
      "experience": { "min_exp": 4, "max_exp": 6 },
      "skills": ["python", "django", "docker"],
      "match_score": 0.87
    }
  ]
}
```

---

### `POST /api/v1/hybrid-match`

**Compute a weighted hybrid match score between a CV and a job description.**

**Formula:** `Final = (Semantic × 60%) + (TF-IDF × 40%)`

**Request body (JSON):**

```json
{
  "cv_text": "Ahmed Khames, Python developer with 5 years...",
  "cv_skills": ["python", "django", "docker"],
  "job_description": "We need a Python/Django backend engineer...",
  "job_skills": ["python", "django", "kubernetes", "fastapi"]
}
```

**Example response:**

```json
{
  "hybrid_match_score": 74.3,
  "semantic_score": 68.1,
  "tfidf_score": 84.2,
  "missing_skills": ["kubernetes", "fastapi"],
  "formula": "Final = (Semantic × 60%) + (TF-IDF × 40%)"
}
```

---

## Contact Extractor — `contact_extractor.py`

Standalone Regex-based utility. No ML required.

```python
from contact_extractor import extract_contacts

info = extract_contacts(raw_cv_text)
# {
#   "email":        "ahmed@example.com",
#   "phone":        "+20 101 234 5678",
#   "linkedin_url": "https://linkedin.com/in/ahmedkhames",
#   "github_url":   "https://github.com/ahmedkhames",
#   "location":     "Cairo, Egypt"
# }
```

| Pattern  | Matches                                                            |
| -------- | ------------------------------------------------------------------ |
| Email    | RFC-5321 simplified — `name@domain.tld`                            |
| Phone    | Optional `+country` · optional `(area)` · 7–15 digit blocks        |
| LinkedIn | `linkedin.com/in/<handle>` — adds `https://` if missing            |
| GitHub   | `github.com/<user>` — adds `https://` if missing                   |
| Location | Keyword-anchored: `Location:` · `Address:` · `Based in:` · `City:` |

---

## Hybrid Pipeline (CLI mode)

The standalone `hybrid_runner.py` runs the full pipeline from the command line:

```bash
cd ai-hybrid-orchestrator
python hybrid_runner.py  # edit MOCK_CV_PATH / MOCK_JOB_URL at the bottom
```

---

## Hybrid Scoring Formula

```
Final Score = (Semantic Score × 60%) + (TF-IDF Score × 40%)
```

| Signal             | Model                                | Weight  |
| ------------------ | ------------------------------------ | ------- |
| **Semantic Score** | `all-MiniLM-L6-v2` cosine similarity | **60%** |
| **TF-IDF Score**   | Pure-Python cosine similarity        | **40%** |

---

## Namespace Isolation

Both engines expose a top-level `core/` package. Resolved in both `main_api.py` and `test_api.py` by:

1. **`_wipe_core()`** — removes all `core` and `core.*` entries from `sys.modules`
2. **`_set_path_exclusive(root)`** — rebuilds `sys.path` with only `root` as the active engine
3. Load **ai-cv-analyzer** exclusively first → its `core` wins
4. Call `_wipe_core()` again → wipe cv-analyzer's `core.*` from the cache
5. Load **ai-job-miner** exclusively → `core.engine` is re-discovered cleanly
6. Restore both roots to `sys.path` for runtime intra-package imports

---

## Testing — `test_api.py`

```bash
cd ai-hybrid-orchestrator
python test_api.py
```

`TestClient` is used as a **context manager** (`with TestClient(app) as client:`) to trigger the FastAPI `lifespan` event — this is what loads the 3 AI model singletons before any endpoint is called.

| Test Group                                   | What is verified                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test 0** — `GET /`                         | Health check returns `{"status": "operational"}`                                                                                                  |
| **Test 1** — `POST /api/v1/parse-cv`         | Runs against `ai-cv-analyzer/test.pdf` — checks all keys: `skills`, `domain`, `domain_confidence`, `contact_info` (5 fields), `extraction_method` |
| **Test 2** — `POST /api/v1/scrape-on-demand` | Hits Remotive API — checks `jobs` list returned                                                                                                   |
| **Test 3** — `POST /api/v1/hybrid-match`     | Dummy backend engineer CV vs JD — checks `hybrid_match_score`, `semantic_score`, `tfidf_score`, `missing_skills`, `formula`                       |
| **Test 4** — Validation guards               | 4a: `.txt` → 422 · 4b: `ftp://` → 422 · 4c: blank `cv_text` → 422                                                                                 |

---

## Dependencies

```bash
pip install fastapi uvicorn python-multipart aiohttp beautifulsoup4 \
            sentence-transformers scikit-learn pymupdf python-docx \
            opencv-python-headless transformers torch spacy
```

---

## Roadmap

| Phase        | Feature                                                                           | Status |
| ------------ | --------------------------------------------------------------------------------- | ------ |
| Phase 1–5    | ai-job-miner 5-phase scraping pipeline                                            | ✅     |
| Phase 6a     | ai-cv-analyzer 3-layer ML pipeline                                                | ✅     |
| Phase 6b     | Hybrid Orchestrator Facade (CLI runner)                                           | ✅     |
| **Phase 6c** | **FastAPI Gateway + Contact Extractor**                                           | ✅     |
| Phase 7      | Laravel integration — update `CvController`, `JobController` to call this gateway | 🔜     |
