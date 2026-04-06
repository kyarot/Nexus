from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.dependencies import role_required
from core.firebase import db
from models.mission import MissionDocument, MissionListResponse, MissionStatus

PREFIX = "/volunteer"
TAGS = ["volunteer"]
router = APIRouter()

ACTIVE_MISSION_STATUSES = {MissionStatus.dispatched.value, MissionStatus.en_route.value, MissionStatus.on_ground.value}


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


@router.get("/missions", response_model=MissionListResponse)
async def list_volunteer_missions(
    user: dict[str, Any] = Depends(role_required("volunteer")),
    status_filter: str | None = Query(default=None, alias="status"),
) -> MissionListResponse:
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have an associated NGO")

    mission_docs = (
        db.collection("missions")
        .where("ngoId", "==", ngo_id)
        .where("targetAudience", "==", "volunteer")
        .stream()
    )

    missions: list[dict[str, Any]] = []
    for doc in mission_docs:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        if status_filter and str(data.get("status") or "").lower() != status_filter.lower():
            continue
        missions.append(data)

    missions.sort(key=_mission_sort_key, reverse=True)
    typed_missions = [_mission_from_doc(mission["id"], mission) for mission in missions]

    status_counts = Counter(
        str(mission.status.value if isinstance(mission.status, MissionStatus) else mission.status).lower()
        for mission in typed_missions
    )

    return MissionListResponse(
        missions=typed_missions,
        total=len(typed_missions),
        active=sum(status_counts.get(status, 0) for status in ACTIVE_MISSION_STATUSES),
        pending=status_counts.get(MissionStatus.pending.value, 0),
        completed=status_counts.get(MissionStatus.completed.value, 0),
    )