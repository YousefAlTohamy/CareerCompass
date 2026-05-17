import asyncio
import json
import os
import re
import subprocess
import time
from collections import Counter
from typing import Any, Optional
from urllib.parse import quote_plus, urljoin, urlparse

from fastapi import FastAPI, Header, HTTPException, Response, status
from pydantic import AnyHttpUrl, BaseModel, Field
import httpx
from bs4 import BeautifulSoup


app = FastAPI(
    title="CareerCompass Job Miner",
    version="1.0.0",
    description="Internal HTTP wrapper around the Scrapy job mining pipeline.",
)

SCRAPE_REQUESTS_TOTAL = 0
SCRAPE_FAILURES_TOTAL = 0
SCRAPE_DURATION_MS_TOTAL = 0


class SourceConfig(BaseModel):
    id: Optional[int] = Field(default=None, ge=1)
    name: Optional[str] = None
    type: Optional[str] = None
    endpoint: Optional[str] = None
    method: str = "GET"
    headers: dict[str, str] = Field(default_factory=dict)
    params: dict[str, Any] = Field(default_factory=dict)
    mode: Optional[str] = None
    pattern: Optional[str] = None
    adapter_name: Optional[str] = None
    support_status: Optional[str] = None
    requires_credentials: bool = False
    requires_proxy: bool = False


class ScrapeRequest(BaseModel):
    query: str = Field(min_length=1, max_length=255)
    limit: int = Field(default=30, ge=1, le=100)
    source_id: Optional[int] = Field(default=None, ge=1)
    scraping_job_id: int = Field(ge=1)
    callback_base_url: Optional[AnyHttpUrl] = None
    source: Optional[SourceConfig] = None


def _require_service_token(token: Optional[str]) -> None:
    expected = os.getenv("SCRAPER_SERVICE_TOKEN") or os.getenv("SCRAPY_API_TOKEN", "")
    if not expected or token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid scraper service token.",
        )


def _callback_base_url(requested: Optional[AnyHttpUrl]) -> str:
    if requested is not None:
        return str(requested).rstrip("/")

    return os.getenv("LARAVEL_API_BASE_URL", "http://127.0.0.1:8000/api").rstrip("/")


def _source_config(payload: ScrapeRequest) -> SourceConfig:
    if payload.source is not None:
        return payload.source

    return SourceConfig(id=payload.source_id, name="LinkedIn", type="linkedin")


def _apply_query_template(endpoint: str, query: str) -> str:
    encoded = quote_plus(query)
    if "{query}" in endpoint:
        return endpoint.replace("{query}", encoded)

    return endpoint


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "job"


def _is_demo_source(source: SourceConfig) -> bool:
    source_type = (source.type or "").lower().strip()
    endpoint = (source.endpoint or "").lower().strip()
    adapter = (source.adapter_name or "").lower().strip()
    name = (source.name or "").lower().strip()

    return (
        adapter == "demo"
        or source_type in {"demo", "local", "demo/local"}
        or endpoint.startswith("demo://")
        or "careercompass demo" in name
    )


def _is_valid_absolute_url(value: Any) -> bool:
    url = str(value or "").strip()
    if not url:
        return False

    parsed = urlparse(url)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _is_generated_or_local_url(value: Any) -> bool:
    parsed = urlparse(str(value or "").strip())
    host = parsed.netloc.lower()
    path = parsed.path.lower()

    return host in {"careercompass.local", "localhost", "127.0.0.1"} and (
        "/generated/" in path or "/demo-jobs/" in path or path.startswith("/generated")
    )


def _normalize_job_type(value: Any) -> str:
    normalized = str(value or "").strip().lower().replace("_", "-")
    normalized = re.sub(r"\s+", "-", normalized)

    aliases = {
        "fulltime": "full-time",
        "full-time": "full-time",
        "permanent": "full-time",
        "employee": "full-time",
        "parttime": "part-time",
        "part-time": "part-time",
        "contractor": "contract",
        "contract": "contract",
        "intern": "internship",
        "internship": "internship",
        "freelance": "freelance",
        "temporary": "temporary",
        "temp": "temporary",
    }

    return aliases.get(normalized, "full-time")


def _normalize_work_type(value: Any) -> str:
    if isinstance(value, bool):
        return "remote" if value else "onsite"

    normalized = str(value or "").strip().lower().replace("_", "-")
    normalized = re.sub(r"\s+", "-", normalized)

    aliases = {
        "remote": "remote",
        "work-from-home": "remote",
        "telecommute": "remote",
        "hybrid": "hybrid",
        "onsite": "onsite",
        "on-site": "onsite",
        "office": "onsite",
        "in-person": "onsite",
    }

    return aliases.get(normalized, "remote")


def _failure_signals(output: str) -> bool:
    signals = [
        "CRITICAL ERROR",
        "Successfully reported failure to DLQ",
        "downloader/exception_count",
        "log_count/ERROR",
        "Traceback (most recent call last)",
        "Page.goto: net::ERR_TIMED_OUT",
    ]
    return any(signal in output for signal in signals)


def _extract_error_summary(output: str) -> str:
    for line in output.splitlines():
        if "Page.goto:" in line or "Proxy failed:" in line or "ERROR:" in line or "Traceback" in line:
            return line.strip()[:500]

    return output.strip()[:500]


def _scrapy_export_count(output: str) -> int:
    return len(re.findall(r"Successfully exported job to Laravel:", output or ""))


def _scrapy_quality_rejected_count(output: str) -> int:
    return len(re.findall(r"Quality rejected job:", output or ""))


def _classification(success: bool, jobs_stored: int, failed_urls: int, output: str) -> str:
    blocked = _blocked_reason(output, "LinkedIn")
    if blocked:
        return "EXTERNAL_BLOCKED"

    if _failure_signals(output):
        return "INTEGRITY_COMPROMISED"

    if failed_urls > 0 and jobs_stored > 0:
        return "PARTIAL_SUCCESS"

    if failed_urls > 0:
        return "EXTERNAL_FAILED"

    if success and jobs_stored > 0:
        return "SUCCESS"

    if success:
        return "EMPTY_RESULT"

    return "EXTERNAL_FAILED"


def _clean_text(value: Any) -> str:
    if value is None:
        return ""

    text = BeautifulSoup(str(value), "html.parser").get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


def _sanitize_sensitive(value: Any) -> str:
    text = _clean_text(value)

    for env_name in ("ADZUNA_APP_ID", "ADZUNA_APP_KEY", "LARAVEL_API_TOKEN", "SCRAPER_SERVICE_TOKEN"):
        secret = os.getenv(env_name, "").strip()
        if secret:
            text = text.replace(secret, "[redacted]")

    return re.sub(
        r"([?&](?:app_id|app_key|api_key|token)=)[^&\s]+",
        r"\1[redacted]",
        text,
        flags=re.IGNORECASE,
    )


def _canonical_adapter(source: SourceConfig) -> str:
    if source.adapter_name:
        return source.adapter_name.lower().strip()

    name = f"{source.name or ''} {source.endpoint or ''} {source.type or ''}".lower()

    if (source.endpoint or "").startswith("demo://") or (source.type or "").lower() in {"demo", "local", "demo/local"}:
        return "demo"
    if "remotive.com" in name:
        return "remotive"
    if "adzuna.com" in name:
        return "adzuna"
    if "remoteok.com" in name:
        return "remoteok"
    if "arbeitnow.com" in name:
        return "arbeitnow"
    if "wuzzuf.net" in name:
        return "wuzzuf"
    if "indeed.com" in name:
        return "indeed"
    if "upwork.com" in name:
        return "upwork"
    if "linkedin.com" in name:
        return "linkedin"

    return (source.type or "unknown").lower().strip()


def _blocked_reason(html: str, source_name: str) -> Optional[str]:
    lowered = html.lower()
    signals = [
        "captcha",
        "unusual traffic",
        "access denied",
        "access to this page has been denied",
        "temporarily blocked",
        "verify you are human",
        "are you a human",
        "security check",
        "enable cookies",
        "sign in to continue",
        "login to continue",
        "please log in",
        "403 forbidden",
        "too many requests",
        "http 429",
        "rate limit",
        "forbidden by robots.txt",
        "ignorerequest('forbidden by robots.txt')",
        "robots exclusion",
    ]

    for signal in signals:
        if signal in lowered:
            return f"{source_name} appears to be blocked by anti-bot, login, or verification controls: {signal}."

    return None


def _http_blocked_reason(status_code: int, source_name: str) -> Optional[str]:
    if status_code in {401, 403, 429}:
        return f"{source_name} returned HTTP {status_code}; treating this as blocked, login-required, or rate-limited public access."

    return None


def _meaningful_text(value: Any, *, min_length: int = 2) -> bool:
    text = _clean_text(value)
    return len(text) >= min_length and not re.fullmatch(r"[\W\d_]+", text)


def _meaningful_title(value: Any) -> bool:
    text = _clean_text(value)
    if len(text) < 4 or len(text) > 255:
        return False

    lowered = text.lower()
    if lowered in {"job", "jobs", "openings", "results", "search results"}:
        return False
    if re.match(r"^https?://", lowered):
        return False
    if re.search(r"\b(?:jobs?|results?|positions?|openings?)\b", lowered) and re.search(r"\d", lowered):
        return False

    return _meaningful_text(text, min_length=4)


def _meaningful_company(value: Any, *, demo: bool) -> bool:
    text = _clean_text(value)
    if len(text) < 2 or len(text) > 255:
        return False

    if demo:
        return True

    lowered = text.lower()
    placeholders = {
        "unknown",
        "unknown company",
        "company",
        "employer",
        "indeed employer",
        "wuzzuf employer",
        "upwork client",
        "careercompass demo",
        "careercompass source",
    }

    return lowered not in placeholders


def _meaningful_description(*values: Any) -> bool:
    text = _clean_text(" ".join(str(value or "") for value in values))
    return len(text) >= 30


def _skills_from_text(*values: Any) -> list[str]:
    known = [
        "php", "laravel", "mysql", "docker", "react", "javascript", "typescript", "python",
        "fastapi", "scrapy", "aws", "s3", "redis", "rest", "api", "vue", "node", "sql",
        "html", "css", "kubernetes", "linux", "git", "ci/cd", "postgresql", "django",
    ]
    text = " ".join(_clean_text(value).lower() for value in values if value)
    skills: list[str] = []

    for skill in known:
        pattern = r"(?<![a-z0-9])" + re.escape(skill) + r"(?![a-z0-9])"
        if re.search(pattern, text):
            skills.append("REST APIs" if skill in {"rest", "api"} else skill.upper() if skill in {"php", "sql", "aws", "s3"} else skill.title())

    return list(dict.fromkeys(skills))


def _quality_rule_labels() -> list[str]:
    return [
        "meaningful_title",
        "meaningful_company",
        "meaningful_description_or_requirements",
        "valid_absolute_url",
        "no_generated_external_url",
        "source_identity",
        "normalized_job_type",
        "normalized_work_type",
    ]


def _quality_rejected_example(payload: dict[str, Any], reasons: list[str]) -> dict[str, Any]:
    return {
        "title": _sanitize_sensitive(payload.get("title"))[:120],
        "company": _sanitize_sensitive(payload.get("company"))[:120],
        "url": _sanitize_sensitive(payload.get("url"))[:200],
        "reasons": reasons[:5],
    }


def _quality_gate(
    jobs: list[dict[str, Any]],
    source: SourceConfig,
    query: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    accepted: list[dict[str, Any]] = []
    rejected_examples: list[dict[str, Any]] = []
    reason_counts: Counter[str] = Counter()
    demo = _is_demo_source(source)

    for job in jobs:
        payload = _job_payload(job, source, query)
        reasons: list[str] = []

        if not _meaningful_title(payload.get("title")):
            reasons.append("title_missing_or_not_meaningful")

        if not _meaningful_company(payload.get("company"), demo=demo):
            reasons.append("company_missing_or_not_meaningful")

        if not _meaningful_description(payload.get("description"), payload.get("requirements")):
            reasons.append("description_or_requirements_missing_or_too_short")

        url = payload.get("url")
        if not _is_valid_absolute_url(url):
            reasons.append("url_missing_or_not_absolute")
        elif not demo and _is_generated_or_local_url(url):
            reasons.append("generated_or_local_url_not_allowed_for_external_source")

        if not (source.id or source.name or payload.get("source")):
            reasons.append("source_identity_missing")

        if payload.get("job_type") not in {"full-time", "part-time", "contract", "internship", "freelance", "temporary"}:
            reasons.append("job_type_not_normalized")

        if payload.get("work_type") not in {"remote", "hybrid", "onsite"}:
            reasons.append("work_type_not_normalized")

        if reasons:
            reason_counts.update(reasons)
            if len(rejected_examples) < 3:
                rejected_examples.append(_quality_rejected_example(payload, reasons))
            continue

        accepted.append(payload)

    warnings: list[str] = []
    rejected_count = len(jobs) - len(accepted)
    if rejected_count:
        top_reasons = ", ".join(f"{reason}={count}" for reason, count in reason_counts.most_common(4))
        warnings.append(f"{rejected_count} job candidate(s) rejected by data quality gate before import.")
        if top_reasons:
            warnings.append(f"Top rejection reasons: {top_reasons}.")

    summary = {
        "accepted": len(accepted),
        "rejected": rejected_count,
        "rules": _quality_rule_labels(),
        "rejection_reasons": dict(reason_counts),
    }

    return accepted, {
        "jobs_quality_rejected_count": rejected_count,
        "quality_warnings": warnings,
        "rejected_examples": rejected_examples,
        "data_quality_summary": summary,
    }


def _classification_from_counts(
    *,
    jobs_preview_count: int,
    jobs_stored: int,
    failed_urls_count: int = 0,
    quality_rejected_count: int = 0,
    import_errors_count: int = 0,
) -> str:
    if jobs_stored > 0 and (failed_urls_count > 0 or quality_rejected_count > 0 or import_errors_count > 0):
        return "PARTIAL_SUCCESS"

    if jobs_stored > 0:
        return "SUCCESS"

    if jobs_preview_count > 0 and quality_rejected_count >= jobs_preview_count:
        return "DATA_QUALITY_FAILED"

    if import_errors_count > 0 or failed_urls_count > 0:
        return "EXTERNAL_FAILED"

    return "EMPTY_RESULT"


def _result(
    *,
    payload: ScrapeRequest,
    source: SourceConfig,
    started: float,
    success: bool,
    classification: str,
    endpoint_used: str,
    jobs_preview_count: int = 0,
    jobs_stored: int = 0,
    jobs_quality_rejected_count: int = 0,
    failed_urls_count: int = 0,
    stdout: str = "",
    stderr: str = "",
    error_summary: Optional[str] = None,
    matching_mode: Optional[str] = None,
    quality_warnings: Optional[list[str]] = None,
    rejected_examples: Optional[list[dict[str, Any]]] = None,
    data_quality_summary: Optional[dict[str, Any]] = None,
    extra: Optional[dict[str, Any]] = None,
) -> dict[str, object]:
    data: dict[str, object] = {
        "success": success,
        "classification": classification,
        "matching_mode": matching_mode or _canonical_adapter(source),
        "query": payload.query,
        "source_id": source.id or payload.source_id,
        "source_name": source.name,
        "source_type": source.type,
        "adapter_name": _canonical_adapter(source),
        "endpoint_used": endpoint_used,
        "scraping_job_id": payload.scraping_job_id,
        "jobs_preview_count": jobs_preview_count,
        "jobs_stored": jobs_stored,
        "jobs_quality_rejected_count": jobs_quality_rejected_count,
        "failed_urls_count": failed_urls_count,
        "quality_warnings": quality_warnings or [],
        "rejected_examples": rejected_examples or [],
        "data_quality_summary": data_quality_summary or {
            "accepted": jobs_preview_count,
            "rejected": jobs_quality_rejected_count,
            "stored": jobs_stored,
            "rules": _quality_rule_labels(),
        },
        "elapsed_ms": int((time.monotonic() - started) * 1000),
        "stdout": stdout,
        "stderr": stderr,
        "error_summary": error_summary,
    }

    if extra:
        data.update(extra)

    return data


def _job_payload(job: dict[str, Any], source: SourceConfig, query: str) -> dict[str, Any]:
    title = _clean_text(job.get("title") or job.get("position") or job.get("name"))
    company = job.get("company") or job.get("company_name") or job.get("employer") or ""
    if isinstance(company, dict):
        company = company.get("display_name") or company.get("name") or ""

    description = _clean_text(job.get("description") or job.get("summary") or job.get("requirements"))
    requirements = _clean_text(job.get("requirements") or description)
    url = str(job.get("url") or job.get("job_url") or job.get("redirect_url") or job.get("application_url") or "").strip()

    skills = job.get("skills") or job.get("tags") or []
    if isinstance(skills, str):
        skills = [part.strip() for part in re.split(r"[,;]", skills) if part.strip()]
    if not isinstance(skills, list):
        skills = []

    if _is_demo_source(source):
        title = title or f"{query} Demo Role"
        company = company or "CareerCompass Demo"
        description = description or f"Deterministic demo role for {query}."
        requirements = requirements or description

    return {
        "title": title,
        "description": description,
        "company": _clean_text(company),
        "url": url,
        "scraping_source_id": source.id,
        "location": _clean_text(job.get("location") or job.get("candidate_required_location") or ""),
        "requirements": requirements,
        "skills": skills,
        "work_type": _normalize_work_type(job.get("work_type") or job.get("workplace_type")),
        "job_type": _normalize_job_type(job.get("job_type") or job.get("type") or job.get("contract_type")),
        "experience": _clean_text(job.get("experience") or ""),
        "salary_range": _clean_text(job.get("salary_range") or job.get("salary") or ""),
        "source": _clean_text(job.get("source") or source.name or ""),
    }


def _demo_jobs(query: str, limit: int, source: SourceConfig) -> list[dict[str, Any]]:
    normalized = query.strip() or "Software"
    base_skills = ["PHP", "Laravel", "MySQL", "Docker", "REST APIs"]
    if "react" in normalized.lower() or "frontend" in normalized.lower():
        base_skills = ["React", "JavaScript", "CSS", "REST APIs", "Docker"]
    elif "flutter" in normalized.lower() or "mobile" in normalized.lower():
        base_skills = ["Flutter", "Dart", "REST APIs", "Firebase", "Git"]

    companies = ["CareerCompass Labs", "DemoWorks Remote", "Compass Talent Studio"]
    jobs = []
    for index in range(min(limit, 3)):
        title = normalized if index == 0 else f"{normalized} #{index + 1}"
        jobs.append({
            "title": title,
            "company": companies[index % len(companies)],
            "location": "Remote",
            "job_type": "full-time",
            "work_type": "remote",
            "description": (
                f"Deterministic demo role for {normalized}. The role validates the CareerCompass "
                "source-target scraping pipeline without calling an external job board."
            ),
            "requirements": ", ".join(base_skills),
            "skills": base_skills,
            "url": f"https://careercompass.local/demo-jobs/{_slug(normalized)}-{index + 1}",
            "source": source.name or "CareerCompass Demo Jobs",
        })

    return jobs


def _export_jobs(jobs: list[dict[str, Any]], source: SourceConfig, query: str, callback_base: str) -> tuple[int, list[str]]:
    errors: list[str] = []
    stored = 0

    if not jobs:
        return 0, []

    api_token = os.getenv("LARAVEL_API_TOKEN", "")
    import_url = f"{callback_base}/jobs/import"

    if not api_token:
        return 0, ["LARAVEL_API_TOKEN is not configured; refusing to export jobs"]

    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        **({"X-Request-ID": os.getenv("REQUEST_ID", "")} if os.getenv("REQUEST_ID") else {}),
    }

    with httpx.Client(timeout=15.0) as client:
        for job in jobs:
            payload = _job_payload(job, source, query)

            try:
                response = client.post(import_url, json=payload, headers=headers)
                if response.status_code in (200, 201):
                    stored += 1
                else:
                    errors.append(_sanitize_sensitive(
                        f"Import failed for {payload['url'] or '[missing-url]'}: HTTP {response.status_code} {response.text[:300]}"
                    ))
            except httpx.RequestError as exc:
                errors.append(_sanitize_sensitive(f"Import request failed for {payload['url'] or '[missing-url]'}: {exc}"))

    return stored, errors


def _parse_api_jobs(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, dict):
        for key in ("jobs", "results", "data", "items"):
            value = data.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        return []

    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]

    return []


def _remotive_jobs(data: Any) -> list[dict[str, Any]]:
    jobs = data.get("jobs", []) if isinstance(data, dict) else []
    normalized: list[dict[str, Any]] = []

    for job in jobs:
        if not isinstance(job, dict):
            continue

        tags = job.get("tags") or []
        if isinstance(tags, str):
            tags = [tags]

        normalized.append({
            "title": job.get("title"),
            "company": job.get("company_name"),
            "location": job.get("candidate_required_location") or "Remote",
            "job_type": job.get("job_type"),
            "work_type": "remote",
            "description": _clean_text(job.get("description")),
            "requirements": _clean_text(job.get("description")),
            "skills": tags or _skills_from_text(job.get("title"), job.get("description"), job.get("category")),
            "url": job.get("url"),
            "source": "Remotive Remote Jobs",
        })

    return normalized


def _adzuna_jobs(data: Any) -> list[dict[str, Any]]:
    jobs = data.get("results", []) if isinstance(data, dict) else []
    normalized: list[dict[str, Any]] = []

    for job in jobs:
        if not isinstance(job, dict):
            continue

        company = job.get("company") or {}
        location = job.get("location") or {}
        category = job.get("category") or {}
        salary_min = job.get("salary_min")
        salary_max = job.get("salary_max")
        salary_range = ""
        if salary_min or salary_max:
            salary_range = f"{salary_min or ''}-{salary_max or ''}".strip("-")

        normalized.append({
            "title": job.get("title"),
            "company": company.get("display_name") if isinstance(company, dict) else company,
            "location": location.get("display_name") if isinstance(location, dict) else location,
            "job_type": job.get("contract_type") or "full-time",
            "work_type": "remote" if "remote" in _clean_text(f"{job.get('title') or ''} {job.get('description') or ''}").lower() else "onsite",
            "description": _clean_text(job.get("description")),
            "requirements": _clean_text(job.get("description")),
            "skills": _skills_from_text(job.get("title"), job.get("description"), category.get("label") if isinstance(category, dict) else category),
            "url": job.get("redirect_url") or job.get("adref"),
            "salary_range": salary_range,
            "source": "Adzuna",
        })

    return normalized


def _remoteok_jobs(data: Any, query: str) -> list[dict[str, Any]]:
    raw_jobs = data if isinstance(data, list) else []
    normalized: list[dict[str, Any]] = []
    query_tokens = {token for token in re.split(r"\W+", query.lower()) if len(token) >= 3}

    for job in raw_jobs:
        if not isinstance(job, dict) or not job.get("position"):
            continue

        tags = job.get("tags") or []
        if isinstance(tags, str):
            tags = [tags]
        salary_min = job.get("salary_min")
        salary_max = job.get("salary_max")
        salary_range = ""
        if salary_min or salary_max:
            salary_range = f"{salary_min or ''}-{salary_max or ''}".strip("-")

        haystack = " ".join([
            str(job.get("position") or ""),
            str(job.get("company") or ""),
            " ".join(map(str, tags)),
            str(job.get("description") or ""),
        ]).lower()
        if query_tokens and not any(token in haystack for token in query_tokens):
            continue

        normalized.append({
            "title": job.get("position"),
            "company": job.get("company"),
            "location": job.get("location") or "Remote",
            "job_type": "full-time",
            "work_type": "remote",
            "description": _clean_text(job.get("description") or job.get("position")),
            "requirements": _clean_text(job.get("description")),
            "skills": tags or _skills_from_text(job.get("position"), job.get("description")),
            "url": job.get("url") or f"https://remoteok.com/remote-jobs/{job.get('id')}",
            "salary_range": salary_range,
            "source": "RemoteOK",
        })

    return normalized


def _arbeitnow_jobs(data: Any, query: str) -> list[dict[str, Any]]:
    raw_jobs = data.get("data", []) if isinstance(data, dict) else []
    normalized: list[dict[str, Any]] = []
    query_tokens = {token for token in re.split(r"\W+", query.lower()) if len(token) >= 3}

    for job in raw_jobs:
        if not isinstance(job, dict):
            continue

        tags = job.get("tags") or []
        if isinstance(tags, str):
            tags = [tags]

        haystack = " ".join([
            str(job.get("title") or ""),
            str(job.get("company_name") or ""),
            str(job.get("description") or ""),
            " ".join(map(str, tags)),
        ]).lower()
        if query_tokens and not any(token in haystack for token in query_tokens):
            continue

        normalized.append({
            "title": job.get("title"),
            "company": job.get("company_name"),
            "location": job.get("location") or "Remote",
            "job_type": (job.get("job_types") or ["full-time"])[0] if isinstance(job.get("job_types"), list) else job.get("job_types"),
            "work_type": "remote" if bool(job.get("remote")) else "onsite",
            "description": _clean_text(job.get("description")),
            "requirements": _clean_text(job.get("description")),
            "skills": tags or _skills_from_text(job.get("title"), job.get("description")),
            "url": job.get("url"),
            "source": "Arbeitnow",
        })

    return normalized


def _wuzzuf_jobs(html: str, query: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("div.css-1gatmva, div[data-testid='job-card'], article[data-testid='job-card']")
    if not cards:
        cards = [link.find_parent(["div", "article"]) for link in soup.select("a[href*='/jobs/p/']")]
        cards = [card for card in cards if card is not None]

    jobs: list[dict[str, Any]] = []
    for card in cards:
        title_link = card.select_one("h2 a[href], a[href*='/jobs/p/']")
        if not title_link:
            continue

        href = title_link.get("href", "")
        if href.startswith("/"):
            href = f"https://wuzzuf.net{href}"

        title = _clean_text(title_link.get_text(" ", strip=True))
        company_node = card.select_one("a.css-17s97q8, .css-17s97q8, [data-testid='company-name'], a[href*='/jobs/careers/']")
        location_node = card.select_one(".css-5wys0k, [class*='location'], [data-testid='job-location']")
        company = _clean_text(company_node.get_text(" ", strip=True) if company_node else "")
        location = _clean_text(location_node.get_text(" ", strip=True) if location_node else "Egypt")
        tags = [_clean_text(tag.get_text(" ", strip=True)) for tag in card.select(".css-5x9pm1, a[href*='/a/'], [data-testid='skill-tag']")]
        snippet = _clean_text(card.get_text(" ", strip=True))

        if title:
            jobs.append({
                "title": title,
                "company": company,
                "location": location or "Egypt",
                "job_type": "full-time",
                "work_type": "remote" if "remote" in snippet.lower() else "onsite",
                "description": snippet,
                "requirements": snippet,
                "skills": tags or _skills_from_text(title, snippet, query),
                "url": href,
                "source": "Wuzzuf Egypt",
            })

    return jobs


def _indeed_jobs(html: str, query: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("div.job_seen_beacon, div[data-testid='slider_item'], div[data-jk]")
    if not cards:
        cards = soup.select("a[data-jk]")
    jobs: list[dict[str, Any]] = []

    for card in cards:
        title_node = card.select_one("h2 span[title], h2 span, a[data-jk] span, [data-testid='jobTitle']")
        link_node = card.select_one("a[href*='/viewjob'], a[data-jk]")
        if not title_node and link_node:
            title_node = link_node

        title = _clean_text(title_node.get("title") if title_node and title_node.has_attr("title") else title_node.get_text(" ", strip=True) if title_node else "")
        if not title:
            continue

        href = link_node.get("href", "") if link_node else ""
        if href.startswith("/"):
            href = f"https://www.indeed.com{href}"

        company_node = card.select_one("[data-testid='company-name'], .companyName")
        location_node = card.select_one("[data-testid='text-location'], .companyLocation")
        snippet = _clean_text(card.get_text(" ", strip=True))

        jobs.append({
            "title": title,
            "company": _clean_text(company_node.get_text(" ", strip=True) if company_node else ""),
            "location": _clean_text(location_node.get_text(" ", strip=True) if location_node else "Remote"),
            "job_type": "full-time",
            "work_type": "remote" if "remote" in snippet.lower() else "onsite",
            "description": snippet,
            "requirements": snippet,
            "skills": _skills_from_text(title, snippet, query),
            "url": href,
            "source": "Indeed",
        })

    return jobs


def _upwork_jobs(html: str, query: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("section[data-test='job-tile'], article[data-test='job-tile'], div[data-test='job-tile'], article")
    jobs: list[dict[str, Any]] = []

    for card in cards:
        title_node = card.select_one("a[data-test='job-tile-title-link'], a[href*='/jobs/'], h2, h3")
        title = _clean_text(title_node.get_text(" ", strip=True) if title_node else "")
        if not title:
            continue

        href = title_node.get("href", "") if title_node and title_node.has_attr("href") else ""
        if href.startswith("/"):
            href = f"https://www.upwork.com{href}"

        text = _clean_text(card.get_text(" ", strip=True))
        tags = [_clean_text(tag.get_text(" ", strip=True)) for tag in card.select("[data-test='token'], .air3-token")]
        company_node = card.select_one("[data-test='client-name'], [data-test='buyer-name'], [data-test='client-country']")
        company = _clean_text(company_node.get_text(" ", strip=True) if company_node else "")

        jobs.append({
            "title": title,
            "company": company,
            "location": "Remote",
            "job_type": "freelance",
            "work_type": "remote",
            "description": text,
            "requirements": text,
            "skills": tags or _skills_from_text(title, text, query),
            "url": href,
            "source": "Upwork",
        })

    return jobs


def _json_values(value: Any):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from _json_values(child)
    elif isinstance(value, list):
        for child in value:
            yield from _json_values(child)


def _json_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return _clean_text(value)
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        return _clean_text(" ".join(_json_text(item) for item in value))
    if isinstance(value, dict):
        for key in ("name", "title", "text", "label", "display_name"):
            if key in value:
                return _json_text(value.get(key))
    return ""


def _json_url(value: Any, base_url: str) -> str:
    if isinstance(value, str) and value.strip():
        return urljoin(base_url, value.strip())
    if isinstance(value, dict):
        for key in ("url", "@id", "sameAs"):
            url = _json_url(value.get(key), base_url)
            if url:
                return url
    if isinstance(value, list):
        for item in value:
            url = _json_url(item, base_url)
            if url:
                return url
    return ""


def _salary_from_json(value: Any) -> str:
    if not isinstance(value, dict):
        return _json_text(value)

    raw_value = value.get("value")
    currency = value.get("currency") or value.get("currencyCode") or ""
    if isinstance(raw_value, dict):
        minimum = raw_value.get("minValue") or raw_value.get("min")
        maximum = raw_value.get("maxValue") or raw_value.get("max")
        unit = raw_value.get("unitText") or ""
        if minimum or maximum:
            salary = f"{minimum or ''}-{maximum or ''}".strip("-")
            return _clean_text(f"{salary} {currency} {unit}")
        if raw_value.get("value"):
            return _clean_text(f"{raw_value.get('value')} {currency} {unit}")

    return _json_text(raw_value or value)


def _location_from_json(value: Any) -> str:
    if isinstance(value, list):
        return _clean_text(" / ".join(filter(None, (_location_from_json(item) for item in value))))
    if not isinstance(value, dict):
        return _json_text(value)

    address = value.get("address") if isinstance(value, dict) else None
    if isinstance(address, dict):
        parts = [
            address.get("addressLocality"),
            address.get("addressRegion"),
            address.get("addressCountry"),
        ]
        return _clean_text(", ".join(_json_text(part) for part in parts if _json_text(part)))

    return _json_text(value)


def _json_ld_jobs(html: str, base_url: str, source_label: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    jobs: list[dict[str, Any]] = []

    for script in soup.select("script[type='application/ld+json']"):
        raw = script.string or script.get_text("", strip=True)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        for item in _json_values(data):
            raw_type = item.get("@type") or item.get("type")
            types = raw_type if isinstance(raw_type, list) else [raw_type]
            if not any(str(value).lower() == "jobposting" for value in types if value):
                continue

            organization = item.get("hiringOrganization") or item.get("organization") or {}
            jobs.append({
                "title": item.get("title") or item.get("name"),
                "company": _json_text(organization),
                "location": _location_from_json(item.get("jobLocation") or item.get("applicantLocationRequirements")),
                "job_type": item.get("employmentType") or "full-time",
                "work_type": "remote" if item.get("jobLocationType") == "TELECOMMUTE" else "",
                "description": _clean_text(item.get("description")),
                "requirements": _clean_text(item.get("responsibilities") or item.get("qualifications") or item.get("description")),
                "skills": _skills_from_text(item.get("skills"), item.get("qualifications"), item.get("description")),
                "url": _json_url(item.get("url") or item.get("sameAs") or item.get("identifier"), base_url),
                "salary_range": _salary_from_json(item.get("baseSalary")),
                "source": source_label,
            })

    return jobs


def _embedded_state_jobs(html: str, base_url: str, source_label: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    jobs: list[dict[str, Any]] = []
    scripts = soup.select("script#__NEXT_DATA__[type='application/json'], script[type='application/json']")

    for script in scripts:
        raw = script.string or script.get_text("", strip=True)
        if not raw or len(raw) > 5_000_000:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        for item in _json_values(data):
            title = item.get("title") or item.get("position") or item.get("name")
            company = (
                item.get("company")
                or item.get("companyName")
                or item.get("company_name")
                or item.get("hiringOrganization")
                or item.get("client")
            )
            url = _json_url(item.get("url") or item.get("jobUrl") or item.get("job_url") or item.get("canonicalUrl"), base_url)
            description = item.get("description") or item.get("summary") or item.get("snippet")

            if not title or not company or not url:
                continue

            jobs.append({
                "title": title,
                "company": _json_text(company),
                "location": _json_text(item.get("location") or item.get("candidate_required_location")),
                "job_type": item.get("job_type") or item.get("employmentType") or item.get("type"),
                "work_type": item.get("work_type") or item.get("workplace_type") or item.get("remote"),
                "description": _clean_text(description),
                "requirements": _clean_text(item.get("requirements") or description),
                "skills": item.get("skills") or item.get("tags") or _skills_from_text(title, description),
                "url": url,
                "salary_range": _json_text(item.get("salary") or item.get("salary_range")),
                "source": source_label,
            })

            if len(jobs) >= 100:
                return jobs

    return jobs


def _dedupe_jobs(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []

    for job in jobs:
        key = str(job.get("url") or "").strip().lower()
        if not key:
            key = f"{_clean_text(job.get('title')).lower()}::{_clean_text(job.get('company')).lower()}"
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(job)

    return unique


def _parse_public_html_jobs(parser: str, html: str, query: str, endpoint: str) -> list[dict[str, Any]]:
    source_label = {
        "wuzzuf": "Wuzzuf Egypt",
        "indeed": "Indeed",
        "upwork": "Upwork",
    }.get(parser, parser.title())

    jobs = _json_ld_jobs(html, endpoint, source_label)
    jobs.extend(_embedded_state_jobs(html, endpoint, source_label))

    if parser == "wuzzuf":
        jobs.extend(_wuzzuf_jobs(html, query))
    elif parser == "indeed":
        jobs.extend(_indeed_jobs(html, query))
    elif parser == "upwork":
        jobs.extend(_upwork_jobs(html, query))

    return _dedupe_jobs(jobs)


def _public_playwright_selector(parser: str) -> str:
    return {
        "wuzzuf": "div.css-1gatmva, div[data-testid='job-card'], a[href*='/jobs/p/']",
        "indeed": "div.job_seen_beacon, div[data-testid='slider_item'], a[data-jk], a[href*='/viewjob']",
        "upwork": "section[data-test='job-tile'], article[data-test='job-tile'], div[data-test='job-tile'], a[href*='/jobs/']",
    }.get(parser, "body")


async def _render_public_page(endpoint: str, parser: str, headers: dict[str, str]) -> tuple[Optional[str], Optional[str]]:
    timeout_ms = min(int(os.getenv("SCRAPER_PLAYWRIGHT_TIMEOUT_MS", "20000")), 30000)
    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            try:
                context = await browser.new_context(extra_http_headers=headers)
                page = await context.new_page()
                page.set_default_timeout(timeout_ms)
                page.set_default_navigation_timeout(timeout_ms)

                await page.goto(endpoint, wait_until="domcontentloaded", timeout=timeout_ms)
                try:
                    await page.wait_for_load_state("networkidle", timeout=5000)
                except Exception:
                    pass

                selector = _public_playwright_selector(parser)
                try:
                    await page.wait_for_selector(selector, timeout=timeout_ms)
                except Exception:
                    pass

                html = await page.content()
                await context.close()
                return html, None
            finally:
                await browser.close()
    except Exception as exc:
        return None, _sanitize_sensitive(exc)[:500]


def _render_public_page_sync(endpoint: str, parser: str, headers: dict[str, str]) -> tuple[Optional[str], Optional[str]]:
    return asyncio.run(_render_public_page(endpoint, parser, headers))


def _run_demo_source(payload: ScrapeRequest, source: SourceConfig, callback_base: str, started: float) -> dict[str, object]:
    jobs = _demo_jobs(payload.query, payload.limit, source)
    accepted_jobs, quality = _quality_gate(jobs, source, payload.query)
    stored, errors = _export_jobs(accepted_jobs, source, payload.query, callback_base)
    elapsed_ms = int((time.monotonic() - started) * 1000)
    classification = _classification_from_counts(
        jobs_preview_count=len(jobs),
        jobs_stored=stored,
        quality_rejected_count=quality["jobs_quality_rejected_count"],
        import_errors_count=len(errors),
    )
    success = classification in {"SUCCESS", "PARTIAL_SUCCESS"}

    return {
        "success": success,
        "classification": classification,
        "matching_mode": "demo_local",
        "query": payload.query,
        "source_id": source.id or payload.source_id,
        "source_name": source.name,
        "source_type": source.type,
        "adapter_name": "demo",
        "endpoint_used": source.endpoint or "demo://careercompass/jobs",
        "scraping_job_id": payload.scraping_job_id,
        "jobs_preview_count": len(jobs),
        "jobs_stored": stored,
        "jobs_quality_rejected_count": quality["jobs_quality_rejected_count"],
        "failed_urls_count": len(errors),
        "quality_warnings": quality["quality_warnings"],
        "rejected_examples": quality["rejected_examples"],
        "data_quality_summary": {**quality["data_quality_summary"], "stored": stored},
        "elapsed_ms": elapsed_ms,
        "stdout": f"Generated {len(jobs)} deterministic demo jobs, accepted {len(accepted_jobs)}, and stored {stored}.",
        "stderr": _sanitize_sensitive("\n".join(errors)),
        "error_summary": _sanitize_sensitive("; ".join(errors))[:500] if errors else None,
    }


def _run_api_source(payload: ScrapeRequest, source: SourceConfig, callback_base: str, started: float) -> dict[str, object]:
    endpoint = _apply_query_template(source.endpoint or "", payload.query)
    if not endpoint:
        return _result(
            payload=payload,
            source=source,
            started=started,
            success=False,
            classification="CONFIG_INVALID",
            endpoint_used=endpoint,
            stderr="API source endpoint is empty.",
            error_summary="API source endpoint is empty.",
        )

    method = (source.method or "GET").upper()
    try:
        with httpx.Client(timeout=min(int(os.getenv("SCRAPER_DEFAULT_TIMEOUT", "600")), 30)) as client:
            response = client.request(method, endpoint, headers=source.headers or {}, params=source.params or None)
        blocked = _http_blocked_reason(response.status_code, source.name or "API source")
        if blocked:
            return _result(
                payload=payload,
                source=source,
                started=started,
                success=False,
                classification="EXTERNAL_BLOCKED",
                endpoint_used=endpoint,
                failed_urls_count=1,
                stderr=blocked,
                error_summary=blocked,
            )
        response.raise_for_status()
        jobs = _parse_api_jobs(response.json())
    except Exception as exc:
        return _result(
            payload=payload,
            source=source,
            started=started,
            success=False,
            classification="EXTERNAL_FAILED",
            endpoint_used=endpoint,
            failed_urls_count=1,
            stderr=_sanitize_sensitive(exc),
            error_summary=_sanitize_sensitive(exc)[:500],
        )

    jobs = jobs[:payload.limit]
    accepted_jobs, quality = _quality_gate(jobs, source, payload.query)
    stored, errors = _export_jobs(accepted_jobs, source, payload.query, callback_base)
    elapsed_ms = int((time.monotonic() - started) * 1000)
    classification = _classification_from_counts(
        jobs_preview_count=len(jobs),
        jobs_stored=stored,
        quality_rejected_count=quality["jobs_quality_rejected_count"],
        import_errors_count=len(errors),
    )

    return {
        "success": classification in ("SUCCESS", "PARTIAL_SUCCESS"),
        "classification": classification,
        "query": payload.query,
        "source_id": source.id or payload.source_id,
        "source_name": source.name,
        "source_type": source.type,
        "adapter_name": _canonical_adapter(source),
        "endpoint_used": endpoint,
        "scraping_job_id": payload.scraping_job_id,
        "jobs_preview_count": len(jobs),
        "jobs_stored": stored,
        "jobs_quality_rejected_count": quality["jobs_quality_rejected_count"],
        "failed_urls_count": len(errors),
        "quality_warnings": quality["quality_warnings"],
        "rejected_examples": quality["rejected_examples"],
        "data_quality_summary": {**quality["data_quality_summary"], "stored": stored},
        "elapsed_ms": elapsed_ms,
        "stdout": f"Fetched {len(jobs)} API job candidates, accepted {len(accepted_jobs)}, and stored {stored}.",
        "stderr": _sanitize_sensitive("\n".join(errors)),
        "error_summary": _sanitize_sensitive("; ".join(errors))[:500] if errors else None,
    }


def _run_json_adapter(
    payload: ScrapeRequest,
    source: SourceConfig,
    callback_base: str,
    started: float,
    parser: str,
) -> dict[str, object]:
    endpoint = _apply_query_template(source.endpoint or "", payload.query)
    headers = {
        "Accept": "application/json",
        "User-Agent": "CareerCompassBot/1.0 (+https://careercompass.local)",
        **(source.headers or {}),
    }
    params = dict(source.params or {})

    if parser == "adzuna":
        app_id = os.getenv("ADZUNA_APP_ID", "").strip()
        app_key = os.getenv("ADZUNA_APP_KEY", "").strip()
        if not app_id or not app_key:
            return _result(
                payload=payload,
                source=source,
                started=started,
                success=False,
                classification="CONFIG_REQUIRED",
                endpoint_used=endpoint,
                stderr="Set ADZUNA_APP_ID and ADZUNA_APP_KEY to enable Adzuna.",
                error_summary="Set ADZUNA_APP_ID and ADZUNA_APP_KEY to enable Adzuna.",
                extra={"requires_credentials": True},
            )

        params.update({"app_id": app_id, "app_key": app_key})

    try:
        with httpx.Client(timeout=min(int(os.getenv("SCRAPER_DEFAULT_TIMEOUT", "600")), 30), follow_redirects=True) as client:
            response = client.get(endpoint, headers=headers, params=params or None)
        blocked = _http_blocked_reason(response.status_code, source.name or parser)
        if blocked:
            return _result(
                payload=payload,
                source=source,
                started=started,
                success=False,
                classification="EXTERNAL_BLOCKED",
                endpoint_used=endpoint,
                failed_urls_count=1,
                stderr=blocked,
                error_summary=blocked,
            )
        response.raise_for_status()
        data = response.json()
    except Exception as exc:
        return _result(
            payload=payload,
            source=source,
            started=started,
            success=False,
            classification="EXTERNAL_FAILED",
            endpoint_used=endpoint,
            failed_urls_count=1,
            stderr=_sanitize_sensitive(exc),
            error_summary=_sanitize_sensitive(exc)[:500],
        )

    if parser == "remotive":
        jobs = _remotive_jobs(data)
    elif parser == "adzuna":
        jobs = _adzuna_jobs(data)
    elif parser == "remoteok":
        jobs = _remoteok_jobs(data, payload.query)
    elif parser == "arbeitnow":
        jobs = _arbeitnow_jobs(data, payload.query)
    else:
        jobs = _parse_api_jobs(data)

    jobs = jobs[:payload.limit]
    accepted_jobs, quality = _quality_gate(jobs, source, payload.query)
    stored, errors = _export_jobs(accepted_jobs, source, payload.query, callback_base)
    classification = _classification_from_counts(
        jobs_preview_count=len(jobs),
        jobs_stored=stored,
        quality_rejected_count=quality["jobs_quality_rejected_count"],
        import_errors_count=len(errors),
    )

    return _result(
        payload=payload,
        source=source,
        started=started,
        success=classification in ("SUCCESS", "PARTIAL_SUCCESS"),
        classification=classification,
        endpoint_used=endpoint,
        jobs_preview_count=len(jobs),
        jobs_stored=stored,
        jobs_quality_rejected_count=quality["jobs_quality_rejected_count"],
        failed_urls_count=len(errors),
        quality_warnings=quality["quality_warnings"],
        rejected_examples=quality["rejected_examples"],
        data_quality_summary={**quality["data_quality_summary"], "stored": stored},
        stdout=f"{parser} adapter fetched {len(jobs)} candidates, accepted {len(accepted_jobs)}, and stored {stored}.",
        stderr=_sanitize_sensitive("\n".join(errors)),
        error_summary=_sanitize_sensitive("; ".join(errors))[:500] if errors else None,
    )


def _run_html_adapter(
    payload: ScrapeRequest,
    source: SourceConfig,
    callback_base: str,
    started: float,
    parser: str,
) -> dict[str, object]:
    endpoint = _apply_query_template(source.endpoint or "", payload.query)
    headers = {
        "Accept": "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        **(source.headers or {}),
    }

    try:
        with httpx.Client(timeout=min(int(os.getenv("SCRAPER_DEFAULT_TIMEOUT", "600")), 30), follow_redirects=True) as client:
            response = client.get(endpoint, headers=headers, params=source.params or None)
        blocked = _http_blocked_reason(response.status_code, source.name or parser)
        if blocked:
            return _result(
                payload=payload,
                source=source,
                started=started,
                success=False,
                classification="EXTERNAL_BLOCKED",
                endpoint_used=endpoint,
                failed_urls_count=1,
                stderr=blocked,
                error_summary=blocked,
            )
        response.raise_for_status()
        html = response.text
    except Exception as exc:
        return _result(
            payload=payload,
            source=source,
            started=started,
            success=False,
            classification="EXTERNAL_FAILED",
            endpoint_used=endpoint,
            failed_urls_count=1,
            stderr=_sanitize_sensitive(exc),
            error_summary=_sanitize_sensitive(exc)[:500],
        )

    blocked = _blocked_reason(html, source.name or parser)
    if blocked:
        return _result(
            payload=payload,
            source=source,
            started=started,
            success=False,
            classification="EXTERNAL_BLOCKED",
            endpoint_used=endpoint,
            failed_urls_count=1,
            stderr=blocked,
            error_summary=blocked,
        )

    jobs = _parse_public_html_jobs(parser, html, payload.query, endpoint)
    rendered = False
    render_error = None

    if not jobs:
        rendered_html, render_error = _render_public_page_sync(endpoint, parser, headers)
        if rendered_html:
            rendered = True
            blocked = _blocked_reason(rendered_html, source.name or parser)
            if blocked:
                return _result(
                    payload=payload,
                    source=source,
                    started=started,
                    success=False,
                    classification="EXTERNAL_BLOCKED",
                    endpoint_used=endpoint,
                    failed_urls_count=1,
                    stderr=blocked,
                    error_summary=blocked,
                    extra={"playwright_used": True},
                )
            jobs = _parse_public_html_jobs(parser, rendered_html, payload.query, endpoint)

    jobs = jobs[:payload.limit]
    accepted_jobs, quality = _quality_gate(jobs, source, payload.query)
    stored, errors = _export_jobs(accepted_jobs, source, payload.query, callback_base)
    classification = _classification_from_counts(
        jobs_preview_count=len(jobs),
        jobs_stored=stored,
        quality_rejected_count=quality["jobs_quality_rejected_count"],
        import_errors_count=len(errors),
    )
    stderr = "\n".join(errors)
    if render_error and not jobs:
        stderr = "\n".join(filter(None, [stderr, f"Playwright render fallback failed: {render_error}"]))

    return _result(
        payload=payload,
        source=source,
        started=started,
        success=classification in ("SUCCESS", "PARTIAL_SUCCESS"),
        classification=classification,
        endpoint_used=endpoint,
        jobs_preview_count=len(jobs),
        jobs_stored=stored,
        jobs_quality_rejected_count=quality["jobs_quality_rejected_count"],
        failed_urls_count=len(errors),
        quality_warnings=quality["quality_warnings"],
        rejected_examples=quality["rejected_examples"],
        data_quality_summary={**quality["data_quality_summary"], "stored": stored},
        stdout=f"{parser} adapter parsed {len(jobs)} public job candidates, accepted {len(accepted_jobs)}, stored {stored}, playwright_used={rendered}.",
        stderr=_sanitize_sensitive(stderr),
        error_summary=_sanitize_sensitive("; ".join(errors) or (f"Playwright render fallback failed: {render_error}" if render_error and not jobs else ""))[:500] or None,
        extra={"playwright_used": rendered, "playwright_needed": rendered or parser in {"indeed", "upwork"}},
    )


def _unsupported_source(payload: ScrapeRequest, source: SourceConfig, started: float, reason: str) -> dict[str, object]:
    elapsed_ms = int((time.monotonic() - started) * 1000)
    return {
        "success": False,
        "classification": "ADAPTER_MISSING",
        "query": payload.query,
        "source_id": source.id or payload.source_id,
        "source_name": source.name,
        "source_type": source.type,
        "adapter_name": _canonical_adapter(source),
        "endpoint_used": _apply_query_template(source.endpoint or "", payload.query),
        "scraping_job_id": payload.scraping_job_id,
        "jobs_preview_count": 0,
        "jobs_stored": 0,
        "jobs_quality_rejected_count": 0,
        "failed_urls_count": 0,
        "quality_warnings": [],
        "rejected_examples": [],
        "data_quality_summary": {
            "accepted": 0,
            "rejected": 0,
            "stored": 0,
            "rules": _quality_rule_labels(),
            "rejection_reasons": {},
        },
        "elapsed_ms": elapsed_ms,
        "stdout": "",
        "stderr": reason,
        "error_summary": reason,
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "CareerCompass Job Miner"}


@app.get("/metrics")
def metrics() -> Response:
    lines = [
        "# HELP career_compass_scraper_requests_total Total scraper executions.",
        "# TYPE career_compass_scraper_requests_total counter",
        f"career_compass_scraper_requests_total {SCRAPE_REQUESTS_TOTAL}",
        "# HELP career_compass_scraper_failures_total Failed scraper executions.",
        "# TYPE career_compass_scraper_failures_total counter",
        f"career_compass_scraper_failures_total {SCRAPE_FAILURES_TOTAL}",
        "# HELP career_compass_scraper_duration_ms_total Total scraper execution duration in milliseconds.",
        "# TYPE career_compass_scraper_duration_ms_total counter",
        f"career_compass_scraper_duration_ms_total {SCRAPE_DURATION_MS_TOTAL}",
    ]

    return Response("\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")


@app.post("/scrape")
def scrape(
    payload: ScrapeRequest,
    x_scraper_service_token: Optional[str] = Header(default=None),
    x_request_id: Optional[str] = Header(default=None),
) -> dict[str, object]:
    global SCRAPE_DURATION_MS_TOTAL, SCRAPE_FAILURES_TOTAL, SCRAPE_REQUESTS_TOTAL

    _require_service_token(x_scraper_service_token)
    SCRAPE_REQUESTS_TOTAL += 1

    started = time.monotonic()
    timeout = int(os.getenv("SCRAPER_DEFAULT_TIMEOUT", "600"))
    callback_base = _callback_base_url(payload.callback_base_url)
    source = _source_config(payload)
    source_type = (source.type or "").lower().strip()
    endpoint = _apply_query_template(source.endpoint or "", payload.query)
    adapter = _canonical_adapter(source)

    if adapter == "demo":
        return _run_demo_source(payload, source, callback_base, started)

    if adapter in {"remotive", "adzuna", "remoteok", "arbeitnow"}:
        return _run_json_adapter(payload, source, callback_base, started, adapter)

    if adapter in {"wuzzuf", "indeed", "upwork"}:
        return _run_html_adapter(payload, source, callback_base, started, adapter)

    if source_type == "api":
        return _run_api_source(payload, source, callback_base, started)

    if source_type in {"html"}:
        return _unsupported_source(
            payload,
            source,
            started,
            "Generic HTML source extraction is not implemented yet. Use a demo/local, API, or supported spider-backed source.",
        )

    if source_type in {"spa"} and "linkedin.com" not in endpoint.lower():
        return _unsupported_source(
            payload,
            source,
            started,
            "No source-specific SPA adapter is implemented for this endpoint yet. Public Indeed and Upwork adapters are handled separately without login or CAPTCHA bypass.",
        )

    command = [
        "scrapy",
        "crawl",
        "linkedin",
        "-a",
        f"query={payload.query}",
        "-a",
        f"limit={payload.limit}",
    ]

    source_id = source.id or payload.source_id
    if source_id is not None:
        command.extend(["-a", f"source_id={source_id}"])

    if endpoint:
        command.extend(["-a", f"endpoint={endpoint}"])

    env = os.environ.copy()
    env.update(
        {
            "LARAVEL_API_URL": f"{callback_base}/jobs/import",
            "LARAVEL_API_CHECK_URL": f"{callback_base}/jobs/import/check",
            "LARAVEL_API_FAILED_URL": f"{callback_base}/jobs/import/failed",
            "LARAVEL_API_PROXIES_URL": f"{callback_base}/proxies/active",
            "LARAVEL_API_TOKEN": os.getenv("LARAVEL_API_TOKEN", ""),
            "SCRAPING_JOB_ID": str(payload.scraping_job_id),
            "REQUEST_ID": x_request_id or "",
            "SCRAPER_USE_PROXIES": os.getenv("SCRAPER_USE_PROXIES", "true"),
        }
    )

    try:
        result = subprocess.run(
            command,
            cwd=os.getcwd(),
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        SCRAPE_FAILURES_TOTAL += 1
        SCRAPE_DURATION_MS_TOTAL += elapsed_ms
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "message": "Scrapy execution timed out.",
                "elapsed_ms": elapsed_ms,
                "stdout": _sanitize_sensitive(exc.stdout[-4000:] if exc.stdout else ""),
                "stderr": _sanitize_sensitive(exc.stderr[-4000:] if exc.stderr else ""),
            },
        ) from exc

    elapsed_ms = int((time.monotonic() - started) * 1000)
    SCRAPE_DURATION_MS_TOTAL += elapsed_ms
    output = (result.stdout or "") + "\n" + (result.stderr or "")
    jobs_stored = _scrapy_export_count(output)
    jobs_quality_rejected_count = _scrapy_quality_rejected_count(output)
    failed_urls_count = 1 if _failure_signals(output) else 0
    blocked = _blocked_reason(output, source.name or "LinkedIn")
    classification = (
        "EXTERNAL_BLOCKED"
        if blocked
        else "INTEGRITY_COMPROMISED"
        if _failure_signals(output)
        else "PARTIAL_SUCCESS"
        if jobs_stored > 0 and jobs_quality_rejected_count > 0
        else "SUCCESS"
        if jobs_stored > 0 and result.returncode == 0
        else "DATA_QUALITY_FAILED"
        if jobs_quality_rejected_count > 0 and result.returncode == 0
        else "EMPTY_RESULT"
        if result.returncode == 0
        else "EXTERNAL_FAILED"
    )
    success = classification in {"SUCCESS", "PARTIAL_SUCCESS"}

    if not success:
        SCRAPE_FAILURES_TOTAL += 1

    return {
        "success": success,
        "classification": classification,
        "request_id": x_request_id,
        "query": payload.query,
        "source_id": source_id,
        "source_name": source.name,
        "source_type": source.type,
        "adapter_name": "linkedin",
        "endpoint_used": endpoint or f"https://www.linkedin.com/jobs/search/?keywords={payload.query}",
        "scraping_job_id": payload.scraping_job_id,
        "exit_code": result.returncode,
        "elapsed_ms": elapsed_ms,
        "jobs_preview_count": jobs_stored + jobs_quality_rejected_count,
        "jobs_stored": jobs_stored,
        "jobs_quality_rejected_count": jobs_quality_rejected_count,
        "failed_urls_count": failed_urls_count,
        "quality_warnings": [f"{jobs_quality_rejected_count} LinkedIn item(s) rejected by data quality gate before import."] if jobs_quality_rejected_count else [],
        "rejected_examples": [],
        "data_quality_summary": {
            "accepted": jobs_stored,
            "rejected": jobs_quality_rejected_count,
            "stored": jobs_stored,
            "rules": _quality_rule_labels(),
            "rejection_reasons": {"scrapy_pipeline_quality_rejected": jobs_quality_rejected_count} if jobs_quality_rejected_count else {},
        },
        "error_summary": blocked or (_extract_error_summary(output) if not success else None),
        "stdout": result.stdout[-8000:],
        "stderr": result.stderr[-8000:],
    }
