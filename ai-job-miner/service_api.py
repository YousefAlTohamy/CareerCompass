import os
import re
import subprocess
import time
from typing import Any, Optional
from urllib.parse import quote_plus

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
    normalized = str(value or "").strip().lower().replace("_", "-")
    normalized = re.sub(r"\s+", "-", normalized)

    aliases = {
        "remote": "remote",
        "work-from-home": "remote",
        "telecommute": "remote",
        "hybrid": "hybrid",
        "onsite": "onsite",
        "on-site": "on-site",
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


def _classification(success: bool, jobs_stored: int, failed_urls: int, output: str) -> str:
    if _failure_signals(output):
        return "INTEGRITY_COMPROMISED"

    if failed_urls > 0 and jobs_stored > 0:
        return "PARTIAL_SUCCESS"

    if failed_urls > 0:
        return "EXTERNAL_FAILED"

    if success and jobs_stored > 0:
        return "SUCCESS"

    if success:
        return "EMPTY_SUCCESS"

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
        "temporarily blocked",
        "verify you are human",
        "security check",
        "enable cookies",
        "sign in to continue",
        "login to continue",
    ]

    for signal in signals:
        if signal in lowered:
            return f"{source_name} appears to be blocked by anti-bot, login, or verification controls: {signal}."

    return None


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
    failed_urls_count: int = 0,
    stdout: str = "",
    stderr: str = "",
    error_summary: Optional[str] = None,
    matching_mode: Optional[str] = None,
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
        "failed_urls_count": failed_urls_count,
        "elapsed_ms": int((time.monotonic() - started) * 1000),
        "stdout": stdout,
        "stderr": stderr,
        "error_summary": error_summary,
    }

    if extra:
        data.update(extra)

    return data


def _job_payload(job: dict[str, Any], source: SourceConfig, query: str) -> dict[str, Any]:
    title = str(job.get("title") or job.get("position") or job.get("name") or f"{query} Specialist").strip()
    company = job.get("company") or job.get("company_name") or job.get("employer") or "CareerCompass Demo"
    if isinstance(company, dict):
        company = company.get("display_name") or company.get("name") or "Unknown Company"

    description = str(job.get("description") or job.get("summary") or job.get("requirements") or f"{title} role for {query}.").strip()
    url = str(job.get("url") or job.get("job_url") or job.get("redirect_url") or job.get("application_url") or "").strip()

    skills = job.get("skills") or job.get("tags") or []
    if isinstance(skills, str):
        skills = [part.strip() for part in re.split(r"[,;]", skills) if part.strip()]
    if not isinstance(skills, list):
        skills = []

    return {
        "title": title,
        "description": description,
        "company": str(company).strip() or "Unknown Company",
        "url": url,
        "scraping_source_id": source.id,
        "location": job.get("location") or job.get("candidate_required_location") or "Remote",
        "requirements": job.get("requirements") or description,
        "skills": skills,
        "work_type": _normalize_work_type(job.get("work_type") or job.get("workplace_type")),
        "job_type": _normalize_job_type(job.get("job_type") or job.get("type") or job.get("contract_type")),
        "experience": job.get("experience") or "",
        "salary_range": job.get("salary_range") or job.get("salary") or "",
        "source": source.name or "CareerCompass Source",
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
    api_token = os.getenv("LARAVEL_API_TOKEN", "")
    import_url = f"{callback_base}/jobs/import"
    errors: list[str] = []
    stored = 0

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
            if not payload["url"]:
                payload["url"] = f"https://careercompass.local/generated/{_slug(query)}-{stored + 1}"

            try:
                response = client.post(import_url, json=payload, headers=headers)
                if response.status_code in (200, 201):
                    stored += 1
                else:
                    errors.append(f"Import failed for {payload['url']}: HTTP {response.status_code} {response.text[:300]}")
            except httpx.RequestError as exc:
                errors.append(f"Import request failed for {payload['url']}: {exc}")

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
    cards = soup.select("div.css-1gatmva, div[data-testid='job-card']")
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
        company = _clean_text((card.select_one("a.css-17s97q8, .css-17s97q8") or "").get_text(" ", strip=True) if card.select_one("a.css-17s97q8, .css-17s97q8") else "")
        location = _clean_text((card.select_one(".css-5wys0k, [class*='location']") or "").get_text(" ", strip=True) if card.select_one(".css-5wys0k, [class*='location']") else "Egypt")
        tags = [_clean_text(tag.get_text(" ", strip=True)) for tag in card.select(".css-5x9pm1, a[href*='/a/']")]
        snippet = _clean_text(card.get_text(" ", strip=True))

        if title:
            jobs.append({
                "title": title,
                "company": company or "Wuzzuf Employer",
                "location": location or "Egypt",
                "job_type": "full-time",
                "work_type": "onsite",
                "description": snippet or f"{title} role matching {query}.",
                "requirements": snippet,
                "skills": tags or _skills_from_text(title, snippet, query),
                "url": href,
                "source": "Wuzzuf Egypt",
            })

    return jobs


def _indeed_jobs(html: str, query: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("div.job_seen_beacon, div[data-testid='slider_item'], a[data-jk]")
    jobs: list[dict[str, Any]] = []

    for card in cards:
        title_node = card.select_one("h2 span[title], h2 span, a[data-jk] span")
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
            "company": _clean_text(company_node.get_text(" ", strip=True) if company_node else "Indeed Employer"),
            "location": _clean_text(location_node.get_text(" ", strip=True) if location_node else "Remote"),
            "job_type": "full-time",
            "work_type": "remote" if "remote" in snippet.lower() else "onsite",
            "description": snippet,
            "requirements": snippet,
            "skills": _skills_from_text(title, snippet, query),
            "url": href or f"https://www.indeed.com/jobs?q={quote_plus(query)}",
            "source": "Indeed",
        })

    return jobs


def _upwork_jobs(html: str, query: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("section[data-test='job-tile'], article[data-test='job-tile'], div[data-test='job-tile']")
    jobs: list[dict[str, Any]] = []

    for card in cards:
        title_node = card.select_one("a[data-test='job-tile-title-link'], h2, h3")
        title = _clean_text(title_node.get_text(" ", strip=True) if title_node else "")
        if not title:
            continue

        href = title_node.get("href", "") if title_node and title_node.has_attr("href") else ""
        if href.startswith("/"):
            href = f"https://www.upwork.com{href}"

        text = _clean_text(card.get_text(" ", strip=True))
        tags = [_clean_text(tag.get_text(" ", strip=True)) for tag in card.select("[data-test='token'], .air3-token")]

        jobs.append({
            "title": title,
            "company": "Upwork Client",
            "location": "Remote",
            "job_type": "freelance",
            "work_type": "remote",
            "description": text,
            "requirements": text,
            "skills": tags or _skills_from_text(title, text, query),
            "url": href or f"https://www.upwork.com/nx/search/jobs/?q={quote_plus(query)}",
            "source": "Upwork",
        })

    return jobs


def _run_demo_source(payload: ScrapeRequest, source: SourceConfig, callback_base: str, started: float) -> dict[str, object]:
    jobs = _demo_jobs(payload.query, payload.limit, source)
    stored, errors = _export_jobs(jobs, source, payload.query, callback_base)
    elapsed_ms = int((time.monotonic() - started) * 1000)
    success = stored > 0 and not errors

    return {
        "success": success,
        "classification": "SUCCESS" if success else "PARTIAL_SUCCESS" if stored > 0 else "EXTERNAL_FAILED",
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
        "failed_urls_count": len(errors),
        "elapsed_ms": elapsed_ms,
        "stdout": f"Generated {len(jobs)} deterministic demo jobs and stored {stored}.",
            "stderr": _sanitize_sensitive("\n".join(errors)),
            "error_summary": _sanitize_sensitive("; ".join(errors))[:500] if errors else None,
    }


def _run_api_source(payload: ScrapeRequest, source: SourceConfig, callback_base: str, started: float) -> dict[str, object]:
    endpoint = _apply_query_template(source.endpoint or "", payload.query)
    if not endpoint:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        return {
            "success": False,
            "classification": "CONFIG_INVALID",
            "query": payload.query,
            "source_id": source.id or payload.source_id,
            "source_name": source.name,
            "source_type": source.type,
            "adapter_name": _canonical_adapter(source),
            "endpoint_used": endpoint,
            "scraping_job_id": payload.scraping_job_id,
            "jobs_preview_count": 0,
            "jobs_stored": 0,
            "failed_urls_count": 0,
            "elapsed_ms": elapsed_ms,
            "stdout": "",
            "stderr": "API source endpoint is empty.",
            "error_summary": "API source endpoint is empty.",
        }

    method = (source.method or "GET").upper()
    try:
        with httpx.Client(timeout=min(int(os.getenv("SCRAPER_DEFAULT_TIMEOUT", "600")), 30)) as client:
            response = client.request(method, endpoint, headers=source.headers or {}, params=source.params or None)
        response.raise_for_status()
        jobs = _parse_api_jobs(response.json())
    except Exception as exc:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        return {
            "success": False,
            "classification": "EXTERNAL_FAILED",
            "query": payload.query,
            "source_id": source.id or payload.source_id,
            "source_name": source.name,
            "source_type": source.type,
            "adapter_name": _canonical_adapter(source),
            "endpoint_used": endpoint,
            "scraping_job_id": payload.scraping_job_id,
            "jobs_preview_count": 0,
            "jobs_stored": 0,
            "failed_urls_count": 1,
            "elapsed_ms": elapsed_ms,
            "stdout": "",
            "stderr": _sanitize_sensitive(exc),
            "error_summary": _sanitize_sensitive(exc)[:500],
        }

    jobs = jobs[:payload.limit]
    stored, errors = _export_jobs(jobs, source, payload.query, callback_base)
    elapsed_ms = int((time.monotonic() - started) * 1000)
    classification = "SUCCESS" if stored > 0 and not errors else "PARTIAL_SUCCESS" if stored > 0 else "EMPTY_SUCCESS" if not errors else "EXTERNAL_FAILED"

    return {
        "success": classification in ("SUCCESS", "PARTIAL_SUCCESS", "EMPTY_SUCCESS"),
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
        "failed_urls_count": len(errors),
        "elapsed_ms": elapsed_ms,
        "stdout": f"Fetched {len(jobs)} API job candidates and stored {stored}.",
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
    stored, errors = _export_jobs(jobs, source, payload.query, callback_base)
    classification = "SUCCESS" if stored > 0 and not errors else "PARTIAL_SUCCESS" if stored > 0 else "EMPTY_SUCCESS" if not errors else "EXTERNAL_FAILED"

    return _result(
        payload=payload,
        source=source,
        started=started,
        success=classification in ("SUCCESS", "PARTIAL_SUCCESS", "EMPTY_SUCCESS"),
        classification=classification,
        endpoint_used=endpoint,
        jobs_preview_count=len(jobs),
        jobs_stored=stored,
        failed_urls_count=len(errors),
        stdout=f"{parser} adapter fetched {len(jobs)} candidates and stored {stored}.",
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

    if parser == "wuzzuf":
        jobs = _wuzzuf_jobs(html, payload.query)
    elif parser == "indeed":
        jobs = _indeed_jobs(html, payload.query)
    elif parser == "upwork":
        jobs = _upwork_jobs(html, payload.query)
    else:
        jobs = []

    jobs = jobs[:payload.limit]
    stored, errors = _export_jobs(jobs, source, payload.query, callback_base)
    classification = "SUCCESS" if stored > 0 and not errors else "PARTIAL_SUCCESS" if stored > 0 else "EMPTY_SUCCESS" if not errors else "EXTERNAL_FAILED"

    return _result(
        payload=payload,
        source=source,
        started=started,
        success=classification in ("SUCCESS", "PARTIAL_SUCCESS", "EMPTY_SUCCESS"),
        classification=classification,
        endpoint_used=endpoint,
        jobs_preview_count=len(jobs),
        jobs_stored=stored,
        failed_urls_count=len(errors),
        stdout=f"{parser} adapter parsed {len(jobs)} visible job cards and stored {stored}.",
        stderr=_sanitize_sensitive("\n".join(errors)),
        error_summary=_sanitize_sensitive("; ".join(errors))[:500] if errors else None,
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
        "failed_urls_count": 0,
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
                "stdout": exc.stdout[-4000:] if exc.stdout else "",
                "stderr": exc.stderr[-4000:] if exc.stderr else "",
            },
        ) from exc

    elapsed_ms = int((time.monotonic() - started) * 1000)
    SCRAPE_DURATION_MS_TOTAL += elapsed_ms
    output = (result.stdout or "") + "\n" + (result.stderr or "")
    failed_urls_count = 1 if _failure_signals(output) else 0
    success = result.returncode == 0 and failed_urls_count == 0

    if not success:
        SCRAPE_FAILURES_TOTAL += 1

    classification = _classification(success, 0, failed_urls_count, output)

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
        "jobs_preview_count": 0,
        "jobs_stored": 0,
        "failed_urls_count": failed_urls_count,
        "error_summary": _extract_error_summary(output) if not success else None,
        "stdout": result.stdout[-8000:],
        "stderr": result.stderr[-8000:],
    }
