# Layer 1: Spatial Understanding & Semantic Extraction

This layer is responsible for converting raw, unstructured PDF/Image data into a clean, segmented, and normalized JSON structure. It focuses on the "what and where" of the document.

## Components

### 1. Spatial Parser (`spatial_parser.py`)
- **Layout-Aware Extraction**: Uses `pdfplumber` to group text into rows based on vertical coordinates.
- **Table Handling**: Detects and reconstructs simple tables into readable text blocks.
- **Normalization**: Fixes hyphenations and merges lines that belong to the same paragraph.

### 2. Section Segmenter (`section_segmenter.py`)
- **Hybrid Detection**: Uses exact matching, regex patterns, and semantic similarity (MiniLM) to identify section boundaries.
- **Dynamic Headers**: Configurable via `data/config.json`. Supports custom section types like "Notable Projects" or "Courses".

### 3. Advanced NER (`advanced_ner.py`)
- **BERT-Powered**: Uses `dslim/bert-base-NER` to identify entities (ORGs, Roles, Skills).
- **Context Validation**: Uses a ±3 word window to verify if a candidate entity makes sense in its local context.

### 4. Experience Engine (`experience_engine.py`)
- **Temporal Analysis**: Extracts date ranges and calculates durations for each job.
- **Total Experience**: Computes total years of experience, handling overlaps and "Present" indicators.

### 5. Contact Extractor (`contact_extractor.py`)
- **Regex + Logic**: Extracts Emails, Phones, LinkedIn (full and short handles), GitHub, and Portfolios.
- **Location Intelligence**: Identifies "City, Country" while filtering out noise using a data-driven rejection list.

## Configuration (`data/config.json`)
The behavior of Layer 1 is governed by a central JSON file:
- `section_config`: Define how headers are matched.
- `contact_config`: Define filters for location extraction.
- `title_config`: Define blacklisted words and action verbs for title detection.

## Current Integration Notes

- Layer 1 is called through the FastAPI service in `ai-cv-analyzer/main.py`, not directly by Laravel.
- Laravel persists the final structured output through `CvProcessingService`.
- Parser status values matter to the backend. Timeout/error responses preserve existing user profile and skills; successful responses with empty skills also preserve existing skills.
- If text extraction falls back to OCR, the API can return `parsing_status="ocr_fallback"` so the frontend can present an honest warning.
- Backend post-processing now splits comma/semicolon-delimited skill labels before syncing user skills.
