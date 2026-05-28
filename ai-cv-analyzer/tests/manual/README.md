# Manual CV Analyzer Checks

These scripts are preserved for manual reference and are not part of the current pytest suite. `legacy_parse_cv_http_check.py` targets the old `/api/v2/analyze-cv` response shape and should not be used as an automated regression test for the current service.

For the current API behavior, use `POST /api/parse-cv` and the maintained service tests.
