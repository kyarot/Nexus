from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from core.dependencies import role_required
from core.firebase import db
from services.notifications_hub import notify_ngo_coordinators
from services.insights_synthesis import synthesize_insights_for_ngo

PREFIX = "/coordinator"
TAGS = ["coordinator"]
router = APIRouter()


def _serialize_firestore_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_serialize_firestore_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize_firestore_value(item) for key, item in value.items()}
    return value


def _get_coordinator_ngo_id(user: dict[str, Any]) -> str:
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have an associated NGO")
    return ngo_id


def _coerce_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        except ValueError:
            return None
    return None


@router.get("/insights", response_model=dict[str, Any])
async def list_insights(
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = _get_coordinator_ngo_id(user)

    mission_report_ids: set[str] = set()
    try:
        mission_docs = db.collection("missions").where("ngoId", "==", ngo_id).stream()
        for mission_doc in mission_docs:
            mission_data = mission_doc.to_dict() or {}
            for report_id in mission_data.get("sourceReportIds") or []:
                if report_id:
                    mission_report_ids.add(str(report_id))
    except Exception:
        mission_report_ids = set()

    insights: list[dict[str, Any]] = []
    try:
        insights_docs = (
            db.collection("insights")
            .where("ngoId", "==", ngo_id)
            .order_by("generatedAt", direction="DESCENDING")
            .limit(30)
            .stream()
        )
        insight_rows = list(insights_docs)
    except Exception:
        fallback_docs = db.collection("insights").where("ngoId", "==", ngo_id).stream()
        insight_rows = list(fallback_docs)
        insight_rows.sort(
            key=lambda doc: _coerce_datetime(doc.to_dict().get("generatedAt")) or datetime.min,
            reverse=True,
        )

    for doc in insight_rows:
        data = doc.to_dict() or {}
        zone_id = str(data.get("zoneId") or "")
        insight_report_ids = [str(item) for item in (data.get("sourceReportIds") or []) if str(item).strip()]
        has_mission = any(report_id in mission_report_ids for report_id in insight_report_ids)
        report_rows: list[dict[str, Any]] = []
        if zone_id:
            try:
                reports = (
                    db.collection("reports")
                    .where("ngoId", "==", ngo_id)
                    .where("zoneId", "==", zone_id)
                    .order_by("createdAt", direction="DESCENDING")
                    .limit(5)
                    .stream()
                )
                report_docs = list(reports)
            except Exception:
                fallback_reports = (
                    db.collection("reports")
                    .where("ngoId", "==", ngo_id)
                    .stream()
                )
                report_docs = [
                    doc for doc in fallback_reports
                    if str((doc.to_dict() or {}).get("zoneId") or "") == zone_id
                ]
                report_docs.sort(
                    key=lambda doc: _coerce_datetime((doc.to_dict() or {}).get("createdAt")) or datetime.min,
                    reverse=True,
                )
                report_docs = report_docs[:5]

            for report_doc in report_docs:
                report_data = report_doc.to_dict() or {}
                report_rows.append(
                    {
                        "id": report_doc.id,
                        "needType": report_data.get("needType"),
                        "severity": report_data.get("severity"),
                        "familiesAffected": report_data.get("familiesAffected"),
                        "personsAffected": report_data.get("personsAffected"),
                        "additionalNotes": report_data.get("additionalNotes")
                        or ((report_data.get("extractedData") or {}).get("additionalNotes") if isinstance(report_data.get("extractedData"), dict) else None),
                        "createdAt": _serialize_firestore_value(report_data.get("createdAt")),
                    }
                )

        insights.append(
            {
                "id": doc.id,
                "zoneId": data.get("zoneId"),
                "zoneName": data.get("zoneName"),
                "summary": data.get("summary"),
                "signals": data.get("signals") or [],
                "severity": data.get("severity") or "watch",
                "status": data.get("status") or "active",
                "reportCount": data.get("reportCount") or 0,
                "sourceNgoCount": data.get("sourceNgoCount") or 1,
                "generatedAt": _serialize_firestore_value(data.get("generatedAt")),
                "hasMission": has_mission,
                "sourceReports": report_rows,
            }
        )

    return {"insights": insights, "total": len(insights)}


@router.post("/insights/synthesize", response_model=dict[str, Any])
async def synthesize_insights(
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = _get_coordinator_ngo_id(user)
    result = synthesize_insights_for_ngo(ngo_id)
    zones_updated = int(result.get("zonesUpdated", 0) or 0)
    reports_added = int(result.get("reportsAdded", 0) or 0)

    if zones_updated > 0:
        notify_ngo_coordinators(
            ngo_id,
            type="insight_generated",
            title="New insights generated",
            message=f"Generated insights for {zones_updated} zone(s) from {reports_added} new report(s).",
            metadata={"zonesUpdated": zones_updated, "reportsAdded": reports_added},
        )

    return {
        "updated": True,
        "zonesUpdated": zones_updated,
        "reportsAdded": reports_added,
    }
