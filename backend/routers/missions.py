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
from services.assignment_location import location_distance_to_zone_km, location_is_within_zone, zone_radius_km
from services.mission_assignment import commit_mission_assignment
from services.mission_intelligence import generate_empathy_brief, plan_resources_for_mission, rank_candidate_support_with_gemini
from services.notifications_hub import notify_ngo_coordinators, notify_users

PREFIX = "/coordinator"
TAGS = ["coordinator"]
router = APIRouter()
logger = logging.getLogger("nexus.missions")

ACTIVE_MISSION_STATUSES = {MissionStatus.dispatched.value, MissionStatus.en_route.value, MissionStatus.on_ground.value}

CITY_LANGUAGE_HINTS: dict[str, list[str]] = {
    "bengaluru": ["kannada"],
    "bangalore": ["kannada"],
    "mysuru": ["kannada"],
    "mysore": ["kannada"],
    "chennai": ["tamil"],
    "coimbatore": ["tamil"],
    "madurai": ["tamil"],
    "hyderabad": ["telugu", "urdu"],
    "warangal": ["telugu"],
    "vijayawada": ["telugu"],
    "visakhapatnam": ["telugu"],
    "mumbai": ["marathi", "hindi"],
    "pune": ["marathi"],
    "nagpur": ["marathi"],
    "kolkata": ["bengali"],
    "howrah": ["bengali"],
    "delhi": ["hindi"],
    "new delhi": ["hindi"],
    "lucknow": ["hindi"],
    "jaipur": ["hindi"],
    "ahmedabad": ["gujarati"],
    "surat": ["gujarati"],
    "kochi": ["malayalam"],
    "ernakulam": ["malayalam"],
    "thiruvananthapuram": ["malayalam"],
    "patna": ["hindi"],
    "bhubaneswar": ["odia"],
    "cuttack": ["odia"],
    "amritsar": ["punjabi"],
    "ludhiana": ["punjabi"],
}

LANGUAGE_ALIASES: dict[str, str] = {
    "kannada": "kannada",
    "kn": "kannada",
    "kannad": "kannada",
    "tamil": "tamil",
    "ta": "tamil",
    "telugu": "telugu",
    "te": "telugu",
    "hindi": "hindi",
    "hi": "hindi",
    "marathi": "marathi",
    "mr": "marathi",
    "bengali": "bengali",
    "bangla": "bengali",
    "bn": "bengali",
    "malayalam": "malayalam",
    "ml": "malayalam",
    "urdu": "urdu",
    "ur": "urdu",
    "gujarati": "gujarati",
    "gu": "gujarati",
    "odia": "odia",
    "oriya": "odia",
    "od": "odia",
    "punjabi": "punjabi",
    "pa": "punjabi",
    "english": "english",
    "en": "english",
}


class MissionAssignRequest(BaseModel):
    volunteerId: str


class MissionMessageRequest(BaseModel):
    message: str


class MissionFlagReviewRequest(BaseModel):
    reason: str | None = None


class AutoAssignPendingResult(BaseModel):
    totalPending: int
    assigned: int
    skipped: int
    failed: int
    assignedMissionIds: list[str]
    details: list[dict[str, Any]]


@router.post("/missions/{mission_id}/close", response_model=MissionDocument)
async def close_mission(
    mission_id: str,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> MissionDocument:
    ngo_id = _get_coordinator_ngo_id(user)
    mission_ref = db.collection("missions").document(mission_id)
    mission_snapshot = mission_ref.get()
    if not mission_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission not found")

    mission_data = mission_snapshot.to_dict() or {}
    if str(mission_data.get("ngoId") or "") != ngo_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mission does not belong to your NGO")

    now = _now()
    mission_update = {
        "status": MissionStatus.completed.value,
        "statusText": "Mission completed",
        "updatedAt": now,
        "completedAt": now,
    }
    mission_ref.update(mission_update)
    mission_ref.collection("updates").add({
        "type": "mission_closed",
        "status": "completed",
        "timestamp": now,
        "submittedBy": user.get("id"),
    })

    if rtdb is not None:
        rtdb.child("missionTracking").child(mission_id).update({
            "status": "completed",
            "lastUpdate": now.isoformat(),
            "isOnGround": False,
        })

    mission_data.update(mission_update)
    mission_data["id"] = mission_id
    return _mission_from_doc(mission_id, mission_data)


@router.post("/missions/{mission_id}/message", response_model=dict[str, Any])
async def message_mission_assignee(
    mission_id: str,
    payload: MissionMessageRequest,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = _get_coordinator_ngo_id(user)
    message = (payload.message or "").strip()
    if not message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="message is required")

    mission_ref = db.collection("missions").document(mission_id)
    mission_snapshot = mission_ref.get()
    if not mission_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission not found")

    mission_data = mission_snapshot.to_dict() or {}
    if str(mission_data.get("ngoId") or "") != ngo_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mission does not belong to your NGO")

    assignee_id = str(mission_data.get("assignedTo") or "").strip()
    if not assignee_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Mission has no assigned responder")

    now = _now()
    sender_name = str(user.get("name") or user.get("email") or "Coordinator")

    mission_ref.collection("updates").add({
        "type": "mission_message",
        "text": message,
        "timestamp": now,
        "submittedBy": user.get("id"),
        "senderName": sender_name,
    })
    mission_ref.update({"updatedAt": now})

    notify_users(
        [assignee_id],
        type="mission_message",
        title="Coordinator message",
        message=message,
        mission_id=mission_id,
        metadata={
            "senderName": sender_name,
            "senderRole": "coordinator",
        },
        timestamp=now,
    )

    return {"sent": True}


@router.post("/missions/{mission_id}/flag-review", response_model=MissionDocument)
async def flag_mission_for_review(
    mission_id: str,
    payload: MissionFlagReviewRequest,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> MissionDocument:
    ngo_id = _get_coordinator_ngo_id(user)
    reason = (payload.reason or "").strip()

    mission_ref = db.collection("missions").document(mission_id)
    mission_snapshot = mission_ref.get()
    if not mission_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission not found")

    mission_data = mission_snapshot.to_dict() or {}
    if str(mission_data.get("ngoId") or "") != ngo_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mission does not belong to your NGO")

    if str(mission_data.get("status") or "").lower() == MissionStatus.completed.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Completed missions cannot be flagged for review")

    now = _now()
    reviewer_name = str(user.get("name") or user.get("email") or "Coordinator")
    mission_title = str(mission_data.get("title") or mission_id)

    mission_update = {
        "reviewFlagged": True,
        "reviewReason": reason or None,
        "reviewFlaggedBy": user.get("id"),
        "reviewFlaggedAt": now,
        "statusText": "Flagged for coordinator review",
        "updatedAt": now,
        "newUpdates": int(mission_data.get("newUpdates") or 0) + 1,
    }
    mission_ref.update(mission_update)
    mission_ref.collection("updates").add(
        {
            "type": "mission_flagged_for_review",
            "status": mission_data.get("status"),
            "text": reason or "Mission flagged for review by coordinator",
            "timestamp": now,
            "submittedBy": user.get("id"),
            "submittedByName": reviewer_name,
        }
    )

    assignee_id = str(mission_data.get("assignedTo") or "").strip()
    if assignee_id:
        notify_users(
            [assignee_id],
            type="mission_flagged_for_review",
            title="Mission update",
            message=f"{mission_title} was flagged for review. Await further instructions.",
            mission_id=mission_id,
            metadata={
                "reason": reason or None,
                "flaggedBy": reviewer_name,
            },
            timestamp=now,
        )

    notify_ngo_coordinators(
        ngo_id,
        type="mission_flagged_for_review",
        title="Mission flagged for review",
        message=f"{mission_title} was flagged for review{': ' + reason if reason else '.'}",
        mission_id=mission_id,
        metadata={
            "reason": reason or None,
            "flaggedBy": reviewer_name,
            "flaggedById": user.get("id"),
        },
        timestamp=now,
    )

    mission_data.update(mission_update)
    mission_data["id"] = mission_id
    return _mission_from_doc(mission_id, mission_data)


@router.post("/missions/{mission_id}/renotify", response_model=dict[str, Any])
async def renotify_mission_assignee(
    mission_id: str,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = _get_coordinator_ngo_id(user)
    mission_ref = db.collection("missions").document(mission_id)
    mission_snapshot = mission_ref.get()
    if not mission_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission not found")

    mission_data = mission_snapshot.to_dict() or {}
    if str(mission_data.get("ngoId") or "") != ngo_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mission does not belong to your NGO")

    assignee_id = str(mission_data.get("assignedTo") or "").strip()
    if not assignee_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Mission has no assigned responder")

    zone_name = str(mission_data.get("zoneName") or "Assigned zone")
    now = _now()
    notify_users(
        [assignee_id],
        type="mission_assigned",
        mission_id=mission_id,
        title=str(mission_data.get("title") or "Mission reminder"),
        message=f"Reminder: mission assigned in {zone_name}",
        metadata={
            "zoneId": mission_data.get("zoneId"),
            "zoneName": zone_name,
            "reminder": True,
        },
        timestamp=now,
    )

    return {"sent": True}


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


def _normalize_language(value: Any) -> str:
    normalized = str(value or "").strip().lower().replace("_", " ").replace("-", " ")
    if not normalized:
        return ""
    return LANGUAGE_ALIASES.get(normalized, normalized)


def _normalize_language_list(values: list[Any]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        lang = _normalize_language(value)
        if lang and lang not in seen:
            normalized.append(lang)
            seen.add(lang)
    return normalized


def _infer_zone_local_languages(zone: ZoneDocument) -> list[str]:
    # Prefer explicit language metadata if available on the zone document.
    zone_data = zone.model_dump()
    explicit_values: list[Any] = []
    explicit_values.extend(zone_data.get("localLanguages") or [])
    explicit_values.extend(zone_data.get("additionalLanguages") or [])
    explicit_values.extend(zone_data.get("languages") or [])
    explicit_values.append(zone_data.get("primaryLanguage"))
    explicit_values.append(zone_data.get("language"))

    explicit_languages = _normalize_language_list(explicit_values)
    if explicit_languages:
        return explicit_languages

    # Fallback: infer from city/ward/zone-name when metadata is not stored.
    inferred: list[Any] = []
    location_tokens = [str(zone.city or ""), str(zone.ward or ""), str(zone.name or "")]
    joined_location = " ".join(location_tokens).lower()
    for city_hint, languages in CITY_LANGUAGE_HINTS.items():
        if city_hint in joined_location:
            inferred.extend(languages)

    if not inferred:
        inferred = ["english"]

    return _normalize_language_list(inferred)


def _candidate_languages(user_data: dict[str, Any]) -> list[str]:
    raw: list[Any] = []
    raw.append(user_data.get("primaryLanguage"))
    raw.append(user_data.get("language"))
    raw.extend(user_data.get("additionalLanguages") or [])
    raw.extend(user_data.get("languages") or [])
    return _normalize_language_list(raw)


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
        reviewFlagged=bool(data.get("reviewFlagged") or False),
        reviewReason=data.get("reviewReason"),
        reviewFlaggedBy=data.get("reviewFlaggedBy"),
        reviewFlaggedAt=_read_timestamp(data.get("reviewFlaggedAt")),
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
    local_languages: list[str],
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
    spoken_languages = _candidate_languages(user_data)
    language_overlap = sorted(set(spoken_languages) & set(local_languages))
    language_match = bool(language_overlap)

    normalized_need = need_type.lower().replace(" ", "_")
    normalized_zone_name = zone.name.lower()
    zone_familiarity = zone.id in zones or zone.id in offline_zones or normalized_zone_name in [item.lower() for item in zones + offline_zones]
    skill_match = any(normalized_need in skill or skill in normalized_need for skill in skills)
    distance_km = location_distance_to_zone_km(user_data, zone.model_dump())
    zone_radius = zone_radius_km(zone.model_dump())
    within_zone_radius = distance_km is not None and distance_km <= zone_radius

    score = 35
    if within_zone_radius:
        score += 10
    if zone_familiarity:
        score += 40
    if skill_match:
        score += 15
    if language_match:
        score += 22
    elif spoken_languages:
        score += 3
    if availability == "available":
        score += 5
    if travel_radius >= 5:
        score += 5

    score = min(score, 100)
    if distance_km is not None:
        distance = f"{max(0.1, round(distance_km, 1))} km away"
    else:
        distance = f"{max(1.0, round((10 - min(travel_radius, 10)) * 0.4 + (0 if zone_familiarity else 2.0), 1))} km away"
    reason = "Matching zone coverage"
    if within_zone_radius and skill_match:
        reason = f"Inside zone radius and matched {need_type.lower()} skills"
    if language_match:
        reason = f"Local language match ({', '.join(language_overlap[:2])}) + zone fit"
    elif within_zone_radius:
        reason = "Inside mission zone radius"
    elif skill_match:
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
    local_languages: list[str],
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
        mission_description=f"{mission_description}. Local zone languages: {', '.join(local_languages)}",
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
    local_languages = _infer_zone_local_languages(zone)

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
        user_distance_km = _distance_to_zone_km(user_data, zone)
        zone_radius_km = max(0.1, float(zone.radiusMeters or 1000) / 1000.0)
        if user_distance_km is not None and user_distance_km > zone_radius_km:
            continue
        assigned_snapshot = (
            db.collection("missions")
            .where(filter=FieldFilter("assignedTo", "==", user_data["id"]))
            .limit(5)
            .get()
        )
        if any(str(mission.to_dict().get("status") or "").lower() in ACTIVE_MISSION_STATUSES for mission in assigned_snapshot):
            continue
        candidates.append(_score_candidate(user_data, zone, need_type, local_languages))

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
                user_distance_km = _distance_to_zone_km(user_data, zone)
                zone_radius_km = max(0.1, float(zone.radiusMeters or 1000) / 1000.0)
                if user_distance_km is not None and user_distance_km > zone_radius_km:
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
                        local_languages,
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
                local_languages=local_languages,
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
        if selected_candidate is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected responder is not eligible (availability/active mission/zone radius mismatch)",
            )

    chosen_candidate = selected_candidate or best_candidate
    assigned_to = chosen_candidate.id if chosen_candidate and (payload.allowAutoAssign or bool(selected_candidate)) else None
    assigned_name = chosen_candidate.name if chosen_candidate and (payload.allowAutoAssign or bool(selected_candidate)) else None
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


@router.post("/missions/auto-assign-pending", response_model=AutoAssignPendingResult)
async def auto_assign_pending_missions(
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> AutoAssignPendingResult:
    ngo_id = _get_coordinator_ngo_id(user)
    pending_docs = list(
        db.collection("missions")
        .where(filter=FieldFilter("ngoId", "==", ngo_id))
        .where(filter=FieldFilter("status", "==", MissionStatus.pending.value))
        .stream()
    )

    total_pending = len(pending_docs)
    assigned = 0
    failed = 0
    skipped = 0
    assigned_ids: list[str] = []
    details: list[dict[str, Any]] = []

    for mission_doc in pending_docs:
        mission_id = mission_doc.id
        mission_data = mission_doc.to_dict() or {}
        if str(mission_data.get("assignedTo") or "").strip():
            skipped += 1
            details.append({"missionId": mission_id, "status": "skipped", "reason": "already assigned"})
            continue

        zone_id = str(mission_data.get("zoneId") or "").strip()
        need_type = str(mission_data.get("needType") or "").strip()
        target_audience = str(mission_data.get("targetAudience") or "fieldworker").strip().lower()

        if not zone_id or not need_type:
            failed += 1
            details.append({"missionId": mission_id, "status": "failed", "reason": "missing zone or need type"})
            continue

        try:
            zone = _get_zone(zone_id, ngo_id)
            candidates = await get_mission_candidates(
                user=user,
                zone_id=zone_id,
                need_type=need_type,
                target_audience=target_audience,
            )
            chosen_candidate = _pick_best_candidate(candidates)
            if not chosen_candidate:
                skipped += 1
                details.append({"missionId": mission_id, "status": "skipped", "reason": "no available candidates"})
                continue

            assignee_snapshot = db.collection("users").document(chosen_candidate.id).get()
            assignee_data = assignee_snapshot.to_dict() if assignee_snapshot.exists else {}
            commit_mission_assignment(
                mission_id=mission_id,
                mission_data=mission_data,
                zone=zone.model_dump(),
                assignee_id=chosen_candidate.id,
                assignee_name=chosen_candidate.name,
                assignee_data=assignee_data or {},
                mission_update={
                    "assignedRole": target_audience,
                    "assignedVolunteerMatch": chosen_candidate.matchPercent,
                    "assignedVolunteerDistance": chosen_candidate.distance,
                    "assignedVolunteerReason": chosen_candidate.reason,
                    "assignedVolunteerNgoId": chosen_candidate.sourceNgoId or ngo_id,
                    "assignedVolunteerNgoName": chosen_candidate.sourceNgoName if chosen_candidate.sourceNgoId else _get_ngo_name(ngo_id),
                    "supportActivated": bool(chosen_candidate.isPartnerSupport),
                    "scoreSharePercent": int(chosen_candidate.scoreSharePercent or 0),
                    "status": MissionStatus.dispatched.value,
                    "statusText": "Volunteer en route" if target_audience == "volunteer" else "Field worker en route",
                },
                update_event_actor_key="volunteerId",
                update_event_actor_name_key="volunteerName",
                notification_title=str(mission_data.get("title") or "Mission assignment"),
                notification_message=f"New mission assigned in {zone.name}",
                notification_metadata={
                    "zoneId": zone.id,
                    "zoneName": zone.name,
                    "targetAudience": target_audience,
                    "autoAssigned": True,
                },
            )

            assigned += 1
            assigned_ids.append(mission_id)
            details.append({"missionId": mission_id, "status": "assigned", "assignee": chosen_candidate.name})
        except HTTPException as exc:
            failed += 1
            details.append({"missionId": mission_id, "status": "failed", "reason": str(exc.detail)})
        except Exception as exc:
            failed += 1
            details.append({"missionId": mission_id, "status": "failed", "reason": str(exc)})

    if assigned > 0:
        notify_ngo_coordinators(
            ngo_id,
            type="missions_auto_assigned",
            title="Pending missions auto-assigned",
            message=f"Auto-assigned {assigned} pending mission(s).",
            metadata={
                "assigned": assigned,
                "totalPending": total_pending,
                "failed": failed,
                "skipped": skipped,
            },
            timestamp=_now(),
        )

    return AutoAssignPendingResult(
        totalPending=total_pending,
        assigned=assigned,
        skipped=skipped,
        failed=failed,
        assignedMissionIds=assigned_ids,
        details=details,
    )


@router.get("/missions/weekly-report", response_model=dict[str, Any])
async def export_weekly_mission_report(
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = _get_coordinator_ngo_id(user)
    now = _now()
    week_start = now - timedelta(days=7)

    mission_docs = db.collection("missions").where("ngoId", "==", ngo_id).stream()
    rows: list[dict[str, Any]] = []

    for doc in mission_docs:
        mission_data = doc.to_dict() or {}
        created_at = _parse_iso_datetime(mission_data.get("createdAt")) or _read_timestamp(mission_data.get("createdAt"))
        updated_at = _parse_iso_datetime(mission_data.get("updatedAt")) or _read_timestamp(mission_data.get("updatedAt"))
        completed_at = _parse_iso_datetime(mission_data.get("completedAt")) or _read_timestamp(mission_data.get("completedAt"))

        reference_times = [value for value in [created_at, updated_at, completed_at] if isinstance(value, datetime)]
        if reference_times and max(reference_times) < week_start:
            continue

        rows.append(
            {
                "missionId": doc.id,
                "title": str(mission_data.get("title") or "Untitled mission"),
                "zone": str(mission_data.get("zoneName") or mission_data.get("zoneId") or ""),
                "needType": str(mission_data.get("needType") or ""),
                "targetAudience": str(mission_data.get("targetAudience") or "fieldworker"),
                "priority": str(mission_data.get("priority") or "medium"),
                "status": str(mission_data.get("status") or MissionStatus.pending.value),
                "assignee": str(mission_data.get("assignedToName") or ""),
                "familiesHelped": int(mission_data.get("familiesHelped") or 0),
                "newUpdates": int(mission_data.get("newUpdates") or 0),
                "sourceReports": len(mission_data.get("sourceReportIds") or []),
                "createdAt": created_at.isoformat() if isinstance(created_at, datetime) else None,
                "updatedAt": updated_at.isoformat() if isinstance(updated_at, datetime) else None,
                "completedAt": completed_at.isoformat() if isinstance(completed_at, datetime) else None,
                "autoAssigned": bool(mission_data.get("autoAssigned") or False),
            }
        )

    status_counts = Counter(str(row.get("status") or "").lower() for row in rows)
    report = {
        "generatedAt": now.isoformat(),
        "windowStart": week_start.isoformat(),
        "windowEnd": now.isoformat(),
        "summary": {
            "total": len(rows),
            "pending": status_counts.get(MissionStatus.pending.value, 0),
            "active": sum(status_counts.get(status, 0) for status in ACTIVE_MISSION_STATUSES),
            "completed": status_counts.get(MissionStatus.completed.value, 0),
            "failed": status_counts.get(MissionStatus.failed.value, 0),
            "cancelled": status_counts.get(MissionStatus.cancelled.value, 0),
            "criticalPriority": sum(1 for row in rows if row.get("priority") == MissionPriority.critical.value),
            "autoAssigned": sum(1 for row in rows if row.get("autoAssigned") is True),
            "familiesHelped": sum(int(row.get("familiesHelped") or 0) for row in rows),
        },
        "missions": rows,
    }
    return report


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
    target_audience = str(mission_data.get("targetAudience") or "fieldworker").strip().lower()
    if target_audience not in {"fieldworker", "volunteer"}:
        target_audience = "fieldworker"
    expected_role = "volunteer" if target_audience == "volunteer" else "fieldworker"
    audience_label = "Volunteer" if target_audience == "volunteer" else "Field worker"

    volunteer_id = payload.volunteerId.strip()
    volunteer_snapshot = db.collection("users").document(volunteer_id).get()
    if not volunteer_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{audience_label} not found")

    volunteer_data = volunteer_snapshot.to_dict() or {}
    volunteer_ngo_id = str(volunteer_data.get("ngoId") or "").strip()
    is_partner_support = volunteer_ngo_id != ngo_id
    if not volunteer_ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{audience_label} is not mapped to an NGO")

    if is_partner_support and target_audience == "volunteer":
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
    elif is_partner_support and target_audience == "fieldworker":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Field worker assignment must be from your NGO")

    role = str(volunteer_data.get("role") or "").lower().strip()
    if role != expected_role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Selected user is not a {expected_role}")

    responder_distance_km = _distance_to_zone_km(volunteer_data, zone)
    zone_radius_km = max(0.1, float(zone.radiusMeters or 1000) / 1000.0)
    if responder_distance_km is not None and responder_distance_km > zone_radius_km:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Selected {expected_role} is outside zone radius "
                f"({round(responder_distance_km, 1)} km > {round(zone_radius_km, 1)} km)"
            ),
        )

    candidate = _score_candidate(
        volunteer_data | {"id": volunteer_id},
        zone,
        str(mission_data.get("needType") or ""),
        _infer_zone_local_languages(zone),
        source_ngo_id=volunteer_ngo_id if is_partner_support else None,
        source_ngo_name=_get_ngo_name(volunteer_ngo_id) if is_partner_support else None,
    )
    now = _now()
    mission_update = {
        "assignedTo": candidate.id,
        "assignedToName": candidate.name,
        "assignedRole": target_audience,
        "assignedVolunteerMatch": candidate.matchPercent,
        "assignedVolunteerDistance": candidate.distance,
        "assignedVolunteerReason": candidate.reason,
        "assignedVolunteerNgoId": volunteer_ngo_id,
        "assignedVolunteerNgoName": candidate.sourceNgoName if is_partner_support else _get_ngo_name(ngo_id),
        "supportActivated": is_partner_support,
        "scoreSharePercent": 50 if is_partner_support else 0,
        "status": MissionStatus.dispatched.value,
        "statusText": "Volunteer en route" if target_audience == "volunteer" else "Field worker en route",
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
        "targetAudience": target_audience,
        "timestamp": now,
        "submittedBy": user["id"],
    })

    notify_users(
        [candidate.id],
        type="mission_assigned",
        mission_id=mission_id,
        title=mission_data.get("title") or "Mission assignment",
        message=f"New mission assigned in {zone.name}",
        metadata={"zoneId": zone.id, "zoneName": zone.name, "targetAudience": target_audience},
        timestamp=now,
    )

    notify_ngo_coordinators(
        ngo_id,
        type="mission_assignment_updated",
        mission_id=mission_id,
        title=f"{audience_label} assigned",
        message=f"{candidate.name} assigned to mission {mission_data.get('title') or mission_id}.",
        metadata={
            "volunteerId": candidate.id,
            "volunteerName": candidate.name,
            "zoneId": zone.id,
            "zoneName": zone.name,
            "targetAudience": target_audience,
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

