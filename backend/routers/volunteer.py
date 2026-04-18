from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from core.dependencies import role_required
from core.firebase import db
from models.inventory import MissionResourceRequestCreatePayload
from models.mission import MissionDocument, MissionListResponse, MissionStatus
from services.mission_intelligence import generate_empathy_brief

PREFIX = "/volunteer"
TAGS = ["volunteer"]
router = APIRouter()

ACTIVE_MISSION_STATUSES = {MissionStatus.dispatched.value, MissionStatus.en_route.value, MissionStatus.on_ground.value}


def _read_timestamp(value: Any) -> datetime | None:
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


def _serialize_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _to_relative_time(value: datetime | None) -> str:
    if not value:
        return "Recently"
    now = datetime.utcnow()
    diff = now - value
    minutes = int(max(0, diff.total_seconds() // 60))
    if minutes < 1:
        return "just now"
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    return f"{hours // 24}d ago"


def _status_rank(status: str) -> int:
    rank = {
        MissionStatus.pending.value: 5,
        MissionStatus.dispatched.value: 4,
        MissionStatus.en_route.value: 3,
        MissionStatus.on_ground.value: 2,
        MissionStatus.completed.value: 1,
        MissionStatus.failed.value: 0,
        MissionStatus.cancelled.value: 0,
    }
    return rank.get(status.lower(), 0)


def _to_completion_quote(mission: MissionDocument) -> str:
    if mission.outcomeNotes and str(mission.outcomeNotes).strip():
        return str(mission.outcomeNotes)
    helped = int(mission.familiesHelped or 0)
    if helped > 0:
        return f"Mission outcome recorded with {helped} families helped."
    return "Mission marked complete with verified field response."


class VolunteerDashboardHero(BaseModel):
    greeting: str
    weeklyImpactFamilies: int
    subtitle: str


class VolunteerDashboardMissionCard(BaseModel):
    id: str
    title: str
    zoneName: str
    distanceLabel: str
    durationLabel: str
    relativeTime: str
    status: str
    locationAddress: str


class VolunteerDashboardImpactItem(BaseModel):
    id: str
    title: str
    locationLabel: str
    status: str
    quote: str | None = None
    needType: str
    completedAt: str | None = None


class VolunteerDashboardSidebar(BaseModel):
    missionsPerMonth: int
    percentileText: str
    burnoutRisk: str
    burnoutScore: float
    burnoutInsight: str
    dnaProfile: dict[str, float] = Field(default_factory=dict)
    badges: list[str] = Field(default_factory=list)


class VolunteerDashboardResponse(BaseModel):
    availability: str
    hero: VolunteerDashboardHero
    priorityMission: VolunteerDashboardMissionCard | None = None
    activeMission: VolunteerDashboardMissionCard | None = None
    recentImpactHistory: list[VolunteerDashboardImpactItem] = Field(default_factory=list)
    sidebar: VolunteerDashboardSidebar


class VolunteerImpactTimelinePoint(BaseModel):
    month: str
    points: float
    avg: float


class VolunteerImpactLedgerItem(BaseModel):
    missionId: str
    name: str
    zone: str
    beforeScore: float
    afterScore: float
    deltaScore: float
    type: str
    date: str


class VolunteerImpactZoneItem(BaseModel):
    zoneId: str
    name: str
    missionCount: int
    lat: float
    lng: float


class VolunteerImpactWellbeing(BaseModel):
    risk: str
    score: float
    activity30d: dict[str, float | int]
    advice: str


class VolunteerImpactRank(BaseModel):
    globalRank: int
    level: int
    xp: int
    xpTarget: int
    title: str


class VolunteerImpactSharePayload(BaseModel):
    headline: str
    missions: int
    level: int
    shareText: str
    shareUrl: str


class VolunteerImpactResponse(BaseModel):
    range: str
    summaryCards: dict[str, dict[str, str]]
    timeline: list[VolunteerImpactTimelinePoint] = Field(default_factory=list)
    ledger: list[VolunteerImpactLedgerItem] = Field(default_factory=list)
    zones: list[VolunteerImpactZoneItem] = Field(default_factory=list)
    wellbeing: VolunteerImpactWellbeing
    dna: dict[str, float] = Field(default_factory=dict)
    badges: list[str] = Field(default_factory=list)
    rank: VolunteerImpactRank
    share: VolunteerImpactSharePayload


class VolunteerEmpathyResponse(BaseModel):
    mission: dict[str, Any]
    empathy: dict[str, Any]
    resources: list[dict[str, Any]] = Field(default_factory=list)
    pendingResourceRequests: list[dict[str, Any]] = Field(default_factory=list)


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


def _to_mission_card(mission: MissionDocument) -> VolunteerDashboardMissionCard:
    primary_time = mission.updatedAt or mission.createdAt or mission.dispatchedAt
    distance = mission.assignedVolunteerDistance or "Nearby"
    duration_label = f"{int(mission.estimatedDurationMinutes or 45)} minutes"
    address = mission.location.address if mission.location and mission.location.address else (mission.zoneName or "Assigned zone")
    return VolunteerDashboardMissionCard(
        id=mission.id,
        title=mission.title,
        zoneName=mission.zoneName or mission.ward or "Assigned zone",
        distanceLabel=str(distance),
        durationLabel=duration_label,
        relativeTime=_to_relative_time(primary_time),
        status=str(mission.status.value if isinstance(mission.status, MissionStatus) else mission.status),
        locationAddress=address,
    )


def _range_days(range_key: str) -> int | None:
    normalized = range_key.strip().lower()
    if normalized in {"month", "this-month", "this_month"}:
        return 30
    if normalized in {"3m", "three-months", "three_months"}:
        return 90
    if normalized in {"6m", "six-months", "six_months"}:
        return 180
    if normalized in {"all", "all-time", "all_time"}:
        return None
    return 90


def _month_key(value: datetime) -> str:
    return value.strftime("%Y-%m")


def _month_label(value: datetime) -> str:
    return value.strftime("%b")


def _impact_delta_from_mission(mission: MissionDocument) -> float:
    helped = max(0, int(mission.familiesHelped or 0))
    status = str(mission.status.value if isinstance(mission.status, MissionStatus) else mission.status)
    base = max(1.0, min(18.0, helped * 0.25))
    if status in {MissionStatus.failed.value, MissionStatus.cancelled.value}:
        return -round(base * 0.35, 1)
    return round(base, 1)


def _rank_title(level: int) -> str:
    if level >= 30:
        return "Legendary Community Builder"
    if level >= 20:
        return "Community Champion"
    if level >= 10:
        return "Impact Contributor"
    return "Rising Volunteer"


@router.get("/impact", response_model=VolunteerImpactResponse)
async def get_volunteer_impact(
    user: dict[str, Any] = Depends(role_required("volunteer")),
    range_key: str = Query(default="3m", alias="range"),
) -> VolunteerImpactResponse:
    uid = str(user.get("id") or user.get("uid") or "").strip()
    if not uid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user context")

    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have an associated NGO")

    days = _range_days(range_key)
    now = datetime.utcnow()
    since = (now - timedelta(days=days)) if isinstance(days, int) else None

    all_mission_rows = (
        db.collection("missions")
        .where("ngoId", "==", ngo_id)
        .where("targetAudience", "==", "volunteer")
        .stream()
    )

    all_missions: list[MissionDocument] = []
    for row in all_mission_rows:
        data = row.to_dict() or {}
        all_missions.append(_mission_from_doc(row.id, data))

    my_missions = [mission for mission in all_missions if str(mission.assignedTo or "").strip() == uid]
    my_completed = [
        mission for mission in my_missions
        if str(mission.status.value if isinstance(mission.status, MissionStatus) else mission.status)
        == MissionStatus.completed.value
    ]

    filtered_missions = [
        mission for mission in my_missions
        if not since or (mission.completedAt or mission.updatedAt or mission.createdAt or datetime.min) >= since
    ]
    filtered_completed = [
        mission for mission in filtered_missions
        if str(mission.status.value if isinstance(mission.status, MissionStatus) else mission.status)
        == MissionStatus.completed.value
    ]

    families_helped = sum(int(mission.familiesHelped or 0) for mission in filtered_completed)
    total_hours = round(sum((mission.estimatedDurationMinutes or 0) / 60 for mission in filtered_missions), 1)

    reductions = [max(0.0, _impact_delta_from_mission(mission)) for mission in filtered_missions]
    avg_reduction = round(sum(reductions) / len(reductions), 1) if reductions else 0.0
    impacted_zones = len({str(mission.zoneId or "") for mission in filtered_missions if str(mission.zoneId or "").strip()})

    # Timeline: your points vs NGO average by month.
    month_points: dict[str, float] = {}
    month_avg_bucket: dict[str, list[float]] = {}
    for mission in all_missions:
        stamp = mission.completedAt or mission.updatedAt or mission.createdAt
        if not stamp:
            continue
        if since and stamp < since:
            continue
        key = _month_key(stamp)
        points = max(1.0, float(mission.familiesHelped or 0) * 4.0)
        if str(mission.assignedTo or "").strip() == uid:
            month_points[key] = month_points.get(key, 0.0) + points
        month_avg_bucket.setdefault(key, []).append(points)

    if since:
        month_cursor = datetime(since.year, since.month, 1)
    else:
        # all-time defaults to last 12 months for readability.
        month_cursor = datetime(now.year, now.month, 1) - timedelta(days=330)
    month_end = datetime(now.year, now.month, 1)
    months: list[datetime] = []
    while month_cursor <= month_end:
        months.append(month_cursor)
        if month_cursor.month == 12:
            month_cursor = datetime(month_cursor.year + 1, 1, 1)
        else:
            month_cursor = datetime(month_cursor.year, month_cursor.month + 1, 1)

    timeline = [
        VolunteerImpactTimelinePoint(
            month=_month_label(month),
            points=round(month_points.get(_month_key(month), 0.0), 1),
            avg=round(
                (sum(month_avg_bucket.get(_month_key(month), [])) / max(1, len(month_avg_bucket.get(_month_key(month), []))))
                if month_avg_bucket.get(_month_key(month))
                else 0.0,
                1,
            ),
        )
        for month in months
    ]

    # Ledger and zone map.
    zone_ids = {str(mission.zoneId or "") for mission in filtered_missions if str(mission.zoneId or "").strip()}
    zone_docs: dict[str, dict[str, Any]] = {}
    for zone_id in zone_ids:
        zone_snap = db.collection("zones").document(zone_id).get()
        if zone_snap.exists:
            zone_docs[zone_id] = zone_snap.to_dict() or {}

    sorted_for_ledger = sorted(
        filtered_missions,
        key=lambda mission: mission.completedAt or mission.updatedAt or mission.createdAt or datetime.min,
        reverse=True,
    )
    ledger = []
    for mission in sorted_for_ledger[:8]:
        zone_data = zone_docs.get(str(mission.zoneId or ""), {})
        after_score = float(zone_data.get("currentScore") or 0.0)
        delta = _impact_delta_from_mission(mission)
        before_score = max(0.0, min(100.0, after_score + delta))
        if delta < 0:
            before_score = max(0.0, min(100.0, after_score - abs(delta)))
        ledger.append(
            VolunteerImpactLedgerItem(
                missionId=mission.id,
                name=mission.title,
                zone=mission.zoneName or mission.ward or "Zone",
                beforeScore=round(before_score, 1),
                afterScore=round(after_score, 1),
                deltaScore=round(before_score - after_score, 1),
                type="pos" if before_score >= after_score else "neg",
                date=(mission.completedAt or mission.updatedAt or mission.createdAt or now).strftime("%b %d"),
            )
        )

    zone_counts: dict[str, int] = {}
    for mission in filtered_missions:
        zone_id = str(mission.zoneId or "")
        if not zone_id:
            continue
        zone_counts[zone_id] = zone_counts.get(zone_id, 0) + 1

    zones = []
    for zone_id, count in sorted(zone_counts.items(), key=lambda item: item[1], reverse=True)[:12]:
        zone_data = zone_docs.get(zone_id, {})
        zones.append(
            VolunteerImpactZoneItem(
                zoneId=zone_id,
                name=str(zone_data.get("name") or zone_id),
                missionCount=count,
                lat=float(zone_data.get("lat") or 0.0),
                lng=float(zone_data.get("lng") or 0.0),
            )
        )

    # Wellbeing and activity summaries.
    last_30_since = now - timedelta(days=30)
    missions_30 = [
        mission for mission in my_missions
        if (mission.completedAt or mission.updatedAt or mission.createdAt or datetime.min) >= last_30_since
    ]
    avg_duration = round(
        (sum(int(mission.estimatedDurationMinutes or 0) for mission in missions_30) / len(missions_30)) if missions_30 else 0.0,
        1,
    )
    active_days = {
        (mission.completedAt or mission.updatedAt or mission.createdAt or now).date().isoformat()
        for mission in missions_30
    }
    rest_days = max(0, 30 - len(active_days))

    burnout_risk = str(user.get("burnoutRisk") or "low").lower()
    try:
        burnout_score = float(user.get("burnoutScore") or 0.0)
    except (TypeError, ValueError):
        burnout_score = 0.0

    advice = "Nexus suggests maintaining your current mission rhythm."
    if burnout_risk in {"high", "critical"} or burnout_score >= 70:
        advice = "Nexus suggests taking lighter missions this week and planning recovery windows."
    elif burnout_risk in {"medium", "moderate"} or burnout_score >= 40:
        advice = "Nexus suggests spacing high-intensity missions with recovery days."

    # Rank and level.
    volunteer_rows = (
        db.collection("users")
        .where("ngoId", "==", ngo_id)
        .where("role", "==", "volunteer")
        .stream()
    )
    ranking: list[tuple[str, int]] = []
    for row in volunteer_rows:
        data = row.to_dict() or {}
        try:
            points = int(data.get("impactPoints") or 0)
        except (TypeError, ValueError):
            points = 0
        ranking.append((row.id, points))
    ranking.sort(key=lambda item: item[1], reverse=True)

    my_rank = next((idx + 1 for idx, item in enumerate(ranking) if item[0] == uid), 0)
    level = int(user.get("level") or 1)
    xp = int(user.get("xp") or 0)
    xp_target = max(1000, level * 125)

    top_zone_name = zones[0].name if zones else "your community"
    impact_points = int(user.get("impactPoints") or 0)

    summary_cards = {
        "familiesHelped": {
            "label": "Families Helped",
            "value": str(families_helped),
            "delta": f"+{max(0, families_helped // 5)} this period",
        },
        "needScoreReduced": {
            "label": "Need Score Reduced",
            "value": f"-{avg_reduction:.1f}%",
            "delta": f"Across {impacted_zones} zones",
        },
        "totalHours": {
            "label": "Total Hours Volunteered",
            "value": f"{total_hours:.1f}h",
            "delta": "From mission logs",
        },
        "impactPoints": {
            "label": "Impact Points",
            "value": str(impact_points),
            "delta": f"Rank #{my_rank or '-'} in NGO",
        },
    }

    dna = user.get("dnaProfile") if isinstance(user.get("dnaProfile"), dict) else {}
    dna_payload = {
        "skill": float(dna.get("analyticalThinking") or 50.0),
        "reach": float(dna.get("leadership") or 50.0),
        "consistency": float(dna.get("resilience") or 50.0),
        "proximity": float(dna.get("adaptability") or 50.0),
        "urgency": float(dna.get("stamina") or 50.0),
        "empathy": float(dna.get("empathy") or 50.0),
    }

    return VolunteerImpactResponse(
        range=range_key,
        summaryCards=summary_cards,
        timeline=timeline,
        ledger=ledger,
        zones=zones,
        wellbeing=VolunteerImpactWellbeing(
            risk=burnout_risk,
            score=burnout_score,
            activity30d={
                "missions": len(missions_30),
                "avgDurationMinutes": avg_duration,
                "restDays": rest_days,
            },
            advice=advice,
        ),
        dna=dna_payload,
        badges=[str(item) for item in (user.get("badges") or []) if str(item).strip()],
        rank=VolunteerImpactRank(
            globalRank=my_rank,
            level=level,
            xp=xp,
            xpTarget=xp_target,
            title=_rank_title(level),
        ),
        share=VolunteerImpactSharePayload(
            headline=f"Helping {top_zone_name}",
            missions=len(filtered_completed),
            level=level,
            shareText=f"I have completed {len(filtered_completed)} missions and supported {families_helped} families via NEXUS.",
            shareUrl=f"https://nexus.local/volunteer/{uid}/impact",
        ),
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


@router.get("/missions/{mission_id}/updates", response_model=dict[str, Any])
async def list_volunteer_mission_updates(
    mission_id: str,
    user: dict[str, Any] = Depends(role_required("volunteer")),
) -> dict[str, Any]:
    uid = str(user.get("id") or user.get("uid") or "").strip()
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not uid or not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user context")

    selected_mission_id, _ = _pick_volunteer_mission(uid, ngo_id, mission_id)

    updates_snapshot = (
        db.collection("missions")
        .document(selected_mission_id)
        .collection("updates")
        .order_by("timestamp", direction="DESCENDING")
        .limit(40)
        .stream()
    )

    updates: list[dict[str, Any]] = []
    for doc in updates_snapshot:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        timestamp = data.get("timestamp")
        if isinstance(timestamp, datetime):
            data["timestamp"] = timestamp.isoformat()
        updates.append(data)

    return {"updates": updates}


@router.get("/dashboard", response_model=VolunteerDashboardResponse)
async def get_volunteer_dashboard(
    user: dict[str, Any] = Depends(role_required("volunteer")),
) -> VolunteerDashboardResponse:
    uid = str(user.get("id") or user.get("uid") or "").strip()
    if not uid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user context")

    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have an associated NGO")

    mission_rows = (
        db.collection("missions")
        .where("ngoId", "==", ngo_id)
        .where("targetAudience", "==", "volunteer")
        .stream()
    )

    missions: list[MissionDocument] = []
    for row in mission_rows:
        data = row.to_dict() or {}
        missions.append(_mission_from_doc(row.id, data))

    missions.sort(
        key=lambda mission: (_status_rank(str(mission.status.value if isinstance(mission.status, MissionStatus) else mission.status)), mission.updatedAt or mission.createdAt or datetime.min),
        reverse=True,
    )

    assigned_missions = [mission for mission in missions if str(mission.assignedTo or "").strip() == uid]
    now = datetime.utcnow()
    one_week_ago = now - timedelta(days=7)
    one_month_ago = now - timedelta(days=30)

    weekly_impact = sum(
        int(mission.familiesHelped or 0)
        for mission in assigned_missions
        if str(mission.status.value if isinstance(mission.status, MissionStatus) else mission.status) == MissionStatus.completed.value
        and (mission.completedAt or mission.updatedAt or mission.createdAt or datetime.min) >= one_week_ago
    )

    priority_pool = [
        mission for mission in missions
        if str(mission.status.value if isinstance(mission.status, MissionStatus) else mission.status)
        in {MissionStatus.pending.value, MissionStatus.dispatched.value, MissionStatus.en_route.value}
    ]
    priority_pool.sort(
        key=lambda mission: (
            _status_rank(str(mission.status.value if isinstance(mission.status, MissionStatus) else mission.status)),
            mission.updatedAt or mission.createdAt or datetime.min,
        ),
        reverse=True,
    )

    active_pool = [
        mission for mission in assigned_missions
        if str(mission.status.value if isinstance(mission.status, MissionStatus) else mission.status)
        in ACTIVE_MISSION_STATUSES
    ]
    active_pool.sort(key=lambda mission: (mission.updatedAt or mission.createdAt or datetime.min), reverse=True)

    completed_recent = [
        mission for mission in assigned_missions
        if str(mission.status.value if isinstance(mission.status, MissionStatus) else mission.status)
        in {MissionStatus.completed.value, MissionStatus.failed.value, MissionStatus.cancelled.value}
    ]
    completed_recent.sort(key=lambda mission: (mission.completedAt or mission.updatedAt or mission.createdAt or datetime.min), reverse=True)

    missions_per_month = sum(
        1
        for mission in assigned_missions
        if str(mission.status.value if isinstance(mission.status, MissionStatus) else mission.status) == MissionStatus.completed.value
        and (mission.completedAt or mission.updatedAt or mission.createdAt or datetime.min) >= one_month_ago
    )

    volunteer_rows = (
        db.collection("users")
        .where("ngoId", "==", ngo_id)
        .where("role", "==", "volunteer")
        .stream()
    )
    mission_counts: list[int] = []
    for row in volunteer_rows:
        data = row.to_dict() or {}
        try:
            mission_counts.append(int(data.get("missionsCompleted") or 0))
        except (TypeError, ValueError):
            mission_counts.append(0)

    my_completed = int(user.get("missionsCompleted") or 0)
    if mission_counts:
        lower_or_equal = sum(1 for count in mission_counts if count <= my_completed)
        percentile = int(round((lower_or_equal / len(mission_counts)) * 100))
    else:
        percentile = 0

    burnout_risk = str(user.get("burnoutRisk") or "low").lower()
    try:
        burnout_score = float(user.get("burnoutScore") or 0.0)
    except (TypeError, ValueError):
        burnout_score = 0.0

    burnout_insight = "Stable engagement patterns detected."
    if burnout_risk in {"high", "critical"}:
        burnout_insight = "Please take lighter missions this week and plan recovery windows."
    elif burnout_risk in {"medium", "moderate"}:
        burnout_insight = "Your load is moderate; include recovery time between assignments."

    dna = user.get("dnaProfile") if isinstance(user.get("dnaProfile"), dict) else {}
    dna_profile = {
        "skill": float(dna.get("analyticalThinking") or 50.0),
        "proximity": float(dna.get("adaptability") or 50.0),
        "emotional": float(dna.get("empathy") or 50.0),
        "lang": float(dna.get("communication") or 50.0),
        "success": float(user.get("successRate") or 0.0),
        "avail": 100.0 if str(user.get("availability") or "available").lower() == "available" else 25.0,
    }

    history_items = [
        VolunteerDashboardImpactItem(
            id=mission.id,
            title=mission.title,
            locationLabel=f"{mission.zoneName or mission.ward or 'Zone'} • {_to_relative_time(mission.completedAt or mission.updatedAt or mission.createdAt)}",
            status="SUCCESS" if str(mission.status.value if isinstance(mission.status, MissionStatus) else mission.status) == MissionStatus.completed.value else "CLOSED",
            quote=_to_completion_quote(mission),
            needType=mission.needType,
            completedAt=_serialize_datetime(mission.completedAt),
        )
        for mission in completed_recent[:5]
    ]

    return VolunteerDashboardResponse(
        availability=str(user.get("availability") or "available").lower(),
        hero=VolunteerDashboardHero(
            greeting=f"Good morning, {str(user.get('name') or 'Volunteer').split(' ')[0]}!",
            weeklyImpactFamilies=weekly_impact,
            subtitle=f"Your contribution this week impacted {weekly_impact} families.",
        ),
        priorityMission=_to_mission_card(priority_pool[0]) if priority_pool else None,
        activeMission=_to_mission_card(active_pool[0]) if active_pool else None,
        recentImpactHistory=history_items,
        sidebar=VolunteerDashboardSidebar(
            missionsPerMonth=missions_per_month,
            percentileText=f"Top {max(1, 100 - percentile)}% in your NGO" if percentile else "Building impact baseline",
            burnoutRisk=burnout_risk,
            burnoutScore=burnout_score,
            burnoutInsight=burnout_insight,
            dnaProfile=dna_profile,
            badges=[str(item) for item in (user.get("badges") or []) if str(item).strip()],
        ),
    )


def _pick_volunteer_mission(uid: str, ngo_id: str, mission_id: str | None = None) -> tuple[str, dict[str, Any]]:
    if mission_id:
        snapshot = db.collection("missions").document(mission_id).get()
        if not snapshot.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission not found")
        data = snapshot.to_dict() or {}
        if str(data.get("ngoId") or "") != ngo_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mission does not belong to your NGO")
        if str(data.get("assignedTo") or "") != uid:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mission is not assigned to you")
        return snapshot.id, data

    docs = (
        db.collection("missions")
        .where("ngoId", "==", ngo_id)
        .where("targetAudience", "==", "volunteer")
        .where("assignedTo", "==", uid)
        .stream()
    )
    rows: list[tuple[str, dict[str, Any]]] = []
    for doc in docs:
        data = doc.to_dict() or {}
        rows.append((doc.id, data))
    rows.sort(
        key=lambda row: _read_timestamp(row[1].get("updatedAt") or row[1].get("createdAt")) or datetime.min,
        reverse=True,
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No assigned mission found")
    return rows[0]


@router.get("/empathy-brief", response_model=VolunteerEmpathyResponse)
async def get_volunteer_empathy_brief(
    user: dict[str, Any] = Depends(role_required("volunteer")),
    mission_id: str | None = Query(default=None, alias="missionId"),
    regenerate: bool = Query(default=False),
) -> VolunteerEmpathyResponse:
    uid = str(user.get("id") or user.get("uid") or "").strip()
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not uid or not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user context")

    selected_mission_id, mission_data = _pick_volunteer_mission(uid, ngo_id, mission_id)

    zone_data: dict[str, Any] = {}
    zone_id = str(mission_data.get("zoneId") or "").strip()
    if zone_id:
        zone_snapshot = db.collection("zones").document(zone_id).get()
        if zone_snapshot.exists:
            zone_data = zone_snapshot.to_dict() or {}

    empathy = mission_data.get("empathyBrief") if isinstance(mission_data.get("empathyBrief"), dict) else None
    if regenerate or not empathy:
        empathy = generate_empathy_brief(mission=mission_data, volunteer=user, zone=zone_data)
        db.collection("missions").document(selected_mission_id).update(
            {"empathyBrief": empathy, "updatedAt": datetime.utcnow()}
        )

    requests_docs = (
        db.collection("missionResourceRequests")
        .where("missionId", "==", selected_mission_id)
        .where("volunteerId", "==", uid)
        .stream()
    )
    pending_requests = []
    for doc in requests_docs:
        data = doc.to_dict() or {}
        if str(data.get("status") or "") == "pending":
            pending_requests.append({"id": doc.id, **data})

    mission_payload = {"id": selected_mission_id, **mission_data}
    for key in ["createdAt", "updatedAt", "dispatchedAt", "startedAt", "completedAt"]:
        value = mission_payload.get(key)
        if isinstance(value, datetime):
            mission_payload[key] = value.isoformat()

    resources = mission_data.get("resources") if isinstance(mission_data.get("resources"), list) else []
    return VolunteerEmpathyResponse(
        mission=mission_payload,
        empathy=empathy or {},
        resources=[item for item in resources if isinstance(item, dict)],
        pendingResourceRequests=pending_requests,
    )


@router.post("/missions/{mission_id}/claim-resources", response_model=dict[str, Any])
async def claim_mission_resources(
    mission_id: str,
    user: dict[str, Any] = Depends(role_required("volunteer")),
) -> dict[str, Any]:
    uid = str(user.get("id") or user.get("uid") or "").strip()
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    selected_mission_id, mission_data = _pick_volunteer_mission(uid, ngo_id, mission_id)

    resources = mission_data.get("resources") if isinstance(mission_data.get("resources"), list) else []
    now = datetime.utcnow()
    claimed_items = 0
    for resource in resources:
        if not isinstance(resource, dict):
            continue
        item_id = str(resource.get("itemId") or "").strip()
        if not item_id:
            continue
        item_ref = db.collection("inventoryItems").document(item_id)
        item_snapshot = item_ref.get()
        if not item_snapshot.exists:
            continue
        item_data = item_snapshot.to_dict() or {}
        try:
            qty = float(resource.get("quantity") or 0)
            available = float(item_data.get("availableQty") or 0)
        except (TypeError, ValueError):
            continue
        if qty <= 0 or available <= 0:
            continue
        next_qty = max(0.0, available - qty)
        item_ref.update({"availableQty": next_qty, "updatedAt": now})
        claimed_items += 1

    mission_ref = db.collection("missions").document(selected_mission_id)
    mission_ref.update({"resourcesClaimed": True, "updatedAt": now})
    mission_ref.collection("updates").add(
        {
            "type": "resources_claimed",
            "timestamp": now,
            "submittedBy": uid,
            "count": claimed_items,
        }
    )

    coordinator_id = str(mission_data.get("creatorId") or "")
    if coordinator_id:
        db.collection("notifications").add(
            {
                "userId": coordinator_id,
                "type": "resources_claimed",
                "missionId": selected_mission_id,
                "title": "Mission resources claimed",
                "message": f"{str(user.get('name') or 'Volunteer')} claimed mission resources.",
                "timestamp": now,
                "read": False,
            }
        )

    return {"claimed": True, "itemsUpdated": claimed_items}


@router.post("/missions/{mission_id}/resource-requests", response_model=dict[str, Any])
async def request_extra_resources(
    mission_id: str,
    payload: MissionResourceRequestCreatePayload,
    user: dict[str, Any] = Depends(role_required("volunteer")),
) -> dict[str, Any]:
    uid = str(user.get("id") or user.get("uid") or "").strip()
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    selected_mission_id, mission_data = _pick_volunteer_mission(uid, ngo_id, mission_id)

    now = datetime.utcnow()
    ref = db.collection("missionResourceRequests").document()
    data = {
        "ngoId": ngo_id,
        "missionId": selected_mission_id,
        "volunteerId": uid,
        "volunteerName": str(user.get("name") or "Volunteer"),
        "zoneId": mission_data.get("zoneId"),
        "warehouseId": payload.warehouseId,
        "items": [item.model_dump() for item in payload.items],
        "reason": payload.reason,
        "status": "pending",
        "decisionNote": "",
        "createdAt": now,
        "updatedAt": now,
        "resolvedAt": None,
        "resolvedBy": None,
    }
    ref.set(data)

    coordinator_id = str(mission_data.get("creatorId") or "")
    if coordinator_id:
        db.collection("notifications").add(
            {
                "userId": coordinator_id,
                "type": "resource_request",
                "missionId": selected_mission_id,
                "requestId": ref.id,
                "title": "Extra resources requested",
                "message": f"{str(user.get('name') or 'Volunteer')} requested additional mission resources.",
                "timestamp": now,
                "read": False,
                "metadata": {
                    "volunteerId": uid,
                    "volunteerName": str(user.get("name") or "Volunteer"),
                    "warehouseId": payload.warehouseId,
                },
            }
        )

    return {"created": True, "requestId": ref.id}