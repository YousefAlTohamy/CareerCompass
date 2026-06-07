from __future__ import annotations

import importlib.util
import json
import re
import sys
from pathlib import Path
from statistics import mean
from typing import Any


BASE_DIR = Path(__file__).resolve().parent
ROOT = BASE_DIR.parents[2]
AI_DIR = ROOT / "ai-cv-analyzer"
SAMPLES_PATH = BASE_DIR / "ai_cv_analyzer_smoke_samples.json"
RESULTS_PATH = BASE_DIR / "ai_cv_analyzer_smoke_results.json"
SUMMARY_PATH = BASE_DIR / "ai_cv_analyzer_smoke_summary.md"


SKILL_ALIASES = {
    "PHP": ["php"],
    "Laravel": ["laravel"],
    "MySQL": ["mysql", "my sql"],
    "REST APIs": ["rest api", "rest apis", "api"],
    "Docker": ["docker"],
    "Git": ["git"],
    "Python": ["python"],
    "pandas": ["pandas"],
    "SQL": ["sql"],
    "Power BI": ["power bi", "powerbi"],
    "scikit-learn": ["scikit-learn", "sklearn"],
    "React": ["react", "react.js", "reactjs"],
    "JavaScript": ["javascript", "java script", "js"],
    "HTML": ["html"],
    "CSS": ["css"],
    "Vite": ["vite"],
    "API integration": ["api integration"],
    "Kubernetes": ["kubernetes", "k8s"],
    "AWS": ["aws", "amazon web services"],
    "Terraform": ["terraform"],
    "Linux": ["linux"],
    "CI/CD": ["ci/cd", "cicd", "ci cd"],
}


ROLE_RULES = [
    ("DevOps Engineer", ["devops engineer", "cloud engineer", "site reliability"]),
    ("Data Analyst", ["data analyst", "analytics intern", "data intern"]),
    ("Frontend Developer", ["frontend developer", "front-end developer", "react developer"]),
    ("Backend Developer", ["backend developer", "back-end developer", "laravel developer"]),
]


DOMAIN_RULES = [
    ("DevOps and Cloud", ["docker", "kubernetes", "terraform", "aws", "ci/cd", "linux"]),
    ("Data Analytics", ["data analyst", "pandas", "power bi", "scikit-learn", "notebooks"]),
    ("Frontend Development", ["frontend", "react", "javascript", "html", "css", "vite"]),
    ("Backend Development", ["backend", "laravel", "php", "mysql", "rest api"]),
]


def load_samples() -> list[dict[str, Any]]:
    return json.loads(SAMPLES_PATH.read_text(encoding="utf-8"))


def normalize_set(values: list[str]) -> set[str]:
    return {value.strip().lower() for value in values if value and value.strip()}


def contains_alias(text: str, aliases: list[str]) -> bool:
    text_l = text.lower()
    return any(re.search(rf"(?<![a-z0-9]){re.escape(alias.lower())}(?![a-z0-9])", text_l) for alias in aliases)


def extract_skills(text: str) -> list[str]:
    return [skill for skill, aliases in SKILL_ALIASES.items() if contains_alias(text, aliases)]


def infer_role(text: str) -> str | None:
    text_l = text.lower()
    for role, aliases in ROLE_RULES:
        if any(alias in text_l for alias in aliases):
            return role
    return None


def infer_domain(text: str, skills: list[str]) -> str | None:
    combined = f"{text.lower()} {' '.join(skills).lower()}"
    scores = []
    for domain, markers in DOMAIN_RULES:
        scores.append((sum(1 for marker in markers if marker in combined), domain))
    best_score, best_domain = max(scores)
    return best_domain if best_score > 0 else None


def infer_seniority(text: str) -> str | None:
    text_l = text.lower()
    if "intern" in text_l or "internship" in text_l:
        return "intern"
    if "junior" in text_l:
        return "junior"
    if "senior" in text_l:
        return "senior"
    years_match = re.search(r"(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)", text_l)
    if years_match:
        years = float(years_match.group(1))
        if years < 1:
            return "intern"
        if years < 2:
            return "junior"
        if years < 5:
            return "mid"
        if years < 8:
            return "senior"
        return "lead"
    if infer_role(text):
        return "junior"
    return None


def infer_parsing_status(text: str, skills: list[str], role: str | None) -> str:
    if len(text.split()) < 12 and not skills and not role:
        return "low_information"
    return "success"


def prf(expected: set[str], actual: set[str]) -> dict[str, float]:
    if not expected and not actual:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0}
    tp = len(expected & actual)
    precision = tp / len(actual) if actual else 0.0
    recall = tp / len(expected) if expected else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if precision + recall else 0.0
    return {"precision": precision, "recall": recall, "f1": f1}


def dependency_probe() -> dict[str, Any]:
    package_names = ["pdfplumber", "transformers", "torch", "sentence_transformers", "easyocr", "pydantic"]
    package_status = {name: importlib.util.find_spec(name) is not None for name in package_names}
    analyzer_import = {"ok": False, "error": None}
    sys.path.insert(0, str(AI_DIR))
    try:
        import core.layer1_understanding.orchestrator  # noqa: F401

        analyzer_import["ok"] = True
    except Exception as exc:
        analyzer_import["error"] = f"{exc.__class__.__name__}: {exc}"

    tfidf_probe = {"ok": False, "score": None, "error": None}
    try:
        from core.layer3_matching.tfidf import match_score

        tfidf_probe["score"] = round(float(match_score("Laravel Docker MySQL REST APIs", "Backend Laravel Docker MySQL")), 4)
        tfidf_probe["ok"] = True
    except Exception as exc:
        tfidf_probe["error"] = f"{exc.__class__.__name__}: {exc}"

    return {
        "packages_available": package_status,
        "full_analyzer_import": analyzer_import,
        "tfidf_probe": tfidf_probe,
    }


def evaluate() -> dict[str, Any]:
    samples = load_samples()
    rows = []
    skill_metrics = []
    role_hits = []
    domain_hits = []
    seniority_hits = []
    status_hits = []

    for sample in samples:
        expected = sample["expected"]
        actual_skills = extract_skills(sample["cv_text"])
        actual_role = infer_role(sample["cv_text"])
        actual_domain = infer_domain(sample["cv_text"], actual_skills)
        actual_seniority = infer_seniority(sample["cv_text"])
        actual_status = infer_parsing_status(sample["cv_text"], actual_skills, actual_role)

        metrics = prf(normalize_set(expected["skills"]), normalize_set(actual_skills))
        skill_metrics.append(metrics)

        role_match = expected["role"] == actual_role
        domain_match = expected["domain"] == actual_domain
        seniority_match = expected["seniority"] == actual_seniority
        status_match = expected["parsing_status"] == actual_status

        role_hits.append(1.0 if role_match else 0.0)
        domain_hits.append(1.0 if domain_match else 0.0)
        seniority_hits.append(1.0 if seniority_match else 0.0)
        status_hits.append(1.0 if status_match else 0.0)

        rows.append(
            {
                "sample_id": sample["sample_id"],
                "expected_skills": expected["skills"],
                "actual_skills": actual_skills,
                "skill_precision": round(metrics["precision"], 3),
                "skill_recall": round(metrics["recall"], 3),
                "skill_f1": round(metrics["f1"], 3),
                "expected_role": expected["role"],
                "actual_role": actual_role,
                "role_match": role_match,
                "expected_domain": expected["domain"],
                "actual_domain": actual_domain,
                "domain_match": domain_match,
                "expected_seniority": expected["seniority"],
                "actual_seniority": actual_seniority,
                "seniority_match": seniority_match,
                "expected_parsing_status": expected["parsing_status"],
                "actual_parsing_status": actual_status,
                "parsing_status_match": status_match,
            }
        )

    result = {
        "evaluation_mode": "deterministic_text_smoke_evaluation",
        "statistical_scope": "5 manually labeled smoke samples; not a full NER or production benchmark",
        "runtime_boundary": "Full analyzer import is probed, but the measured metrics use deterministic text rules because model/PDF dependencies may be unavailable.",
        "sample_count": len(samples),
        "dependency_probe": dependency_probe(),
        "summary": {
            "macro_skill_precision": round(mean(item["precision"] for item in skill_metrics), 3),
            "macro_skill_recall": round(mean(item["recall"] for item in skill_metrics), 3),
            "macro_skill_f1": round(mean(item["f1"] for item in skill_metrics), 3),
            "role_match_rate": round(mean(role_hits), 3),
            "domain_match_rate": round(mean(domain_hits), 3),
            "seniority_match_rate": round(mean(seniority_hits), 3),
            "parsing_status_match_rate": round(mean(status_hits), 3),
        },
        "sample_results": rows,
    }
    RESULTS_PATH.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    SUMMARY_PATH.write_text(summary_markdown(result), encoding="utf-8")
    return result


def summary_markdown(result: dict[str, Any]) -> str:
    summary = result["summary"]
    deps = result["dependency_probe"]
    lines = [
        "# AI CV Analyzer Smoke Evaluation Summary",
        "",
        "This is a small deterministic smoke evaluation for the graduation book. It is not a full NER benchmark and it does not evaluate the transformer model weights.",
        "",
        "## Runtime Boundary",
        "",
        f"- Full analyzer import: {'available' if deps['full_analyzer_import']['ok'] else 'unavailable'}",
        f"- Full analyzer import error: `{deps['full_analyzer_import']['error'] or 'none'}`",
        f"- TF-IDF probe: {'available' if deps['tfidf_probe']['ok'] else 'unavailable'}; score={deps['tfidf_probe']['score']}",
        "",
        "## Summary Metrics",
        "",
        "| Metric | Value |",
        "|---|---:|",
        f"| Macro skill precision | {summary['macro_skill_precision']:.3f} |",
        f"| Macro skill recall | {summary['macro_skill_recall']:.3f} |",
        f"| Macro skill F1 | {summary['macro_skill_f1']:.3f} |",
        f"| Role match rate | {summary['role_match_rate']:.3f} |",
        f"| Domain match rate | {summary['domain_match_rate']:.3f} |",
        f"| Seniority match rate | {summary['seniority_match_rate']:.3f} |",
        f"| Parsing status match rate | {summary['parsing_status_match_rate']:.3f} |",
        "",
        "## Per-Sample Results",
        "",
        "| Sample | Skills F1 | Role | Domain | Seniority | Status |",
        "|---|---:|---|---|---|---|",
    ]
    for item in result["sample_results"]:
        lines.append(
            "| {sample_id} | {skill_f1:.3f} | {role} | {domain} | {seniority} | {status} |".format(
                sample_id=item["sample_id"],
                skill_f1=item["skill_f1"],
                role="pass" if item["role_match"] else "check",
                domain="pass" if item["domain_match"] else "check",
                seniority="pass" if item["seniority_match"] else "check",
                status="pass" if item["parsing_status_match"] else "check",
            )
        )
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "The smoke samples are useful for proving that the documentation evaluator and schema examples are reproducible. They should not be cited as final model accuracy.",
            "",
        ]
    )
    return "\n".join(lines)


if __name__ == "__main__":
    print(json.dumps(evaluate()["summary"], indent=2))
