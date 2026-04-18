from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime
from typing import Any

from core.firebase import db


def _coerce_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        except ValueError:
            return None
    if hasattr(value, "to_datetime"):
        try:
            parsed = value.to_datetime()
            return parsed.replace(tzinfo=None) if getattr(parsed, "tzinfo", None) else parsed
        except Exception:
            return None
    return None


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _as_float(value: Any, fallback: float = 0.0) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _week_key(value: datetime | None) -> str:
    if not value:
        return ""
    year, week, _ = value.isocalendar()
    return f"{year:04d}-W{week:02d}"


def _history_points(zone_doc: dict[str, Any]) -> list[tuple[datetime | None, float]]:
    raw_history = zone_doc.get("scoreHistory") if isinstance(zone_doc.get("scoreHistory"), list) else []
    points: list[tuple[datetime | None, float]] = []
    for entry in raw_history:
        if not isinstance(entry, dict):
            continue
        dt = _coerce_datetime(entry.get("timestamp") or entry.get("updatedAt") or entry.get("createdAt"))
        score = _as_float(entry.get("score", entry.get("actual", 0.0)), 0.0)
        points.append((dt, score))
    if not points:
        points.append((_coerce_datetime(zone_doc.get("updatedAt")), _as_float(zone_doc.get("currentScore"), 0.0)))
    return points


def _actual_score_for_week(zone_doc: dict[str, Any], week_start: datetime) -> float | None:
    target_key = _week_key(week_start)
    candidates = _history_points(zone_doc)
    for dt, score in candidates:
        if _week_key(dt) == target_key:
            return score

    nearest_score = None
    nearest_distance = None
    for dt, score in candidates:
        if not dt:
            continue
        distance = abs((dt - week_start).days)
        if nearest_distance is None or distance < nearest_distance:
            nearest_distance = distance
            nearest_score = score

    if nearest_distance is not None and nearest_distance <= 7:
        return nearest_score
    return None


def _compute_error_metrics(errors: list[float]) -> tuple[float, float]:
    if not errors:
        return 0.0, 0.0
    mae = sum(errors) / len(errors)
    rmse = math.sqrt(sum(err * err for err in errors) / len(errors))
    return round(mae, 2), round(rmse, 2)


def compute_backtesting_dashboard(ngo_id: str, window_weeks: int = 12) -> dict[str, Any]:
    runs = [
        {"id": doc.id, **(doc.to_dict() or {})}
        for doc in db.collection("forecastRuns").where("ngoId", "==", ngo_id).stream()
    ]
    runs.sort(key=lambda item: _coerce_datetime(item.get("generatedAt")) or datetime.min, reverse=True)
    runs = runs[: max(24, window_weeks * 2)]

    zones = {
        doc.id: (doc.to_dict() or {})
        for doc in db.collection("zones").where("ngoIds", "array_contains", ngo_id).stream()
    }

    errors: list[float] = []
    per_zone_metrics: dict[str, dict[str, Any]] = defaultdict(lambda: {"errors": [], "within5": 0, "samples": 0, "zone": ""})
    monthly_metrics: dict[str, dict[str, Any]] = defaultdict(lambda: {"errors": [], "within5": 0, "count": 0})

    directional_total = 0
    directional_hits = 0

    for run in runs:
        generated_at = _coerce_datetime(run.get("generatedAt"))
        month_label = generated_at.strftime("%b %y") if generated_at else "Unknown"
        zone_runs = run.get("zones") if isinstance(run.get("zones"), list) else []

        for zone_run in zone_runs:
            if not isinstance(zone_run, dict):
                continue
            zone_id = str(zone_run.get("zoneId") or "").strip()
            if not zone_id:
                continue

            zone_doc = zones.get(zone_id)
            if not zone_doc:
                continue

            zone_name = str(zone_run.get("zone") or zone_doc.get("name") or zone_id)
            current_score_at_run = _as_float(zone_run.get("currentScore"), _as_float(zone_doc.get("currentScore"), 0.0))
            predictions = zone_run.get("predictions") if isinstance(zone_run.get("predictions"), list) else []

            for prediction in predictions:
                if not isinstance(prediction, dict):
                    continue
                target_week = _coerce_datetime(prediction.get("targetWeekStart"))
                predicted_score = _as_float(prediction.get("score"), 0.0)
                if not target_week:
                    continue

                actual_score = _actual_score_for_week(zone_doc, target_week)
                if actual_score is None:
                    continue

                error = abs(predicted_score - actual_score)
                within5 = error <= 5.0

                errors.append(error)
                monthly_metrics[month_label]["errors"].append(error)
                monthly_metrics[month_label]["count"] += 1
                if within5:
                    monthly_metrics[month_label]["within5"] += 1

                zone_stats = per_zone_metrics[zone_id]
                zone_stats["zone"] = zone_name
                zone_stats["errors"].append(error)
                zone_stats["samples"] += 1
                if within5:
                    zone_stats["within5"] += 1

                directional_total += 1
                predicted_direction = 1 if predicted_score > current_score_at_run else -1 if predicted_score < current_score_at_run else 0
                actual_direction = 1 if actual_score > current_score_at_run else -1 if actual_score < current_score_at_run else 0
                if predicted_direction == actual_direction:
                    directional_hits += 1

    mae, rmse = _compute_error_metrics(errors)
    total_evaluated = len(errors)
    within5 = len([err for err in errors if err <= 5.0])
    accuracy = round((within5 / total_evaluated) * 100, 2) if total_evaluated else 0.0
    directional_accuracy = round((directional_hits / directional_total) * 100, 2) if directional_total else 0.0

    series = []
    month_items = sorted(monthly_metrics.items(), key=lambda item: item[0])[-6:]
    for label, metrics in month_items:
        month_errors = metrics["errors"]
        month_mae = round(sum(month_errors) / len(month_errors), 2) if month_errors else 0.0
        month_accuracy = round((metrics["within5"] / metrics["count"]) * 100, 2) if metrics["count"] else 0.0
        series.append({"label": label, "accuracy": month_accuracy, "mae": month_mae})

    zone_leaderboard = []
    for zone_id, metrics in per_zone_metrics.items():
        samples = int(metrics["samples"])
        if samples == 0:
            continue
        zone_errors = metrics["errors"]
        zone_mae = round(sum(zone_errors) / len(zone_errors), 2)
        zone_accuracy = round((int(metrics["within5"]) / samples) * 100, 2)
        zone_leaderboard.append(
            {
                "zoneId": zone_id,
                "zone": metrics["zone"],
                "mae": zone_mae,
                "accuracy": zone_accuracy,
                "samples": samples,
            }
        )

    zone_leaderboard.sort(key=lambda row: (row["mae"], -row["accuracy"]))

    return {
        "accuracyScore": _clamp(accuracy, 0.0, 100.0),
        "mae": mae,
        "rmse": rmse,
        "directionalAccuracy": _clamp(directional_accuracy, 0.0, 100.0),
        "within5": within5,
        "totalEvaluated": total_evaluated,
        "series": series,
        "zoneLeaderboard": zone_leaderboard[:8],
    }


def compute_monthly_calibration(ngo_id: str) -> dict[str, Any]:
    runs = [
        {"id": doc.id, **(doc.to_dict() or {})}
        for doc in db.collection("forecastRuns").where("ngoId", "==", ngo_id).stream()
    ]
    runs.sort(key=lambda item: _coerce_datetime(item.get("generatedAt")) or datetime.min, reverse=True)
    runs = runs[:60]

    zones = {
        doc.id: (doc.to_dict() or {})
        for doc in db.collection("zones").where("ngoIds", "array_contains", ngo_id).stream()
    }

    zone_errors: dict[str, list[float]] = defaultdict(list)
    sample_count = 0

    for run in runs:
        zone_runs = run.get("zones") if isinstance(run.get("zones"), list) else []
        for zone_run in zone_runs:
            if not isinstance(zone_run, dict):
                continue
            zone_id = str(zone_run.get("zoneId") or "").strip()
            if not zone_id or zone_id not in zones:
                continue

            predictions = zone_run.get("predictions") if isinstance(zone_run.get("predictions"), list) else []
            for prediction in predictions:
                if not isinstance(prediction, dict):
                    continue
                week_start = _coerce_datetime(prediction.get("targetWeekStart"))
                if not week_start:
                    continue
                actual_score = _actual_score_for_week(zones[zone_id], week_start)
                if actual_score is None:
                    continue
                predicted_score = _as_float(prediction.get("score"), 0.0)
                zone_errors[zone_id].append(predicted_score - actual_score)
                sample_count += 1

    zone_bias: dict[str, float] = {}
    for zone_id, errors in zone_errors.items():
        if len(errors) < 3:
            continue
        trimmed = sorted(errors)
        if len(trimmed) > 6:
            trimmed = trimmed[1:-1]
        zone_bias[zone_id] = round(sum(trimmed) / len(trimmed), 2)

    now = datetime.utcnow().isoformat()
    calibration_version = f"calib-{datetime.utcnow().strftime('%Y-%m')}"
    payload = {
        "ngoId": ngo_id,
        "generatedAt": now,
        "calibrationVersion": calibration_version,
        "sampleCount": sample_count,
        "zoneBias": zone_bias,
    }
    db.collection("forecastCalibrations").document(ngo_id).set(payload, merge=True)

    return {
        "updated": True,
        "generatedAt": now,
        "calibrationVersion": calibration_version,
        "zoneBiasCount": len(zone_bias),
        "sampleCount": sample_count,
    }
