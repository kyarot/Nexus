from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from google.genai import types

from core.dependencies import role_required
from core.firebase import db, rtdb
from core.gemini import GEMINI_FLASH, client
from core.security import decode_access_token
from models.zone import (
    DashboardMetrics,
    HeatmapPoint,
    Report,
    SafetyInteraction,
    ZoneCreateRequest,
    ZoneDetailResponse,
    ZoneDocument,
    ZoneHistoryEntry,
    ZoneHistoryResponse,
    ZoneRiskLevel,
)

PREFIX = "/coordinator"
TAGS = ["coordinator"]
router = APIRouter()
logger = logging.getLogger("nexus.zones")


def _coerce_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if hasattr(value, "to_datetime"):
        try:
            converted = value.to_datetime()
            return converted.replace(tzinfo=None) if getattr(converted, "tzinfo", None) else converted
        except Exception:
            return None
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        except ValueError:
            return None
    return None


def _coordinator_user_from_token(token: str) -> tuple[dict[str, Any], str]:
    jwt_payload = decode_access_token(token)
    if not jwt_payload or not isinstance(jwt_payload.get("sub"), str):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid stream token")

    uid = str(jwt_payload["sub"])
    user_snapshot = db.collection("users").document(uid).get()
    if not user_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    user = user_snapshot.to_dict() or {}
    user.setdefault("id", uid)
    if user.get("role") != "coordinator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Coordinator role required")

    ngo_id = get_coordinator_ngo_id(user)
    return user, ngo_id


def _latest_zone_update_marker(ngo_id: str) -> str:
    zones_docs = db.collection("zones").where("ngoIds", "array_contains", ngo_id).stream()
    latest = datetime.min
    for doc in zones_docs:
        zone = doc.to_dict() or {}
        updated = _coerce_datetime(zone.get("updatedAt"))
        if updated and updated.tzinfo:
            updated = updated.replace(tzinfo=None)
        if updated and updated > latest:
            latest = updated
    return latest.isoformat() if latest != datetime.min else ""


def _relative_time_label(timestamp: datetime | None) -> str:
    if not timestamp:
        return "just now"
    delta = datetime.utcnow() - timestamp
    total_minutes = int(max(0, delta.total_seconds() // 60))
    if total_minutes < 1:
        return "just now"
    if total_minutes < 60:
        return f"{total_minutes}m ago"
    hours = total_minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    return f"{days}d ago"


def _initials(name: str) -> str:
    parts = [part for part in str(name or "").strip().split() if part]
    if not parts:
        return "NA"
    return "".join(part[0] for part in parts[:2]).upper()


def _fetch_zone_reports(zone_id: str, limit: int) -> list[dict[str, Any]]:
    # Avoid composite index dependency on (zoneId, createdAt) by sorting in memory.
    reports_snapshot = db.collection("reports").where("zoneId", "==", zone_id).limit(max(limit * 6, limit)).stream()
    reports: list[dict[str, Any]] = []
    for doc in reports_snapshot:
        record = doc.to_dict() or {}
        record["id"] = doc.id
        reports.append(record)
    reports.sort(
        key=lambda item: _coerce_datetime(item.get("createdAt")) or datetime.min,
        reverse=True,
    )
    for report in reports:
        created_at = report.get("createdAt")
        if isinstance(created_at, datetime):
            report["createdAt"] = created_at.isoformat()
        updated_at = report.get("updatedAt")
        if isinstance(updated_at, datetime):
            report["updatedAt"] = updated_at.isoformat()
    return reports[:limit]
def get_coordinator_ngo_id(user: dict[str, Any]) -> str:
    ngo_id = user.get("ngoId") or user.get("ngo_id")
    if not ngo_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have an associated NGO",
        )
    return ngo_id


def _default_safety_profile() -> dict[str, Any]:
    return {
        "score": 50,
        "level": "moderate",
        "interactions": [],
        "timeOfDayFlags": {"night": False, "early_morning": False},
        "specificFlags": [],
    }


def validate_zone_belongs_to_ngo(zone: dict[str, Any], ngo_id: str) -> None:
    ngo_ids = zone.get("ngoIds", [])
    if ngo_id not in ngo_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Zone does not belong to your NGO",
        )


@router.get("/dashboard", response_model=DashboardMetrics)
async def get_coordinator_dashboard(
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> DashboardMetrics:
    ngo_id = get_coordinator_ngo_id(user)

    zones_docs = db.collection("zones").where("ngoIds", "array_contains", ngo_id).stream()
    zones = [{"id": doc.id, **(doc.to_dict() or {})} for doc in zones_docs]

    avg_zone_score = 0.0
    zones_at_risk = 0
    critical_zones: list[dict[str, Any]] = []

    if zones:
        total_score = sum(zone.get("currentScore", 0) for zone in zones)
        avg_zone_score = total_score / len(zones)

        for zone in zones:
            score = zone.get("currentScore", 0)
            if score > 70:
                zones_at_risk += 1
            if zone.get("riskLevel") == "critical":
                critical_zones.append(
                    {
                        "id": zone.get("id"),
                        "name": zone.get("name"),
                        "score": score,
                        "riskLevel": zone.get("riskLevel"),
                    }
                )

    missions_docs = db.collection("missions").where("ngoId", "==", ngo_id).where("status", "==", "active").stream()
    active_missions = len(list(missions_docs))

    # Avoid composite index dependency on (ngoId, status, generatedAt) for local/dev environments.
    insights_docs = db.collection("insights").where("ngoId", "==", ngo_id).limit(80).stream()
    active_insights: list[dict[str, Any]] = []
    all_insights: list[dict[str, Any]] = []

    for doc in insights_docs:
        record = doc.to_dict() or {}
        all_insights.append(record)
        status = str(record.get("status") or "").lower()
        if not status or status == "active":
            active_insights.append(record)

    candidates = active_insights or all_insights
    candidates.sort(
        key=lambda item: _coerce_datetime(item.get("generatedAt")) or datetime.min,
        reverse=True,
    )
    recent_insights = candidates[:2]

    available_volunteers = 0
    try:
        rtdb_presence = rtdb.child("volunteerPresence").get() or {}
        if isinstance(rtdb_presence, dict):
            for presence_data in rtdb_presence.values():
                if isinstance(presence_data, dict) and presence_data.get("available") is True:
                    available_volunteers += 1
    except Exception as exc:
        logger.warning("Could not fetch volunteer presence: %s", exc)

    return DashboardMetrics(
        avgZoneScore=round(avg_zone_score, 2),
        zonesAtRisk=zones_at_risk,
        activeMissions=active_missions,
        availableVolunteers=available_volunteers,
        recentInsights=recent_insights,
        zoneCount=len(zones),
        criticalZones=critical_zones,
    )


@router.get("/zones", response_model=dict[str, Any])
async def get_coordinator_zones(
    user: dict[str, Any] = Depends(role_required("coordinator")),
    risk_filter: Optional[str] = Query(None),
) -> dict[str, Any]:
    ngo_id = get_coordinator_ngo_id(user)

    zones_docs = db.collection("zones").where("ngoIds", "array_contains", ngo_id).stream()
    zones_list: list[ZoneDocument] = []

    for doc in zones_docs:
        zone_data = doc.to_dict() or {}
        zone_data["id"] = doc.id

        if risk_filter and zone_data.get("riskLevel") != risk_filter:
            continue

        try:
            zones_list.append(ZoneDocument(**zone_data))
        except Exception as exc:
            logger.warning("Could not parse zone %s: %s", doc.id, exc)

    return {
        "zones": [zone.model_dump() for zone in zones_list],
        "total": len(zones_list),
    }


@router.post("/zones", response_model=ZoneDocument, status_code=status.HTTP_201_CREATED)
async def create_zone(
    payload: ZoneCreateRequest,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> ZoneDocument:
    ngo_id = get_coordinator_ngo_id(user)
    zone_ref = db.collection("zones").document()
    now = datetime.utcnow().isoformat()

    zone_data = {
        "name": payload.name,
        "ward": payload.ward,
        "city": payload.city,
        "ngoIds": [ngo_id],
        "currentScore": payload.currentScore,
        "riskLevel": payload.riskLevel.value if isinstance(payload.riskLevel, ZoneRiskLevel) else str(payload.riskLevel),
        "scoreHistory": [],
        "signalCounts": {"food": 0, "education": 0, "health": 0, "substance": 0, "shelter": 0, "safety": 0},
        "activeMissions": 0,
        "lastIntervention": None,
        "forecastScore": payload.currentScore,
        "forecastConfidence": 50,
        "generationalCohort": payload.generationalCohort,
        "safetyProfile": _default_safety_profile(),
        "geometry": payload.geometry,
        "lat": payload.lat,
        "lng": payload.lng,
        "updatedAt": now,
        "createdAt": now,
    }

    zone_ref.set(zone_data)
    zone_data["id"] = zone_ref.id
    logger.info("Created zone %s for NGO %s", zone_ref.id, ngo_id)
    return ZoneDocument.model_validate(zone_data)


@router.get("/zones/heatmap", response_model=list[HeatmapPoint])
async def get_zones_heatmap(
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> list[HeatmapPoint]:
    ngo_id = get_coordinator_ngo_id(user)

    zones_docs = db.collection("zones").where("ngoIds", "array_contains", ngo_id).stream()
    heatmap_points: list[HeatmapPoint] = []

    for doc in zones_docs:
        zone_data = doc.to_dict() or {}
        try:
            heatmap_points.append(
                HeatmapPoint(
                    lat=zone_data.get("lat", 0.0),
                    lng=zone_data.get("lng", 0.0),
                    weight=zone_data.get("currentScore", 0) / 100.0,
                    zoneId=doc.id,
                    name=zone_data.get("name", "Unknown Zone"),
                    riskLevel=zone_data.get("riskLevel", "low"),
                )
            )
        except Exception as exc:
            logger.warning("Could not create heatmap point for zone %s: %s", doc.id, exc)

    return heatmap_points


@router.get("/terrain/snapshot", response_model=dict[str, Any])
async def get_terrain_snapshot(
    user: dict[str, Any] = Depends(role_required("coordinator")),
    need_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    confidence_min: int = Query(0, ge=0, le=100),
    since_hours: int = Query(168, ge=1, le=720),
    limit_points: int = Query(1000, ge=100, le=5000),
) -> dict[str, Any]:
    ngo_id = get_coordinator_ngo_id(user)

    zones_docs = db.collection("zones").where("ngoIds", "array_contains", ngo_id).stream()
    zones: list[dict[str, Any]] = []
    zone_ids: set[str] = set()
    for doc in zones_docs:
        zone_data = doc.to_dict() or {}
        zone_data["id"] = doc.id
        zone_ids.add(doc.id)
        zones.append(zone_data)

    points_query = (
        db.collection("terrainSignals")
        .order_by("updatedAt", direction="DESCENDING")
        .limit(limit_points)
        .stream()
    )

    threshold = datetime.utcnow() - timedelta(hours=since_hours)
    normalized_need = str(need_type or "").strip().lower()
    normalized_severity = str(severity or "").strip().lower()

    terrain_points: list[dict[str, Any]] = []
    for doc in points_query:
        item = doc.to_dict() or {}
        zone_id = str(item.get("zoneId") or "").strip()
        if zone_id not in zone_ids:
            continue
        if normalized_need and str(item.get("needType") or "").strip().lower() != normalized_need:
            continue
        if normalized_severity and str(item.get("severity") or "").strip().lower() != normalized_severity:
            continue
        if int(item.get("confidence") or 0) < confidence_min:
            continue

        updated_at = _coerce_datetime(item.get("updatedAt") or item.get("createdAt"))
        if updated_at and updated_at.tzinfo:
            updated_at = updated_at.replace(tzinfo=None)
        if updated_at and updated_at < threshold:
            continue

        terrain_points.append(
            {
                "id": doc.id,
                "reportId": item.get("reportId"),
                "zoneId": zone_id,
                "needType": item.get("needType") or "general",
                "severity": item.get("severity") or "medium",
                "riskLevel": item.get("riskLevel") or "low",
                "lat": float(item.get("lat") or 0.0),
                "lng": float(item.get("lng") or 0.0),
                "weight": float(item.get("weight") or 0.0),
                "confidence": int(item.get("confidence") or 0),
                "familiesAffected": int(item.get("familiesAffected") or 0),
                "personsAffected": int(item.get("personsAffected") or 0),
                "minUrgencyWindowHours": int(item.get("minUrgencyWindowHours") or 72),
                "riskFlags": item.get("riskFlags") if isinstance(item.get("riskFlags"), list) else [],
                "updatedAt": item.get("updatedAt"),
            }
        )

    zone_overview = []
    for zone in zones:
        zone_overview.append(
            {
                "id": zone.get("id"),
                "name": zone.get("name"),
                "ward": zone.get("ward"),
                "city": zone.get("city"),
                "lat": float(zone.get("lat") or 0.0),
                "lng": float(zone.get("lng") or 0.0),
                "riskLevel": zone.get("riskLevel", "low"),
                "currentScore": float(zone.get("currentScore") or 0.0),
                "trendDirection": zone.get("trendDirection") or "stable",
                "terrainConfidence": float(zone.get("terrainConfidence") or 0.0),
                "reportVolume7d": int(zone.get("reportVolume7d") or 0),
                "topNeeds": zone.get("topNeeds") if isinstance(zone.get("topNeeds"), list) else [],
                "signalCounts": zone.get("signalCounts") if isinstance(zone.get("signalCounts"), dict) else {},
                "geometry": zone.get("geometry"),
                "updatedAt": zone.get("updatedAt"),
            }
        )

    return {
        "generatedAt": datetime.utcnow().isoformat(),
        "zones": zone_overview,
        "points": terrain_points,
        "totalZones": len(zone_overview),
        "totalPoints": len(terrain_points),
    }


@router.get("/terrain/zones/{zone_id}", response_model=dict[str, Any])
async def get_terrain_zone_detail(
    zone_id: str,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = get_coordinator_ngo_id(user)

    zone_doc = db.collection("zones").document(zone_id).get()
    if not zone_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found",
        )

    zone_data = zone_doc.to_dict() or {}
    validate_zone_belongs_to_ngo(zone_data, ngo_id)
    zone_data["id"] = zone_id

    points_snapshot = (
        db.collection("terrainSignals")
        .where("zoneId", "==", zone_id)
        .limit(300)
        .stream()
    )
    points = [doc.to_dict() or {} for doc in points_snapshot]
    points.sort(
        key=lambda item: _coerce_datetime(item.get("updatedAt") or item.get("createdAt")) or datetime.min,
        reverse=True,
    )
    points = points[:150]

    unmet_by_need: dict[str, int] = {}
    for point in points:
        key = str(point.get("needType") or "general").strip().lower()
        unmet_by_need[key] = unmet_by_need.get(key, 0) + 1

    top_unmet_needs = [
        {"needType": need_type, "count": count}
        for need_type, count in sorted(unmet_by_need.items(), key=lambda item: item[1], reverse=True)[:6]
    ]

    recent_reports = []
    for report in _fetch_zone_reports(zone_id, 12):
        recent_reports.append(
            {
                "id": report.get("id"),
                "needType": report.get("needType"),
                "severity": report.get("severity"),
                "familiesAffected": report.get("familiesAffected"),
                "personsAffected": report.get("personsAffected"),
                "confidence": report.get("confidence"),
                "createdAt": report.get("createdAt").isoformat() if isinstance(report.get("createdAt"), datetime) else report.get("createdAt"),
            }
        )

    return {
        "zone": zone_data,
        "topUnmetNeeds": top_unmet_needs,
        "recentReports": recent_reports,
        "points": points,
    }


@router.get("/terrain/zones/{zone_id}/narrative", response_model=dict[str, Any])
async def get_terrain_zone_narrative(
    zone_id: str,
    force_refresh: bool = Query(False),
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = get_coordinator_ngo_id(user)

    zone_ref = db.collection("zones").document(zone_id)
    zone_doc = zone_ref.get()
    if not zone_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")

    zone_data = zone_doc.to_dict() or {}
    validate_zone_belongs_to_ngo(zone_data, ngo_id)

    cached_narrative = zone_data.get("terrainNarrative")
    cached_at = _coerce_datetime(zone_data.get("terrainNarrativeUpdatedAt"))
    if (
        not force_refresh
        and isinstance(cached_narrative, dict)
        and cached_at
        and (datetime.utcnow() - cached_at) < timedelta(minutes=20)
    ):
        return {"narrative": cached_narrative, "source": "cache", "updatedAt": cached_at.isoformat()}

    points_snapshot = (
        db.collection("terrainSignals")
        .where("zoneId", "==", zone_id)
        .limit(120)
        .stream()
    )
    points = [doc.to_dict() or {} for doc in points_snapshot]

    top_need_counts: dict[str, int] = {}
    for point in points:
        key = str(point.get("needType") or "general").strip().lower()
        top_need_counts[key] = top_need_counts.get(key, 0) + 1
    top_needs = [name for name, _ in sorted(top_need_counts.items(), key=lambda item: item[1], reverse=True)[:4]]

    stats = {
        "zoneName": zone_data.get("name"),
        "riskLevel": zone_data.get("riskLevel", "low"),
        "currentScore": float(zone_data.get("currentScore") or 0.0),
        "trendDirection": zone_data.get("trendDirection") or "stable",
        "terrainConfidence": float(zone_data.get("terrainConfidence") or 0.0),
        "reportVolume7d": int(zone_data.get("reportVolume7d") or 0),
        "topNeeds": top_needs,
        "signalCounts": zone_data.get("signalCounts") if isinstance(zone_data.get("signalCounts"), dict) else {},
    }

    try:
        prompt = (
            "You are generating a short operations narrative for an NGO coordinator terrain dashboard. "
            "Keep it practical, concise, and evidence-based. "
            "Return JSON only with keys: summary, highlights (list of max 3), actions (list of max 3), confidenceLabel.\n"
            f"Zone metrics: {json.dumps(stats)}"
        )

        response = client.models.generate_content(
            model=GEMINI_FLASH,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
        )
        generated_text = getattr(response, "text", "") or "{}"
        narrative = json.loads(generated_text)
        if not isinstance(narrative, dict):
            raise ValueError("Invalid narrative payload")
    except Exception as exc:
        logger.warning("Gemini terrain narrative fallback for zone %s: %s", zone_id, exc)
        narrative = {
            "summary": f"{stats['zoneName']} is currently {stats['riskLevel']} risk with score {round(stats['currentScore'])}/100.",
            "highlights": [
                f"Trend is {stats['trendDirection']}",
                f"Top needs: {', '.join(top_needs) if top_needs else 'insufficient data'}",
                f"Recent report volume (7d): {stats['reportVolume7d']}",
            ],
            "actions": [
                "Validate high-severity signals from latest reports",
                "Prioritize clusters with low confidence for field re-verification",
                "Monitor terrain score movement over the next 24 hours",
            ],
            "confidenceLabel": "fallback",
        }

    now_iso = datetime.utcnow().isoformat()
    zone_ref.update({"terrainNarrative": narrative, "terrainNarrativeUpdatedAt": now_iso})
    return {"narrative": narrative, "source": "generated", "updatedAt": now_iso}


@router.get("/terrain/zones/{zone_id}/sidebar", response_model=dict[str, Any])
async def get_terrain_zone_sidebar(
    zone_id: str,
    force_refresh: bool = Query(False),
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = get_coordinator_ngo_id(user)

    zone_ref = db.collection("zones").document(zone_id)
    zone_doc = zone_ref.get()
    if not zone_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")

    zone_data = zone_doc.to_dict() or {}
    validate_zone_belongs_to_ngo(zone_data, ngo_id)
    zone_data["id"] = zone_id

    reports = _fetch_zone_reports(zone_id, 40)

    points_snapshot = db.collection("terrainSignals").where("zoneId", "==", zone_id).limit(400).stream()
    points = [doc.to_dict() or {} for doc in points_snapshot]

    need_counts: dict[str, int] = {}
    for point in points:
        need = str(point.get("needType") or "general").strip().lower()
        need_counts[need] = need_counts.get(need, 0) + 1
    category = (zone_data.get("topNeeds") or [None])[0] or (max(need_counts.items(), key=lambda item: item[1])[0] if need_counts else "general")

    now = datetime.utcnow()
    buckets = [0] * 8
    for point in points:
        point_time = _coerce_datetime(point.get("updatedAt") or point.get("createdAt"))
        if not point_time:
            continue
        hours_ago = (now - point_time).total_seconds() / 3600
        if hours_ago < 0 or hours_ago >= 8:
            continue
        index = max(0, min(7, 7 - int(hours_ago)))
        point_weight = float(point.get("weight") or 0.0)
        buckets[index] += max(1, int(round(point_weight * 8)))

    label_points = []
    for index, value in enumerate(buckets):
        hour = (now - timedelta(hours=(7 - index))).strftime("%I:%M %p")
        label_points.append({"label": hour, "value": value})

    missions_snapshot = db.collection("missions").where("zoneId", "==", zone_id).limit(60).stream()
    active_statuses = {"dispatched", "en_route", "on_ground"}
    active_responders: list[dict[str, Any]] = []
    seen_user_ids: set[str] = set()
    active_missions = 0
    for mission_doc in missions_snapshot:
        mission = mission_doc.to_dict() or {}
        status = str(mission.get("status") or "").strip().lower()
        if status not in active_statuses:
            continue
        active_missions += 1
        assignee = str(mission.get("assignedTo") or "").strip()
        if not assignee or assignee in seen_user_ids:
            continue
        seen_user_ids.add(assignee)
        user_doc = db.collection("users").document(assignee).get()
        user_data = user_doc.to_dict() if user_doc.exists else {}
        responder_name = str((user_data or {}).get("name") or mission.get("assignedToName") or "Responder")
        active_responders.append(
            {
                "id": assignee,
                "name": responder_name,
                "initials": _initials(responder_name),
                "photoUrl": (user_data or {}).get("photoUrl"),
            }
        )
        if len(active_responders) >= 5:
            break

    cached_sidebar = zone_data.get("terrainSidebar")
    cached_at = _coerce_datetime(zone_data.get("terrainSidebarUpdatedAt"))
    if (
        not force_refresh
        and isinstance(cached_sidebar, dict)
        and cached_at
        and (datetime.utcnow() - cached_at) < timedelta(minutes=8)
    ):
        narrative = cached_sidebar.get("narrative") if isinstance(cached_sidebar.get("narrative"), dict) else {}
    else:
        prompt_payload = {
            "zoneName": zone_data.get("name"),
            "riskLevel": zone_data.get("riskLevel", "low"),
            "currentScore": float(zone_data.get("currentScore") or 0.0),
            "trendDirection": zone_data.get("trendDirection") or "stable",
            "terrainConfidence": float(zone_data.get("terrainConfidence") or 0.0),
            "topNeeds": zone_data.get("topNeeds") if isinstance(zone_data.get("topNeeds"), list) else [],
            "signalCounts": zone_data.get("signalCounts") if isinstance(zone_data.get("signalCounts"), dict) else {},
            "reportSample": [
                {
                    "needType": item.get("needType"),
                    "severity": item.get("severity"),
                    "familiesAffected": item.get("familiesAffected"),
                    "createdAt": item.get("createdAt").isoformat() if isinstance(item.get("createdAt"), datetime) else item.get("createdAt"),
                }
                for item in reports[:10]
            ],
        }
        try:
            response = client.models.generate_content(
                model=GEMINI_FLASH,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
                contents=[
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": (
                                    "Create concise NGO terrain sidebar intelligence in JSON with keys: "
                                    "summary, etaSignal, highlights (max 3), actions (max 3). "
                                    "Keep it data-driven and non-fictional. Input: "
                                    f"{json.dumps(prompt_payload)}"
                                )
                            }
                        ],
                    }
                ],
            )
            narrative_raw = json.loads((getattr(response, "text", "") or "{}").strip())
            if not isinstance(narrative_raw, dict):
                raise ValueError("Invalid Gemini sidebar payload")
            narrative = {
                "summary": str(narrative_raw.get("summary") or ""),
                "etaSignal": str(narrative_raw.get("etaSignal") or ""),
                "highlights": [str(item) for item in (narrative_raw.get("highlights") or [])][:3],
                "actions": [str(item) for item in (narrative_raw.get("actions") or [])][:3],
            }
        except Exception as exc:
            logger.warning("Gemini sidebar fallback for zone %s: %s", zone_id, exc)
            narrative = {
                "summary": f"{zone_data.get('name') or 'This zone'} is {zone_data.get('riskLevel', 'low')} risk with score {round(float(zone_data.get('currentScore') or 0.0))}/100 based on recent reports.",
                "etaSignal": "Risk may increase in 24-48h if high-severity reports continue.",
                "highlights": [
                    f"Top category: {str(category).upper()}",
                    f"Active missions: {active_missions}",
                    f"Signals tracked: {len(points)}",
                ],
                "actions": [
                    "Validate highest-severity households first",
                    "Prioritize responders near dense report clusters",
                    "Monitor trend direction over next 6 hours",
                ],
            }

        zone_ref.update({"terrainSidebar": {"narrative": narrative}, "terrainSidebarUpdatedAt": datetime.utcnow().isoformat()})

    updated_at = _coerce_datetime(zone_data.get("updatedAt"))
    return {
        "zone": {
            "id": zone_id,
            "name": zone_data.get("name"),
            "ward": zone_data.get("ward"),
            "city": zone_data.get("city"),
            "riskLevel": zone_data.get("riskLevel", "low"),
            "currentScore": float(zone_data.get("currentScore") or 0.0),
            "updatedAt": zone_data.get("updatedAt"),
            "trendDirection": zone_data.get("trendDirection") or "stable",
            "signalCounts": zone_data.get("signalCounts") if isinstance(zone_data.get("signalCounts"), dict) else {},
            "activeMissions": active_missions,
            "safetyProfile": zone_data.get("safetyProfile") if isinstance(zone_data.get("safetyProfile"), dict) else {},
        },
        "badges": {
            "category": str(category).upper(),
            "riskPercent": int(round(float(zone_data.get("currentScore") or 0.0))),
            "lastUpdateLabel": _relative_time_label(updated_at),
        },
        "narrative": narrative,
        "activeResponders": active_responders,
        "incidentFrequency": label_points,
        "recentReports": [
            {
                "needType": item.get("needType"),
                "severity": item.get("severity"),
                "createdAt": item.get("createdAt").isoformat() if isinstance(item.get("createdAt"), datetime) else item.get("createdAt"),
            }
            for item in reports[:6]
        ],
    }


@router.get("/terrain/stream")
async def terrain_stream(
    request: Request,
    token: str = Query(..., min_length=10),
) -> StreamingResponse:
    _, ngo_id = _coordinator_user_from_token(token)

    async def event_generator():
        last_marker = ""
        while True:
            if await request.is_disconnected():
                break

            marker = _latest_zone_update_marker(ngo_id)
            if marker != last_marker:
                payload = {"type": "terrain_update", "updatedAt": marker}
                last_marker = marker
            else:
                payload = {"type": "heartbeat", "updatedAt": marker}

            yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(3)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/zones/{zone_id}", response_model=ZoneDetailResponse)
async def get_zone_detail(
    zone_id: str,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> ZoneDetailResponse:
    ngo_id = get_coordinator_ngo_id(user)

    zone_doc = db.collection("zones").document(zone_id).get()
    if not zone_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found",
        )

    zone_data = zone_doc.to_dict() or {}
    validate_zone_belongs_to_ngo(zone_data, ngo_id)
    zone_data["id"] = zone_id

    reports_data = _fetch_zone_reports(zone_id, 10)
    recent_reports: list[Report] = []

    for report_data in reports_data:
        try:
            recent_reports.append(Report(**report_data))
        except Exception as exc:
            logger.warning("Could not parse report for zone %s: %s", zone_id, exc)

    try:
        zone_payload = ZoneDocument(**zone_data)
    except Exception as exc:
        logger.warning("Could not parse zone %s with ZoneDocument: %s", zone_id, exc)
        zone_payload = ZoneDocument.model_validate(
            {
                "id": zone_id,
                "name": zone_data.get("name", "Unknown Zone"),
                "ward": zone_data.get("ward", ""),
                "city": zone_data.get("city", ""),
                "ngoIds": zone_data.get("ngoIds") if isinstance(zone_data.get("ngoIds"), list) else [],
                "currentScore": float(zone_data.get("currentScore") or 0.0),
                "riskLevel": zone_data.get("riskLevel", "low"),
                "scoreHistory": zone_data.get("scoreHistory") if isinstance(zone_data.get("scoreHistory"), list) else [],
                "signalCounts": zone_data.get("signalCounts") if isinstance(zone_data.get("signalCounts"), dict) else {},
                "activeMissions": int(zone_data.get("activeMissions") or 0),
                "lastIntervention": zone_data.get("lastIntervention"),
                "forecastScore": float(zone_data.get("forecastScore") or 0.0),
                "forecastConfidence": float(zone_data.get("forecastConfidence") or 0.0),
                "generationalCohort": zone_data.get("generationalCohort", ""),
                "safetyProfile": zone_data.get("safetyProfile") if isinstance(zone_data.get("safetyProfile"), dict) else _default_safety_profile(),
                "geometry": zone_data.get("geometry"),
                "lat": float(zone_data.get("lat") or 0.0),
                "lng": float(zone_data.get("lng") or 0.0),
                "updatedAt": zone_data.get("updatedAt", ""),
            }
        )

    return ZoneDetailResponse(
        zone=zone_payload,
        recentReports=recent_reports,
    )


@router.patch("/zones/{zone_id}", response_model=dict[str, Any])
async def update_zone(
    zone_id: str,
    update_data: dict[str, Any],
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = get_coordinator_ngo_id(user)

    zone_doc = db.collection("zones").document(zone_id).get()
    if not zone_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found",
        )

    zone_data = zone_doc.to_dict() or {}
    validate_zone_belongs_to_ngo(zone_data, ngo_id)

    updates: dict[str, Any] = {}

    if "name" in update_data:
        name = str(update_data.get("name") or "").strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Zone name cannot be empty",
            )
        updates["name"] = name

    if "ward" in update_data:
        updates["ward"] = str(update_data.get("ward") or "").strip()

    if "city" in update_data:
        updates["city"] = str(update_data.get("city") or "").strip()

    if "lat" in update_data:
        try:
            updates["lat"] = float(update_data.get("lat") or 0.0)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid lat value",
            )

    if "lng" in update_data:
        try:
            updates["lng"] = float(update_data.get("lng") or 0.0)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid lng value",
            )

    if "currentScore" in update_data:
        try:
            score = float(update_data.get("currentScore") or 0.0)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid currentScore value",
            )
        updates["currentScore"] = max(0.0, min(100.0, score))

    if "topNeeds" in update_data:
        needs = update_data.get("topNeeds")
        if not isinstance(needs, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="topNeeds must be a list",
            )
        updates["topNeeds"] = [str(item).strip() for item in needs if str(item).strip()]

    if "riskLevel" in update_data:
        risk_level = update_data["riskLevel"]
        if risk_level not in [level.value for level in ZoneRiskLevel]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid riskLevel: {risk_level}",
            )
        updates["riskLevel"] = risk_level

    if "safetyProfile" in update_data:
        safety_profile_data = update_data["safetyProfile"] or {}

        if "interactions" in safety_profile_data:
            interactions = safety_profile_data["interactions"] or []
            if interactions:
                sentiment_scores = {
                    "positive": 70,
                    "neutral": 50,
                    "negative": 30,
                }
                avg_sentiment_score = sum(
                    sentiment_scores.get(interaction.get("sentiment", "neutral"), 50)
                    for interaction in interactions
                ) / len(interactions)
                safety_profile_data["score"] = int(avg_sentiment_score)
            else:
                safety_profile_data["score"] = 50

        updates["safetyProfile"] = safety_profile_data

    updates["updatedAt"] = datetime.utcnow().isoformat()

    db.collection("zones").document(zone_id).update(updates)
    logger.info("Updated zone %s with updates: %s", zone_id, updates)

    return {"updated": True}


@router.get("/zones/{zone_id}/history", response_model=ZoneHistoryResponse)
async def get_zone_history(
    zone_id: str,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> ZoneHistoryResponse:
    ngo_id = get_coordinator_ngo_id(user)

    zone_doc = db.collection("zones").document(zone_id).get()
    if not zone_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found",
        )

    zone_data = zone_doc.to_dict() or {}
    validate_zone_belongs_to_ngo(zone_data, ngo_id)

    raw_history = zone_data.get("scoreHistory") if isinstance(zone_data.get("scoreHistory"), list) else []
    normalized_history: list[dict[str, Any]] = []
    for index, entry in enumerate(raw_history[-8:], start=1):
        score = float(entry.get("score") or entry.get("actual") or 0)
        actual = entry.get("actual") if entry.get("actual") is not None else score
        normalized_history.append({"week": index, "score": score, "actual": actual})

    history_entries: list[ZoneHistoryEntry] = []
    for entry in normalized_history:
        try:
            history_entries.append(
                ZoneHistoryEntry(
                    week=entry.get("week", 0),
                    score=entry.get("score", 0),
                    actual=entry.get("actual"),
                )
            )
        except Exception as exc:
            logger.warning("Could not parse history entry: %s", exc)

    return ZoneHistoryResponse(zoneId=zone_id, history=history_entries)
