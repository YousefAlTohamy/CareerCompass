# AI CV Analyzer Source Inventory

## Scope

This inventory covers `ai-cv-analyzer/` as committed source plus safe local metadata observations. It does not copy `.env`, model binaries, generated datasets, or ignored private artifacts.

## Artifact and Secret Boundary

The following paths are intentionally treated as deployment-local:

| Path | Git Status | Documentation Decision |
|---|---|---|
| `ai-cv-analyzer/.env` | Ignored | Do not read or copy; `.env.example` is the documentable configuration source. |
| `ai-cv-analyzer/models/` | Ignored | Runtime may load model weights from here, but weights are not committed. |
| `ai-cv-analyzer/models/ner_weights/career_compass_ner_final` | Ignored local artifact path | Safe metadata was inspected locally; binary weights were not copied. |

## Top-Level Files

| File | Purpose |
|---|---|
| `.dockerignore`, `.gitignore` | Defines container/build exclusions and ignored secrets/model artifacts. |
| `.env.example` | Documents runtime environment variables without secrets. |
| `Dockerfile` | Builds the FastAPI CV analyzer service image. |
| `README.md` | Service overview and usage notes. |
| `requirements.txt` | Python runtime dependencies for FastAPI, PDF/OCR, transformers, embeddings, and support libraries. |
| `main.py` | FastAPI entry point, health/metrics endpoints, parse-CV endpoint, and hybrid-match endpoint. |

## Layer 1: CV Understanding

| File or Folder | Purpose |
|---|---|
| `layer1/advanced_ner.py` | Singleton transformer NER engine, chunked inference, entity merging, name candidate extraction. |
| `layer1/canonicalizer.py` | Skill normalization, deduplication, exact/fuzzy/semantic mapping. |
| `layer1/contact_extractor.py` | Email, phone, and location extraction. |
| `layer1/experience_engine.py` | Date-range parsing, total experience, skill durations, career health, action-verb scoring. |
| `layer1/ocr_pipeline.py` | Image/PDF OCR fallback helpers. |
| `layer1/orchestrator.py` | Coordinates extraction, OCR fallback, NLP pipeline, strict result assembly, and Layer 2 enrichment. |
| `layer1/schema.py` | Pydantic response schema for contacts, skills, experience, analysis, stats, and status. |
| `layer1/section_segmenter.py` | Header detection, semantic section matching, and block merging. |
| `layer1/spatial_parser.py` | Ordered PDF text extraction using word positions, adaptive row grouping, columns, and fallback text extraction. |
| `layer1/utils.py` | Layer 1 config loading. |
| `layer1/data/config.json` | Section headers, canonical skill/domain cues, semantic thresholds, and extraction configuration. |
| `layer1/EXPLAIN LAYER1/*.md`, `layer1/README.md` | Developer explanation material for the understanding layer. |

## Layer 2: Classification

| File or Folder | Purpose |
|---|---|
| `layer2/classifier.py` | Singleton CV domain classifier wrapper around semantic embedder. |
| `layer2/domain_engine.py` | Predicts primary technical domain from title, summary, experience, and taxonomy descriptions. |
| `layer2/orchestrator.py` | Enriches Layer 1 output with domain, seniority, and skill categories. |
| `layer2/seniority_engine.py` | Combines years, title cues, semantic hints, and action verbs into a seniority label. |
| `layer2/skill_engine.py` | Categorizes skills into hard, soft, and management buckets. |
| `layer2/utils.py` | Taxonomy loading. |
| `layer2/data/taxonomy.json` | Domain, skill, management, and soft-skill taxonomy. |
| `layer2/EXPLAIN LAYER2/*.md`, `layer2/README.md` | Developer explanation material for classification. |

## Layer 3: Matching

| File or Folder | Purpose |
|---|---|
| `layer3/constraint_validator.py` | Applies mandatory-skill, experience, and seniority penalties. |
| `layer3/embedder.py` | Sentence-transformer singleton, embedding cache, similarity helper, optional quantization. |
| `layer3/fit_analysis_generator.py` | Converts score breakdowns into summary, strengths, gaps, red flags, and verdict. |
| `layer3/job_description_engine.py` | Parses job descriptions into seniority, years, skills, domain, and summary. |
| `layer3/ranking_orchestrator.py` | Ranks candidate/job combinations using the matcher. |
| `layer3/similarity.py` | Adaptive semantic/skill/domain matching and score collapse. |
| `layer3/tfidf.py` | Pure Python TF-IDF tokenizer, vectors, cosine similarity, and fallback score. |
| `layer3/matching_config.json` | Seniority-aware matching weights, thresholds, and penalty controls. |
| `layer3/API_DOCUMENTATION.md`, `layer3/EXPLAIN LAYER3/*.md`, `layer3/README.md` | API and matching explanation material. |

## Training and Diagnostics

| File or Folder | Purpose |
|---|---|
| `training/generate_tech_dataset.py` | Gemini-based synthetic CV snippet generator with key/model rotation and negative decoys. |
| `training/clean_dataset.py` | Dataset normalization, deduplication, and span validation. |
| `training/train_ner.ipynb` | Colab-oriented BERT token-classification training notebook. |
| `scripts/deploy_model.py` | Utility script for deploy/mock weight setup; path behavior should be reviewed before production use. |
| `scripts/patch_nb.py` | Notebook patch helper. |
| `scripts/verify_phase1.py` to `verify_phase5.py` | Incremental diagnostic checks. |
| `tests/test_service_api.py` | FastAPI service tests using fakes for status and hybrid-match behavior. |
| `tests/test_local_model.py` | Direct local model smoke script; not an asserted test suite. |
| `tests/trace_cv.py` and trace JSON files | CV trace/debug support. |
| `tests/manual/*` | Manual HTTP check scripts and notes. |

## Source Inventory Conclusion

The analyzer is a layered hybrid system. Its strongest committed evidence is the implementation code, training notebook, data-generation and cleaning scripts, API tests, and diagnostic scripts. The optional NER weight folder is a deployment artifact rather than a committed source artifact.
