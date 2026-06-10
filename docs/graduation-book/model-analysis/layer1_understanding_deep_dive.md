# Layer 1 CV Understanding Deep Dive

## Purpose

Layer 1 converts uploaded CV files into structured candidate data. It is responsible for extracting readable text, recovering text through OCR when necessary, segmenting CV sections, extracting entities, normalizing skills, estimating experience, and producing a strict response shape for Laravel.

## Runtime Flow

1. `main.py` receives `/api/parse-cv`.
2. `process_file` chooses PDF or image processing.
3. `CVOrchestrator.process_cv` or `process_image_cv` starts Layer 1.
4. `spatial_parser.py` extracts ordered PDF text using word positions.
5. `_should_trigger_ocr` requests OCR fallback when text is missing or too short.
6. `section_segmenter.py` groups text into profile, skills, experience, education, projects, and related sections.
7. `advanced_ner.py` extracts model-backed entity candidates.
8. Contact, date, experience, and skill-normalization helpers refine the result.
9. `schema.py` validates the final response.

## Spatial PDF Parsing

`spatial_parser.py` reads word-level coordinates, removes `(cid:...)` artifacts, groups words into rows, splits row segments using x-axis gaps, and orders segments by columns and rows. It also dehyphenates broken lines. If this spatial result loses a large amount of text compared with plain extraction, it falls back to safer plain text extraction.

## OCR Fallback

OCR is triggered when normal extraction has no text, returns an error, or produces fewer than the configured minimum characters. The fallback renders PDF pages with PyMuPDF, converts them to image bytes, preprocesses with grayscale/blur logic, and uses EasyOCR. This is useful for scanned CVs or image-heavy documents, but it is slower and should be treated as a fallback path.

## Section Segmentation

The segmenter uses configured header patterns, normalized candidate headers, bullet detection, and optional semantic header matching. If no clear headers are found, it still returns a profile-style block so later extraction does not collapse into an empty result.

## NER and Post-Processing

`AdvancedNEREngine` is a singleton. It tries to load the optional local token-classification artifact, otherwise it has a fallback model path. Runtime text is chunked with overlap so long CVs do not exceed model limits. Predictions are merged, cleaned, deduplicated, and filtered before they become skills, roles, education, or certifications.

## Experience and Seniority Signals

`ExperienceEngine` parses date ranges, merges overlapping periods, estimates total years, computes per-skill durations, detects gaps/overlaps/short stints, and scores action verbs. Layer 1 also has a seniority heuristic that combines title cues, years of experience, and action-verb strength before Layer 2 performs additional enrichment.

## Output Shape

The final response uses strict Pydantic models for contact info, profile, document stats, skills, experience, analysis, and parsing status. The status vocabulary includes normal and fallback states such as `success`, `ocr_fallback`, `empty_file`, `no_text`, and `error`. The API-level timeout fallback returns a separate timeout payload.

## Key Limitations

- OCR quality depends on image quality and OCR dependencies.
- NER extraction is only as reliable as the supplied model artifact and training data.
- Title, skill, and seniority heuristics are practical demo logic, not a certified HR decision system.
- The optional local model artifact is ignored by Git, so final accuracy must be measured in a reproducible environment with a supplied artifact.
