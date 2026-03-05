# ai-hybrid-orchestrator

> **Facade Pattern** — a single entry-point that combines two independent AI engines into one unified hybrid matching pipeline.

---

## Overview

This orchestrator acts as a **Facade** over two standalone microservices that were built across Phases 1–5:

| Engine             | Directory            | Role                                                                                                                                        |
| ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI Job Miner**   | `../ai-job-miner/`   | Scrapes and parses job listings from any URL using the 5-phase heuristic + AI pipeline (Token Bucket, DLQ, async generator)                 |
| **AI CV Analyzer** | `../ai-cv-analyzer/` | Parses CVs (PDF / DOCX / Image), extracts entities via BERT NER, classifies domain with BART-MNLI, and embeds text semantically with MiniLM |

---

## Directory Structure

```
ai-hybrid-orchestrator/
├── __init__.py          # Package marker
├── README.md            # This file
├── hybrid_runner.py     # Core facade: process_hybrid_application()
└── hybrid_output.txt    # Output from the last local test run
```

---

## The Hybrid Pipeline

`process_hybrid_application(cv_path, job_url)` runs in 3 sequential actions:

```
cv_path + job_url
        │
        ├─── [A] ScrapingEngine.stream_jobs()  ─── ai-job-miner ───────────────────┐
        │         Phase 1: SmartAsyncClient (Token Bucket + Backoff + UA rotation)  │
        │         Phase 2: HtmlSmartScraper (DFS density + title <h1> + location)   │
        │         Phase 3: Regex FSM cleaners (job_type, work_model, salary, exp)   │
        │         Phase 4: NER skill extractor + TF-IDF match scorer               │
        │         Phase 5: DLQ fault-tolerance + O(1) async generator              │
        │                                                                            │
        ├─── [B] CV Analysis Pipeline  ────────── ai-cv-analyzer ──────────────────┤
        │         Layer 1: PyMuPDF / python-docx / EasyOCR → raw text              │
        │         Layer 1: dslim/bert-base-NER → skills, roles, orgs               │
        │         Layer 2: facebook/bart-large-mnli → domain classification         │
        │                                                                            │
        └─── [C] Hybrid Scoring ──────────────────────────────────────────────────┘
                  Semantic Score  (MiniLM all-MiniLM-L6-v2 cosine) × 60%
                  TF-IDF Score    (pure-Python cosine similarity)   × 40%
                  ─────────────────────────────────────────────
                  Final Score  =  (Semantic × 0.6) + (TF-IDF × 0.4)
```

---

## Hybrid Scoring Formula

```
Final Score = (Semantic Score × 60%) + (TF-IDF Score × 40%)
```

| Signal                | Model                                                                                                              | Weight  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | ------- |
| **Semantic Score**    | `all-MiniLM-L6-v2` sentence embeddings + cosine similarity (`ai-cv-analyzer` Layer 3)                              | **60%** |
| **TF-IDF Math Score** | Term Frequency–Inverse Document Frequency + cosine similarity, pure Python, no NumPy (`ai-job-miner` `ai.matcher`) | **40%** |

---

## Namespace Isolation

Both engines expose a top-level `core/` package. The collision is resolved at import time by:

1. Loading **ai-cv-analyzer** exclusively first (only its root on `sys.path`, `core.*` wiped from `sys.modules`).
2. Saving the cv-analyzer `core.*` modules under `cva.*` aliases in `sys.modules`.
3. Swapping to **ai-job-miner** exclusively to import `core.engine` and `ai.matcher`.
4. Restoring both roots to `sys.path` for runtime intra-package imports.

---

## Output Structure

```json
{
  "job": {
    "url": "https://...",
    "title": "Senior Backend Engineer",
    "job_type": "Full-time",
    "work_model": "Remote",
    "location": "Cairo, Egypt",
    "working_hours": "40 hours/week",
    "salary": { "min_salary": 90000, "max_salary": 120000, "currency": "USD" },
    "experience": { "min_exp": 4, "max_exp": 6 },
    "skills": ["python", "django", "fastapi", "docker", "kubernetes"]
  },
  "cv": {
    "raw_text_preview": "Ahmed Khames … Cross-platform, AI …",
    "extraction_method": "pymupdf",
    "skills": ["Python", "TensorFlow", "Flutter"],
    "roles": [],
    "domain": "Mobile App Development",
    "domain_confidence": "65.7%"
  },
  "scores": {
    "semantic_score_pct": 72.4,
    "tfidf_score_pct": 91.8,
    "final_score_pct": 80.2,
    "formula": "Final = (Semantic × 60%) + (TF-IDF × 40%)",
    "missing_skills": ["kubernetes", "kafka"]
  }
}
```

---

## AI Models Used

| Model                      | Source                              | Purpose                                        |
| -------------------------- | ----------------------------------- | ---------------------------------------------- |
| `dslim/bert-base-NER`      | HuggingFace                         | Named Entity Recognition — skills, roles, orgs |
| `facebook/bart-large-mnli` | HuggingFace                         | Zero-shot domain classification                |
| `all-MiniLM-L6-v2`         | HuggingFace / sentence-transformers | Semantic text embeddings                       |

All models are downloaded automatically on first run and cached locally by HuggingFace.

---

## Health Check Results (Pre-Integration)

| Engine                        | Result                  |
| ----------------------------- | ----------------------- |
| `ai-job-miner` pytest         | **186 / 186 passed ✅** |
| `ai-cv-analyzer` import check | **ALL IMPORTS OK ✅**   |

---

## Usage

```bash
cd ai-hybrid-orchestrator
python hybrid_runner.py
```

To test with a real CV and job URL, edit these two constants at the bottom of `hybrid_runner.py`:

```python
MOCK_CV_PATH = r"C:\path\to\your\real_cv.pdf"          # PDF, DOCX, PNG, JPG
MOCK_JOB_URL = "https://example.com/job/python-dev"    # any HTML job listing page
```

---

## Dependencies

Install on the system Python (required for cross-engine import):

```bash
pip install aiohttp beautifulsoup4 sentence-transformers scikit-learn \
            pymupdf python-docx opencv-python-headless pytesseract \
            transformers torch spacy numpy
```

---

## Roadmap

| Phase                                                                      | Status |
| -------------------------------------------------------------------------- | ------ |
| Phase 1 — Architecture (Factory + Strategy)                                | ✅     |
| Phase 2 — Smart DOM Analysis (DFS + Semantic Proximity)                    | ✅     |
| Phase 3 — Data Normalization Pipeline (Bloom Filter + Regex FSM)           | ✅     |
| Phase 4 — AI & Mathematical Matching (TF-IDF + NER)                        | ✅     |
| Phase 5 — Performance, Memory & Evasion (Token Bucket + DLQ + O(1) stream) | ✅     |
| Phase 5.5 — IE Enhancements (title, location, job_type, work_model, hours) | ✅     |
| Phase 6 — Hybrid Orchestrator (Facade over ai-job-miner + ai-cv-analyzer)  | ✅     |
| Phase 7 — REST API wrapper (FastAPI endpoint for Laravel integration)      | 🔜     |
