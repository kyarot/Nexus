from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.dependencies import role_required
from core.firebase import db, rtdb
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

    insights_query = (
        db.collection("insights")
        .where("status", "==", "active")
        .where("ngoId", "==", ngo_id)
        .order_by("generatedAt", direction="DESCENDING")
        .limit(2)
    )
    recent_insights = [doc.to_dict() or {} for doc in insights_query.stream()]

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

    reports_docs = (
        db.collection("reports")
        .where("zoneId", "==", zone_id)
        .order_by("createdAt", direction="DESCENDING")
        .limit(10)
        .stream()
    )
    recent_reports: list[Report] = []

    for doc in reports_docs:
        report_data = doc.to_dict() or {}
        report_data["id"] = doc.id
        try:
            recent_reports.append(Report(**report_data))
        except Exception as exc:
            logger.warning("Could not parse report %s: %s", doc.id, exc)

    return ZoneDetailResponse(
        zone=ZoneDocument(**zone_data),
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

    history_entries: list[ZoneHistoryEntry] = []
    for entry in zone_data.get("scoreHistory", []):
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
