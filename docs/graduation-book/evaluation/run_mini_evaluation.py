from __future__ import annotations

import json
import math
import re
from pathlib import Path
from statistics import mean


BASE_DIR = Path(__file__).resolve().parent
CV_PATH = BASE_DIR / "mini_cv_dataset.json"
JOBS_PATH = BASE_DIR / "mini_jobs_dataset.json"
LABELS_PATH = BASE_DIR / "expected_labels.json"
RESULTS_PATH = BASE_DIR / "mini_evaluation_results.json"
SUMMARY_PATH = BASE_DIR / "mini_evaluation_summary.md"


SKILL_ALIASES = {
    "REST API": ["rest api", "rest apis", "api modules", "api design", "apis"],
    "API integration": ["api integration", "integrate api", "api calls"],
    "API testing": ["api testing", "api tests"],
    "bug reporting": ["bug reporting", "reports bugs", "report bugs"],
    "test cases": ["test cases", "test case"],
    "data analysis": ["data analysis", "analyze datasets"],
    "scikit-learn": ["scikit-learn", "sklearn"],
    "testing": ["testing", "tests"],
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def skill_terms(skill: str) -> list[str]:
    return [skill.lower(), *SKILL_ALIASES.get(skill, [])]


def build_skill_vocab(cvs, jobs) -> list[str]:
    vocab = set()
    for cv in cvs:
        vocab.update(cv["expected_skills"])
    for job in jobs:
        vocab.update(job["required_skills"])
    return sorted(vocab, key=lambda item: item.lower())


def extract_skills(text: str, vocab: list[str]) -> list[str]:
    normalized = norm(text)
    found = []
    for skill in vocab:
        for term in skill_terms(skill):
            if re.search(rf"(^| )({re.escape(norm(term))})( |$)", normalized):
                found.append(skill)
                break
    return sorted(set(found), key=lambda item: item.lower())


def infer_role(skills: set[str], text: str) -> str:
    text_n = norm(text)
    if {"Laravel", "React"}.issubset(skills):
        return "Full Stack Developer"
    if "Laravel" in skills or "PHP" in skills:
        return "Backend Laravel Developer"
    if "React" in skills:
        return "Frontend React Developer"
    if "scikit-learn" in skills or "pandas" in skills or "NLP" in skills:
        return "Data and ML Student"
    if "pytest" in skills or "test cases" in skills or "qa" in text_n:
        return "QA Testing Engineer"
    return "Unknown"


def infer_seniority(text: str) -> str:
    text_n = norm(text)
    for value in ["intern", "junior", "student", "mid", "senior"]:
        if value in text_n:
            return value
    return "unknown"


def infer_domain(skills: set[str], text: str) -> str:
    if {"Laravel", "React"}.issubset(skills):
        return "full_stack_web"
    if "Laravel" in skills or "PHP" in skills:
        return "backend_web"
    if "React" in skills or "Vite" in skills:
        return "frontend_web"
    if "NLP" in skills or "pandas" in skills or "scikit-learn" in skills:
        return "data_ml"
    if "pytest" in skills or "API testing" in skills or "testing" in skills:
        return "quality_assurance"
    return "unknown"


def prf(expected: set[str], actual: set[str]) -> dict[str, float]:
    tp = len(expected & actual)
    precision = tp / len(actual) if actual else 0.0
    recall = tp / len(expected) if expected else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if precision + recall else 0.0
    return {"precision": precision, "recall": recall, "f1": f1}


def round_metric(value: float) -> float:
    return round(value, 3)


def score_cv_job(cv, job) -> float:
    cv_skills = set(cv["expected_skills"])
    job_skills = set(job["required_skills"])
    overlap = len(cv_skills & job_skills)
    skill_recall = overlap / len(job_skills) if job_skills else 0.0
    skill_precision = overlap / len(cv_skills) if cv_skills else 0.0
    domain_bonus = 0.15 if cv["domain"] == job["domain"] else 0.0
    seniority_bonus = 0.05 if cv["seniority"] == job["seniority"] else 0.0
    return min(1.0, (0.55 * skill_recall) + (0.25 * skill_precision) + domain_bonus + seniority_bonus)


def evaluate():
    cvs = load_json(CV_PATH)
    jobs = load_json(JOBS_PATH)
    labels = load_json(LABELS_PATH)
    vocab = build_skill_vocab(cvs, jobs)

    cv_results = []
    for cv in cvs:
        actual_skills = set(extract_skills(cv["cv_text"], vocab))
        expected_skills = set(cv["expected_skills"])
        metrics = prf(expected_skills, actual_skills)
        role = infer_role(actual_skills, cv["cv_text"])
        seniority = infer_seniority(cv["cv_text"])
        domain = infer_domain(actual_skills, cv["cv_text"])
        cv_results.append(
            {
                "sample_id": cv["sample_id"],
                "expected_skills": sorted(expected_skills),
                "extracted_skills_offline": sorted(actual_skills),
                "skill_precision": round_metric(metrics["precision"]),
                "skill_recall": round_metric(metrics["recall"]),
                "skill_f1": round_metric(metrics["f1"]),
                "expected_role": cv["expected_role"],
                "predicted_role_offline": role,
                "role_match": role == cv["expected_role"],
                "expected_seniority": cv["expected_seniority"],
                "predicted_seniority_offline": seniority,
                "seniority_match": seniority == cv["expected_seniority"],
                "expected_domain": cv["expected_domain"],
                "predicted_domain_offline": domain,
                "domain_match": domain == cv["expected_domain"],
            }
        )

    recommendation_results = []
    top1_hits = 0
    top3_hits = 0
    precision_at_3_values = []
    for cv in cvs:
        ranked = sorted(
            [
                {
                    "job_id": job["job_id"],
                    "title": job["title"],
                    "score": round_metric(score_cv_job(cv, job)),
                }
                for job in jobs
            ],
            key=lambda item: item["score"],
            reverse=True,
        )
        expected_relevant = labels["recommendation_labels"][cv["sample_id"]]
        top1 = [item["job_id"] for item in ranked[:1]]
        top3 = [item["job_id"] for item in ranked[:3]]
        top1_hit = any(job_id in expected_relevant for job_id in top1)
        top3_hit = any(job_id in expected_relevant for job_id in top3)
        precision_at_3 = len(set(top3) & set(expected_relevant)) / 3
        top1_hits += int(top1_hit)
        top3_hits += int(top3_hit)
        precision_at_3_values.append(precision_at_3)
        recommendation_results.append(
            {
                "sample_id": cv["sample_id"],
                "expected_relevant_job_ids": expected_relevant,
                "top_3_recommended_job_ids": top3,
                "top_1_hit": top1_hit,
                "top_3_hit": top3_hit,
                "precision_at_3": round_metric(precision_at_3),
                "ranked_jobs": ranked,
            }
        )

    gap_results = []
    matched_agreements = []
    missing_agreements = []
    job_by_id = {job["job_id"]: job for job in jobs}
    cv_by_id = {cv["sample_id"]: cv for cv in cvs}
    for pair in labels["gap_pairs"]:
        cv = cv_by_id[pair["cv_sample_id"]]
        job = job_by_id[pair["job_id"]]
        actual_matched = set(cv["expected_skills"]) & set(job["required_skills"])
        actual_missing = set(job["required_skills"]) - set(cv["expected_skills"])
        expected_matched = set(pair["expected_matched_skills"])
        expected_missing = set(pair["expected_missing_skills"])
        matched_f1 = prf(expected_matched, actual_matched)["f1"]
        missing_f1 = prf(expected_missing, actual_missing)["f1"] if expected_missing or actual_missing else 1.0
        matched_agreements.append(matched_f1)
        missing_agreements.append(missing_f1)
        gap_results.append(
            {
                "cv_sample_id": cv["sample_id"],
                "job_id": job["job_id"],
                "expected_matched_skills": sorted(expected_matched),
                "computed_matched_skills": sorted(actual_matched),
                "expected_missing_skills": sorted(expected_missing),
                "computed_missing_skills": sorted(actual_missing),
                "matched_skill_agreement_f1": round_metric(matched_f1),
                "missing_skill_agreement_f1": round_metric(missing_f1),
            }
        )

    summary = {
        "evaluation_mode": "offline_synthetic_keyword_and_overlap_evaluation",
        "statistical_scope": "preliminary synthetic demo dataset; not production benchmarking",
        "cv_samples": len(cvs),
        "job_samples": len(jobs),
        "cv_analyzer_offline": {
            "macro_skill_precision": round_metric(mean(item["skill_precision"] for item in cv_results)),
            "macro_skill_recall": round_metric(mean(item["skill_recall"] for item in cv_results)),
            "macro_skill_f1": round_metric(mean(item["skill_f1"] for item in cv_results)),
            "role_match_rate": round_metric(mean(1.0 if item["role_match"] else 0.0 for item in cv_results)),
            "seniority_match_rate": round_metric(mean(1.0 if item["seniority_match"] else 0.0 for item in cv_results)),
            "domain_match_rate": round_metric(mean(1.0 if item["domain_match"] else 0.0 for item in cv_results)),
        },
        "recommendation_offline": {
            "top_1_relevance": round_metric(top1_hits / len(cvs)),
            "top_3_relevance": round_metric(top3_hits / len(cvs)),
            "mean_precision_at_3": round_metric(mean(precision_at_3_values)),
        },
        "gap_analysis_offline": {
            "mean_matched_skill_agreement_f1": round_metric(mean(matched_agreements)),
            "mean_missing_skill_agreement_f1": round_metric(mean(missing_agreements)),
        },
    }

    results = {
        "summary": summary,
        "cv_analyzer_results": cv_results,
        "recommendation_results": recommendation_results,
        "gap_analysis_results": gap_results,
    }
    RESULTS_PATH.write_text(json.dumps(results, indent=2), encoding="utf-8")
    write_summary(results)
    return results


def write_summary(results: dict) -> None:
    summary = results["summary"]
    cv = summary["cv_analyzer_offline"]
    rec = summary["recommendation_offline"]
    gap = summary["gap_analysis_offline"]
    lines = [
        "# Mini Evaluation Summary",
        "",
        "This evaluation uses synthetic demo data created for the graduation book. It is an offline keyword and skill-overlap evaluation, not a production benchmark and not a live AI service accuracy claim.",
        "",
        "## Dataset",
        "",
        f"- CV samples: {summary['cv_samples']}",
        f"- Job samples: {summary['job_samples']}",
        "",
        "## Summary Metrics",
        "",
        "| Area | Metric | Value |",
        "|---|---|---:|",
        f"| CV Analyzer offline | Macro skill precision | {cv['macro_skill_precision']:.3f} |",
        f"| CV Analyzer offline | Macro skill recall | {cv['macro_skill_recall']:.3f} |",
        f"| CV Analyzer offline | Macro skill F1 | {cv['macro_skill_f1']:.3f} |",
        f"| CV Analyzer offline | Role match rate | {cv['role_match_rate']:.3f} |",
        f"| CV Analyzer offline | Seniority match rate | {cv['seniority_match_rate']:.3f} |",
        f"| CV Analyzer offline | Domain match rate | {cv['domain_match_rate']:.3f} |",
        f"| Recommendation offline | Top-1 relevance | {rec['top_1_relevance']:.3f} |",
        f"| Recommendation offline | Top-3 relevance | {rec['top_3_relevance']:.3f} |",
        f"| Recommendation offline | Mean precision@3 | {rec['mean_precision_at_3']:.3f} |",
        f"| Gap analysis offline | Matched skill agreement F1 | {gap['mean_matched_skill_agreement_f1']:.3f} |",
        f"| Gap analysis offline | Missing skill agreement F1 | {gap['mean_missing_skill_agreement_f1']:.3f} |",
        "",
        "## Limitations",
        "",
        "- Synthetic CVs and jobs are intentionally small and fake.",
        "- Metrics are computed from deterministic keyword and overlap logic.",
        "- Results are useful for graduation validation and regression checks, not for production model claims.",
        "- Live AI CV Analyzer endpoint evaluation can be added later if the service test dependencies and runtime are standardized.",
        "",
    ]
    SUMMARY_PATH.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    output = evaluate()
    print(json.dumps(output["summary"], indent=2))
