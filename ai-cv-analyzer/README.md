# 🧠 AI CV Analyzer

> **V3 AI Pipeline — Layer 1 Understanding**  
> Universal document extraction with spatial normalization, semantic segmentation, advanced NER, canonicalization, and temporal parsing.  
> **Layer 2 — Professional Domain Classification (Zero-Shot BART-MNLI)**  
> **Layer 3 — Semantic Matching Engine (Sentence-BERT + Cosine Similarity)**

A **5-stage V3 AI pipeline** that converts any CV file into a structured, canonicalized profile and intelligently matches it against job descriptions using semantic embeddings and hard-skill overlap scoring.

---

## Table of Contents

1. [V3 AI Pipeline Architecture](#v3-ai-pipeline-architecture)
2. [Directory Structure](#directory-structure)
3. [5-Stage V3 Pipeline (Layer 1)](#5-stage-v3-pipeline-layer-1)
4. [Layer 2 & 3](#layer-2--3)
5. [Pydantic CVParseResult Schema](#pydantic-cvparseresult-schema)
6. [API Endpoints](#api-endpoints)
7. [Running Locally (Port 8002)](#running-locally-port-8002)
8. [Installation](#installation)
9. [Troubleshooting](#troubleshooting)
10. [Integration with Hybrid Orchestrator](#integration-with-hybrid-orchestrator)

---

## V3 AI Pipeline Architecture

| Attribute     | Detail                                                                         |
| ------------- | ------------------------------------------------------------------------------ |
| **Language**  | Python 3.11+                                                                   |
| **Framework** | FastAPI — async REST API gateway on port **8002**                              |
| **ML Models** | `dslim/bert-base-NER`, `facebook/bart-large-mnli`, `all-MiniLM-L6-v2`          |
| **OCR Stack** | PyMuPDF (text PDFs), EasyOCR + OpenCV (scanned images)                         |
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
├── main.py                          # FastAPI gateway (port 8002)
├── test_cv.py                       # Local end-to-end verification script
├── test.pdf                         # Sample CV for testing
├── train_ner.ipynb                  # Colab notebook: synthetic data + fine-tuning
├── HOW_TO_TRAIN_MODEL.md            # Step-by-step training guide
│
├── core/                            # The 3 Layers of Intelligence
│   ├── layer1_understanding/
│   │   ├── orchestrator.py          # V3 Facade: spatial → NER → experience → canonicalizer
│   │   ├── spatial_parser.py        # pdfplumber Row Grouper — layout-aware extraction
│   │   ├── section_segmenter.py     # Semantic section segmentation (Sentence-Transformers ready)
│   │   ├── advanced_ner.py          # BERT NER with context window validation (±3 words)
│   │   ├── experience_engine.py     # Temporal engine — python-dateutil date parsing
│   │   ├── canonicalizer.py         # RapidFuzz fuzzy deduplication
│   │   ├── schema.py                # Pydantic CVParseResult, SkillItem, etc.
│   │   └── ocr_pipeline.py          # EasyOCR + OpenCV (scanned PDFs)
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

## 5-Stage V3 Pipeline (Layer 1)

The V3 pipeline processes PDFs through five tightly coupled stages, producing a strict **CVParseResult** JSON schema.

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
- **Present Handling**: Normalizes "Present", "Current", "Now", "Today" to today's date
- **Output**: `DateRange` list, `total_experience_years`, ranked current title

---

## Pydantic CVParseResult Schema

The pipeline outputs a **strict Pydantic model** — `CVParseResult` — ensuring type safety and contract consistency:

```python
class CVParseResult(StrictModel):
    parsing_status: Literal["success", "empty_file", "no_text", "error"]
    profile: Profile           # full_name, current_title, headline, summary, contact
    stats: DocumentStats       # page_count, char_count, word_count
    skills: SkillsSection      # items: List[SkillItem], confidence_score
    experience: ExperienceSection  # items: List[ExperienceItem], confidence_score
    analysis: AnalysisSection  # predicted_role, strengths, gaps, red_flags, metadata
```

**SkillItem** includes `name`, `confidence_score`, `category`, and `evidence` (snippet indicating where the skill was found).

**ExperienceItem** includes `title`, `company`, `start_date`, `end_date`, `is_current`, `description`, `technologies`, `confidence_score`.

---

## Layer 2 & 3

### Layer 2: Domain Classification

- **Model**: `facebook/bart-large-mnli` (Zero-Shot Classification)
- **Output**: Probability distribution across professional domains

### Layer 3: Semantic Matching Engine

- **Model**: `all-MiniLM-L6-v2` — 384-dim embeddings
- **Formula**: `Final = (Semantic × 60%) + (Skill Overlap × 40%)`

---

## API Endpoints

| Method | Endpoint             | Description                                                           |
| ------ | -------------------- | --------------------------------------------------------------------- |
| `GET`  | `/`                  | Health check — `{"status": "operational", "version": "v2.0"}`         |
| `POST` | `/api/v2/analyze-cv` | Upload CV → Layer 1 (V3 pipeline) + Layer 2 (classification)          |
| `POST` | `/api/v2/match-job`  | JSON body → Layer 3 semantic matching                                 |

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

**Tesseract** (for EasyOCR on scanned images): Download from [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki) and add to PATH.

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
2. **Laravel GapAnalysisService** — calls `POST /api/v2/match-job` on port 8002 for Zero PDF Re-parsing matching

See [ai-hybrid-orchestrator/README.md](../ai-hybrid-orchestrator/README.md) for the full integration flow.

---

**Last Updated**: March 2026  
**Version**: V3 Pipeline — 5-Stage Layer 1 Understanding
