from __future__ import annotations

from datetime import datetime, timedelta
from math import atan2, cos, radians, sin, sqrt
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from core.dependencies import role_required
from core.firebase import db
from models.mission import MissionStatus
from services.copilot_data_access import CoordinatorWriteLayer

PREFIX = "/coordinator"
TAGS = ["coordinator"]
router = APIRouter()

ACTIVE_MISSION_STATUSES = {
    MissionStatus.dispatched.value,
    MissionStatus.en_route.value,
    MissionStatus.on_ground.value,
}


class VolunteerScoreDimensions(BaseModel):
    skillMatch: int
    proximity: int
    languageMatch: int
    pastSuccess: int
    emotionalCapacity: int
    zoneFamiliarity: int
    availability: int
    burnoutRisk: int


class VolunteerAIBreakdown(BaseModel):
    dimensions: VolunteerScoreDimensions
    reasoning: str


class VolunteerDecisionLogItem(BaseModel):
    date: str
    missionType: str
    score: int
    outcome: str
    status: str


class VolunteerMissionHistoryItem(BaseModel):
    zone: str
    type: str
    outcome: str
    date: str


class VolunteerDnaProfile(BaseModel):
    skill: int
    proximity: int
    emotional: int
    language: int
    success: int
    availability: int


class CoordinatorVolunteerItem(BaseModel):
    id: str
    name: str
    initials: str
    org: str
    matchPercent: int
    distance: str
    distanceKm: float
    skills: list[str] = Field(default_factory=list)
    burnout: str
    missions: int
    successRate: int
    color: str
    availability: str
    aiBreakdown: VolunteerAIBreakdown
    decisionLog: list[VolunteerDecisionLogItem] = Field(default_factory=list)
    missionHistory: list[VolunteerMissionHistoryItem] = Field(default_factory=list)
    dnaProfile: VolunteerDnaProfile
    languages: list[str] = Field(default_factory=list)
    availableNow: bool
    activeMissionCount: int
    hasThisWeekActivity: bool


class CoordinatorVolunteersSummary(BaseModel):
    totalVolunteers: int
    availableNow: int
    onMission: int
    burnoutRisk: int


class CoordinatorVolunteersFilters(BaseModel):
    skills: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)


class CoordinatorVolunteersResponse(BaseModel):
    summary: CoordinatorVolunteersSummary
    filters: CoordinatorVolunteersFilters
    volunteers: list[CoordinatorVolunteerItem] = Field(default_factory=list)
    total: int


class AddVolunteerRequest(BaseModel):
    name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    phone: str = ""
    skills: list[str] = Field(default_factory=list)
    availability: str = "available"
    zones: list[str] = Field(default_factory=list)
    primaryLanguage: str = "English"
    additionalLanguages: list[str] = Field(default_factory=list)
    travelRadius: int = Field(default=5, ge=1, le=50)
    emotionalCapacity: str = "moderate"
    avoidCategories: list[str] = Field(default_factory=list)


class AddVolunteerResponse(BaseModel):
    created: bool
    volunteer: dict[str, Any]


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


def _initials(name: str) -> str:
    parts = [part.strip() for part in name.split() if part.strip()]
    if not parts:
        return "NA"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return f"{parts[0][0]}{parts[1][0]}".upper()


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return max(0.1, r * c)


def _clamp_score(value: float) -> int:
    return int(max(0, min(100, round(value))))


def _avatar_color(volunteer_id: str) -> str:
    palette = [
        "bg-primary",
        "bg-success",
        "bg-warning",
        "bg-primary-glow",
        "bg-destructive",
    ]
    idx = sum(ord(ch) for ch in volunteer_id) % len(palette)
    return palette[idx]


def _mission_outcome_label(status: str) -> tuple[str, str]:
    normalized = status.lower().strip()
    if normalized == MissionStatus.completed.value:
        return "completed", "success"
    if normalized in {MissionStatus.failed.value, MissionStatus.cancelled.value}:
        return "incomplete", "warning"
    return normalized or "pending", "warning"


def _safe_split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip().lower() for item in value.split(",") if item.strip()]


@router.get("/volunteers", response_model=CoordinatorVolunteersResponse)
async def get_coordinator_volunteers(
    user: dict[str, Any] = Depends(role_required("coordinator")),
    search: str | None = Query(default=None),
    availability: str | None = Query(default=None),
    skills: str | None = Query(default=None),
    languages: str | None = Query(default=None),
    min_match: int = Query(default=0, ge=0, le=100, alias="minMatch"),
    max_distance_km: float = Query(default=30.0, ge=0.1, le=1000, alias="maxDistanceKm"),
    sort_by: str = Query(default="match", alias="sortBy"),
) -> CoordinatorVolunteersResponse:
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have an associated NGO")

    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)

    ngo_name = "Community NGO"
    ngo_doc = db.collection("ngos").document(ngo_id).get()
    if ngo_doc.exists:
        ngo_name = str((ngo_doc.to_dict() or {}).get("name") or ngo_name)

    coordinator_zone_ids = [str(item) for item in (user.get("zones") or []) if str(item).strip()]

    zone_rows = db.collection("zones").where("ngoIds", "array_contains", ngo_id).stream()
    zones_by_id: dict[str, dict[str, Any]] = {}
    for row in zone_rows:
        data = row.to_dict() or {}
        zones_by_id[row.id] = {
            "id": row.id,
            "name": str(data.get("name") or row.id),
            "lat": float(data.get("lat") or 0.0),
            "lng": float(data.get("lng") or 0.0),
        }

    reference_zone_id = coordinator_zone_ids[0] if coordinator_zone_ids else (next(iter(zones_by_id.keys()), ""))
    reference_zone = zones_by_id.get(reference_zone_id, {"lat": 12.9716, "lng": 77.5946})

    mission_rows = (
        db.collection("missions")
        .where("ngoId", "==", ngo_id)
        .where("targetAudience", "==", "volunteer")
        .stream()
    )

    missions_by_volunteer: dict[str, list[dict[str, Any]]] = {}
    for row in mission_rows:
        mission = row.to_dict() or {}
        assigned_to = str(mission.get("assignedTo") or "").strip()
        if not assigned_to:
            continue
        mission["id"] = row.id
        missions_by_volunteer.setdefault(assigned_to, []).append(mission)

    volunteer_rows = (
        db.collection("users")
        .where("ngoId", "==", ngo_id)
        .where("role", "==", "volunteer")
        .stream()
    )

    normalized_skills = _safe_split_csv(skills)
    normalized_languages = _safe_split_csv(languages)
    normalized_search = (search or "").strip().lower()
    normalized_availability = (availability or "").strip().lower()

    all_skill_tags: set[str] = set()
    all_languages: set[str] = set()
    computed_items: list[CoordinatorVolunteerItem] = []

    for row in volunteer_rows:
        profile = row.to_dict() or {}
        volunteer_id = row.id
        name = str(profile.get("name") or "Volunteer")

        raw_skills = [str(item).strip() for item in (profile.get("skills") or []) if str(item).strip()]
        for skill_tag in raw_skills:
            all_skill_tags.add(skill_tag)

        primary_language = str(profile.get("primaryLanguage") or profile.get("language") or "").strip()
        additional_languages = [str(item).strip() for item in (profile.get("additionalLanguages") or []) if str(item).strip()]
        volunteer_languages = [lang for lang in [primary_language, *additional_languages] if lang]
        for language_item in volunteer_languages:
            all_languages.add(language_item)

        volunteer_zone_ids = [str(item).strip() for item in (profile.get("zones") or []) if str(item).strip()]
        volunteer_zone = zones_by_id.get(volunteer_zone_ids[0]) if volunteer_zone_ids else None

        if volunteer_zone and volunteer_zone.get("lat") and volunteer_zone.get("lng"):
            distance_km = _distance_km(
                float(reference_zone.get("lat") or 12.9716),
                float(reference_zone.get("lng") or 77.5946),
                float(volunteer_zone.get("lat") or 12.9716),
                float(volunteer_zone.get("lng") or 77.5946),
            )
        else:
            distance_km = 10.0

        volunteer_missions = missions_by_volunteer.get(volunteer_id, [])
        active_mission_count = sum(
            1
            for mission in volunteer_missions
            if str(mission.get("status") or "").lower() in ACTIVE_MISSION_STATUSES
        )

        mission_total = len(volunteer_missions)
        completed_count = sum(
            1
            for mission in volunteer_missions
            if str(mission.get("status") or "").lower() == MissionStatus.completed.value
        )
        failed_count = sum(
            1
            for mission in volunteer_missions
            if str(mission.get("status") or "").lower() in {MissionStatus.failed.value, MissionStatus.cancelled.value}
        )

        stored_success_rate = float(profile.get("successRate") or 0.0)
        computed_success_rate = (completed_count / max(1, completed_count + failed_count)) * 100 if (completed_count + failed_count) > 0 else stored_success_rate
        success_rate = _clamp_score(computed_success_rate)

        burnout_risk = str(profile.get("burnoutRisk") or "low").lower().strip()
        if burnout_risk not in {"low", "medium", "high"}:
            burnout_risk = "medium"

        availability_status = str(profile.get("availability") or "available").lower().strip()
        available_now = availability_status in {"available", "online"}

        recent_mission_stamp = None
        for mission in volunteer_missions:
            stamp = _read_timestamp(mission.get("updatedAt") or mission.get("completedAt") or mission.get("createdAt"))
            if stamp and (recent_mission_stamp is None or stamp > recent_mission_stamp):
                recent_mission_stamp = stamp
        has_this_week_activity = bool(recent_mission_stamp and recent_mission_stamp >= week_ago)

        skill_match_score = 70
        if normalized_skills:
            overlap = len({item.lower() for item in raw_skills} & set(normalized_skills))
            skill_match_score = _clamp_score((overlap / max(1, len(normalized_skills))) * 100)
        elif raw_skills:
            skill_match_score = _clamp_score(min(100, 65 + len(raw_skills) * 7))

        language_match_score = 70
        if normalized_languages:
            overlap = len({item.lower() for item in volunteer_languages} & set(normalized_languages))
            language_match_score = _clamp_score((overlap / max(1, len(normalized_languages))) * 100)
        elif volunteer_languages:
            language_match_score = _clamp_score(min(100, 60 + len(volunteer_languages) * 12))

        proximity_score = _clamp_score(max(0, 100 - distance_km * 8))
        emotional_capacity = float(profile.get("emotionalCapacity") or 70.0)
        emotional_capacity_score = _clamp_score(emotional_capacity)

        zone_familiarity = 100 if (reference_zone_id and reference_zone_id in volunteer_zone_ids) else (70 if volunteer_zone_ids else 45)
        availability_score = 100 if available_now else 35
        burnout_safe_score = {"low": 95, "medium": 72, "high": 40}.get(burnout_risk, 70)

        dimensions = VolunteerScoreDimensions(
            skillMatch=skill_match_score,
            proximity=proximity_score,
            languageMatch=language_match_score,
            pastSuccess=success_rate,
            emotionalCapacity=emotional_capacity_score,
            zoneFamiliarity=zone_familiarity,
            availability=availability_score,
            burnoutRisk=burnout_safe_score,
        )

        match_percent = _clamp_score(
            dimensions.skillMatch * 0.2
            + dimensions.proximity * 0.15
            + dimensions.languageMatch * 0.1
            + dimensions.pastSuccess * 0.2
            + dimensions.emotionalCapacity * 0.1
            + dimensions.zoneFamiliarity * 0.1
            + dimensions.availability * 0.1
            + dimensions.burnoutRisk * 0.05
        )

        reasoning = (
            f"{name.split(' ')[0]} scores {match_percent}% based on "
            f"{dimensions.skillMatch}% skill fit, {dimensions.proximity}% proximity, "
            f"{dimensions.pastSuccess}% success history, and {dimensions.burnoutRisk}% burnout safety."
        )

        history_rows = sorted(
            volunteer_missions,
            key=lambda mission: _read_timestamp(mission.get("updatedAt") or mission.get("completedAt") or mission.get("createdAt")) or datetime.min,
            reverse=True,
        )

        mission_history: list[VolunteerMissionHistoryItem] = []
        decision_log: list[VolunteerDecisionLogItem] = []
        for mission in history_rows[:6]:
            status_raw = str(mission.get("status") or "pending")
            outcome, log_status = _mission_outcome_label(status_raw)
            stamp = _read_timestamp(mission.get("updatedAt") or mission.get("completedAt") or mission.get("createdAt"))
            date_text = stamp.strftime("%b %d") if stamp else "--"
            zone_name = str(mission.get("zoneName") or zones_by_id.get(str(mission.get("zoneId") or ""), {}).get("name") or "Zone")
            need_type = str(mission.get("needType") or "Mission")
            mission_history.append(
                VolunteerMissionHistoryItem(
                    zone=zone_name,
                    type=need_type,
                    outcome=outcome,
                    date=date_text,
                )
            )

            mission_weight = {"critical": 8, "high": 4, "medium": 0, "low": -2}.get(str(mission.get("priority") or "medium").lower(), 0)
            log_score = _clamp_score(match_percent + mission_weight)
            decision_log.append(
                VolunteerDecisionLogItem(
                    date=date_text,
                    missionType=need_type.replace("_", " ").title(),
                    score=log_score,
                    outcome=outcome.title(),
                    status=log_status,
                )
            )

        item = CoordinatorVolunteerItem(
            id=volunteer_id,
            name=name,
            initials=_initials(name),
            org=ngo_name,
            matchPercent=match_percent,
            distance=f"{distance_km:.1f} km",
            distanceKm=round(distance_km, 2),
            skills=raw_skills[:5],
            burnout=burnout_risk,
            missions=int(profile.get("missionsCompleted") or mission_total),
            successRate=success_rate,
            color=_avatar_color(volunteer_id),
            availability=availability_status,
            aiBreakdown=VolunteerAIBreakdown(dimensions=dimensions, reasoning=reasoning),
            decisionLog=decision_log,
            missionHistory=mission_history,
            dnaProfile=VolunteerDnaProfile(
                skill=dimensions.skillMatch,
                proximity=dimensions.proximity,
                emotional=dimensions.emotionalCapacity,
                language=dimensions.languageMatch,
                success=dimensions.pastSuccess,
                availability=dimensions.availability,
            ),
            languages=volunteer_languages,
            availableNow=available_now,
            activeMissionCount=active_mission_count,
            hasThisWeekActivity=has_this_week_activity,
        )
        computed_items.append(item)

    # Pre-filter summary uses full NGO volunteer pool.
    summary = CoordinatorVolunteersSummary(
        totalVolunteers=len(computed_items),
        availableNow=sum(1 for item in computed_items if item.availableNow),
        onMission=sum(1 for item in computed_items if item.activeMissionCount > 0),
        burnoutRisk=sum(1 for item in computed_items if item.burnout == "high"),
    )

    filtered = computed_items

    if normalized_search:
        filtered = [
            item
            for item in filtered
            if normalized_search in item.name.lower()
            or normalized_search in item.org.lower()
            or any(normalized_search in skill.lower() for skill in item.skills)
        ]

    if normalized_availability == "available_now":
        filtered = [item for item in filtered if item.availableNow]
    elif normalized_availability == "this_week":
        filtered = [item for item in filtered if item.hasThisWeekActivity]

    if normalized_skills:
        filtered = [
            item
            for item in filtered
            if set(normalized_skills).issubset({skill.lower() for skill in item.skills})
        ]

    if normalized_languages:
        filtered = [
            item
            for item in filtered
            if set(normalized_languages).issubset({language.lower() for language in item.languages})
        ]

    filtered = [item for item in filtered if item.matchPercent >= min_match and item.distanceKm <= max_distance_km]

    sort_key = sort_by.strip().lower()
    if sort_key == "distance":
        filtered.sort(key=lambda item: (item.distanceKm, -item.matchPercent))
    elif sort_key == "missions":
        filtered.sort(key=lambda item: (item.missions, item.successRate), reverse=True)
    else:
        filtered.sort(key=lambda item: (item.matchPercent, item.successRate), reverse=True)

    filters_meta = CoordinatorVolunteersFilters(
        skills=sorted(all_skill_tags),
        languages=sorted(all_languages),
    )

    return CoordinatorVolunteersResponse(
        summary=summary,
        filters=filters_meta,
        volunteers=filtered,
        total=len(filtered),
    )


@router.post("/volunteers", response_model=AddVolunteerResponse, status_code=status.HTTP_201_CREATED)
async def add_coordinator_volunteer(
    payload: AddVolunteerRequest,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> AddVolunteerResponse:
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have an associated NGO")

    write = CoordinatorWriteLayer(
        ngo_id=ngo_id,
        user_id=str(user.get("id") or user.get("uid") or "").strip(),
        role=str(user.get("role") or ""),
    )

    volunteer = write.add_volunteer(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        skills=payload.skills,
        availability=payload.availability,
        zones=payload.zones,
        primary_language=payload.primaryLanguage,
        additional_languages=payload.additionalLanguages,
        travel_radius=payload.travelRadius,
        emotional_capacity=payload.emotionalCapacity,
        avoid_categories=payload.avoidCategories,
    )
    return AddVolunteerResponse(created=True, volunteer=volunteer)
