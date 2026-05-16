from fastapi.testclient import TestClient

import main


client = TestClient(main.app)


class FakeMatcher:
    def __init__(self, score=80.0, missing=None):
        self.score = score
        self.missing = missing or ["Docker"]

    def calculate_match(self, cv_data, parsed_jd):
        return {
            "match_score": self.score,
            "missing_skills": self.missing,
        }


class FakeOrchestrator:
    def __init__(self):
        self.calls = []

    def process_cv(self, file_bytes, filename):
        self.calls.append(("pdf", filename))
        return main._timeout_result()

    def process_image_cv(self, file_bytes, filename):
        self.calls.append(("image", filename))
        return main._error_result("image route")


def test_health_endpoint_returns_request_metadata():
    response = client.get("/", headers={"X-Request-ID": "ci-ai-health"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "ci-ai-health"
    assert response.json()["status"] == "operational"
    assert response.json()["service"] == "Career Compass AI Engine"
    assert response.json()["request_id"] == "ci-ai-health"


def test_metrics_endpoint_uses_prometheus_text_format():
    response = client.get("/metrics")

    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    assert "career_compass_ai_requests_total" in response.text
    assert "career_compass_ai_request_errors_total" in response.text


def test_parse_cv_rejects_empty_upload_without_model_execution():
    response = client.post(
        "/api/parse-cv",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Empty file uploaded."


def test_parse_cv_returns_structured_error_when_processing_crashes(monkeypatch):
    def explode(file_bytes, filename):
        raise RuntimeError("parser exploded")

    monkeypatch.setattr(main, "_process_with_timeout", explode)

    response = client.post(
        "/api/parse-cv",
        files={"file": ("resume.pdf", b"%PDF-1.4\nfake", "application/pdf")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["parsing_status"] == "error"
    assert body["analysis"]["metadata"]["error"] == "parser exploded"
    assert body["skills"]["items"] == []


def test_process_with_timeout_routes_image_uploads_to_ocr_path(monkeypatch):
    fake = FakeOrchestrator()
    monkeypatch.setattr(main, "_get_orchestrator", lambda: fake)

    result = main._process_with_timeout(b"image-bytes", "resume.png")

    assert result["parsing_status"] == "error"
    assert result["analysis"]["metadata"]["error"] == "image route"
    assert fake.calls == [("image", "resume.png")]


def test_timeout_and_error_results_have_distinct_statuses():
    timeout = main._timeout_result()
    error = main._error_result("parser exploded")

    assert timeout["parsing_status"] == "timeout"
    assert error["parsing_status"] == "error"
    assert error["analysis"]["metadata"]["error"] == "parser exploded"


def test_hybrid_match_uses_tfidf_when_available(monkeypatch):
    monkeypatch.setattr(main, "_get_intelligent_matcher", lambda: FakeMatcher(score=80.0, missing=[]))
    monkeypatch.setattr(main, "_HAS_TFIDF", True)
    monkeypatch.setattr(main, "_tfidf_match_score", lambda cv_text, job_text: 0.50)

    response = client.post(
        "/api/hybrid-match",
        json={
            "cv_skills": ["Laravel", "Docker"],
            "cv_text": "Laravel Docker REST APIs",
            "job_description": "Laravel Docker engineer",
            "job_skills": ["Laravel", "Docker"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["hybrid_match_score"] == 68.0
    assert body["semantic_match_pct"] == 80.0
    assert body["tfidf_score_pct"] == 50.0
    assert body["matching_mode"] == "hybrid"


def test_hybrid_match_semantic_only_fallback_does_not_penalize_score(monkeypatch):
    monkeypatch.setattr(main, "_get_intelligent_matcher", lambda: FakeMatcher(score=82.0, missing=["React"]))
    monkeypatch.setattr(main, "_HAS_TFIDF", False)

    response = client.post(
        "/api/hybrid-match",
        json={
            "cv_skills": ["Laravel"],
            "cv_text": "Laravel REST APIs",
            "job_description": "React Laravel developer",
            "job_skills": ["React", "Laravel"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["hybrid_match_score"] == 82.0
    assert body["tfidf_score_pct"] == 0.0
    assert body["missing_skills"] == ["React"]
    assert body["matching_mode"] == "semantic_only_fallback"
