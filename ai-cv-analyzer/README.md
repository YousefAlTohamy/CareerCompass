# 🧠 AI CV Analyzer

> **Layer 1 — Universal Document Understanding (PDF · DOCX · Image / OCR)**  
> **Layer 2 — Professional Domain Classification (Zero-Shot BART-MNLI)**  
> **Layer 3 — Semantic Matching Engine (Sentence-BERT + Cosine Similarity)**

A **3-Layer Deep Learning pipeline** that converts any CV file into a structured profile and intelligently matches it against a job description using both semantic embeddings and hard-skill overlap scoring.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Directory Structure](#directory-structure)
3. [Core 3-Layer Architecture](#core-3-layer-architecture)
   - [Layer 1: Universal Understanding & OCR](#1️⃣-layer-1-universal-understanding--ocr)
   - [Layer 2: Domain Classification](#2️⃣-layer-2-professional-domain-classification)
   - [Layer 3: Semantic Matching Engine](#3️⃣-layer-3-semantic-matching-engine)
4. [API Endpoints](#api-endpoints)
5. [Model Fine-Tuning](#model-fine-tuning)
6. [Model Evaluation Metrics](#model-evaluation-metrics)
7. [Troubleshooting & Engineering Solutions](#️-troubleshooting--engineering-solutions)
8. [Integration with Hybrid Orchestrator](#integration-with-hybrid-orchestrator)
9. [Installation](#installation)
10. [Scalability & Future Expansion](#scalability--future-expansion)
11. [Technical Glossary](#technical-glossary)
12. [Roadmap](#roadmap)

---

## Project Overview

| Attribute     | Detail                                                                         |
| ------------- | ------------------------------------------------------------------------------ |
| **Language**  | Python 3.11+                                                                   |
| **Framework** | FastAPI — async REST API gateway on port `8002`                                |
| **ML Models** | `dslim/bert-base-NER`, `facebook/bart-large-mnli`, `all-MiniLM-L6-v2`          |
| **OCR Stack** | PyMuPDF (text PDFs), EasyOCR + OpenCV (scanned images)                         |
| **Goal**      | Replace brittle keyword matching with transformer-based semantic understanding |

---

## Directory Structure

```
ai-cv-analyzer/
│
├── README.md                        # This file
├── requirements.txt                 # Isolated dependencies
├── main.py                          # FastAPI gateway (port 8002)
├── test_cv.py                       # Local end-to-end verification script
├── test.pdf                         # Sample CV for testing
├── train_ner.ipynb                  # Colab notebook: synthetic data + fine-tuning
├── HOW_TO_TRAIN_MODEL.md            # Step-by-step training guide
│
├── core/                            # The 3 Layers of Intelligence
│   ├── layer1_understanding/
│   │   ├── text_parser.py           # PyMuPDF (PDF) + python-docx (DOCX) extraction
│   │   ├── ocr_pipeline.py          # EasyOCR + OpenCV for scanned images
│   │   ├── universal_extractor.py   # Smart router: picks extraction method by file type
│   │   └── ner_engine.py            # BERT NER: extracts skills, roles, orgs (Singleton)
│   │
│   ├── layer2_classification/
│   │   └── classifier.py            # BART-MNLI zero-shot domain classifier (Singleton)
│   │
│   └── layer3_matching/
│       ├── embedder.py              # Sentence-BERT: text → 384-dim vector (Singleton)
│       └── similarity.py            # IntelligentMatcher: semantic + skill-overlap scoring
│
├── models/                          # Saved fine-tuned weights (Git-ignored)
│   └── ner_weights/
│       └── career_compass_ner_final/   # Custom fine-tuned NER (optional, auto-detected)
│
└── utils/
```

---

## Core 3-Layer Architecture

### 1️⃣ Layer 1: Universal Understanding & OCR

**Files:** `core/layer1_understanding/`

**Goal:** Convert any document format (PDF · DOCX · PNG/JPG) into clean raw text.

| Module                   | Handles                     | Method                                   |
| ------------------------ | --------------------------- | ---------------------------------------- |
| `text_parser.py`         | Text-based PDFs             | PyMuPDF (`fitz`) — fast, lossless        |
| `text_parser.py`         | Word documents (`.docx`)    | `python-docx` — paragraph extraction     |
| `ocr_pipeline.py`        | Scanned images & image-PDFs | EasyOCR + OpenCV pre-processing          |
| `universal_extractor.py` | Any file                    | Smart router: text → OCR fallback        |
| `ner_engine.py`          | Raw text                    | BERT NER: Skills · Roles · Organizations |

**Smart fallback chain (PDF):**

```
PDF → PyMuPDF  →  has text? → return text
                ↓ no text (scanned)
              Render pages as images → EasyOCR → return OCR text
```

**NER model auto-detection:**

```python
# ner_engine.py — loads custom weights if present, generic BERT-NER otherwise
if os.path.exists("models/ner_weights/career_compass_ner_final"):
    MODEL_NAME = "models/ner_weights/career_compass_ner_final"  # fine-tuned
else:
    MODEL_NAME = "dslim/bert-base-NER"   # HuggingFace fallback — never crashes
```

---

### 2️⃣ Layer 2: Professional Domain Classification

**File:** `core/layer2_classification/classifier.py`

**Goal:** Classify a CV into a professional domain with probability scores.

- **Model:** `facebook/bart-large-mnli` (Zero-Shot Classification — no labelled training data needed)
- **Output:** Probability distribution across domains e.g. `Backend Development: 0.92, UI/UX: 0.04`
- **Pattern:** Singleton — model loaded once at startup, reused for all requests

```python
classifier = CVDomainClassifier()
probs = classifier.predict_domain(cv_raw_text)
# → {"Backend Development": 0.89, "Mobile App Development": 0.07, ...}
```

---

### 3️⃣ Layer 3: Semantic Matching Engine

**Files:** `core/layer3_matching/embedder.py` · `core/layer3_matching/similarity.py`

**Goal:** Match a CV to a job description based on _meaning_, not just keywords.

#### Scoring Formula

```
Final Match Score = (Semantic Score × 60%) + (Skill Overlap Score × 40%)
```

| Signal             | Method                                                  | Weight     |
| ------------------ | ------------------------------------------------------- | ---------- | --- | --- |
| **Semantic Score** | `all-MiniLM-L6-v2` → 384-dim vector → Cosine Similarity | 60%        |
| **Skill Overlap**  | Exact set intersection: `cv_skills ∩ job_skills /       | job_skills | `   | 40% |

```python
matcher = IntelligentMatcher()
result = matcher.calculate_match(
    cv_data  = {"raw_text": cv_text,  "skills": ["python", "django"]},
    job_data = {"description": jd_text, "skills": ["python", "fastapi"]},
)
# → {"match_score": 72.4, "semantic_score": 68.1,
#    "skill_overlap_score": 50.0, "missing_skills": ["fastapi"]}
```

---

## API Endpoints

| Method | Endpoint             | Description                                                           |
| ------ | -------------------- | --------------------------------------------------------------------- |
| `GET`  | `/`                  | Health check — returns `{"status": "operational", "version": "v2.0"}` |
| `POST` | `/api/v2/analyze-cv` | Upload CV file → Layer 1 (NER) + Layer 2 (classification)             |
| `POST` | `/api/v2/match-job`  | JSON body → Layer 3 semantic matching                                 |

**Run the server:**

```bash
cd ai-cv-analyzer
python main.py   # starts on port 8002
```

---

## Model Fine-Tuning

To ensure independence from private/gated datasets, we use a **Synthetic Data Augmentation** strategy:

1. **Synthetic Engine** (`train_ner.ipynb`): Generates 5,000+ realistic BIO-tagged resume samples (Skills, Roles, Experience).
2. **Infrastructure:** Training runs on **Google Colab** (T4 GPU) fine-tuning `distilbert-base-cased`.
3. **Auto-Detection:** `ner_engine.py` checks for `models/ner_weights/career_compass_ner_final/` — uses it if present, falls back to `dslim/bert-base-NER` otherwise.
4. **Verification:** Colab notebook generates an F1-Score report for each training run.

See [HOW_TO_TRAIN_MODEL.md](HOW_TO_TRAIN_MODEL.md) for the full step-by-step guide.

---

## Model Evaluation Metrics

| Metric        | Definition                                         | Why it matters        |
| ------------- | -------------------------------------------------- | --------------------- |
| **Precision** | Of all predicted skills, how many were correct?    | Avoids hallucinations |
| **Recall**    | Of all real skills in the CV, how many were found? | Avoids missing data   |
| **F1-Score**  | Harmonic mean of Precision & Recall                | Gold standard for NER |

**Validation approach:** 80/20 train-test split on 5,000+ synthetic samples. Target F1 > 90%.

---

## 🛠️ Troubleshooting & Engineering Solutions

| Challenge                       | Solution                                                                  | Technical Term               |
| :------------------------------ | :------------------------------------------------------------------------ | :--------------------------- |
| **Dataset inaccessibility**     | Custom Synthetic Data Engine generating 5,000+ labelled samples           | _Data Augmentation_          |
| **Library version conflicts**   | Updated `evaluation_strategy` → `eval_strategy` for `transformers` v4.46+ | _API Lifecycle Management_   |
| **Missing model parameters**    | Switched `tokenizer` → `processing_class` in `Trainer` init               | _Backward Compatibility Fix_ |
| **OCR resource intensity**      | PyMuPDF (fast, text-only) → EasyOCR fallback (image-based)                | _Multi-Modal Fallback_       |
| **Port conflicts**              | ai-cv-analyzer runs on port `8002`; legacy engine on `8001`               | _Port Orchestration_         |
| **`core/` namespace collision** | Resolved in `ai-hybrid-orchestrator` via sequential sys.path swap         | _Module Isolation_           |

---

## Integration with Hybrid Orchestrator

`ai-cv-analyzer` is consumed directly by `ai-hybrid-orchestrator/hybrid_runner.py` as part of the combined Facade pipeline:

```python
# hybrid_runner.py imports from ai-cv-analyzer:
from core.layer1_understanding.universal_extractor import process_document
from core.layer1_understanding.ner_engine          import SkillNEREngine
from core.layer2_classification.classifier         import CVDomainClassifier
from core.layer3_matching.similarity               import IntelligentMatcher
```

The orchestrator calls all 3 layers sequentially, then combines the semantic score from **Layer 3** with a TF-IDF score from `ai-job-miner` to produce the final weighted match result.

---

## Installation

```bash
# 1. Navigate into the project directory
cd ai-cv-analyzer

# 2. (Recommended) Create & activate a virtual environment
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. (Tesseract — required for EasyOCR on Windows)
# Download from: https://github.com/UB-Mannheim/tesseract/wiki
# Add to PATH after installation
```

---

## Scalability & Future Expansion

1. **Vertical Scaling (Data):** Expand `SKILLS`/`ROLES` dictionaries in `train_ner.ipynb`; increase samples 5k → 50k+; add real datasets (CoNLL-2003, JobStack).
2. **Architectural Upgrade:** Swap `distilbert-base-cased` → `bert-base-cased` or `roberta-large` for higher accuracy.
3. **Entity Expansion:** Add new BIO tags (`EDUCATION`, `CERTIFICATIONS`, `GPA`) to the synthetic engine.
4. **Hardware Acceleration:** Move from Colab T4 to A100/H100 for massive-scale training.

---

## Technical Glossary

| Term                         | Definition                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| **NER**                      | Named Entity Recognition — locates and classifies entities (skills, roles, orgs) in unstructured text |
| **BIO Tagging**              | Token labelling format: B-Begin, I-Inside, O-Outside a named entity                                   |
| **Embeddings**               | Dense numeric vectors for text; semantically similar phrases cluster close together                   |
| **Cosine Similarity**        | Angle-based distance metric between two vectors — core of the semantic matcher                        |
| **Fine-Tuning**              | Training a pre-trained model further on domain-specific data (resume text)                            |
| **Synthetic Data**           | Artificially generated labelled data used when real data is scarce or restricted                      |
| **Zero-Shot Classification** | Classifying into labels the model has never explicitly been trained on                                |

---

## Roadmap

| Phase           | Feature                                              | Status |
| --------------- | ---------------------------------------------------- | ------ |
| **Layer 1**     | Universal document extraction (PDF, DOCX, Image/OCR) | ✅     |
| **Layer 2**     | Zero-shot domain classification (BART-MNLI)          | ✅     |
| **Layer 3**     | Semantic matching engine (SBERT + cosine similarity) | ✅     |
| **API**         | FastAPI gateway (`/analyze-cv`, `/match-job`)        | ✅     |
| **Fine-Tuning** | Synthetic data engine + Colab training pipeline      | ✅     |
| **Integration** | Hybrid Orchestrator Facade with `ai-job-miner`       | ✅     |
| **Phase 7**     | Unified REST API endpoint for Laravel integration    | 🔜     |
