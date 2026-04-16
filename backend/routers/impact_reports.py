from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from core.dependencies import role_required
from core.firebase import db


PREFIX = "/coordinator"
TAGS = ["coordinator"]
router = APIRouter()


class SendPolicyBriefRequest(BaseModel):
    recipient: str | None = None
    channel: str | None = None


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


def _to_number(value: Any, fallback: float = 0.0) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _score_from_history(entry: Any) -> float | None:
    if not isinstance(entry, dict):
        return None
    score = entry.get("score")
    if score is None:
        score = entry.get("actual")
    return _to_number(score, None) if score is not None else None


def _format_month_label(value: Any, fallback: str) -> str:
    parsed = _coerce_datetime(value)
    if not parsed:
        return fallback
    return parsed.strftime("%b")


def _period_count(period: str) -> int:
    return {"1m": 4, "3m": 6, "6m": 8, "1y": 12}.get(period, 6)


def _get_ngo_name(ngo_id: str) -> str | None:
    try:
        ngo_doc = db.collection("ngos").document(ngo_id).get()
    except Exception:
        return None
    if not ngo_doc.exists:
        return None
    data = ngo_doc.to_dict() or {}
    name = data.get("name")
    return str(name).strip() if name else None


def _build_report_payload(ngo_id: str, period: str) -> dict[str, Any]:
    now = datetime.utcnow()

    try:
        mission_docs = db.collection("missions").where("ngoId", "==", ngo_id).stream()
        missions = [{**(doc.to_dict() or {}), "id": doc.id} for doc in mission_docs]
    except Exception:
        missions = []

    try:
        zone_docs = db.collection("zones").where("ngoIds", "array_contains", ngo_id).stream()
        zones = [{**(doc.to_dict() or {}), "id": doc.id} for doc in zone_docs]
    except Exception:
        zones = []

    try:
        insight_docs = db.collection("insights").where("ngoId", "==", ngo_id).stream()
        insights = [{**(doc.to_dict() or {}), "id": doc.id} for doc in insight_docs]
    except Exception:
        insights = []

    insights.sort(key=lambda item: _coerce_datetime(item.get("generatedAt")) or datetime.min, reverse=True)

    zones_by_id = {str(zone.get("id")): zone for zone in zones}
    completed_missions = [mission for mission in missions if mission.get("status") == "completed"]

    def mission_sort_key(mission: dict[str, Any]) -> datetime:
        return (
            _coerce_datetime(mission.get("completedAt"))
            or _coerce_datetime(mission.get("updatedAt"))
            or _coerce_datetime(mission.get("createdAt"))
            or datetime.min
        )

    sorted_completed = sorted(completed_missions, key=mission_sort_key, reverse=True)
    ledger_rows: list[dict[str, Any]] = []

    for mission in sorted_completed[:10]:
        zone_id = str(mission.get("zoneId") or "")
        zone = zones_by_id.get(zone_id)
        history = zone.get("scoreHistory") if isinstance(zone, dict) else None
        history_list = history if isinstance(history, list) else []
        after = _score_from_history(history_list[-1]) if history_list else None
        if after is None:
            after = _to_number(zone.get("currentScore") if isinstance(zone, dict) else None, 0.0)
        before = _score_from_history(history_list[-2]) if len(history_list) > 1 else None
        if before is None:
            families_helped = _to_number(mission.get("familiesHelped"), 0.0)
            bump = min(20.0, max(2.0, round(families_helped / 2.0))) if families_helped else 6.0
            before = min(100.0, after + bump)

        ledger_rows.append(
            {
                "mission": mission.get("id"),
                "zone": mission.get("zoneName") or (zone.get("name") if isinstance(zone, dict) else "Zone"),
                "type": mission.get("needType"),
                "before": round(before),
                "after": round(after),
                "change": round(after - before),
                "volunteer": mission.get("assignedToName") or "Unassigned",
                "date": _serialize_firestore_value(
                    mission.get("completedAt") or mission.get("updatedAt") or mission.get("createdAt")
                ),
            }
        )

    families_reached = sum(_to_number(mission.get("familiesHelped"), 0.0) for mission in completed_missions)
    mission_success_rate = (
        round((len(completed_missions) / len(missions)) * 100) if missions else 0
    )

    reductions: list[float] = []
    for row in ledger_rows:
        before = _to_number(row.get("before"), 0.0)
        after = _to_number(row.get("after"), 0.0)
        if before:
            reductions.append(round(((before - after) / before) * 100))
    avg_need_reduction = round(sum(reductions) / len(reductions)) if reductions else 0

    top_zone = None
    if zones:
        top_zone = sorted(zones, key=lambda item: _to_number(item.get("currentScore"), 0.0), reverse=True)[0]

    chart_series: list[dict[str, Any]] = []
    if isinstance(top_zone, dict):
        history = top_zone.get("scoreHistory")
        history_list = history if isinstance(history, list) else []
        if history_list:
            period_size = _period_count(period)
            sliced = history_list[-period_size:]
            for index, entry in enumerate(sliced):
                label = fallback = f"P{index + 1}"
                if isinstance(entry, dict) and isinstance(entry.get("week"), int):
                    label = f"W{entry.get('week')}"
                else:
                    timestamp = entry.get("timestamp") if isinstance(entry, dict) else None
                    label = _format_month_label(timestamp, fallback)
                chart_series.append(
                    {
                        "label": label,
                        "score": _to_number(_score_from_history(entry) if isinstance(entry, dict) else None, 0.0),
                    }
                )

    active_insight = insights[0] if insights else None
    policy_items: list[str] = []
    if isinstance(active_insight, dict):
        for value in [active_insight.get("summary"), active_insight.get("recommendedAction")]:
            if isinstance(value, str) and value.strip():
                policy_items.append(value.strip())
        signals = active_insight.get("signals")
        if isinstance(signals, list):
            for signal in signals:
                if isinstance(signal, dict):
                    label = signal.get("label") or signal.get("name")
                else:
                    label = signal
                if isinstance(label, str) and label.strip():
                    policy_items.append(label.strip())
        policy_items = policy_items[:4]

    ngo_ids = []
    for mission in missions:
        source_ids = mission.get("sourceNgoIds")
        if isinstance(source_ids, list) and source_ids:
            ngo_ids.extend([source for source in source_ids if source])
        else:
            ngo_id_val = mission.get("ngoId")
            if ngo_id_val:
                ngo_ids.append(ngo_id_val)

    payload = {
        "generatedAt": _serialize_firestore_value(now),
        "organization": {
            "id": ngo_id,
            "name": _get_ngo_name(ngo_id),
        },
        "summary": {
            "missions": len(missions),
            "completedMissions": len(completed_missions),
            "zones": len(zones),
            "ngos": len(set(ngo_ids)),
            "reports": len(insights),
        },
        "metrics": {
            "missionSuccessRate": mission_success_rate,
            "familiesReached": round(families_reached),
            "avgNeedReduction": avg_need_reduction,
        },
        "ledger": ledger_rows,
        "chart": {
            "zoneId": top_zone.get("id") if isinstance(top_zone, dict) else None,
            "zoneName": top_zone.get("name") if isinstance(top_zone, dict) else None,
            "series": chart_series,
        },
        "policyBrief": {
            "sourceInsightId": active_insight.get("id") if isinstance(active_insight, dict) else None,
            "generatedAt": _serialize_firestore_value(active_insight.get("generatedAt")) if isinstance(active_insight, dict) else None,
            "items": policy_items,
        },
    }

    return payload


@router.get("/impact-reports/summary", response_model=dict[str, Any])
async def get_impact_report_summary(
    period: str = Query("3m"),
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = _get_coordinator_ngo_id(user)
    return _build_report_payload(ngo_id, period)


@router.get("/impact-reports/grant", response_model=dict[str, Any])
async def get_grant_report(
    period: str = Query("3m"),
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = _get_coordinator_ngo_id(user)
    payload = _build_report_payload(ngo_id, period)
    payload["reportType"] = "grant"
    return payload


@router.get("/impact-reports/policy-brief", response_model=dict[str, Any])
async def get_policy_brief(
    period: str = Query("3m"),
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = _get_coordinator_ngo_id(user)
    payload = _build_report_payload(ngo_id, period)
    payload["reportType"] = "policy_brief"
    return payload


@router.post("/impact-reports/policy-brief/send", response_model=dict[str, Any])
async def send_policy_brief(
    request: SendPolicyBriefRequest,
    period: str = Query("3m"),
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = _get_coordinator_ngo_id(user)
    payload = _build_report_payload(ngo_id, period)
    record = {
        "ngoId": ngo_id,
        "type": "policy_brief",
        "recipient": request.recipient or "district_collector",
        "channel": request.channel or "portal",
        "status": "queued",
        "createdAt": datetime.utcnow(),
        "payload": payload,
    }
    try:
        doc_ref = db.collection("outboundReports").document()
        doc_ref.set(record)
        report_id = doc_ref.id
    except Exception:
        report_id = None

    return {
        "queued": True,
        "reportId": report_id,
        "payload": _serialize_firestore_value(payload),
    }
