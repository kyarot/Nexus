from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from firebase_admin import firestore

from core.firebase import db
from services.notifications_hub import notify_ngo_coordinators

logger = logging.getLogger("nexus.drift_alerts")

DRIFT_ALERTS_COLLECTION = "driftAlerts"
DRIFT_ALERT_EVENTS_COLLECTION = "driftAlertEvents"

RULE_RAPID = "rapid_score_rise"
RULE_THRESHOLD = "threshold_crossing"
RULE_PATTERN = "pattern_match"
RULE_SILENCE = "silence_high_score"

SEVERITY_RANK = {"watch": 1, "high": 2, "critical": 3}
ACTIVE_ALERT_STATUSES = {"active", "actioned"}


def _now() -> datetime:
    return datetime.utcnow()


def _coerce_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if hasattr(value, "to_datetime"):
        try:
            parsed = value.to_datetime()
            return parsed.replace(tzinfo=None) if getattr(parsed, "tzinfo", None) else parsed
        except Exception:
            return None
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        except ValueError:
            return None
    return None


def _serialize(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize(item) for key, item in value.items()}
    return value


def _safe_doc_id(value: str) -> str:
    return value.replace("/", "_").replace(" ", "_")


def _severity_to_priority(severity: str) -> str:
    if severity == "critical":
        return "critical"
    if severity == "high":
        return "high"
    return "medium"


def _alert_level_from_score(score: float) -> str:
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    return "watch"


def _risk_variant_from_severity(severity: str) -> str:
    if severity == "critical":
        return "danger"
    if severity == "high":
        return "warning"
    return "info"


def _fetch_zone_reports(ngo_id: str, zone_id: str, limit: int = 120) -> list[dict[str, Any]]:
    reports: list[dict[str, Any]] = []

    try:
        docs = (
            db.collection("reports")
            .where(filter=firestore.FieldFilter("ngoId", "==", ngo_id))
            .where(filter=firestore.FieldFilter("zoneId", "==", zone_id))
            .limit(limit)
            .stream()
        )
        rows = list(docs)
    except Exception:
        fallback_rows = (
            db.collection("reports")
            .where(filter=firestore.FieldFilter("ngoId", "==", ngo_id))
            .limit(limit * 4)
            .stream()
        )
        rows = [doc for doc in fallback_rows if str((doc.to_dict() or {}).get("zoneId") or "") == zone_id]

    for doc in rows:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        reports.append(data)

    reports.sort(
        key=lambda item: _coerce_datetime(item.get("createdAt")) or datetime.min,
        reverse=True,
    )
    return reports[:limit]


def _fetch_zone_insight(ngo_id: str, zone_id: str) -> dict[str, Any] | None:
    try:
        rows = list(db.collection("insights").where(filter=firestore.FieldFilter("ngoId", "==", ngo_id)).limit(80).stream())
    except Exception:
        rows = list(db.collection("insights").limit(200).stream())

    candidates: list[dict[str, Any]] = []
    for doc in rows:
        data = doc.to_dict() or {}
        if str(data.get("zoneId") or "") != zone_id:
            continue
        status = str(data.get("status") or "active").lower()
        if status not in {"active", "watch"}:
            continue
        data["id"] = doc.id
        candidates.append(data)

    candidates.sort(
        key=lambda item: _coerce_datetime(item.get("generatedAt") or item.get("updatedAt")) or datetime.min,
        reverse=True,
    )
    return candidates[0] if candidates else None


def _build_source_reports(reports: list[dict[str, Any]], limit: int = 5) -> list[dict[str, Any]]:
    source_rows: list[dict[str, Any]] = []
    for report in reports[:limit]:
        source_rows.append(
            {
                "id": str(report.get("id") or ""),
                "needType": report.get("needType"),
                "severity": report.get("severity"),
                "familiesAffected": int(report.get("familiesAffected") or 0),
                "personsAffected": int(report.get("personsAffected") or 0),
                "additionalNotes": report.get("additionalNotes"),
                "createdAt": _serialize(_coerce_datetime(report.get("createdAt"))),
            }
        )
    return source_rows


def _compute_score_series(zone_data: dict[str, Any], now: datetime) -> tuple[list[tuple[datetime, float]], float]:
    current_score = float(zone_data.get("currentScore") or 0.0)
    history = zone_data.get("scoreHistory") if isinstance(zone_data.get("scoreHistory"), list) else []
    points: list[tuple[datetime, float]] = []

    for entry in history:
        if not isinstance(entry, dict):
            continue
        ts = _coerce_datetime(entry.get("timestamp") or entry.get("updatedAt") or entry.get("createdAt"))
        if not ts:
            continue
        score = float(entry.get("score") or 0.0)
        points.append((ts, score))

    zone_updated = _coerce_datetime(zone_data.get("updatedAt")) or now
    points.append((zone_updated, current_score))
    points.sort(key=lambda item: item[0])
    return points, current_score


def _compute_trend_metrics(zone_data: dict[str, Any], reports: list[dict[str, Any]], now: datetime) -> dict[str, Any]:
    points, current_score = _compute_score_series(zone_data, now)
    previous_score = points[-2][1] if len(points) > 1 else current_score

    five_days_ago = now - timedelta(days=5)
    baseline_point = points[0]
    for point in points:
        if point[0] <= five_days_ago:
            baseline_point = point
        else:
            break

    delta_5d = round(current_score - baseline_point[1], 2)
    elapsed_days = max(1.0, (now - baseline_point[0]).total_seconds() / 86400.0)
    score_velocity = round(delta_5d / elapsed_days, 2)

    last_report_at = _coerce_datetime(reports[0].get("createdAt")) if reports else None
    reports_7d = 0
    reports_5d = 0
    for report in reports:
        ts = _coerce_datetime(report.get("createdAt"))
        if not ts:
            continue
        if ts >= now - timedelta(days=7):
            reports_7d += 1
        if ts >= now - timedelta(days=5):
            reports_5d += 1

    return {
        "currentScore": current_score,
        "previousScore": previous_score,
        "scoreDelta5d": delta_5d,
        "scoreVelocityPerDay": score_velocity,
        "lastReportAt": last_report_at,
        "reportCount7d": reports_7d,
        "reportCount5d": reports_5d,
    }


def _upsert_triggered_alert(
    *,
    ngo_id: str,
    zone_id: str,
    zone_name: str,
    rule_type: str,
    severity: str,
    title: str,
    summary: str,
    prediction_text: str,
    recommended_action: str,
    need_type: str,
    evidence: dict[str, Any],
    signals: list[dict[str, Any]],
    source_reports: list[dict[str, Any]],
) -> dict[str, Any]:
    now = _now()
    alert_id = _safe_doc_id(f"{ngo_id}__{zone_id}__{rule_type}")
    alert_ref = db.collection(DRIFT_ALERTS_COLLECTION).document(alert_id)
    existing = alert_ref.get().to_dict() or {}
    old_severity = str(existing.get("severity") or "").lower()
    old_status = str(existing.get("status") or "").lower()
    is_new = not bool(existing)

    status = str(existing.get("status") or "active").lower()
    if status == "dismissed":
        return {"id": alert_id, **existing}
    if status not in {"actioned"}:
        status = "active"

    source_report_ids = [str(item.get("id") or "") for item in source_reports if item.get("id")]
    eta = evidence.get("etaToCriticalDays")
    payload = {
        "ngoId": ngo_id,
        "zoneId": zone_id,
        "zoneName": zone_name,
        "ruleType": rule_type,
        "severity": severity,
        "status": status,
        "title": title,
        "summary": summary,
        "predictionText": prediction_text,
        "recommendedAction": recommended_action,
        "etaToCriticalDays": eta,
        "needType": need_type,
        "signals": signals,
        "sourceReportIds": source_report_ids,
        "sourceReports": source_reports,
        "evidence": evidence,
        "updatedAt": now,
        "triggeredAt": now,
    }

    if not existing:
        payload["createdAt"] = now

    alert_ref.set(payload, merge=True)

    db.collection(DRIFT_ALERT_EVENTS_COLLECTION).add(
        {
            "alertId": alert_id,
            "ngoId": ngo_id,
            "zoneId": zone_id,
            "type": "triggered",
            "ruleType": rule_type,
            "severity": severity,
            "createdAt": now,
        }
    )

    should_notify = is_new or old_severity != severity or old_status not in {"active", "actioned"}
    if should_notify:
        notify_ngo_coordinators(
            ngo_id,
            type="drift_alert_triggered",
            title=f"{severity.title()} alert in {zone_name}",
            message=summary,
            metadata={
                "alertId": alert_id,
                "zoneId": zone_id,
                "zoneName": zone_name,
                "severity": severity,
                "ruleType": rule_type,
            },
            timestamp=now,
        )

    return {"id": alert_id, **payload}


def _resolve_inactive_alert(existing: dict[str, Any], metrics: dict[str, Any], now: datetime) -> None:
    alert_id = str(existing.get("id") or "")
    if not alert_id:
        return

    status = str(existing.get("status") or "").lower()
    if status not in ACTIVE_ALERT_STATUSES:
        return

    current_score = float(metrics.get("currentScore") or 0.0)
    last_report_at = metrics.get("lastReportAt")
    score_velocity = float(metrics.get("scoreVelocityPerDay") or 0.0)

    update_data: dict[str, Any] = {"updatedAt": now}
    event_type: str | None = None

    if current_score < 60:
        update_data.update({"status": "resolved", "resolvedAt": now})
        event_type = "auto_resolved"
    elif last_report_at and (now - last_report_at) >= timedelta(days=14) and score_velocity <= 0:
        update_data.update({"status": "expired", "expiredAt": now})
        event_type = "auto_expired"

    if event_type:
        db.collection(DRIFT_ALERTS_COLLECTION).document(alert_id).set(update_data, merge=True)
        db.collection(DRIFT_ALERT_EVENTS_COLLECTION).add(
            {
                "alertId": alert_id,
                "ngoId": existing.get("ngoId"),
                "zoneId": existing.get("zoneId"),
                "type": event_type,
                "createdAt": now,
            }
        )


def _evaluate_zone_rules(ngo_id: str, zone_id: str, zone_data: dict[str, Any]) -> dict[str, int]:
    now = _now()
    zone_name = str(zone_data.get("name") or zone_id)

    reports = _fetch_zone_reports(ngo_id, zone_id)
    metrics = _compute_trend_metrics(zone_data, reports, now)
    latest_insight = _fetch_zone_insight(ngo_id, zone_id)

    top_need = "general"
    if reports:
        top_need = str(reports[0].get("needType") or "general").strip().lower() or "general"

    source_reports = _build_source_reports(reports)

    triggered_rules: set[str] = set()
    created_or_updated = 0

    current_score = float(metrics["currentScore"])
    previous_score = float(metrics["previousScore"])
    delta_5d = float(metrics["scoreDelta5d"])
    velocity = float(metrics["scoreVelocityPerDay"])

    eta_days = None
    if velocity > 0 and current_score < 80:
        eta_days = round(max(0.0, (80.0 - current_score) / velocity), 1)

    # Rule 1: rapid score rise
    if delta_5d > 15 and metrics["reportCount5d"] > 0:
        severity = "critical" if delta_5d >= 30 or current_score >= 80 else "high"
        prediction = (
            f"Zone score increased by {delta_5d:.1f} in the last 5 days. "
            + (f"At current pace, critical threshold may be reached in about {eta_days} days." if eta_days is not None else "Escalation trend is active.")
        )
        _upsert_triggered_alert(
            ngo_id=ngo_id,
            zone_id=zone_id,
            zone_name=zone_name,
            rule_type=RULE_RAPID,
            severity=severity,
            title=f"{zone_name} — Rapid escalation detected",
            summary=f"Score velocity is {velocity:+.1f}/day with {int(metrics['reportCount5d'])} reports in 5 days.",
            prediction_text=prediction,
            recommended_action="Create mission immediately to reduce escalation velocity.",
            need_type=top_need,
            evidence={
                **metrics,
                "etaToCriticalDays": eta_days,
            },
            signals=[
                {"label": f"Score +{delta_5d:.1f} in 5d", "variant": _risk_variant_from_severity(severity)},
                {"label": f"{int(metrics['reportCount5d'])} reports in 5d", "variant": "warning"},
            ],
            source_reports=source_reports,
        )
        triggered_rules.add(RULE_RAPID)
        created_or_updated += 1

    # Rule 2: threshold crossing
    crossed_threshold = None
    crossing_severity = None
    if previous_score < 80 <= current_score:
        crossed_threshold = 80
        crossing_severity = "critical"
    elif previous_score < 60 <= current_score:
        crossed_threshold = 60
        crossing_severity = "high"

    if crossed_threshold is not None and crossing_severity is not None:
        _upsert_triggered_alert(
            ngo_id=ngo_id,
            zone_id=zone_id,
            zone_name=zone_name,
            rule_type=RULE_THRESHOLD,
            severity=crossing_severity,
            title=f"{zone_name} — Threshold crossing",
            summary=f"Score crossed {crossed_threshold} (from {previous_score:.1f} to {current_score:.1f}).",
            prediction_text="First threshold crossing requires coordinator acknowledgement.",
            recommended_action="Create mission and assign volunteer now.",
            need_type=top_need,
            evidence={
                **metrics,
                "crossedThreshold": crossed_threshold,
            },
            signals=[
                {"label": f"Crossed {crossed_threshold}", "variant": _risk_variant_from_severity(crossing_severity)},
                {"label": f"Prev {previous_score:.1f} → Now {current_score:.1f}", "variant": "info"},
            ],
            source_reports=source_reports,
        )
        triggered_rules.add(RULE_THRESHOLD)
        created_or_updated += 1

    # Rule 3: pattern match from insight signal
    if latest_insight:
        insight_severity = str(latest_insight.get("severity") or "watch").lower()
        if insight_severity not in {"critical", "high", "watch"}:
            insight_severity = _alert_level_from_score(current_score)
        insight_summary = str(latest_insight.get("summary") or "Pattern match detected from live signals.").strip()
        insight_signals = latest_insight.get("signals") if isinstance(latest_insight.get("signals"), list) else []
        normalized_signals = []
        for item in insight_signals[:3]:
            if not isinstance(item, dict):
                continue
            label = str(item.get("label") or "Pattern signal")
            variant = str(item.get("variant") or "info").lower()
            if variant not in {"danger", "warning", "info", "success"}:
                variant = "info"
            normalized_signals.append({"label": label, "variant": variant})
        if not normalized_signals:
            normalized_signals = [{"label": "Pattern signature match", "variant": _risk_variant_from_severity(insight_severity)}]

        _upsert_triggered_alert(
            ngo_id=ngo_id,
            zone_id=zone_id,
            zone_name=zone_name,
            rule_type=RULE_PATTERN,
            severity=insight_severity,
            title=f"{zone_name} — Pattern match detected",
            summary=insight_summary,
            prediction_text="Current report constellation resembles a known deterioration pattern.",
            recommended_action="Schedule follow-up survey and early intervention mission.",
            need_type=top_need,
            evidence={
                **metrics,
                "insightId": latest_insight.get("id"),
                "insightGeneratedAt": _serialize(_coerce_datetime(latest_insight.get("generatedAt"))),
            },
            signals=normalized_signals,
            source_reports=source_reports,
        )
        triggered_rules.add(RULE_PATTERN)
        created_or_updated += 1

    # Rule 4: silence with high score
    last_report_at = metrics.get("lastReportAt")
    days_since_report = (now - last_report_at).days if isinstance(last_report_at, datetime) else 999
    if current_score > 60 and days_since_report >= 7:
        severity = "high" if current_score >= 75 else "watch"
        _upsert_triggered_alert(
            ngo_id=ngo_id,
            zone_id=zone_id,
            zone_name=zone_name,
            rule_type=RULE_SILENCE,
            severity=severity,
            title=f"{zone_name} — No reports + high score",
            summary=f"High score ({current_score:.1f}) with no report for {days_since_report} days.",
            prediction_text="Field silence under sustained high risk may indicate hidden escalation.",
            recommended_action="Dispatch follow-up field visit to validate current ground reality.",
            need_type=top_need,
            evidence={
                **metrics,
                "daysSinceLastReport": days_since_report,
            },
            signals=[
                {"label": f"No reports for {days_since_report}d", "variant": "warning"},
                {"label": f"Score {current_score:.1f}", "variant": _risk_variant_from_severity(severity)},
            ],
            source_reports=source_reports,
        )
        triggered_rules.add(RULE_SILENCE)
        created_or_updated += 1

    # Resolve or expire non-triggered active alerts in this zone.
    try:
        zone_alert_rows = list(
            db.collection(DRIFT_ALERTS_COLLECTION)
            .where(filter=firestore.FieldFilter("ngoId", "==", ngo_id))
            .limit(300)
            .stream()
        )
    except Exception:
        zone_alert_rows = list(db.collection(DRIFT_ALERTS_COLLECTION).limit(500).stream())

    for doc in zone_alert_rows:
        row = doc.to_dict() or {}
        if str(row.get("zoneId") or "") != zone_id:
            continue
        row["id"] = doc.id
        rule = str(row.get("ruleType") or "")
        if rule in triggered_rules:
            continue
        _resolve_inactive_alert(row, metrics, now)

    return {"updated": created_or_updated, "triggered": len(triggered_rules)}


def evaluate_zone_drift_alerts(ngo_id: str, zone_id: str) -> dict[str, int]:
    zone_snap = db.collection("zones").document(zone_id).get()
    if not zone_snap.exists:
        return {"updated": 0, "triggered": 0}

    zone_data = zone_snap.to_dict() or {}
    ngo_ids = zone_data.get("ngoIds") if isinstance(zone_data.get("ngoIds"), list) else []
    if ngo_id not in ngo_ids:
        return {"updated": 0, "triggered": 0}

    try:
        return _evaluate_zone_rules(ngo_id, zone_id, zone_data)
    except Exception as exc:
        logger.warning("Drift alert evaluation failed for zone %s: %s", zone_id, exc)
        return {"updated": 0, "triggered": 0}


def evaluate_ngo_drift_alerts(ngo_id: str) -> dict[str, int]:
    zones = db.collection("zones").where(filter=firestore.FieldFilter("ngoIds", "array_contains", ngo_id)).stream()
    total_updated = 0
    total_triggered = 0
    for zone in zones:
        result = evaluate_zone_drift_alerts(ngo_id, zone.id)
        total_updated += int(result.get("updated") or 0)
        total_triggered += int(result.get("triggered") or 0)
    return {"updated": total_updated, "triggered": total_triggered}


def latest_alert_update_marker(ngo_id: str) -> str:
    try:
        rows = db.collection(DRIFT_ALERTS_COLLECTION).where(filter=firestore.FieldFilter("ngoId", "==", ngo_id)).limit(300).stream()
    except Exception:
        rows = db.collection(DRIFT_ALERTS_COLLECTION).limit(500).stream()

    latest = datetime.min
    for row in rows:
        data = row.to_dict() or {}
        if str(data.get("ngoId") or "") != ngo_id:
            continue
        updated_at = _coerce_datetime(data.get("updatedAt"))
        if updated_at and updated_at > latest:
            latest = updated_at
    return latest.isoformat() if latest != datetime.min else ""


def list_alerts_for_ngo(ngo_id: str) -> list[dict[str, Any]]:
    try:
        rows = db.collection(DRIFT_ALERTS_COLLECTION).where(filter=firestore.FieldFilter("ngoId", "==", ngo_id)).limit(500).stream()
    except Exception:
        rows = db.collection(DRIFT_ALERTS_COLLECTION).limit(800).stream()

    alerts: list[dict[str, Any]] = []
    for doc in rows:
        data = doc.to_dict() or {}
        if str(data.get("ngoId") or "") != ngo_id:
            continue
        data["id"] = doc.id
        alerts.append(_serialize(data))

    alerts.sort(
        key=lambda item: _coerce_datetime(item.get("updatedAt") or item.get("createdAt")) or datetime.min,
        reverse=True,
    )
    return alerts


def get_alert_for_ngo(ngo_id: str, alert_id: str) -> dict[str, Any] | None:
    snap = db.collection(DRIFT_ALERTS_COLLECTION).document(alert_id).get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    if str(data.get("ngoId") or "") != ngo_id:
        return None
    data["id"] = snap.id
    return _serialize(data)


def dismiss_alert_for_ngo(ngo_id: str, alert_id: str, reason: str, actor_id: str | None) -> dict[str, Any] | None:
    snap = db.collection(DRIFT_ALERTS_COLLECTION).document(alert_id).get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    if str(data.get("ngoId") or "") != ngo_id:
        return None

    now = _now()
    db.collection(DRIFT_ALERTS_COLLECTION).document(alert_id).set(
        {
            "status": "dismissed",
            "dismissedReason": reason,
            "dismissedAt": now,
            "updatedAt": now,
        },
        merge=True,
    )

    db.collection(DRIFT_ALERT_EVENTS_COLLECTION).add(
        {
            "alertId": alert_id,
            "ngoId": ngo_id,
            "zoneId": data.get("zoneId"),
            "type": "dismissed",
            "reason": reason,
            "actorId": actor_id,
            "createdAt": now,
        }
    )

    data.update(
        {
            "status": "dismissed",
            "dismissedReason": reason,
            "dismissedAt": now,
            "updatedAt": now,
        }
    )
    return _serialize(data)


def action_alert_for_ngo(ngo_id: str, alert_id: str, mission_id: str, actor_id: str | None) -> dict[str, Any] | None:
    snap = db.collection(DRIFT_ALERTS_COLLECTION).document(alert_id).get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    if str(data.get("ngoId") or "") != ngo_id:
        return None

    now = _now()
    db.collection(DRIFT_ALERTS_COLLECTION).document(alert_id).set(
        {
            "status": "actioned",
            "linkedMissionId": mission_id,
            "actionedAt": now,
            "updatedAt": now,
        },
        merge=True,
    )

    db.collection(DRIFT_ALERT_EVENTS_COLLECTION).add(
        {
            "alertId": alert_id,
            "ngoId": ngo_id,
            "zoneId": data.get("zoneId"),
            "type": "mission_created",
            "missionId": mission_id,
            "actorId": actor_id,
            "createdAt": now,
        }
    )

    data.update(
        {
            "status": "actioned",
            "linkedMissionId": mission_id,
            "actionedAt": now,
            "updatedAt": now,
        }
    )
    return _serialize(data)


def mission_payload_from_alert(alert: dict[str, Any], ngo_id: str) -> dict[str, Any]:
    severity = str(alert.get("severity") or "high").lower()
    source_report_ids = [str(item) for item in (alert.get("sourceReportIds") or []) if str(item).strip()]
    zone_name = str(alert.get("zoneName") or "Zone")
    need_type = str(alert.get("needType") or "general").strip().lower() or "general"
    summary = str(alert.get("summary") or "")
    recommendation = str(alert.get("recommendedAction") or "")

    description = summary
    if recommendation:
        description = f"{summary} {recommendation}".strip()

    return {
        "title": f"Drift response · {zone_name}",
        "description": description,
        "zoneId": str(alert.get("zoneId") or ""),
        "needType": need_type,
        "targetAudience": "volunteer",
        "priority": _severity_to_priority(severity),
        "sourceReportIds": source_report_ids,
        "sourceNgoIds": [ngo_id],
        "allowAutoAssign": True,
        "estimatedDurationMinutes": 90 if severity == "critical" else 60,
        "notes": f"Created from drift alert {alert.get('ruleType')}",
        "instructions": recommendation or "Coordinate immediate response and submit follow-up verification report.",
    }
