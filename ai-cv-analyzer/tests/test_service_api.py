from fastapi.testclient import TestClient

import main


client = TestClient(main.app)


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
