# 🧠 AI CV Analyzer

> **V3 AI Pipeline — Layer 1 Understanding**  
> Universal document extraction with spatial normalization, semantic segmentation, advanced NER, contact extraction, canonicalization, and temporal parsing.  
> **Layer 2 — Professional Domain Classification (Zero-Shot BART-MNLI)**  
> **Layer 3 — Semantic Matching Engine (Sentence-BERT + Cosine Similarity)**

A **6-stage V3 AI pipeline** that converts any CV file into a structured, canonicalized profile with contact information and intelligently matches it against job descriptions using semantic embeddings and hard-skill overlap scoring.

---

## Table of Contents

1. [V3 AI Pipeline Architecture](#v3-ai-pipeline-architecture)
2. [Directory Structure](#directory-structure)
3. [6-Stage V3 Pipeline (Layer 1)](#6-stage-v3-pipeline-layer-1)
4. [Pydantic CVParseResult Schema](#pydantic-cvparseresult-schema)
5. [Layer 2 & 3](#layer-2--3)
6. [API Endpoints](#api-endpoints)
7. [Running Locally (Port 8002)](#running-locally-port-8002)
8. [Installation](#installation)
9. [Environment Variables](#environment-variables)
10. [Troubleshooting](#troubleshooting)
11. [Integration with Hybrid Orchestrator](#integration-with-hybrid-orchestrator)

---

## V3 AI Pipeline Architecture

| Attribute     | Detail                                                                         |
| ------------- | ------------------------------------------------------------------------------ |
| **Language**  | Python 3.11+                                                                   |
| **Framework** | FastAPI — async REST API gateway on port **8002**                              |
| **ML Models** | `dslim/bert-base-NER`, `facebook/bart-large-mnli`, `all-MiniLM-L6-v2`          |
| **OCR Stack** | PyMuPDF (text PDFs), python-docx (DOCX), EasyOCR + OpenCV (scanned images)    |
| **Lifecycle** | **Singleton Pattern** — all models pre-loaded at startup                       |
| **Port**      | **8002** — explicitly isolated from ai-hybrid-orchestrator (8001)              |
| **Memory**    | ~4GB RAM on startup due to singleton model loading                             |
| **Goal**      | 100% precise spatial CV parsing with normalized, canonical skill output        |

---

## Directory Structure

```
ai-cv-analyzer/
│
├── README.md                        # This file
├── requirements.txt                 # Isolated dependencies
├── main.py                          # FastAPI sub-service gateway (port 8002)
├── .env.example                     # Environment template (GEMINI_API_KEY, HF_TOKEN, NER_MODEL_PATH)
├── .gitignore                       # Custom rules for weights, training data, test PDFs
│
├── core/                            # The 3 Layers of Intelligence
│   ├── layer1_understanding/
│   │   ├── orchestrator.py          # V3 Facade: spatial → NER → contacts → experience → canonicalizer
│   │   ├── spatial_parser.py        # pdfplumber Row Grouper — layout-aware extraction
│   │   ├── section_segmenter.py     # Semantic section segmentation (Sentence-Transformers ready)
│   │   ├── advanced_ner.py          # BERT NER with context window validation (±3 words)
│   │   ├── experience_engine.py     # Temporal engine — python-dateutil date parsing
│   │   ├── canonicalizer.py         # RapidFuzz fuzzy deduplication
│   │   ├── contact_extractor.py     # Regex: email, phone, LinkedIn, GitHub, location
│   │   ├── schema.py                # Pydantic CVParseResult, ContactInfo, SkillItem, etc.
│   │   └── ocr_pipeline.py          # EasyOCR + OpenCV (scanned PDFs / images)
│   │
│   ├── layer2_classification/
│   │   └── classifier.py            # BART-MNLI zero-shot domain classifier (Singleton)
│   │
│   └── layer3_matching/
│       ├── embedder.py              # Sentence-BERT: text → 384-dim vector (Singleton)
│       └── similarity.py            # IntelligentMatcher: semantic + skill-overlap scoring
│
├── models/                          # Saved model weights (Git-ignored)
│   ├── .gitkeep                     # Preserves directory in Git
│   ├── ner_weights/
│   │   └── career_compass_ner_final/  # Custom fine-tuned NER (optional, auto-detected)
│   ├── class_weights/               # BART-MNLI cached weights (auto-downloaded)
│   └── sent_bert/                   # Sentence-BERT cached weights (auto-downloaded)
│
├── training/                        # Training data & scripts (large files Git-ignored)
│   ├── train_ner.ipynb              # Colab notebook: synthetic data + fine-tuning
│   ├── generate_tech_dataset.py     # Gemini-powered 50K sample generator (multi-key rotation)
│   ├── clean_dataset.py             # Deduplication + entity validation + greedy SKILL filter
│   ├── check-models.py              # Lists available Gemini models for a given API key
│   ├── train_real_tech.json         # Raw generated dataset (Git-ignored, ~14 MB)
│   └── train_real_tech_cleaned.json # Cleaned dataset for training (Git-ignored, ~13 MB)
│
├── scripts/                         # Verification & deployment utilities
│   ├── verify_phase1.py             # PDF CID stripping, skill extraction, training prompt
│   ├── verify_phase2.py             # NER name extraction, skill/role/org de-confliction
│   ├── verify_phase3.py             # Date regex + total_years, description scrubbing
│   ├── verify_phase4.py             # Fine-tuned model loading, full orchestrator benchmark
│   ├── verify_phase5.py             # Singleton test, stress test (50K words), error handling
│   ├── deploy_model.py              # Quick local model deployment (no training required)
│   └── patch_nb.py                  # Programmatic notebook patching (TrainingArgs + verification cell)
│
├── tests/                           # Test scripts
│   ├── test_cv.py                   # Legacy end-to-end API test (uses old /api/v2/ paths)
│   └── test_local_model.py          # Direct model inference test (bypasses FastAPI)
│
└── docs/                            # Sub-documentation
    ├── HOW_TO_TRAIN_MODEL.md        # Step-by-step Colab training guide
    └── TESTING_GUIDE.md             # Manual & automated testing guide
```

---

## 6-Stage V3 Pipeline (Layer 1)

The V3 pipeline processes PDFs through six tightly coupled stages, producing a strict **CVParseResult** JSON schema.

### Stage 1: Spatial Normalization (`pdfplumber` Row Grouper)

| Module             | File                | Purpose                                                                 |
| ------------------ | ------------------- | ----------------------------------------------------------------------- |
| **Spatial Parser** | `spatial_parser.py` | Layout-aware PDF text extraction using **pdfplumber** word coordinates  |

- **Row Grouper**: Clusters words by Y proximity (`y_tolerance` = median word height × 0.65)
- **Column-Aware Ordering**: Splits rows on horizontal gaps (column separation), clusters segments by X position
- **Reading Order**: Left-to-right columns, top-to-bottom within each column
- **Output**: Ordered text string preserving logical reading flow (avoids multi-column chaos)

### Stage 2: Semantic Section Segmentation (Sentence-Transformers Ready)

| Module               | File                  | Purpose                                                         |
| -------------------- | --------------------- | --------------------------------------------------------------- |
| **Section Segmenter**| `section_segmenter.py`| Splits ordered text into CV sections via header heuristics      |

- **Sections**: `profile_summary`, `experience`, `education`, `skills`, `projects`, `uncategorized`
- **Architecture-Ready**: Accepts custom `header_resolver` (e.g., embeddings-based) without changing the interface
- **Output**: `SegmentationResult` with blocks, sections dict, and analysis (found/missing sections, anomalies)

### Stage 3: Advanced NER & Validation (Context Window ±3 words)

| Module          | File             | Purpose                                                               |
| --------------- | ---------------- | --------------------------------------------------------------------- |
| **Advanced NER**| `advanced_ner.py`| BERT-based Named Entity Recognition with **context window validation**|

- **Model**: `dslim/bert-base-NER` or custom `career_compass_ner_final` if present
- **Context Window**: Configurable `context_window_words=3` — validates entities within ±3 words of surrounding tokens
- **Entity Types**: Skills, Roles, Organizations, Education, Certifications
- **Output**: Normalized entities grouped by category with provenance

### Stage 4: Canonicalization (RapidFuzz Deduplication)

| Module           | File             | Purpose                                              |
| ---------------- | ---------------- | ---------------------------------------------------- |
| **Canonicalizer**| `canonicalizer.py`| Skill normalization and fuzzy deduplication via **RapidFuzz** |

- **Fuzzy Threshold**: Default 86 (configurable via `OrchestratorConfig`)
- **Deduplication**: Merges variants (e.g., `Vue.js` ≡ `VueJS`) and attaches provenance
- **Output**: `CanonicalSkill` list with `name`, `confidence_score`, `sources`, `raw_variants`

### Stage 5: Temporal Engine (`python-dateutil`)

| Module             | File                 | Purpose                                           |
| ------------------ | -------------------- | ------------------------------------------------- |
| **Experience Engine** | `experience_engine.py` | Date range extraction and total experience years |

- **Date Parsing**: `python-dateutil` for robust handling of formats (Jan 2020 – Mar 2022, 05/2019 to 11/2021, etc.)
- **Regex Fallback**: When `python-dateutil` fails, a regex-based date range fallback ensures coverage
- **Present Handling**: Normalizes "Present", "Current", "Now", "Today" to today's date
- **Output**: `DateRange` list, `total_experience_years`, ranked current title

### Stage 6: Contact Information Extraction (Regex)

| Module                | File                    | Purpose                                                  |
| --------------------- | ----------------------- | -------------------------------------------------------- |
| **Contact Extractor** | `contact_extractor.py`  | Regex-based extraction of structured contact details     |

- **Email**: RFC-5321 simplified regex — picks the first match, lowercased
- **Phone**: International format support (`+20 101 234 5678`, `(02) 12345678`, `+1-800-555-0199`); minimum 7 digits to filter noise
- **LinkedIn**: Matches `linkedin.com/in/<profile>` URLs; auto-prefixes `https://` if missing
- **GitHub**: Matches `github.com/<username>` URLs; auto-prefixes `https://` if missing
- **Location**: Keyword-anchored heuristic — looks for `Location:`, `Address:`, `Based in:`, `City:`, `Residence:` labels
- **Output**: `ContactInfo` dict with keys: `email`, `phone`, `linkedin_url`, `github_url`, `location` (each `null` if undetected)

> **Note**: The orchestrator calls `extract_contacts(ordered_text)` after spatial parsing and populates the `Profile.contact` field natively, eliminating the need for downstream merging in the hybrid orchestrator.

---

## Pydantic CVParseResult Schema

The pipeline outputs a **strict Pydantic model** — `CVParseResult` — ensuring type safety and contract consistency:

```python
class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

class CVParseResult(StrictModel):
    parsing_status: Literal["success", "empty_file", "no_text", "error"]
    profile: Profile           # full_name, current_title, headline, summary, contact
    stats: DocumentStats       # page_count, char_count, word_count
    skills: SkillsSection      # items: List[SkillItem], confidence_score
    experience: ExperienceSection  # items: List[ExperienceItem], confidence_score
    analysis: AnalysisSection  # predicted_role, seniority, strengths, gaps, red_flags, metadata
```

**ContactInfo**: `email`, `phone`, `location`, `linkedin_url` (HttpUrl), `github_url` (HttpUrl), `portfolio_url` (HttpUrl) — all optional.

**SkillItem**: `name`, `confidence_score`, `category` (Literal: `hard | soft | tool | language | framework | platform | other`), `evidence` (snippet indicating where found).

**ExperienceItem**: `title`, `company`, `location`, `start_date`, `end_date`, `is_current`, `description` (list of bullet strings), `technologies`, `confidence_score`.

**AnalysisSection.seniority**: Literal enum: `intern | junior | mid | senior | lead | principal`.

---

## Layer 2 & 3

### Layer 2: Domain Classification

- **Model**: `facebook/bart-large-mnli` (Zero-Shot Classification, Singleton)
- **Input**: First 1500 characters of extracted CV text
- **Mode**: `multi_label=False` — single primary domain
- **Output**: Top 3 probability scores across 10 professional domains:

| # | Domain |
|---|---|
| 1 | Backend Development |
| 2 | Frontend Development |
| 3 | Full Stack Development |
| 4 | Mobile App Development |
| 5 | Data Science & AI |
| 6 | DevOps & Cloud |
| 7 | UI/UX Design |
| 8 | Quality Assurance & Testing |
| 9 | Product Management |
| 10 | Cybersecurity |

### Layer 3: Semantic Matching Engine

- **Model**: `all-MiniLM-L6-v2` — 384-dim embeddings (Singleton)
- **Semantic Score**: `cosine_similarity(cv_embedding, job_embedding)`
- **Skill Overlap Score**: `len(cv_skills ∩ job_skills) / len(job_skills)`
- **Formula**: `final_score = (semantic_score × 60%) + (skill_overlap × 40%)`
- **Return schema**:

```json
{
  "match_score": 85.20,
  "semantic_score": 78.50,
  "skill_overlap_score": 95.00,
  "missing_skills": ["Kubernetes", "Terraform"]
}
```

---

## API Endpoints

| Method | Endpoint         | Description                                                                     |
| ------ | ---------------- | ------------------------------------------------------------------------------- |
| `GET`  | `/`              | Health check — `{"status": "operational", "version": "v2.0 (3-Layer Architecture)"}` |
| `POST` | `/api/parse-cv`  | Upload CV (multipart) → Layer 1 (V3 pipeline) → returns strict `CVParseResult`  |

> **Legacy Notice**: The `/api/v2/analyze-cv` and `/api/v2/match-job` endpoints were removed during the API unification phase. Layer 3 matching is now consumed exclusively through the **ai-hybrid-orchestrator** gateway on port 8001 (see `POST /api/hybrid-match`).

---

## Running Locally (Port 8002)

```bash
cd ai-cv-analyzer
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
python main.py   # or: uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

**Verify**: http://127.0.0.1:8002/docs (Swagger UI)

> **Port 8002** is explicitly isolated from the ai-hybrid-orchestrator (port 8001) to allow concurrent model testing and direct Laravel integration for Layer 3 matching.

---

## Installation

```bash
cd ai-cv-analyzer
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
```

**EasyOCR** handles OCR natively for scanned PDFs and images — no separate Tesseract installation is required. EasyOCR downloads its own recognition models on first use.

> **Optional**: If you prefer using `pytesseract` directly for custom OCR pipelines, download Tesseract from [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki) and add to PATH.

---

## Environment Variables

Copy the environment template and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Purpose | Required |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key — used by `training/generate_tech_dataset.py` for synthetic data generation | Only for training |
| `HF_TOKEN` | HuggingFace token — used for accessing gated models (if any) | Optional |
| `NER_MODEL_PATH` | Path to fine-tuned NER weights (default: `./models/ner_weights/career_compass_ner_final`) | Optional (auto-detected) |

---

## Troubleshooting

| Challenge                       | Solution                                                                  |
| ------------------------------- | ------------------------------------------------------------------------- |
| **Port 8002 in use**            | Ensure no legacy services run on 8002; ai-cv-analyzer is isolated         |
| **`core/` namespace collision** | Resolved in ai-hybrid-orchestrator via sequential sys.path swap           |
| **Memory overhead**             | ~4GB RAM; singleton models loaded once at startup                         |
| **OCR resource intensity**      | PyMuPDF (fast, text-only) → EasyOCR fallback (image-based)                |

---

## Integration with Hybrid Orchestrator

`ai-cv-analyzer` is consumed by:

1. **ai-hybrid-orchestrator** — `hybrid_runner.py` and `main_api.py` import `CVOrchestrator` and `IntelligentMatcher`
2. **Laravel CvProcessingService** — calls `POST /api/parse-cv` on port 8002 for direct CV analysis

See [ai-hybrid-orchestrator/README.md](../ai-hybrid-orchestrator/README.md) for the full integration flow.

---

**Last Updated**: April 2026  
**Version**: V3 Pipeline — 6-Stage Layer 1 Understanding + Contact Extraction
