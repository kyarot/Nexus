from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from google.cloud.firestore_v1.base_query import FieldFilter
from pydantic import BaseModel

from core.dependencies import role_required
from core.firebase import db, rtdb
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
from services.mission_intelligence import generate_empathy_brief, plan_resources_for_mission, rank_candidate_support_with_gemini
from services.notifications_hub import notify_ngo_coordinators, notify_users

PREFIX = "/coordinator"
TAGS = ["coordinator"]
router = APIRouter()
logger = logging.getLogger("nexus.missions")

ACTIVE_MISSION_STATUSES = {MissionStatus.dispatched.value, MissionStatus.en_route.value, MissionStatus.on_ground.value}


class MissionAssignRequest(BaseModel):
    volunteerId: str


def _now() -> datetime:
    return datetime.utcnow()


def _get_coordinator_ngo_id(user: dict[str, Any]) -> str:
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have an associated NGO")
    return ngo_id


def _get_partner_ngo_ids(ngo_id: str) -> list[str]:
    snapshot = db.collection("ngos").document(ngo_id).get()
    if not snapshot.exists:
        return []
    data = snapshot.to_dict() or {}
    return [str(item) for item in (data.get("partnerNgoIds") or []) if str(item).strip()]


def _get_ngo_name(ngo_id: str) -> str:
    snapshot = db.collection("ngos").document(ngo_id).get()
    if not snapshot.exists:
        return "Partner NGO"
    data = snapshot.to_dict() or {}
    return str(data.get("name") or "Partner NGO")


def _are_ngos_collaborating(ngo_a: str, ngo_b: str) -> bool:
    if not ngo_a or not ngo_b:
        return False
    partners = set(_get_partner_ngo_ids(ngo_a))
    return ngo_b in partners


def _read_timestamp(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    return None


def _parse_iso_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        except ValueError:
            return None
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
        assignedVolunteerNgoId=data.get("assignedVolunteerNgoId"),
        assignedVolunteerNgoName=data.get("assignedVolunteerNgoName"),
        supportActivated=bool(data.get("supportActivated") or False),
        scoreSharePercent=int(data.get("scoreSharePercent") or 0),
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


def _serialize_firestore_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_serialize_firestore_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize_firestore_value(item) for key, item in value.items()}
    return value


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


def _score_candidate(
    user_data: dict[str, Any],
    zone: ZoneDocument,
    need_type: str,
    *,
    source_ngo_id: str | None = None,
    source_ngo_name: str | None = None,
) -> MissionCandidate:
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
        sourceNgoId=source_ngo_id,
        sourceNgoName=source_ngo_name,
        isPartnerSupport=bool(source_ngo_id),
        scoreSharePercent=50 if source_ngo_id else 0,
    )


def _pick_best_candidate(candidates: list[MissionCandidate]) -> MissionCandidate | None:
    if not candidates:
        return None
    return sorted(candidates, key=lambda candidate: (candidate.matchPercent, candidate.successRate), reverse=True)[0]


def _reorder_partner_candidates_with_gemini(
    *,
    ngo_id: str,
    zone: ZoneDocument,
    need_type: str,
    mission_title: str,
    mission_description: str,
    candidates: list[MissionCandidate],
) -> list[MissionCandidate]:
    if not candidates:
        return []

    candidate_rows = [candidate.model_dump() for candidate in candidates]
    ordered_ids = rank_candidate_support_with_gemini(
        ngo_id=ngo_id,
        zone=zone.model_dump(),
        need_type=need_type,
        mission_title=mission_title,
        mission_description=mission_description,
        candidates=candidate_rows,
    )
    if not ordered_ids:
        return sorted(candidates, key=lambda candidate: (candidate.matchPercent, candidate.successRate), reverse=True)

    by_id = {candidate.id: candidate for candidate in candidates}
    ordered: list[MissionCandidate] = [by_id[candidate_id] for candidate_id in ordered_ids if candidate_id in by_id]
    remaining = [candidate for candidate in candidates if candidate.id not in ordered_ids]
    remaining.sort(key=lambda candidate: (candidate.matchPercent, candidate.successRate), reverse=True)
    return ordered + remaining


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
    used_partner_fallback = False
    if normalized_audience not in {"fieldworker", "volunteer"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid targetAudience")

    users_docs = (
        db.collection("users")
        .where(filter=FieldFilter("ngoId", "==", ngo_id))
        .where(filter=FieldFilter("role", "==", normalized_audience))
        .stream()
    )
    candidates: list[MissionCandidate] = []
    for doc in users_docs:
        user_data = doc.to_dict() or {}
        user_data["id"] = doc.id
        if str(user_data.get("availability") or "available").lower() not in {"available", "online"}:
            continue
        assigned_snapshot = (
            db.collection("missions")
            .where(filter=FieldFilter("assignedTo", "==", user_data["id"]))
            .limit(5)
            .get()
        )
        if any(str(mission.to_dict().get("status") or "").lower() in ACTIVE_MISSION_STATUSES for mission in assigned_snapshot):
            continue
        candidates.append(_score_candidate(user_data, zone, need_type))

    # Worst-case fallback: use partner NGO members only when local candidates are exhausted.
    if not candidates:
        partner_ids = _get_partner_ngo_ids(ngo_id)
        for partner_ngo_id in partner_ids:
            partner_ngo_name = _get_ngo_name(partner_ngo_id)
            partner_users_docs = (
                db.collection("users")
                .where(filter=FieldFilter("ngoId", "==", partner_ngo_id))
                .where(filter=FieldFilter("role", "==", normalized_audience))
                .stream()
            )
            for doc in partner_users_docs:
                user_data = doc.to_dict() or {}
                user_data["id"] = doc.id
                if str(user_data.get("availability") or "available").lower() not in {"available", "online"}:
                    continue
                assigned_snapshot = (
                    db.collection("missions")
                    .where(filter=FieldFilter("assignedTo", "==", user_data["id"]))
                    .limit(5)
                    .get()
                )
                if any(str(mission.to_dict().get("status") or "").lower() in ACTIVE_MISSION_STATUSES for mission in assigned_snapshot):
                    continue
                candidates.append(
                    _score_candidate(
                        user_data,
                        zone,
                        need_type,
                        source_ngo_id=partner_ngo_id,
                        source_ngo_name=partner_ngo_name,
                    )
                )

        if candidates:
            used_partner_fallback = True
            candidates = _reorder_partner_candidates_with_gemini(
                ngo_id=ngo_id,
                zone=zone,
                need_type=need_type,
                mission_title=f"{need_type} support",
                mission_description=f"Partner support fallback for {zone.name}",
                candidates=candidates,
            )

    if not used_partner_fallback:
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
    resource_plan = plan_resources_for_mission(
        ngo_id=ngo_id,
        zone_id=payload.zoneId,
        need_type=payload.needType,
        mission_title=payload.title,
        mission_description=payload.description,
        base_resources=[resource.model_dump() for resource in payload.resources],
    )

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
        "assignedVolunteerNgoId": chosen_candidate.sourceNgoId if chosen_candidate else ngo_id,
        "assignedVolunteerNgoName": chosen_candidate.sourceNgoName if chosen_candidate and chosen_candidate.sourceNgoId else _get_ngo_name(ngo_id),
        "supportActivated": bool(chosen_candidate and chosen_candidate.isPartnerSupport),
        "scoreSharePercent": chosen_candidate.scoreSharePercent if chosen_candidate else 0,
        "resources": resource_plan.get("items") or [resource.model_dump() for resource in payload.resources],
        "resourcePlan": resource_plan,
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

    if assigned_to:
        volunteer_snapshot = db.collection("users").document(assigned_to).get()
        volunteer_data = volunteer_snapshot.to_dict() if volunteer_snapshot.exists else {}
        mission_data["empathyBrief"] = generate_empathy_brief(
            mission=mission_data,
            volunteer={"id": assigned_to, "name": assigned_name, **(volunteer_data or {})},
            zone=zone.model_dump(),
        )

    mission_ref.set(mission_data)
    mission_ref.collection("updates").add({
        "type": "mission_created",
        "status": mission_data["status"],
        "text": payload.description,
        "timestamp": now,
        "submittedBy": user["id"],
    })

    notify_ngo_coordinators(
        ngo_id,
        type="mission_created",
        title="Mission created",
        message=f"{payload.title} created for {zone.name}.",
        mission_id=mission_ref.id,
        metadata={
            "zoneId": zone.id,
            "zoneName": zone.name,
            "needType": payload.needType,
            "targetAudience": payload.targetAudience,
        },
        timestamp=now,
    )

    if assigned_to:
        notify_users(
            [assigned_to],
            type="mission_assigned",
            mission_id=mission_ref.id,
            title=payload.title,
            message=f"New mission assigned in {zone.name}",
            metadata={"zoneId": zone.id, "zoneName": zone.name},
            timestamp=now,
        )

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
            sourceNgoId=mission.assignedVolunteerNgoId,
            sourceNgoName=mission.assignedVolunteerNgoName,
            isPartnerSupport=mission.supportActivated,
            scoreSharePercent=mission.scoreSharePercent,
        )

    return MissionCreateResponse(mission=mission, matchedCandidate=best_candidate)


@router.patch("/missions/{mission_id}/assign", response_model=MissionCreateResponse)
async def assign_mission_volunteer(
    mission_id: str,
    payload: MissionAssignRequest,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> MissionCreateResponse:
    ngo_id = _get_coordinator_ngo_id(user)
    mission_ref = db.collection("missions").document(mission_id)
    mission_snapshot = mission_ref.get()
    if not mission_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission not found")

    mission_data = mission_snapshot.to_dict() or {}
    if str(mission_data.get("ngoId") or "") != ngo_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mission does not belong to your NGO")

    zone_id = str(mission_data.get("zoneId") or "").strip()
    if not zone_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mission has no zone assigned")

    zone = _get_zone(zone_id, ngo_id)

    volunteer_id = payload.volunteerId.strip()
    volunteer_snapshot = db.collection("users").document(volunteer_id).get()
    if not volunteer_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volunteer not found")

    volunteer_data = volunteer_snapshot.to_dict() or {}
    volunteer_ngo_id = str(volunteer_data.get("ngoId") or "").strip()
    is_partner_support = volunteer_ngo_id != ngo_id
    if not volunteer_ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Volunteer is not mapped to an NGO")

    if is_partner_support:
        if not _are_ngos_collaborating(ngo_id, volunteer_ngo_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Volunteer NGO is not an active collaboration partner")
        local_candidates = await get_mission_candidates(
            user=user,
            zone_id=zone.id,
            need_type=str(mission_data.get("needType") or ""),
            target_audience="volunteer",
        )
        if any(not candidate.isPartnerSupport for candidate in local_candidates):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Partner support is allowed only when no local volunteers are available",
            )

    role = str(volunteer_data.get("role") or "").lower().strip()
    if role != "volunteer":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected user is not a volunteer")

    candidate = _score_candidate(
        volunteer_data | {"id": volunteer_id},
        zone,
        str(mission_data.get("needType") or ""),
        source_ngo_id=volunteer_ngo_id if is_partner_support else None,
        source_ngo_name=_get_ngo_name(volunteer_ngo_id) if is_partner_support else None,
    )
    now = _now()
    mission_update = {
        "assignedTo": candidate.id,
        "assignedToName": candidate.name,
        "assignedVolunteerMatch": candidate.matchPercent,
        "assignedVolunteerDistance": candidate.distance,
        "assignedVolunteerReason": candidate.reason,
        "assignedVolunteerNgoId": volunteer_ngo_id,
        "assignedVolunteerNgoName": candidate.sourceNgoName if is_partner_support else _get_ngo_name(ngo_id),
        "supportActivated": is_partner_support,
        "scoreSharePercent": 50 if is_partner_support else 0,
        "status": MissionStatus.dispatched.value,
        "statusText": "Volunteer en route",
        "updatedAt": now,
        "dispatchedAt": now,
        "autoAssigned": False,
    }

    mission_preview = {**mission_data, **mission_update}
    mission_update["empathyBrief"] = generate_empathy_brief(
        mission=mission_preview,
        volunteer={"id": candidate.id, **volunteer_data},
        zone=zone.model_dump(),
    )

    mission_ref.update(mission_update)
    mission_ref.collection("updates").add({
        "type": "mission_assigned",
        "volunteerId": candidate.id,
        "volunteerName": candidate.name,
        "timestamp": now,
        "submittedBy": user["id"],
    })

    notify_users(
        [candidate.id],
        type="mission_assigned",
        mission_id=mission_id,
        title=mission_data.get("title") or "Mission assignment",
        message=f"New mission assigned in {zone.name}",
        metadata={"zoneId": zone.id, "zoneName": zone.name},
        timestamp=now,
    )

    notify_ngo_coordinators(
        ngo_id,
        type="mission_assignment_updated",
        mission_id=mission_id,
        title="Volunteer assigned",
        message=f"{candidate.name} assigned to mission {mission_data.get('title') or mission_id}.",
        metadata={
            "volunteerId": candidate.id,
            "volunteerName": candidate.name,
            "zoneId": zone.id,
            "zoneName": zone.name,
        },
        timestamp=now,
    )

    if is_partner_support:
        notify_ngo_coordinators(
            volunteer_ngo_id,
            type="collaboration_support_activated",
            mission_id=mission_id,
            title="Partner support activated",
            message=f"{candidate.name} was assigned to support partner mission {mission_data.get('title') or mission_id}.",
            metadata={
                "hostNgoId": ngo_id,
                "supportNgoId": volunteer_ngo_id,
                "scoreSharePercent": 50,
            },
            timestamp=now,
        )

    mission_data.update(mission_update)
    mission_data["id"] = mission_id
    mission = _mission_from_doc(mission_id, mission_data)
    return MissionCreateResponse(mission=mission, matchedCandidate=candidate)


@router.get("/missions/{mission_id}/source-reports", response_model=dict[str, Any])
async def get_mission_source_reports(
    mission_id: str,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = _get_coordinator_ngo_id(user)
    mission_snapshot = db.collection("missions").document(mission_id).get()
    if not mission_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission not found")

    mission_data = mission_snapshot.to_dict() or {}
    if str(mission_data.get("ngoId") or "") != ngo_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mission does not belong to your NGO")

    source_report_ids = [str(item) for item in (mission_data.get("sourceReportIds") or []) if str(item).strip()]
    report_docs: list[Any] = []

    if source_report_ids:
        for report_id in source_report_ids:
            report_snapshot = db.collection("reports").document(report_id).get()
            if report_snapshot.exists:
                report_docs.append(report_snapshot)
    else:
        # Backward compatibility for old missions that do not persist sourceReportIds.
        report_docs = list(
            db.collection("reports")
            .where(filter=FieldFilter("missionId", "==", mission_id))
            .limit(50)
            .stream()
        )

    reports: list[dict[str, Any]] = []
    for report_doc in report_docs:
        report_data = report_doc.to_dict() or {}
        reports.append(
            {
                "id": report_doc.id,
                "missionId": report_data.get("missionId"),
                "submittedBy": report_data.get("submittedBy"),
                "submittedByName": report_data.get("submittedByName"),
                "zoneId": report_data.get("zoneId"),
                "needType": report_data.get("needType"),
                "severity": report_data.get("severity"),
                "familiesAffected": report_data.get("familiesAffected"),
                "personsAffected": report_data.get("personsAffected"),
                "sourceType": report_data.get("sourceType"),
                "inputType": report_data.get("inputType"),
                "verificationState": report_data.get("verificationState"),
                "visitType": report_data.get("visitType"),
                "householdRef": report_data.get("householdRef"),
                "confidence": report_data.get("confidence"),
                "location": _serialize_firestore_value(report_data.get("location") or {}),
                "safetySignals": _serialize_firestore_value(report_data.get("safetySignals") or []),
                "fieldConfidences": _serialize_firestore_value(report_data.get("fieldConfidences") or {}),
                "needIncidents": _serialize_firestore_value(report_data.get("needIncidents") or []),
                "assignmentRequirementProfile": _serialize_firestore_value(report_data.get("assignmentRequirementProfile") or {}),
                "additionalNotes": report_data.get("additionalNotes")
                or ((report_data.get("extractedData") or {}).get("additionalNotes") if isinstance(report_data.get("extractedData"), dict) else None),
                "createdAt": _serialize_firestore_value(report_data.get("createdAt")),
                "updatedAt": _serialize_firestore_value(report_data.get("updatedAt")),
            }
        )

    reports.sort(key=lambda item: item.get("createdAt") or "", reverse=True)
    return {
        "reports": reports,
        "total": len(reports),
    }


@router.get("/missions/{mission_id}/tracking", response_model=dict[str, Any])
async def get_mission_tracking(
    mission_id: str,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = _get_coordinator_ngo_id(user)
    mission_snapshot = db.collection("missions").document(mission_id).get()
    if not mission_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission not found")

    mission_data = mission_snapshot.to_dict() or {}
    if str(mission_data.get("ngoId") or "") != ngo_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mission does not belong to your NGO")

    tracking_data = rtdb.child("missionTracking").child(mission_id).get() or {}
    assigned_to = str(mission_data.get("assignedTo") or "").strip()
    tracking_user_id = str((tracking_data or {}).get("volunteerId") or "").strip()
    responder_id = tracking_user_id or assigned_to

    responders: list[dict[str, Any]] = []
    if responder_id:
        user_snapshot = db.collection("users").document(responder_id).get()
        user_data = user_snapshot.to_dict() if user_snapshot.exists else {}

        tracking_location = (tracking_data or {}).get("location") if isinstance(tracking_data, dict) else {}
        mission_location = mission_data.get("location") if isinstance(mission_data.get("location"), dict) else {}
        lat = float((tracking_location or {}).get("lat") or mission_location.get("lat") or 0.0)
        lng = float((tracking_location or {}).get("lng") or mission_location.get("lng") or 0.0)
        last_update = (tracking_data or {}).get("lastUpdate") if isinstance(tracking_data, dict) else None
        last_update_dt = _parse_iso_datetime(last_update)
        is_online = bool(last_update_dt and (datetime.utcnow() - last_update_dt) <= timedelta(minutes=5))

        responders.append(
            {
                "id": responder_id,
                "name": str((user_data or {}).get("name") or mission_data.get("assignedToName") or "Responder"),
                "role": str((user_data or {}).get("role") or mission_data.get("targetAudience") or "fieldworker"),
                "status": str((tracking_data or {}).get("status") or mission_data.get("status") or "unknown"),
                "online": is_online,
                "lastUpdate": last_update,
                "location": {
                    "lat": lat,
                    "lng": lng,
                    "address": (tracking_location or {}).get("address") or mission_location.get("address"),
                    "landmark": (tracking_location or {}).get("landmark") or mission_location.get("landmark"),
                },
                "avatarUrl": (user_data or {}).get("profilePhoto"),
            }
        )

    return {
        "missionId": mission_id,
        "missionStatus": mission_data.get("status"),
        "trackingAvailable": bool(tracking_data),
        "responders": responders,
    }
