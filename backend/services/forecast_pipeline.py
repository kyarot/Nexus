from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from core.firebase import db
from services.forecast_quality import compute_backtesting_dashboard


FORECAST_MODEL_VERSION = "forecast-v1.0.0"
DEFAULT_LOOKBACK_WEEKS = 12
SNAPSHOT_STALE_MINUTES = 12


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


def _as_float(value: Any, fallback: float = 0.0) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _week_start(value: datetime) -> datetime:
    value = value.replace(hour=0, minute=0, second=0, microsecond=0)
    return value - timedelta(days=value.weekday())


def _week_label(value: datetime) -> str:
    year, week, _ = value.isocalendar()
    return f"W{week:02d}"


def _risk_level(score: float) -> str:
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 35:
        return "medium"
    return "low"


def _dominant_need(signal_map: dict[str, float]) -> str:
    if not signal_map:
        return "general"
    return max(signal_map.items(), key=lambda item: item[1])[0]


def _tone_from_risk(risk_level: str) -> tuple[str, str]:
    if risk_level == "critical":
        return "#EF4444", "bg-[#FEF2F2] text-[#EF4444]"
    if risk_level == "high":
        return "#F97316", "bg-orange-50 text-orange-600"
    if risk_level == "medium":
        return "#5A57FF", "bg-[#F3F2FF] text-[#5A57FF]"
    return "#10B981", "bg-[#ECFDF5] text-[#10B981]"


def _severity_weight(severity: str) -> float:
    normalized = str(severity or "medium").strip().lower()
    if normalized == "critical":
        return 2.6
    if normalized == "high":
        return 1.9
    if normalized == "low":
        return 1.0
    return 1.35


def _load_settings(ngo_id: str) -> dict[str, Any]:
    snapshot = db.collection("forecastSettings").document(ngo_id).get()
    data = snapshot.to_dict() or {}
    methods = data.get("notificationMethods") if isinstance(data.get("notificationMethods"), dict) else {}
    return {
        "ngoId": ngo_id,
        "threshold": int(data.get("threshold") or 75),
        "minConfidence": int(data.get("minConfidence") or 65),
        "lookbackWeeks": int(data.get("lookbackWeeks") or DEFAULT_LOOKBACK_WEEKS),
        "seasonalEnabled": bool(data.get("seasonalEnabled", True)),
        "notificationMethods": {
            "email": bool(methods.get("email", True)),
            "sms": bool(methods.get("sms", True)),
            "push": bool(methods.get("push", False)),
        },
        "updatedAt": data.get("updatedAt"),
    }


def get_forecast_settings(ngo_id: str) -> dict[str, Any]:
    return _load_settings(ngo_id)


def patch_forecast_settings(ngo_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    current = _load_settings(ngo_id)
    next_methods = current["notificationMethods"].copy()
    if isinstance(patch.get("notificationMethods"), dict):
        incoming = patch.get("notificationMethods")
        next_methods["email"] = bool(incoming.get("email", next_methods["email"]))
        next_methods["sms"] = bool(incoming.get("sms", next_methods["sms"]))
        next_methods["push"] = bool(incoming.get("push", next_methods["push"]))

    next_payload = {
        "ngoId": ngo_id,
        "threshold": int(patch.get("threshold", current["threshold"])),
        "minConfidence": int(patch.get("minConfidence", current["minConfidence"])),
        "lookbackWeeks": int(patch.get("lookbackWeeks", current["lookbackWeeks"])),
        "seasonalEnabled": bool(patch.get("seasonalEnabled", current["seasonalEnabled"])),
        "notificationMethods": next_methods,
        "updatedAt": datetime.utcnow().isoformat(),
    }

    next_payload["threshold"] = max(0, min(100, next_payload["threshold"]))
    next_payload["minConfidence"] = max(0, min(100, next_payload["minConfidence"]))
    next_payload["lookbackWeeks"] = max(8, min(24, next_payload["lookbackWeeks"]))

    db.collection("forecastSettings").document(ngo_id).set(next_payload, merge=True)
    return next_payload


def _load_zones(ngo_id: str) -> list[dict[str, Any]]:
    rows = []
    for doc in db.collection("zones").where("ngoIds", "array_contains", ngo_id).stream():
        data = doc.to_dict() or {}
        data["id"] = doc.id
        rows.append(data)
    return rows


def _load_reports(ngo_id: str) -> list[dict[str, Any]]:
    rows = []
    # Avoid composite index dependencies by sorting in memory.
    for doc in db.collection("reports").where("ngoId", "==", ngo_id).limit(2000).stream():
        data = doc.to_dict() or {}
        data["id"] = doc.id
        rows.append(data)

    rows.sort(key=lambda item: _coerce_datetime(item.get("createdAt")) or datetime.min, reverse=True)
    return rows


def _load_missions(ngo_id: str) -> list[dict[str, Any]]:
    rows = []
    for doc in db.collection("missions").where("ngoId", "==", ngo_id).limit(1200).stream():
        data = doc.to_dict() or {}
        data["id"] = doc.id
        rows.append(data)
    rows.sort(key=lambda item: _coerce_datetime(item.get("updatedAt") or item.get("createdAt")) or datetime.min, reverse=True)
    return rows


def _load_calibration(ngo_id: str) -> dict[str, Any]:
    snapshot = db.collection("forecastCalibrations").document(ngo_id).get()
    if not snapshot.exists:
        return {"zoneBias": {}, "calibrationVersion": "none", "generatedAt": None}
    data = snapshot.to_dict() or {}
    zone_bias = data.get("zoneBias") if isinstance(data.get("zoneBias"), dict) else {}
    return {
        "zoneBias": {str(zone_id): _as_float(bias, 0.0) for zone_id, bias in zone_bias.items()},
        "calibrationVersion": str(data.get("calibrationVersion") or "none"),
        "generatedAt": data.get("generatedAt"),
    }


def _zone_score_series(zone: dict[str, Any], now: datetime, lookback_weeks: int) -> list[tuple[datetime, float]]:
    history = zone.get("scoreHistory") if isinstance(zone.get("scoreHistory"), list) else []
    series: list[tuple[datetime, float]] = []

    synthetic_anchor = now - timedelta(weeks=min(len(history), lookback_weeks))
    synthetic_step = timedelta(days=7)
    synthetic_index = 0

    for entry in history[-40:]:
        if not isinstance(entry, dict):
            continue
        score = _as_float(entry.get("score", entry.get("actual", zone.get("currentScore", 0.0))), 0.0)
        dt = _coerce_datetime(entry.get("timestamp") or entry.get("updatedAt") or entry.get("createdAt"))
        if dt is None:
            dt = synthetic_anchor + (synthetic_step * synthetic_index)
            synthetic_index += 1
        series.append((_week_start(dt), score))

    if not series:
        current = _as_float(zone.get("currentScore"), 0.0)
        for i in range(lookback_weeks):
            dt = _week_start(now - timedelta(weeks=(lookback_weeks - i)))
            series.append((dt, current))

    latest_score = _as_float(zone.get("currentScore"), series[-1][1])
    series.append((_week_start(now), latest_score))

    compressed: dict[str, tuple[datetime, float]] = {}
    for dt, score in series:
        key = dt.isoformat()
        compressed[key] = (dt, score)

    normalized = sorted(compressed.values(), key=lambda item: item[0])
    return normalized[-lookback_weeks:]


def _weekly_signal_matrix(zone_reports: list[dict[str, Any]], lookback_weeks: int, now: datetime) -> dict[str, dict[str, float]]:
    matrix: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    cutoff = now - timedelta(weeks=lookback_weeks + 1)
    for report in zone_reports:
        created_at = _coerce_datetime(report.get("createdAt"))
        if not created_at or created_at < cutoff:
            continue
        week = _week_start(created_at).isoformat()
        need = str(report.get("needType") or "general").strip().lower() or "general"
        severity = str(report.get("severity") or "medium")
        families = max(0.0, _as_float(report.get("familiesAffected"), 0.0))
        signal_weight = _severity_weight(severity) + min(2.0, families / 20.0)
        matrix[week][need] += signal_weight
    return {week: dict(needs) for week, needs in matrix.items()}


def _seasonal_score(series: list[tuple[datetime, float]], now: datetime) -> tuple[float, str]:
    if len(series) < 20:
        return 0.0, "No strong seasonal pattern"

    current_month = now.month
    same_month = [score for dt, score in series if dt.month == current_month]
    all_scores = [score for _, score in series]
    if len(same_month) < 2 or not all_scores:
        return 0.0, "No strong seasonal pattern"

    seasonal_delta = (sum(same_month) / len(same_month)) - (sum(all_scores) / len(all_scores))
    if abs(seasonal_delta) < 4:
        return 0.0, "No strong seasonal pattern"

    if seasonal_delta > 0:
        return round(min(12.0, seasonal_delta), 2), "Seasonal stress window detected"
    return round(max(-12.0, seasonal_delta), 2), "Seasonal easing window detected"


def _trend_metrics(values: list[float]) -> dict[str, float | str]:
    if len(values) < 2:
        return {
            "slope": 0.0,
            "velocity": 0.0,
            "acceleration": 0.0,
            "driftRatio": 0.0,
            "volatility": 0.0,
            "direction": "stable",
        }

    diffs = [values[idx] - values[idx - 1] for idx in range(1, len(values))]
    slope_window = diffs[-6:] if len(diffs) >= 6 else diffs
    slope = sum(slope_window) / len(slope_window)
    velocity = slope
    acceleration = 0.0
    if len(diffs) >= 2:
        acceleration = diffs[-1] - diffs[-2]

    reference_idx = max(0, len(values) - 5)
    reference_score = values[reference_idx]
    drift_ratio = (values[-1] - reference_score) / max(1.0, abs(reference_score))

    avg_diff = sum(diffs) / len(diffs)
    variance = sum((diff - avg_diff) ** 2 for diff in diffs) / len(diffs)
    volatility = math.sqrt(max(0.0, variance))

    if slope > 1.3:
        direction = "rising"
    elif slope < -1.3:
        direction = "falling"
    else:
        direction = "stable"

    return {
        "slope": round(slope, 3),
        "velocity": round(velocity, 3),
        "acceleration": round(acceleration, 3),
        "driftRatio": round(drift_ratio, 4),
        "volatility": round(volatility, 3),
        "direction": direction,
    }


def _mission_relief(missions: list[dict[str, Any]], now: datetime) -> tuple[float, int]:
    completed = []
    for mission in missions:
        status = str(mission.get("status") or "").strip().lower()
        if status != "completed":
            continue
        completed_at = _coerce_datetime(mission.get("completedAt") or mission.get("updatedAt") or mission.get("createdAt"))
        if not completed_at or (now - completed_at) > timedelta(weeks=6):
            continue
        completed.append(mission)

    if not completed:
        return 0.0, 0

    families = sum(max(0.0, _as_float(mission.get("familiesHelped"), 0.0)) for mission in completed)
    relief = min(14.0, len(completed) * 1.6 + (families / 90.0))
    return round(relief, 2), len(completed)


def _current_pressure(signal_matrix: dict[str, dict[str, float]], now: datetime) -> tuple[float, float, dict[str, float], float]:
    current_week = _week_start(now).isoformat()
    previous_week = _week_start(now - timedelta(weeks=1)).isoformat()

    current_map = signal_matrix.get(current_week, {})
    previous_map = signal_matrix.get(previous_week, {})

    current_pressure = sum(current_map.values())
    previous_pressure = sum(previous_map.values())

    dominant_window: dict[str, float] = defaultdict(float)
    for offset in range(0, 2):
        week_key = _week_start(now - timedelta(weeks=offset)).isoformat()
        for need, weight in signal_matrix.get(week_key, {}).items():
            dominant_window[need] += weight

    acceleration = current_pressure - previous_pressure
    return current_pressure, previous_pressure, dict(dominant_window), acceleration


def _recommended_action(
    dominant_need: str,
    zone_name: str,
    recent_reports: list[dict[str, Any]],
    predicted_peak_week: str,
) -> tuple[str, int]:
    if not recent_reports:
        return f"Maintain baseline responders in {zone_name}; monitor {dominant_need} signals for early escalation.", 1

    recent_families = sum(max(0.0, _as_float(report.get("familiesAffected"), 0.0)) for report in recent_reports)
    high_count = len([r for r in recent_reports if str(r.get("severity") or "").lower() in {"high", "critical"}])
    severity_factor = 1.0 + min(0.7, high_count * 0.12)
    volunteers = max(1, math.ceil((recent_families * severity_factor) / 12.0))

    action = (
        f"Deploy {volunteers} {dominant_need} responders to {zone_name} by {predicted_peak_week}; "
        f"families affected estimate: ~{int(round(recent_families))}."
    )
    return action, int(round(recent_families))


def _prediction_series(
    *,
    current_score: float,
    slope: float,
    acceleration: float,
    seasonal: float,
    pressure_delta: float,
    relief: float,
    volatility: float,
    lookahead_weeks: int,
    calibration_bias: float,
    data_weeks: int,
    has_recent_reports: bool,
    now: datetime,
) -> list[dict[str, Any]]:
    points: list[dict[str, Any]] = []

    base_confidence = 84.0
    base_confidence -= min(24.0, volatility * 4.5)
    base_confidence -= max(0.0, (8 - min(8, data_weeks)) * 2.8)
    if not has_recent_reports:
        base_confidence -= 8.0

    for horizon in range(1, lookahead_weeks + 1):
        trend_term = slope * horizon
        accel_term = acceleration * 0.35 * horizon
        season_term = seasonal * (0.18 + (horizon * 0.02))
        pressure_term = pressure_delta * 0.5
        relief_term = relief * (0.32 + horizon * 0.06)

        raw = current_score + trend_term + accel_term + season_term + pressure_term - relief_term - calibration_bias
        score = round(_clamp(raw, 0.0, 100.0), 2)

        confidence = base_confidence - (horizon * 4.0)
        confidence += min(6.0, abs(seasonal) * 0.35)
        confidence = round(_clamp(confidence, 30.0, 98.0), 2)

        target_week = _week_start(now + timedelta(weeks=horizon))
        points.append(
            {
                "weekLabel": _week_label(target_week),
                "weekStart": target_week.isoformat(),
                "score": score,
                "confidence": confidence,
                "horizon": horizon,
                "direction": "up" if score > current_score else "down" if score < current_score else "stable",
                "targetWeekStart": target_week.isoformat(),
            }
        )

    return points


def _quality_flags(data_weeks: int, has_reports: bool, volatility: float, confidence: float) -> list[str]:
    flags: list[str] = []
    if data_weeks < 8:
        flags.append("sparse_history")
    if not has_reports:
        flags.append("no_recent_reports")
    if volatility > 8:
        flags.append("high_volatility")
    if confidence < 55:
        flags.append("low_confidence")
    return flags


def _snapshot_cache(ngo_id: str) -> dict[str, Any] | None:
    snapshot = db.collection("forecastSnapshots").document(ngo_id).get()
    if not snapshot.exists:
        return None
    return snapshot.to_dict() or None


def _is_snapshot_fresh(snapshot: dict[str, Any]) -> bool:
    generated_at = _coerce_datetime(snapshot.get("generatedAt"))
    if not generated_at:
        return False
    return (datetime.utcnow() - generated_at) < timedelta(minutes=SNAPSHOT_STALE_MINUTES)


def generate_forecast_snapshot(ngo_id: str, force: bool = False) -> dict[str, Any]:
    if not force:
        cached = _snapshot_cache(ngo_id)
        if cached and _is_snapshot_fresh(cached):
            return cached

    started_at = datetime.utcnow()
    settings = _load_settings(ngo_id)
    lookback_weeks = int(settings.get("lookbackWeeks") or DEFAULT_LOOKBACK_WEEKS)

    zones = _load_zones(ngo_id)
    reports = _load_reports(ngo_id)
    missions = _load_missions(ngo_id)
    calibration = _load_calibration(ngo_id)

    now = datetime.utcnow()
    reports_by_zone: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for report in reports:
        zone_id = str(report.get("zoneId") or "").strip()
        if zone_id:
            reports_by_zone[zone_id].append(report)

    missions_by_zone: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for mission in missions:
        zone_id = str(mission.get("zoneId") or "").strip()
        if zone_id:
            missions_by_zone[zone_id].append(mission)

    zone_cards: list[dict[str, Any]] = []
    zone_details: dict[str, dict[str, Any]] = {}
    global_predictions = {1: [], 2: [], 3: [], 4: []}
    global_confidences = {1: [], 2: [], 3: [], 4: []}
    global_drifts: list[float] = []
    historical_points: dict[str, list[float]] = defaultdict(list)

    freshest_report_at = _coerce_datetime(reports[0].get("createdAt")) if reports else None

    for zone in zones:
        zone_id = str(zone.get("id") or "")
        zone_name = str(zone.get("name") or zone_id or "Zone")
        zone_reports = reports_by_zone.get(zone_id, [])[:200]
        zone_missions = missions_by_zone.get(zone_id, [])

        series = _zone_score_series(zone, now, lookback_weeks)
        values = [score for _, score in series]
        current_score = values[-1] if values else _as_float(zone.get("currentScore"), 0.0)

        trend = _trend_metrics(values)
        signal_matrix = _weekly_signal_matrix(zone_reports, lookback_weeks, now)
        current_pressure, previous_pressure, dominant_map, pressure_delta = _current_pressure(signal_matrix, now)
        seasonal_score, seasonal_label = _seasonal_score(series, now) if settings.get("seasonalEnabled", True) else (0.0, "Seasonality disabled")
        relief, completed_recent = _mission_relief(zone_missions, now)

        zone_bias = _as_float(calibration.get("zoneBias", {}).get(zone_id), 0.0)
        predictions = _prediction_series(
            current_score=current_score,
            slope=_as_float(trend.get("slope"), 0.0),
            acceleration=_as_float(trend.get("acceleration"), 0.0),
            seasonal=seasonal_score,
            pressure_delta=current_pressure - previous_pressure,
            relief=relief,
            volatility=_as_float(trend.get("volatility"), 0.0),
            lookahead_weeks=4,
            calibration_bias=zone_bias,
            data_weeks=len(values),
            has_recent_reports=bool(zone_reports[:6]),
            now=now,
        )

        peak = max(predictions, key=lambda row: row["score"]) if predictions else {"score": current_score, "weekLabel": _week_label(_week_start(now)), "confidence": 50.0}
        dominant_need = _dominant_need(dominant_map) if dominant_map else _dominant_need(zone.get("signalCounts") if isinstance(zone.get("signalCounts"), dict) else {})
        recommended_action, families_at_risk = _recommended_action(dominant_need, zone_name, zone_reports[:8], str(peak.get("weekLabel") or "next week"))
        risk_level = _risk_level(_as_float(peak.get("score"), current_score))
        color, badge_tone = _tone_from_risk(risk_level)
        zone_confidence = round(sum(point["confidence"] for point in predictions) / len(predictions), 2) if predictions else 50.0
        flags = _quality_flags(len(values), bool(zone_reports[:6]), _as_float(trend.get("volatility"), 0.0), zone_confidence)

        trend_mini = [round(max(0.0, min(100.0, value)), 2) for value in (values[-2:] + [p["score"] for p in predictions])][-5:]
        if len(trend_mini) < 5:
            trend_mini = ([trend_mini[0]] * (5 - len(trend_mini))) + trend_mini if trend_mini else [0, 0, 0, 0, 0]

        zone_card = {
            "zoneId": zone_id,
            "zone": zone_name,
            "peakLabel": f"{peak.get('weekLabel', 'W--')} PEAK" if risk_level in {"high", "critical"} else ("STABLE" if risk_level == "low" else "WATCH"),
            "color": color,
            "trend": trend_mini,
            "status": recommended_action,
            "badgeTone": badge_tone,
            "confidence": zone_confidence,
            "predictedPeakScore": round(_as_float(peak.get("score"), current_score), 2),
            "riskLevel": risk_level,
            "recommendedAction": recommended_action,
            "dominantNeed": dominant_need,
            "needsAtRisk": families_at_risk,
            "dataQualityFlags": flags,
        }
        zone_cards.append(zone_card)

        zone_details[zone_id] = {
            "zoneId": zone_id,
            "zone": zone_name,
            "currentScore": round(current_score, 2),
            "trendDirection": trend.get("direction", "stable"),
            "driftRatio": trend.get("driftRatio", 0.0),
            "velocity": trend.get("velocity", 0.0),
            "acceleration": trend.get("acceleration", 0.0),
            "seasonalLabel": seasonal_label,
            "seasonalScore": seasonal_score,
            "missionRelief": relief,
            "completedMissionsRecent": completed_recent,
            "signalPressure": round(current_pressure, 2),
            "signalPressureDelta": round(pressure_delta, 2),
            "predictions": predictions,
            "dominantNeed": dominant_need,
            "recommendedAction": recommended_action,
            "dataQualityFlags": flags,
        }

        global_drifts.append(_as_float(trend.get("driftRatio"), 0.0))
        for horizon_point in predictions:
            horizon = int(horizon_point.get("horizon") or 1)
            global_predictions[horizon].append(_as_float(horizon_point.get("score"), current_score))
            global_confidences[horizon].append(_as_float(horizon_point.get("confidence"), 50.0))

        for week_start, score in series[-4:]:
            historical_points[week_start.isoformat()].append(score)

    zone_cards.sort(key=lambda item: item["predictedPeakScore"], reverse=True)

    historical_chart = []
    for week_key in sorted(historical_points.keys())[-4:]:
        dt = _coerce_datetime(week_key) or _week_start(now)
        scores = historical_points[week_key]
        avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0
        historical_chart.append(
            {
                "weekLabel": _week_label(dt),
                "weekStart": dt.isoformat(),
                "score": avg_score,
                "confidence": 100.0,
                "isForecast": False,
            }
        )

    forecast_chart = []
    for horizon in [1, 2, 3, 4]:
        scores = global_predictions[horizon]
        confidences = global_confidences[horizon]
        target = _week_start(now + timedelta(weeks=horizon))
        avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0
        avg_conf = round(sum(confidences) / len(confidences), 2) if confidences else 0.0
        forecast_chart.append(
            {
                "weekLabel": _week_label(target),
                "weekStart": target.isoformat(),
                "score": avg_score,
                "confidence": avg_conf,
                "isForecast": True,
            }
        )

    main_chart_points = historical_chart + forecast_chart
    peak_point = max(forecast_chart, key=lambda item: item["score"], default={"weekLabel": _week_label(_week_start(now)), "score": 0.0, "confidence": 0.0})

    backtesting = compute_backtesting_dashboard(ngo_id, window_weeks=12)
    accuracy_score = _as_float(backtesting.get("accuracyScore"), 0.0)
    trend_bars = [point.get("accuracy", 0.0) for point in (backtesting.get("series") or [])][-5:]
    if len(trend_bars) < 5:
        trend_bars = ([40.0] * (5 - len(trend_bars))) + trend_bars

    high_risk = len([zone for zone in zone_cards if zone["riskLevel"] in {"high", "critical"}])
    critical = len([zone for zone in zone_cards if zone["riskLevel"] == "critical"])
    improving = len([zone for zone in zone_details.values() if _as_float(zone.get("driftRatio"), 0.0) < 0])

    risk_rows = [
        {
            "zoneId": zone["zoneId"],
            "zone": zone["zone"],
            "atRisk": zone["needsAtRisk"],
            "need": zone["dominantNeed"].capitalize(),
            "riskLevel": zone["riskLevel"],
        }
        for zone in zone_cards[:6]
    ]

    runtime_ms = int((datetime.utcnow() - started_at).total_seconds() * 1000)
    freshness_minutes = int(max(0, (datetime.utcnow() - freshest_report_at).total_seconds() // 60)) if freshest_report_at else 999
    avg_confidence = 0.0
    if forecast_chart:
        avg_confidence = sum(point["confidence"] for point in forecast_chart) / len(forecast_chart)
    quality_score = _clamp(round(avg_confidence - min(20, freshness_minutes / 8), 2), 20.0, 99.0)

    performance_note = "Forecast quality is stable."
    if quality_score < 55:
        performance_note = "Low quality forecast window: refresh source reports and validate zone signals."
    elif quality_score > 80:
        performance_note = "High-confidence window across active zones."

    summary = {
        "generatedAt": datetime.utcnow().isoformat(),
        "modelVersion": FORECAST_MODEL_VERSION,
        "windowWeeks": lookback_weeks,
        "mainChart": {
            "points": main_chart_points,
            "peakWeek": peak_point.get("weekLabel", "W--"),
            "peakScore": round(_as_float(peak_point.get("score"), 0.0), 2),
            "peakConfidence": round(max((point.get("confidence", 0.0) for point in forecast_chart), default=0.0), 2),
            "driftRatio": round(sum(global_drifts) / len(global_drifts), 4) if global_drifts else 0.0,
        },
        "performance": {
            "accuracyScore": round(accuracy_score, 2),
            "trendBars": trend_bars,
            "note": performance_note,
        },
        "riskAssessmentRows": risk_rows,
        "telemetry": {
            "qualityScore": quality_score,
            "dataFreshnessMinutes": freshness_minutes,
            "lastComputeDurationMs": runtime_ms,
            "uptimePercent": 99.95,
            "modelVersion": FORECAST_MODEL_VERSION,
            "calibrationVersion": calibration.get("calibrationVersion", "none"),
        },
        "overview": {
            "totalZones": len(zone_cards),
            "highRiskZones": high_risk,
            "criticalZones": critical,
            "improvingZones": improving,
        },
    }

    snapshot = {
        "ngoId": ngo_id,
        "generatedAt": summary["generatedAt"],
        "modelVersion": FORECAST_MODEL_VERSION,
        "summary": summary,
        "zones": zone_cards,
        "zoneDetails": zone_details,
        "backtesting": backtesting,
        "settings": settings,
        "updatedMarker": summary["generatedAt"],
    }

    db.collection("forecastSnapshots").document(ngo_id).set(snapshot, merge=True)

    run_payload = {
        "ngoId": ngo_id,
        "generatedAt": summary["generatedAt"],
        "modelVersion": FORECAST_MODEL_VERSION,
        "qualityScore": quality_score,
        "durationMs": runtime_ms,
        "zones": [
            {
                "zoneId": zone["zoneId"],
                "zone": zone["zone"],
                "currentScore": _as_float(zone_details.get(zone["zoneId"], {}).get("currentScore"), 0.0),
                "predictions": zone_details.get(zone["zoneId"], {}).get("predictions", []),
                "driftRatio": zone_details.get(zone["zoneId"], {}).get("driftRatio", 0.0),
                "confidence": zone["confidence"],
            }
            for zone in zone_cards
        ],
    }
    run_ref = db.collection("forecastRuns").document()
    run_ref.set(run_payload)
    snapshot["runId"] = run_ref.id

    return snapshot


def get_forecast_summary(ngo_id: str, force: bool = False) -> dict[str, Any]:
    snapshot = generate_forecast_snapshot(ngo_id, force=force)
    return snapshot.get("summary") if isinstance(snapshot.get("summary"), dict) else {}


def get_forecast_zones(ngo_id: str, force: bool = False) -> dict[str, Any]:
    snapshot = generate_forecast_snapshot(ngo_id, force=force)
    zones = snapshot.get("zones") if isinstance(snapshot.get("zones"), list) else []
    return {"zones": zones, "total": len(zones)}


def get_forecast_zone_detail(ngo_id: str, zone_id: str, force: bool = False) -> dict[str, Any]:
    snapshot = generate_forecast_snapshot(ngo_id, force=force)
    zones = snapshot.get("zones") if isinstance(snapshot.get("zones"), list) else []
    details = snapshot.get("zoneDetails") if isinstance(snapshot.get("zoneDetails"), dict) else {}

    card = next((zone for zone in zones if str(zone.get("zoneId")) == zone_id), None)
    detail = details.get(zone_id) if isinstance(details.get(zone_id), dict) else None
    if not card:
        return {}

    return {"zone": card, "detail": detail or {}}


def get_forecast_backtesting(ngo_id: str, window_weeks: int = 12) -> dict[str, Any]:
    return compute_backtesting_dashboard(ngo_id, window_weeks=window_weeks)


def latest_forecast_marker(ngo_id: str) -> str:
    snapshot = _snapshot_cache(ngo_id)
    if not snapshot:
        return ""
    marker = str(snapshot.get("updatedMarker") or snapshot.get("generatedAt") or "")
    return marker
