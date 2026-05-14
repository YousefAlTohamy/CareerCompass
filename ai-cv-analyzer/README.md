# AI CV Analyzer

The AI CV Analyzer is the Python FastAPI service responsible for parsing uploaded CV files, extracting structured career data, and scoring CV/job fit for gap analysis. Laravel calls this service over HTTP through `AI_ENGINE_URL`.

The service is intentionally independent from the job miner at runtime. Its hybrid matching code uses local analyzer utilities and does not depend on the `ai-job-miner` folder being present inside the analyzer container.

## Runtime Role

- Accept CV uploads from Laravel.
- Extract text from PDFs and other supported uploads.
- Run the layered CV understanding pipeline.
- Return a structured `CVParseResult`-compatible response.
- Provide hybrid CV/job matching for gap analysis.
- Expose health and Prometheus metrics endpoints.
- Preserve structured timeout/error response shapes so Laravel can make safe persistence decisions.

## Folder Structure

```text
ai-cv-analyzer/
|-- main.py                         FastAPI app, endpoints, timeout/error wrappers
|-- core/
|   |-- layer1_understanding/        Parsing, OCR fallback, sectioning, NER, schema
|   |-- layer2_classification/       Domain/role classification
|   `-- layer3_matching/             Semantic/TF-IDF matching helpers
|-- scripts/                         Verification and utility scripts
|-- tests/                           FastAPI/service tests and trace fixtures
|-- training/                        NER training notebook and training assets
|-- docs/                            Analyzer-specific training/testing docs
|-- requirements.txt
|-- Dockerfile
`-- README.md
```

## FastAPI Endpoint Map

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Health check and basic service metadata |
| `GET` | `/metrics` | Prometheus-compatible service metrics |
| `POST` | `/api/parse-cv` | Parse an uploaded CV file |
| `POST` | `/api/hybrid-match` | Score CV text against a job description/skills |

Docker exposes this service on host port `8000` and container port `8000`.

Laravel reaches it inside Docker with:

```env
AI_ENGINE_URL=http://ai-cv-analyzer:8000
```

Running `python main.py` directly starts a host development server on port `8002`; that mode is only for local Python development.

## CV Parsing Pipeline

The detailed historical analyzer architecture is still organized around three conceptual layers.

### Layer 1: Understanding

Layer 1 turns a raw CV file into structured profile data.

Important responsibilities:

- PDF/text extraction.
- Spatial normalization.
- OCR fallback when normal text extraction is weak.
- Semantic section segmentation.
- Contact extraction.
- Experience extraction.
- Skill evidence extraction.
- Career timeline/statistics.
- Pydantic schema output.

Useful directories:

- `core/layer1_understanding/orchestrator.py`
- `core/layer1_understanding/schema.py`
- `core/layer1_understanding/experience_engine.py`
- `core/layer1_understanding/README.md`

### Layer 2: Classification

Layer 2 classifies the career domain and role signals extracted from the CV.

Typical outputs:

- `primary_domain`
- `predicted_role`
- `seniority`
- confidence/metadata fields used by Laravel and the frontend

Useful directory:

- `core/layer2_classification/`

### Layer 3: Matching

Layer 3 supports matching and scoring.

Typical responsibilities:

- semantic similarity;
- TF-IDF scoring;
- skill overlap and missing-skill detection;
- hybrid score composition for job gap analysis.

Useful directory:

- `core/layer3_matching/`

## CV Output Shape

The parser returns a structured object compatible with the backend's expected analysis shape.

Important top-level sections:

- `parsing_status`
- `profile`
- `stats`
- `skills`
- `experience`
- `analysis`
- `metadata`

Typical fields used by Laravel:

- profile name, headline/title, summary, location, contact info;
- predicted role, primary domain, seniority;
- total experience;
- skill items and confidence/evidence;
- experience rows and technologies;
- strengths, gaps, red flags;
- parser metadata and error/timeout details.

## Parsing Status Values

Common statuses:

- `success`: normal successful parse.
- `ocr_fallback`: successful parse using OCR fallback.
- `timeout`: processing exceeded `CV_TIMEOUT_SECONDS`; returned as structured timeout output.
- `error`: processing crashed or failed; returned as structured error output.
- `empty_file`: file had no usable content.
- `no_text`: extraction produced no usable text.

Backend behavior depends on this field:

- `success` or useful `ocr_fallback`: Laravel can refresh profile, experience, analysis, and skills.
- `timeout` or `error`: Laravel preserves existing profile and skills.
- success with no extracted skills: Laravel preserves existing skills and logs a warning.

## Timeout And Error Behavior

`CV_TIMEOUT_SECONDS` controls per-CV parsing time.

On timeout:

- `_timeout_result()` returns a structured response.
- `parsing_status` is `timeout`.
- Laravel can save a CV analysis row without wiping user skills/profile.

On error:

- `_error_result(error_detail)` returns a structured response.
- `parsing_status` is `error`.
- `analysis.metadata.error` preserves the error detail.

This distinction is covered by tests because UI and backend persistence logic rely on it.

## Hybrid Matching

Endpoint:

```text
POST /api/hybrid-match
```

Request body includes CV text and job data. The response includes:

- `hybrid_match_score`
- `semantic_match_pct`
- `tfidf_score_pct`
- `missing_skills`
- `formula`
- `matching_mode`

Current scoring behavior:

- When TF-IDF scoring is available:
  - `final = semantic * 0.60 + tfidf * 0.40`
  - `matching_mode = "hybrid"`
- When TF-IDF scoring is unavailable:
  - `final = semantic`
  - `tfidf_score_pct = 0`
  - `matching_mode = "semantic_only_fallback"`

The fallback intentionally does not penalize the user by multiplying semantic score by `0.60` when the TF-IDF component cannot run.

## Skill Extraction Notes

The analyzer returns skill labels and evidence where possible. The backend performs additional safety post-processing:

- canonicalizes common skill labels;
- splits comma/semicolon-delimited labels such as `PHP, LARAVEL`;
- preserves existing user skills when no skills are extracted.

Do not rely on the analyzer alone for final database normalization.

## Docker Runtime

Build/start from the repository root:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build ai-cv-analyzer
```

Health check:

```bash
curl http://localhost:8000/
```

Logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f ai-cv-analyzer
```

Restart after Python code-only changes:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart ai-cv-analyzer
```

Rebuild after dependency or Dockerfile changes:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build ai-cv-analyzer
```

## Environment Variables

- `GEMINI_API_KEY`: Gemini key for LLM-powered extraction paths.
- `GEMINI_API_KEYS`: optional comma-separated key rotation list.
- `HF_TOKEN`: optional Hugging Face token for model downloads.
- `NER_MODEL_PATH`: local path to NER weights.
- `CV_TIMEOUT_SECONDS`: max parsing time before structured timeout response.

Docker default:

```env
CV_TIMEOUT_SECONDS=90
```

Backend upload requests have a larger frontend/Nginx/PHP request budget, but analyzer parsing itself is bounded by this service-level timeout.

## Metrics And Logging

- `/metrics` exposes Prometheus text format.
- Request IDs are accepted from the caller and propagated where available.
- Laravel includes correlation IDs in its structured logs, which helps trace a CV upload across services.

## Tests

Run from the repository root:

```bash
python -m compileall ai-cv-analyzer ai-job-miner
```

Run analyzer tests:

```bash
cd ai-cv-analyzer
python -m pytest -q tests/test_service_api.py
cd ..
```

Covered behavior includes:

- health endpoint metadata;
- Prometheus metrics response;
- parse endpoint validation;
- timeout result status;
- error result status and metadata;
- hybrid matching with TF-IDF;
- semantic-only fallback without score penalty.

## Optional Host Development

```bash
cd ai-cv-analyzer
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

The host development server listens on port `8002`.

## Troubleshooting

### First boot is slow

The image includes ML, OCR, PDF, transformer, and PyTorch dependencies. The first boot can be slow, especially if model/cache initialization happens.

### Healthcheck fails during warmup

The Docker healthcheck has a long start period. Wait for warmup before restarting unless logs show a real crash.

### Parsing times out

Check:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f ai-cv-analyzer
```

If the file is large or OCR-heavy, timeout can be expected. Laravel should preserve existing user data and record a structured timeout analysis.

### Empty PDF or scanned CV

Text extraction may return `empty_file`, `no_text`, or `ocr_fallback`. OCR fallback is heavier and may require more memory/time.

### Memory pressure

The production override reserves up to 2 GB for the analyzer. Increase Docker Desktop memory if the service crashes during OCR/model startup.

### Hybrid match looks low

Check `matching_mode`. If the mode is `semantic_only_fallback`, TF-IDF did not contribute but the semantic score is not penalized.

## Related Documentation

- Root `README.md` for full Docker architecture.
- `backend-api/README.md` for how Laravel consumes analyzer results.
- `docs/PRODUCT_FLOW_REVIEW.md` for latest CV upload behavior.
- `ai-cv-analyzer/docs/TESTING_GUIDE.md` for analyzer-specific testing notes.
