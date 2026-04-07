from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Any

from firebase_admin import firestore

from core.firebase import db
from core.gemini import GEMINI_FLASH, client

logger = logging.getLogger("nexus.insights")

SEVERITY_ORDER = {"low": 1, "medium": 2, "high": 3, "critical": 4}


def _strip_json_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()
    return cleaned


def _serialize_firestore_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_serialize_firestore_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize_firestore_value(item) for key, item in value.items()}
    return value


def _safe_doc_id(ngo_id: str, zone_id: str) -> str:
    return f"{ngo_id}__{zone_id}".replace("/", "_")


def _get_zone_snapshot(zone_id: str) -> dict[str, Any] | None:
    snapshot = db.collection("zones").document(zone_id).get()
    if not snapshot.exists:
        return None
    return snapshot.to_dict() or {}


def _summarize_reports_for_prompt(reports: list[dict[str, Any]]) -> list[dict[str, Any]]:
    summaries = []
    for report in reports:
        summaries.append(
            {
                "id": report.get("id"),
                "needType": report.get("needType"),
                "severity": report.get("severity"),
                "familiesAffected": report.get("familiesAffected"),
                "personsAffected": report.get("personsAffected"),
                "additionalNotes": report.get("additionalNotes"),
                "createdAt": report.get("createdAt"),
            }
        )
    return summaries


def _derive_severity(reports: list[dict[str, Any]]) -> str:
    max_level = 1
    for report in reports:
        severity = str(report.get("severity") or "medium").lower()
        max_level = max(max_level, SEVERITY_ORDER.get(severity, 2))
    for label, value in SEVERITY_ORDER.items():
        if value == max_level:
            return label
    return "medium"


def _fallback_insight(zone_name: str, reports: list[dict[str, Any]]) -> dict[str, Any]:
    severity = _derive_severity(reports)
    need_counts: dict[str, int] = {}
    for report in reports:
        need = str(report.get("needType") or "general")
        need_counts[need] = need_counts.get(need, 0) + 1
    top_needs = sorted(need_counts.items(), key=lambda item: item[1], reverse=True)[:3]
    signals = [
        {
            "label": f"{name} +{count}",
            "variant": "danger" if severity in {"high", "critical"} else "warning",
        }
        for name, count in top_needs
    ]
    summary = f"New field reports in {zone_name} indicate rising {', '.join([name for name, _ in top_needs]) or 'community needs'}."
    return {
        "summary": summary,
        "signals": signals,
        "severity": "critical" if severity == "critical" else "high" if severity == "high" else "watch",
    }


def _build_gemini_insight(zone_name: str, reports: list[dict[str, Any]]) -> dict[str, Any]:
    fallback = _fallback_insight(zone_name, reports)
    safe_reports = _serialize_firestore_value(_summarize_reports_for_prompt(reports))
    prompt = (
        "Analyze the field reports for a single zone and return ONLY valid JSON with keys: "
        "summary (string), signals (list of {label, variant}), severity (critical|high|watch|resolved). "
        "Signals should be short phrases with trend indicators.\n\n"
        f"Zone: {zone_name}\n"
        f"Reports: {json.dumps(safe_reports, ensure_ascii=True)}\n"
    )

    try:
        response = client.models.generate_content(
            model=GEMINI_FLASH,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
        )
        raw = _strip_json_fences(getattr(response, "text", "") or "")
        if not raw:
            return fallback
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return fallback

        summary = str(parsed.get("summary") or fallback["summary"]).strip()
        severity = str(parsed.get("severity") or fallback["severity"]).strip().lower()
        if severity not in {"critical", "high", "watch", "resolved"}:
            severity = fallback["severity"]

        signals = parsed.get("signals")
        if not isinstance(signals, list):
            signals = fallback["signals"]

        normalized_signals = []
        for signal in signals:
            if not isinstance(signal, dict):
                continue
            label = str(signal.get("label") or "signal").strip()
            variant = str(signal.get("variant") or "info").strip().lower()
            if variant not in {"danger", "warning", "info", "success"}:
                variant = "info"
            normalized_signals.append({"label": label, "variant": variant})

        if not normalized_signals:
            normalized_signals = fallback["signals"]

        return {"summary": summary, "signals": normalized_signals, "severity": severity}
    except Exception as exc:
        logger.warning("Gemini insight synthesis failed: %s", exc)
        return fallback


def _fetch_new_reports(ngo_id: str, zone_id: str, since: datetime | None) -> list[dict[str, Any]]:
    reports: list[dict[str, Any]] = []
    query = (
        db.collection("reports")
        .where(filter=firestore.FieldFilter("ngoId", "==", ngo_id))
        .where(filter=firestore.FieldFilter("zoneId", "==", zone_id))
    )

    try:
        if since:
            query = query.where(filter=firestore.FieldFilter("createdAt", ">", since))
        query = query.order_by("createdAt", direction=firestore.Query.DESCENDING).limit(50)
        docs = list(query.stream())
    except Exception:
        # Index-free fallback: fetch by ngoId only and filter zoneId in memory.
        fallback_query = db.collection("reports").where(filter=firestore.FieldFilter("ngoId", "==", ngo_id))
        docs = list(fallback_query.stream())

    for doc in docs:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        if str(data.get("zoneId") or "") != zone_id:
            continue
        reports.append(data)

    if since:
        reports = [
            report for report in reports
            if isinstance(report.get("createdAt"), datetime) and report.get("createdAt") > since
        ]

    reports.sort(
        key=lambda report: report.get("createdAt") if isinstance(report.get("createdAt"), datetime) else datetime.min,
        reverse=True,
    )

    return reports[:50]


def synthesize_zone_insight(ngo_id: str, zone_id: str) -> dict[str, Any] | None:
    zone_data = _get_zone_snapshot(zone_id) or {}
    zone_name = str(zone_data.get("name") or zone_id)

    insight_ref = db.collection("insights").document(_safe_doc_id(ngo_id, zone_id))
    insight_snapshot = insight_ref.get()
    insight_data = insight_snapshot.to_dict() or {}

    last_synth = insight_data.get("lastSynthesizedAt")
    if isinstance(last_synth, str):
        try:
            last_synth = datetime.fromisoformat(last_synth.replace("Z", "+00:00"))
        except ValueError:
            last_synth = None

    reports = _fetch_new_reports(ngo_id, zone_id, last_synth if isinstance(last_synth, datetime) else None)
    if not reports:
        return None

    insight_payload = _build_gemini_insight(zone_name, reports)
    now = datetime.utcnow()
    latest_report_time = max(
        (report.get("createdAt") for report in reports if isinstance(report.get("createdAt"), datetime)),
        default=now,
    )

    existing_report_ids = list(insight_data.get("sourceReportIds") or [])
    new_report_ids = [report.get("id") for report in reports if report.get("id")]
    merged_report_ids = list(dict.fromkeys(existing_report_ids + new_report_ids))

    insight_doc = {
        "ngoId": ngo_id,
        "zoneId": zone_id,
        "zoneName": zone_name,
        "summary": insight_payload["summary"],
        "signals": insight_payload["signals"],
        "severity": insight_payload["severity"],
        "status": "active",
        "sourceReportIds": merged_report_ids,
        "reportCount": len(merged_report_ids),
        "sourceNgoCount": 1,
        "generatedAt": now,
        "lastSynthesizedAt": latest_report_time,
        "updatedAt": now,
    }

    insight_ref.set(insight_doc)
    return {"zoneId": zone_id, "reportsAdded": len(new_report_ids)}


def synthesize_insights_for_ngo(ngo_id: str) -> dict[str, Any]:
    zones_docs = db.collection("zones").where("ngoIds", "array_contains", ngo_id).stream()
    updated_zones = 0
    reports_added = 0

    for doc in zones_docs:
        zone_id = doc.id
        result = synthesize_zone_insight(ngo_id, zone_id)
        if result:
            updated_zones += 1
            reports_added += result.get("reportsAdded", 0)

    return {"zonesUpdated": updated_zones, "reportsAdded": reports_added}