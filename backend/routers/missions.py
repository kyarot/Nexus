from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.dependencies import role_required
from core.firebase import db
from models.mission import (
    MissionCandidate,
    MissionCreateRequest,
    MissionCreateResponse,
    MissionDocument,
    MissionListResponse,
    MissionPriority,
    MissionStatus,
)
from models.zone import ZoneDocument

PREFIX = "/coordinator"
TAGS = ["coordinator"]
router = APIRouter()
logger = logging.getLogger("nexus.missions")

ACTIVE_MISSION_STATUSES = {MissionStatus.dispatched.value, MissionStatus.en_route.value, MissionStatus.on_ground.value}


def _now() -> datetime:
    return datetime.utcnow()


def _get_coordinator_ngo_id(user: dict[str, Any]) -> str:
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have an associated NGO")
    return ngo_id


def _read_timestamp(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    return None


def _mission_sort_key(mission: dict[str, Any]) -> tuple[int, datetime]:
    priority_rank = {
        "critical": 4,
        "high": 3,
        "medium": 2,
        "low": 1,
    }
    priority = str(mission.get("priority") or "medium").lower()
    timestamp = _read_timestamp(mission.get("updatedAt") or mission.get("createdAt")) or datetime.min
    return (priority_rank.get(priority, 2), timestamp)


def _mission_from_doc(doc_id: str, data: dict[str, Any]) -> MissionDocument:
    location = data.get("location") or {}
    resources = data.get("resources") or []
    if resources and isinstance(resources[0], str):
        resources = [{"name": item} for item in resources]

    return MissionDocument(
        id=doc_id,
        ngoId=str(data.get("ngoId") or ""),
        creatorId=str(data.get("creatorId") or data.get("createdBy") or ""),
        creatorName=data.get("creatorName"),
        title=str(data.get("title") or "Untitled Mission"),
        description=str(data.get("description") or ""),
        zoneId=str(data.get("zoneId") or ""),
        zoneName=str(data.get("zoneName") or ""),
        ward=str(data.get("ward") or ""),
        city=str(data.get("city") or ""),
        needType=str(data.get("needType") or ""),
        targetAudience=str(data.get("targetAudience") or "fieldworker"),
        priority=str(data.get("priority") or "high"),
        status=str(data.get("status") or "pending"),
        assignedTo=data.get("assignedTo"),
        assignedToName=data.get("assignedToName"),
        assignedVolunteerMatch=int(data.get("assignedVolunteerMatch") or 0),
        assignedVolunteerDistance=data.get("assignedVolunteerDistance"),
        assignedVolunteerReason=data.get("assignedVolunteerReason"),
        resources=resources,
        sourceReportIds=list(data.get("sourceReportIds") or []),
        sourceNgoIds=list(data.get("sourceNgoIds") or []),
        location=location,
        instructions=data.get("instructions"),
        notes=data.get("notes"),
        estimatedDurationMinutes=int(data.get("estimatedDurationMinutes") or 45),
        progress=int(data.get("progress") or 0),
        statusText=data.get("statusText"),
        familiesHelped=int(data.get("familiesHelped") or 0),
        outcomeNotes=data.get("outcomeNotes"),
        mergedFrom=data.get("mergedFrom"),
        newUpdates=int(data.get("newUpdates") or 0),
        createdAt=_read_timestamp(data.get("createdAt")),
        updatedAt=_read_timestamp(data.get("updatedAt")),
        dispatchedAt=_read_timestamp(data.get("dispatchedAt")),
        startedAt=_read_timestamp(data.get("startedAt")),
        completedAt=_read_timestamp(data.get("completedAt")),
        autoAssigned=bool(data.get("autoAssigned") or False),
    )


def _serialize_mission(mission: MissionDocument) -> dict[str, Any]:
    payload = mission.model_dump()
    for key in ["createdAt", "updatedAt", "dispatchedAt", "startedAt", "completedAt"]:
        value = payload.get(key)
        if isinstance(value, datetime):
            payload[key] = value.isoformat()
    return payload


def _get_zone(zone_id: str, ngo_id: str) -> ZoneDocument:
    zone_snapshot = db.collection("zones").document(zone_id).get()
    if not zone_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")

    zone_data = zone_snapshot.to_dict() or {}
    ngo_ids = zone_data.get("ngoIds", [])
    if ngo_id not in ngo_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Zone does not belong to this NGO")

    zone_data["id"] = zone_id
    return ZoneDocument.model_validate(zone_data)


def _score_candidate(user_data: dict[str, Any], zone: ZoneDocument, need_type: str) -> MissionCandidate:
    user_id = str(user_data.get("id") or "")
    name = str(user_data.get("name") or "Field Worker")
    initials = "".join([part[0] for part in name.split()[:2]]).upper() or name[:2].upper()
    skills = [str(skill).lower() for skill in user_data.get("skills", [])]
    zones = [str(item) for item in user_data.get("zones", [])]
    offline_zones = [str(item) for item in user_data.get("offlineZones", [])]
    travel_radius = int(user_data.get("travelRadius") or 0)
    availability = str(user_data.get("availability") or "available")
    burnout_risk = str(user_data.get("burnoutRisk") or "low")
    success_rate = float(user_data.get("successRate") or 0.0)

    normalized_need = need_type.lower().replace(" ", "_")
    normalized_zone_name = zone.name.lower()
    zone_familiarity = zone.id in zones or zone.id in offline_zones or normalized_zone_name in [item.lower() for item in zones + offline_zones]
    skill_match = any(normalized_need in skill or skill in normalized_need for skill in skills)

    score = 35
    if zone_familiarity:
        score += 40
    if skill_match:
        score += 15
    if availability == "available":
        score += 5
    if travel_radius >= 5:
        score += 5

    score = min(score, 100)
    distance = f"{max(1.0, round((10 - min(travel_radius, 10)) * 0.4 + (0 if zone_familiarity else 2.0), 1))} km away"
    reason = "Matching zone coverage"
    if skill_match:
        reason = f"Matched on {need_type.lower()} skills and zone coverage"
    elif zone_familiarity:
        reason = "Close to the mission zone"

    return MissionCandidate(
        id=user_id,
        name=name,
        initials=initials,
        matchPercent=score,
        distance=distance,
        skills=[str(skill) for skill in user_data.get("skills", [])],
        availability=availability,
        burnoutRisk=burnout_risk,
        successRate=success_rate,
        reason=reason,
        zoneFamiliarity=zone_familiarity,
        travelRadius=travel_radius,
    )


def _pick_best_candidate(candidates: list[MissionCandidate]) -> MissionCandidate | None:
    if not candidates:
        return None
    return sorted(candidates, key=lambda candidate: (candidate.matchPercent, candidate.successRate), reverse=True)[0]


@router.get("/missions", response_model=MissionListResponse)
async def list_coordinator_missions(
    user: dict[str, Any] = Depends(role_required("coordinator")),
    status_filter: str | None = Query(default=None, alias="status"),
    zone_id: str | None = Query(default=None, alias="zoneId"),
) -> MissionListResponse:
    ngo_id = _get_coordinator_ngo_id(user)
    mission_docs = db.collection("missions").where("ngoId", "==", ngo_id).stream()

    missions: list[dict[str, Any]] = []
    for doc in mission_docs:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        if status_filter and str(data.get("status") or "").lower() != status_filter.lower():
            continue
        if zone_id and str(data.get("zoneId") or "") != zone_id:
            continue
        missions.append(data)

    missions.sort(key=_mission_sort_key, reverse=True)
    typed_missions = [_mission_from_doc(mission["id"], mission) for mission in missions]

    status_counts = Counter(str(mission.status.value if isinstance(mission.status, MissionStatus) else mission.status).lower() for mission in typed_missions)

    return MissionListResponse(
        missions=typed_missions,
        total=len(typed_missions),
        active=sum(status_counts.get(status, 0) for status in ACTIVE_MISSION_STATUSES),
        pending=status_counts.get(MissionStatus.pending.value, 0),
        completed=status_counts.get(MissionStatus.completed.value, 0),
    )


@router.get("/missions/candidates", response_model=list[MissionCandidate])
async def get_mission_candidates(
    user: dict[str, Any] = Depends(role_required("coordinator")),
    zone_id: str = Query(alias="zoneId"),
    need_type: str = Query(alias="needType"),
    target_audience: str = Query(default="fieldworker", alias="targetAudience"),
) -> list[MissionCandidate]:
    ngo_id = _get_coordinator_ngo_id(user)
    zone = _get_zone(zone_id, ngo_id)

    normalized_audience = target_audience.lower().strip()
    if normalized_audience not in {"fieldworker", "volunteer"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid targetAudience")

    users_docs = db.collection("users").where("ngoId", "==", ngo_id).where("role", "==", normalized_audience).stream()
    candidates = []
    for doc in users_docs:
        user_data = doc.to_dict() or {}
        user_data["id"] = doc.id
        if str(user_data.get("availability") or "available").lower() not in {"available", "online"}:
            continue
        candidates.append(_score_candidate(user_data, zone, need_type))

    candidates.sort(key=lambda candidate: (candidate.matchPercent, candidate.successRate), reverse=True)
    return candidates[:6]


@router.post("/missions", response_model=MissionCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_mission(
    payload: MissionCreateRequest,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> MissionCreateResponse:
    ngo_id = _get_coordinator_ngo_id(user)
    zone = _get_zone(payload.zoneId, ngo_id)

    zone_address = zone.name
    if zone.city:
        zone_address = f"{zone.name}, {zone.city}"

    candidate_objects = await get_mission_candidates(
        user=user,
        zone_id=payload.zoneId,
        need_type=payload.needType,
        target_audience=payload.targetAudience,
    )
    best_candidate = _pick_best_candidate(candidate_objects)
    selected_candidate = None
    if payload.assignedTo:
        selected_candidate = next((candidate for candidate in candidate_objects if candidate.id == payload.assignedTo), None)

    chosen_candidate = selected_candidate or best_candidate
    assigned_to = payload.assignedTo or (chosen_candidate.id if chosen_candidate and payload.allowAutoAssign else None)
    assigned_name = payload.assignedVolunteerName or (chosen_candidate.name if chosen_candidate and payload.allowAutoAssign else None)

    mission_ref = db.collection("missions").document()
    now = _now()
    mission_data = {
        "ngoId": ngo_id,
        "creatorId": user["id"],
        "creatorName": user.get("name"),
        "title": payload.title,
        "description": payload.description,
        "zoneId": zone.id,
        "zoneName": zone.name,
        "ward": zone.ward,
        "city": zone.city,
        "needType": payload.needType,
        "targetAudience": payload.targetAudience,
        "priority": payload.priority.value if isinstance(payload.priority, MissionPriority) else str(payload.priority),
        "status": MissionStatus.dispatched.value if assigned_to else MissionStatus.pending.value,
        "assignedTo": assigned_to,
        "assignedToName": assigned_name,
        "assignedVolunteerMatch": chosen_candidate.matchPercent if chosen_candidate else 0,
        "assignedVolunteerDistance": chosen_candidate.distance if chosen_candidate else None,
        "assignedVolunteerReason": chosen_candidate.reason if chosen_candidate else None,
        "resources": [resource.model_dump() for resource in payload.resources],
        "sourceReportIds": payload.sourceReportIds,
        "sourceNgoIds": payload.sourceNgoIds,
        "location": {
            "lat": zone.lat,
            "lng": zone.lng,
            "address": zone_address,
            "landmark": zone.name,
        },
        "instructions": payload.instructions,
        "notes": payload.notes,
        "estimatedDurationMinutes": payload.estimatedDurationMinutes,
        "progress": 0,
        "statusText": "Volunteer en route" if assigned_to else "Awaiting dispatch",
        "familiesHelped": 0,
        "outcomeNotes": None,
        "mergedFrom": {
            "reports": len(payload.sourceReportIds),
            "ngos": len(set(payload.sourceNgoIds)) if payload.sourceNgoIds else 1,
        } if payload.sourceReportIds else None,
        "newUpdates": 0,
        "createdAt": now,
        "updatedAt": now,
        "dispatchedAt": now if assigned_to else None,
        "startedAt": None,
        "completedAt": None,
        "autoAssigned": not bool(payload.assignedTo) and bool(chosen_candidate),
    }

    mission_ref.set(mission_data)
    mission_ref.collection("updates").add({
        "type": "mission_created",
        "status": mission_data["status"],
        "text": payload.description,
        "timestamp": now,
        "submittedBy": user["id"],
    })

    if assigned_to:
        db.collection("notifications").add({
            "userId": assigned_to,
            "type": "mission_assigned",
            "missionId": mission_ref.id,
            "title": payload.title,
            "message": f"New mission assigned in {zone.name}",
            "timestamp": now,
            "read": False,
        })

    mission = _mission_from_doc(mission_ref.id, mission_data)
    return MissionCreateResponse(mission=mission, matchedCandidate=chosen_candidate)


@router.get("/missions/{mission_id}", response_model=MissionCreateResponse)
async def get_mission_detail(
    mission_id: str,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> MissionCreateResponse:
    ngo_id = _get_coordinator_ngo_id(user)
    mission_snapshot = db.collection("missions").document(mission_id).get()
    if not mission_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission not found")

    mission_data = mission_snapshot.to_dict() or {}
    if str(mission_data.get("ngoId") or "") != ngo_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mission does not belong to your NGO")

    mission_data["id"] = mission_id
    mission = _mission_from_doc(mission_id, mission_data)
    best_candidate = None
    if mission.assignedTo:
        best_candidate = MissionCandidate(
            id=mission.assignedTo,
            name=mission.assignedToName or "Field Worker",
            initials=(mission.assignedToName or "FW")[:2].upper(),
            matchPercent=mission.assignedVolunteerMatch,
            distance=mission.assignedVolunteerDistance or "Nearby",
            reason=mission.assignedVolunteerReason or "Assigned",
        )

    return MissionCreateResponse(mission=mission, matchedCandidate=best_candidate)
