#!/usr/bin/env python3
"""Evaluate job matching labels against predictions.

This script measures only the supplied matching gold-label and prediction JSON
files. It does not run CareerCompass and does not claim accuracy beyond the
provided sample or dataset.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


FIT_LABELS = {"high": "High", "medium": "Medium", "low": "Low"}
FIT_ORDER = ["High", "Medium", "Low"]

SKILL_ALIASES = {
    "js": "javascript",
    "react.js": "react",
    "reactjs": "react",
    "rest apis": "rest api",
    "api": "api",
    "ci cd": "ci/cd",
    "cicd": "ci/cd",
}


class EvaluationInputError(Exception):
    """Raised when an evaluation input file has an invalid shape."""


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def normalize_skill(value: Any) -> str:
    skill = normalize_text(value).replace("-", " ")
    return SKILL_ALIASES.get(skill, skill)


def normalize_fit(value: Any) -> str:
    fit = normalize_text(value)
    if fit not in FIT_LABELS:
        raise EvaluationInputError(f"Invalid human_fit label: {value!r}. Use High, Medium, or Low.")
    return FIT_LABELS[fit]


def load_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise EvaluationInputError(f"Cannot read {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise EvaluationInputError(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise EvaluationInputError(f"{path} must contain a JSON object.")
    if not isinstance(data.get("items"), list):
        raise EvaluationInputError(f"{path} must contain an 'items' list.")
    return data


def index_items(data: dict[str, Any], key: str, source_name: str) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    for position, item in enumerate(data["items"], start=1):
        if not isinstance(item, dict):
            raise EvaluationInputError(f"{source_name} item {position} must be an object.")
        item_id = item.get(key)
        if not item_id:
            raise EvaluationInputError(f"{source_name} item {position} is missing '{key}'.")
        item_id = str(item_id)
        if item_id in indexed:
            raise EvaluationInputError(f"{source_name} contains duplicate {key}: {item_id}")
        indexed[item_id] = item
    return indexed


def normalized_skill_set(values: Any) -> set[str]:
    if values is None:
        return set()
    if not isinstance(values, list):
        raise EvaluationInputError("Skill fields must be lists.")
    return {normalize_skill(value) for value in values if normalize_skill(value)}


def average(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def safe_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise EvaluationInputError(f"Score must be numeric, got {value!r}.") from exc


def safe_rank(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        rank = float(value)
    except (TypeError, ValueError) as exc:
        raise EvaluationInputError(f"rank_position must be numeric, got {value!r}.") from exc
    if rank <= 0:
        raise EvaluationInputError(f"rank_position must be positive, got {value!r}.")
    return rank


def ordered_sanity(averages: dict[str, float | None], higher_is_better: bool) -> str:
    present = [(label, averages[label]) for label in FIT_ORDER if averages.get(label) is not None]
    if len(present) < 2:
        return "not_applicable"
    values = [value for _, value in present if value is not None]
    if higher_is_better:
        return "pass" if values == sorted(values, reverse=True) else "review"
    return "pass" if values == sorted(values) else "review"


def evaluate(gold_path: Path, pred_path: Path) -> dict[str, Any]:
    gold_data = load_json(gold_path)
    pred_data = load_json(pred_path)
    gold_items = index_items(gold_data, "case_id", "gold")
    pred_items = index_items(pred_data, "case_id", "predictions")

    counts_by_fit = {label: 0 for label in FIT_ORDER}
    scores_by_fit: dict[str, list[float]] = {label: [] for label in FIT_ORDER}
    ranks_by_fit: dict[str, list[float]] = {label: [] for label in FIT_ORDER}
    per_case: list[dict[str, Any]] = []
    missing_predictions = 0

    for case_id, gold in gold_items.items():
        human_fit = normalize_fit(gold.get("human_fit"))
        counts_by_fit[human_fit] += 1
        pred = pred_items.get(case_id)
        missing_prediction = pred is None
        if missing_prediction:
            missing_predictions += 1
            pred = {}

        score = safe_float(pred.get("score"))
        rank = safe_rank(pred.get("rank_position"))
        if score is not None:
            scores_by_fit[human_fit].append(score)
        if rank is not None:
            ranks_by_fit[human_fit].append(rank)

        expected_core = normalized_skill_set(gold.get("expected_core_skills", []))
        expected_missing = normalized_skill_set(gold.get("expected_missing_skills", []))
        matched_skills = normalized_skill_set(pred.get("matched_skills", []))
        missing_skills = normalized_skill_set(pred.get("missing_skills", []))

        core_overlap = sorted(expected_core & matched_skills)
        missing_overlap = sorted(expected_missing & missing_skills)
        core_recall = len(core_overlap) / len(expected_core) if expected_core else 1.0
        missing_recall = len(missing_overlap) / len(expected_missing) if expected_missing else 1.0

        per_case.append(
            {
                "case_id": case_id,
                "cv_id": gold.get("cv_id"),
                "job_id": gold.get("job_id"),
                "human_fit": human_fit,
                "missing_prediction": missing_prediction,
                "score": score,
                "rank_position": rank,
                "method": pred.get("method"),
                "expected_core_skills": sorted(expected_core),
                "expected_missing_skills": sorted(expected_missing),
                "matched_core_skills": core_overlap,
                "recalled_missing_skills": missing_overlap,
                "matched_core_skill_recall": core_recall,
                "missing_skill_recall": missing_recall,
            }
        )

    average_score_by_fit = {label: average(scores_by_fit[label]) for label in FIT_ORDER}
    average_rank_by_fit = {label: average(ranks_by_fit[label]) for label in FIT_ORDER}
    extra_prediction_ids = sorted(set(pred_items) - set(gold_items))

    return {
        "metadata": {
            "report_type": "matching_evaluation",
            "note": "Metrics are computed only from the provided matching labels and predictions. Sample files are not final benchmark results.",
        },
        "counts": {
            "gold_items": len(gold_items),
            "prediction_items": len(pred_items),
            "missing_predictions": missing_predictions,
            "extra_prediction_ids": extra_prediction_ids,
            "by_human_fit": counts_by_fit,
        },
        "overall": {
            "average_score_by_fit": average_score_by_fit,
            "average_rank_by_fit": average_rank_by_fit,
            "score_sanity": ordered_sanity(average_score_by_fit, higher_is_better=True),
            "rank_sanity": ordered_sanity(average_rank_by_fit, higher_is_better=False),
            "macro_matched_core_skill_recall": average([item["matched_core_skill_recall"] for item in per_case]) or 0.0,
            "macro_missing_skill_recall": average([item["missing_skill_recall"] for item in per_case]) or 0.0,
        },
        "per_case": per_case,
    }


def fmt(value: float | None) -> str:
    return "N/A" if value is None else f"{value:.2f}"


def pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def render_report(result: dict[str, Any]) -> str:
    counts = result["counts"]
    overall = result["overall"]
    lines = [
        "# Matching Evaluation Report",
        "",
        "> Metrics are computed only from the provided labels and predictions.",
        "> Sample/template files are not final benchmark results.",
        "",
        "## Inputs",
        "",
        f"- Gold cases: {counts['gold_items']}",
        f"- Prediction records: {counts['prediction_items']}",
        f"- Missing predictions: {counts['missing_predictions']}",
        f"- Extra prediction IDs: {', '.join(counts['extra_prediction_ids']) or 'None'}",
        "",
        "## Fit Category Summary",
        "",
        "| Human Fit | Count | Average Score | Average Rank |",
        "| --- | ---: | ---: | ---: |",
    ]
    for label in FIT_ORDER:
        lines.append(
            f"| {label} | {counts['by_human_fit'][label]} | "
            f"{fmt(overall['average_score_by_fit'][label])} | {fmt(overall['average_rank_by_fit'][label])} |"
        )
    lines.extend(
        [
            "",
            "## Sanity Checks",
            "",
            f"- Score sanity: {overall['score_sanity']}",
            f"- Rank sanity: {overall['rank_sanity']}",
            f"- Matched core skill recall: {pct(overall['macro_matched_core_skill_recall'])}",
            f"- Missing skill recall: {pct(overall['macro_missing_skill_recall'])}",
            "",
            "## Per-Case Summary",
            "",
            "| Case ID | Human Fit | Score | Rank | Matched Core Recall | Missing Skill Recall |",
            "| --- | --- | ---: | ---: | ---: | ---: |",
        ]
    )
    for item in result["per_case"]:
        lines.append(
            "| {case_id} | {fit} | {score} | {rank} | {core} | {missing} |".format(
                case_id=item["case_id"],
                fit=item["human_fit"],
                score=fmt(item["score"]),
                rank=fmt(item["rank_position"]),
                core=pct(item["matched_core_skill_recall"]),
                missing=pct(item["missing_skill_recall"]),
            )
        )
    return "\n".join(lines)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate matching labels against predictions.")
    parser.add_argument("--gold", required=True, type=Path, help="Path to matching gold label JSON.")
    parser.add_argument("--pred", required=True, type=Path, help="Path to matching prediction JSON.")
    parser.add_argument("--json-output", type=Path, help="Optional path for machine-readable metrics JSON.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    try:
        result = evaluate(args.gold, args.pred)
    except EvaluationInputError as exc:
        print(f"Invalid input: {exc}", file=sys.stderr)
        return 2

    print(render_report(result))
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
