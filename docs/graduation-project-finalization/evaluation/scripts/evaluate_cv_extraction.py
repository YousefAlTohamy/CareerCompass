#!/usr/bin/env python3
"""Evaluate CV extraction labels against predictions.

This script measures only the provided gold-label and prediction JSON files. It
does not run the CareerCompass AI service and does not claim any benchmark
result beyond the input files supplied to this command.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


SKILL_ALIASES = {
    "js": "javascript",
    "react.js": "react",
    "reactjs": "react",
    "rest apis": "rest api",
    "api": "api",
}

ROLE_GROUPS = [
    {
        "frontend developer",
        "front end developer",
        "react developer",
        "javascript developer",
        "ui developer",
    },
    {
        "backend developer",
        "back end developer",
        "laravel developer",
        "php developer",
        "python developer",
        "django developer",
        "node developer",
        "node.js developer",
    },
    {
        "full stack developer",
        "fullstack developer",
        "full-stack developer",
    },
    {
        "data analyst",
        "business intelligence analyst",
        "bi analyst",
    },
    {
        "ai/ml engineer",
        "ai engineer",
        "ml engineer",
        "machine learning engineer",
        "data scientist",
    },
    {
        "devops engineer",
        "devops developer",
        "cloud engineer",
        "site reliability engineer",
        "sre",
    },
]


class EvaluationInputError(Exception):
    """Raised when an evaluation input file has an invalid shape."""


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def normalize_skill(value: Any) -> str:
    skill = normalize_text(value)
    return SKILL_ALIASES.get(skill, skill)


def normalize_role(value: Any) -> str:
    role = normalize_text(value)
    role = role.replace("full-stack", "full stack")
    role = role.replace("fullstack", "full stack")
    role = role.replace("front-end", "front end")
    role = role.replace("back-end", "back end")
    role = role.replace("ai ml", "ai/ml")
    return re.sub(r"\s+", " ", role)


def normalize_status(value: Any) -> str:
    return normalize_text(value)


def role_is_compatible(expected: str, predicted: str) -> bool:
    expected_norm = normalize_role(expected)
    predicted_norm = normalize_role(predicted)
    if expected_norm == predicted_norm and expected_norm:
        return True
    for group in ROLE_GROUPS:
        normalized_group = {normalize_role(item) for item in group}
        if expected_norm in normalized_group and predicted_norm in normalized_group:
            return True
    return False


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


def skill_metrics(gold: set[str], pred: set[str]) -> dict[str, Any]:
    true_positives = sorted(gold & pred)
    false_positives = sorted(pred - gold)
    false_negatives = sorted(gold - pred)
    tp = len(true_positives)
    fp = len(false_positives)
    fn = len(false_negatives)
    precision = tp / (tp + fp) if (tp + fp) else (1.0 if not gold else 0.0)
    recall = tp / (tp + fn) if (tp + fn) else 1.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return {
        "true_positives": true_positives,
        "false_positives": false_positives,
        "false_negatives": false_negatives,
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def average(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def evaluate(gold_path: Path, pred_path: Path) -> dict[str, Any]:
    gold_data = load_json(gold_path)
    pred_data = load_json(pred_path)
    gold_items = index_items(gold_data, "cv_id", "gold")
    pred_items = index_items(pred_data, "cv_id", "predictions")

    per_cv: list[dict[str, Any]] = []
    total_tp = total_fp = total_fn = 0
    role_exact = role_compatible = status_correct = 0
    missing_predictions = 0

    for cv_id, gold in gold_items.items():
        pred = pred_items.get(cv_id)
        missing_prediction = pred is None
        if missing_prediction:
            missing_predictions += 1
            pred = {}

        gold_skills = normalized_skill_set(gold.get("skills", []))
        pred_skills = normalized_skill_set(pred.get("skills", []))
        metrics = skill_metrics(gold_skills, pred_skills)
        total_tp += metrics["tp"]
        total_fp += metrics["fp"]
        total_fn += metrics["fn"]

        expected_role = str(gold.get("expected_role", ""))
        predicted_role = str(pred.get("predicted_role", ""))
        role_exact_ok = normalize_role(expected_role) == normalize_role(predicted_role) and bool(expected_role)
        role_compatible_ok = role_is_compatible(expected_role, predicted_role)
        role_exact += int(role_exact_ok)
        role_compatible += int(role_compatible_ok)

        expected_status = normalize_status(gold.get("expected_status", ""))
        predicted_status = normalize_status(
            pred.get("parsing_status", pred.get("predicted_status", pred.get("status", "")))
        )
        status_ok = expected_status == predicted_status and bool(expected_status)
        status_correct += int(status_ok)

        per_cv.append(
            {
                "cv_id": cv_id,
                "missing_prediction": missing_prediction,
                "expected_role": expected_role,
                "predicted_role": predicted_role,
                "role_exact": role_exact_ok,
                "role_compatible": role_compatible_ok,
                "expected_status": expected_status,
                "predicted_status": predicted_status,
                "status_correct": status_ok,
                **metrics,
            }
        )

    micro_precision = total_tp / (total_tp + total_fp) if (total_tp + total_fp) else 0.0
    micro_recall = total_tp / (total_tp + total_fn) if (total_tp + total_fn) else 0.0
    micro_f1 = (
        2 * micro_precision * micro_recall / (micro_precision + micro_recall)
        if (micro_precision + micro_recall)
        else 0.0
    )
    total = len(gold_items)
    extra_prediction_ids = sorted(set(pred_items) - set(gold_items))

    return {
        "metadata": {
            "report_type": "cv_extraction_evaluation",
            "note": "Metrics are computed only from the provided labels and predictions. Sample files are not final benchmark results.",
        },
        "counts": {
            "gold_items": total,
            "prediction_items": len(pred_items),
            "missing_predictions": missing_predictions,
            "extra_prediction_ids": extra_prediction_ids,
        },
        "overall": {
            "micro_precision": micro_precision,
            "micro_recall": micro_recall,
            "micro_f1": micro_f1,
            "macro_precision": average([item["precision"] for item in per_cv]),
            "macro_recall": average([item["recall"] for item in per_cv]),
            "macro_f1": average([item["f1"] for item in per_cv]),
            "role_exact_accuracy": role_exact / total if total else 0.0,
            "role_compatible_accuracy": role_compatible / total if total else 0.0,
            "parsing_status_accuracy": status_correct / total if total else 0.0,
            "skill_totals": {"tp": total_tp, "fp": total_fp, "fn": total_fn},
        },
        "per_cv": per_cv,
    }


def pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def render_report(result: dict[str, Any]) -> str:
    overall = result["overall"]
    counts = result["counts"]
    lines = [
        "# CV Extraction Evaluation Report",
        "",
        "> Metrics are computed only from the provided labels and predictions.",
        "> Sample/template files are not final benchmark results.",
        "",
        "## Inputs",
        "",
        f"- Gold CVs: {counts['gold_items']}",
        f"- Prediction records: {counts['prediction_items']}",
        f"- Missing predictions: {counts['missing_predictions']}",
        f"- Extra prediction IDs: {', '.join(counts['extra_prediction_ids']) or 'None'}",
        "",
        "## Overall Metrics",
        "",
        f"- Micro precision: {pct(overall['micro_precision'])}",
        f"- Micro recall: {pct(overall['micro_recall'])}",
        f"- Micro F1: {pct(overall['micro_f1'])}",
        f"- Macro precision: {pct(overall['macro_precision'])}",
        f"- Macro recall: {pct(overall['macro_recall'])}",
        f"- Macro F1: {pct(overall['macro_f1'])}",
        f"- Role exact accuracy: {pct(overall['role_exact_accuracy'])}",
        f"- Role compatible accuracy: {pct(overall['role_compatible_accuracy'])}",
        f"- Parsing status accuracy: {pct(overall['parsing_status_accuracy'])}",
        "",
        "## Per-CV Summary",
        "",
        "| CV ID | TP | FP | FN | Precision | Recall | F1 | Role Compatible | Status Correct |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ]
    for item in result["per_cv"]:
        lines.append(
            "| {cv_id} | {tp} | {fp} | {fn} | {precision} | {recall} | {f1} | {role} | {status} |".format(
                cv_id=item["cv_id"],
                tp=item["tp"],
                fp=item["fp"],
                fn=item["fn"],
                precision=pct(item["precision"]),
                recall=pct(item["recall"]),
                f1=pct(item["f1"]),
                role="yes" if item["role_compatible"] else "no",
                status="yes" if item["status_correct"] else "no",
            )
        )
    return "\n".join(lines)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate CV extraction labels against predictions.")
    parser.add_argument("--gold", required=True, type=Path, help="Path to gold label JSON.")
    parser.add_argument("--pred", required=True, type=Path, help="Path to prediction JSON.")
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
