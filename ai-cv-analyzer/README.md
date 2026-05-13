# AI CV Analyzer

FastAPI service responsible for CV parsing, structured extraction, and hybrid matching.

## Endpoints

- `GET /`: health check.
- `GET /metrics`: Prometheus-compatible metrics.
- `POST /api/parse-cv`: parse an uploaded CV file.
- `POST /api/hybrid-match`: score a CV against job data.

## Docker Runtime

The Docker container listens on port `8000`:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build ai-cv-analyzer
curl http://localhost:8000/
```

Laravel reaches this service inside Docker through:

```env
AI_ENGINE_URL=http://ai-cv-analyzer:8000
```

Running `python main.py` directly starts the local development server on port `8002`; that is only for host-based development.

## CV Parsing Behavior

- CV parsing is bounded by `CV_TIMEOUT_SECONDS`.
- Timeout results return a structured response with `parsing_status=timeout`.
- Laravel preserves existing user profile/skills when AI parsing fails or times out.
- Optional model files can live under `models/`, but the folder is intentionally ignored by git and Docker build context.

## Environment Variables

- `GEMINI_API_KEY`
- `GEMINI_API_KEYS`
- `HF_TOKEN`
- `NER_MODEL_PATH`
- `CV_TIMEOUT_SECONDS`

## Metrics and Logging

The service exposes `/metrics` for Prometheus. Request correlation IDs are accepted and propagated through logs where available.

## Troubleshooting

- First boot can be slow while model dependencies initialize.
- Keep at least 2 GB available for this container when OCR fallback or model warmup is expected.
- If health is slow, wait for the Docker healthcheck start period before restarting.
- If parsing always times out, raise `CV_TIMEOUT_SECONDS` or check model/download latency.
