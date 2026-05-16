# CV Upload and AI Reliability Review

Date: 2026-05-16 17:00 +03:00
Branch: `fix/cv-upload-ai-reliability`
Scope: targeted hardening for the existing CV upload, AI analyzer, dashboard feedback, and regression tests. No model retraining or broad product rewrites were included.

## Current Flow

1. The user uploads a CV from `/dashboard`.
2. The frontend sends `POST /api/upload-cv` with a 240 second upload-specific timeout.
3. Laravel validates the file with `CvUploadRequest`:
   - PDF, JPG, JPEG, or PNG.
   - Maximum size 5 MB.
4. `CvProcessingService` sends the file to `ai-cv-analyzer /api/parse-cv`.
5. The AI analyzer returns a structured response with `parsing_status`, profile, stats, skills, experience, and analysis data.
6. Laravel stores the uploaded CV, persists `cv_analyses`, updates structured profile data only when parsing is usable, and preserves existing skills/experiences when extraction is empty or incomplete.
7. The frontend refreshes the user and skills. If the browser request times out, it polls for a persisted analysis before showing a hard failure.

## Failure Points Found

| Area | Finding | Risk | Fix status |
| --- | --- | --- | --- |
| Upload response contract | Successful uploads returned useful top-level fields but no consistent `data` envelope for parsing status, retry, analysis id, skills count, or download URL. | Frontend and future clients had to infer too much from nested user state. | Fixed. |
| AI malformed response | A JSON response with unexpected fields could be treated as a thin success with empty structured sections. | Profile/skills/experience behavior could become confusing and hard to debug. | Fixed by normalizing AI payloads and converting malformed payloads to structured `error`. |
| Empty/no-text AI status | `empty_file`/`no_text` previously raised a runtime exception from the service layer. | Readable user feedback could become a generic 500 even though the upload reached the analyzer. | Fixed. These statuses now persist as safe analysis records and preserve profile data. |
| Experience refresh | Successful parsing with empty `experience.items` deleted existing experiences. | Manual or previous experience data could be wiped by a partial extraction. | Fixed. Empty/invalid experience extraction preserves existing experiences. |
| AI unavailable response | Connection errors returned a short message but no structured retry fields. | Frontend could not reliably distinguish retryable AI outages. | Fixed with structured failure payload and retry flag. |
| Log detail | Upstream connection exception messages were written to logs during tests. | Internal socket details or vendor messages could leak into logs. | Fixed by logging exception class instead of raw connection message. |
| Dashboard file picker | UI only advertised PDF even though backend allows images. | Users with image CVs received unclear affordance. | Fixed. UI accepts PDF/JPG/PNG and validates size/type before upload. |
| AI image routing | Image uploads were routed through the PDF parser path. | PNG/JPEG CVs could fail before OCR even though OCR support exists. | Fixed by routing image uploads to an explicit OCR path. |
| Proxy upload limit | Files above the Laravel 5 MB limit were rejected by Nginx as raw `413 Request Entity Too Large`. | Users saw an infrastructure error instead of the app's validation message. | Fixed by raising Nginx `client_max_body_size` to 8 MB while keeping Laravel's 5 MB app limit. |

## Fixes Made

Backend:

- Added a backward-compatible upload response `data` envelope with:
  - `analysis_id`
  - `parsing_status`
  - `warnings`
  - `skills_count`
  - `predicted_role`
  - `profile_updated`
  - `retry_available`
  - `download_url`
- Kept existing response fields (`success`, `message`, `user`, `skills`, `warnings`, `parsing_status`) for frontend compatibility.
- Normalized AI analyzer responses before persistence.
- Converted malformed AI JSON into a structured `parsing_status="error"` result.
- Treated `empty_file` and `no_text` as persisted upload warning states rather than generic server errors.
- Preserved existing user experiences when AI returns no valid experience items.
- Continued preserving existing user skills on timeout/error/no-text/empty extraction.
- Added signed CV URL exposure through `UserResource` when a stored CV exists.
- Hardened CV storage fingerprinting with explicit file path and hash checks.
- Removed raw upstream exception text from connection-error logs and API responses.
- Aligned Nginx upload body size with the app-level 5 MB validator so oversized uploads return Laravel's JSON validation response.

AI analyzer:

- Added an explicit image-CV processing route inside the orchestrator using the existing OCR pipeline.
- Routed `.jpg`, `.jpeg`, and `.png` uploads to image OCR instead of PDF spatial parsing.
- Added a regression test proving upload processing crashes still return structured `parsing_status="error"`.
- Added a regression test proving image filenames route to the OCR path.

Frontend:

- Added client-side file validation for supported type and 5 MB max size.
- Updated file inputs to accept PDF/JPG/JPEG/PNG.
- Added clearer dashboard copy for supported formats, size, scanned files, and slow OCR/AI work.
- Added frontend handling for `empty_file`, `no_text`, and `partial_success`.
- Preserved the existing timeout recovery polling flow.

## Edge Cases Covered By Tests

- Unauthenticated CV upload is rejected.
- Invalid file type is rejected.
- Oversized CV is rejected.
- Valid PDF upload persists profile, analysis, skills, experience, and signed download URL data.
- AI returns empty skills: existing skills are preserved.
- AI returns empty experiences: existing experiences are preserved.
- AI is unavailable: safe 503 response with retry guidance and no raw upstream error in JSON.
- AI returns malformed JSON shape: CV is stored as analysis error without wiping profile/skills/experiences.
- AI returns `no_text`: CV is stored with warning, retry available, existing skills preserved.
- Signed CV download route rejects unsigned access and accepts signed URL access.
- AI service rejects empty uploads.
- AI service returns structured error on processing crash.
- AI service routes image upload filenames to OCR handling.

## Manual Edge-Case Notes

No sample CV, generated PDF, screenshots, or runtime uploads are committed by this PR.

The regression suite covers the high-risk backend states in isolation. Additional disposable local files were used against the running Docker stack:

| File | Path location | Result |
| --- | --- | --- |
| Invalid `.txt` upload | Temporary folder outside the repo | `422` JSON validation response. |
| Oversized PDF above 5 MB | Temporary folder outside the repo | `422` JSON validation response after the Nginx body-size alignment. |
| Corrupt PDF | Temporary folder outside the repo | `200` upload response with `parsing_status="error"`, retry available, and existing data preserved. |
| Small English PDF CV | Temporary folder outside the repo | `200` upload response with `parsing_status="success"` and 6 extracted skills. |

The browser dashboard was also checked through the real registration flow. `/dashboard` loaded with the new PDF/JPG/PNG copy and no console errors.

The remaining file scenarios should still be run before final presentation using disposable local files:

- PNG/JPEG image CV.
- Arabic or mixed Arabic/English CV.

Expected behavior:

- Validation errors show clear user-facing messages.
- AI unavailable or timeout states do not claim full success.
- `no_text`, `empty_file`, `ocr_fallback`, and `partial_success` show honest warnings.
- Existing skills and experiences are preserved when extraction is empty or failed.
- A stored CV download link appears after a stored analysis exists.

## Remaining Risks

- CV processing is still synchronous from the backend request perspective; a future production PR should move it to a background job with polling and cancellation semantics.
- OCR quality is limited to the current EasyOCR setup and English reader configuration.
- Arabic CV extraction is not yet benchmarked.
- No malware scanning or file signature validation beyond MIME/extension validation is implemented.
- Storage retention policy needs a tested cleanup job before production.
- The AI model still needs a labeled evaluation set before any accuracy claims.

## Future Model And Dataset Plan

- Build a labeled CV evaluation set with English, Arabic, and mixed-language samples.
- Use ESCO and O*NET as canonical role/skill taxonomies.
- Track skill extraction precision/recall/F1.
- Track role prediction top-1/top-k accuracy.
- Track seniority classification accuracy.
- Track OCR fallback success rate and confidence by file type.
- Add confidence calibration before using AI scores for high-stakes recommendations.

## Validation Log

Baseline before changes:

- Docker compose config: passed.
- Docker stack: started with production compose overlay.
- Health checks: passed for frontend, backend health/ready/v1 health, AI analyzer, and scraper.
- Backend suite: passed, 24 tests / 163 assertions.
- ai-job-miner service API tests: passed, 13 tests.
- Python compileall: passed for `ai-cv-analyzer` and `ai-job-miner`.
- Frontend lint/build: passed in disposable Node container, with 9 existing lint warnings.

Targeted validation during implementation:

- `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan test --filter=CvUploadTest`: passed, 12 tests / 74 assertions.
- `cd ai-cv-analyzer && python -m pytest -q tests/test_service_api.py`: passed, 8 tests.
- `python -m compileall ai-cv-analyzer ai-job-miner`: passed.
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend-api php artisan test`: passed, 32 tests / 206 assertions.
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T ai-job-miner python -m pytest -q tests/test_service_api.py`: passed, 13 tests.
- `cd frontend && npm run lint && npm run build`: passed. Existing lint warnings remain non-blocking.
- Docker health sweep: passed for frontend, backend health/ready/v1 health, AI analyzer, scraper, Prometheus, Grafana, and MinIO.
- Queue check: one old failed queued closure from 2026-05-13 remains; no new CV upload queue failure was introduced.

The AI analyzer container does not include `pytest`, so the AI pytest suite was run successfully from the local Python environment after compile validation.
