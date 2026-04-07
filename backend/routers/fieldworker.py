from __future__ import annotations

import logging
import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from core.dependencies import role_required
from core.storage import bucket
from core.firebase import db, rtdb
from services.ocr_service import process_scan
from services.voice_service import process_voice
from services.mission_synthesis import upsert_mission_from_report
from services.insights_synthesis import synthesize_zone_insight
from models.report import (
    AssignmentRequirementProfile,
    CanonicalReportExtraction,
    FieldConfidences,
    NeedIncident,
    RequiredResource,
    OfflineSyncRequest,
    ReportCreatePayload,
    ReportLocation,
    ReportSourceType,
)

logger = logging.getLogger(__name__)

router = APIRouter()
PREFIX = "/fieldworker"
TAGS = ["fieldworker"]
ACTIVE_MISSION_STATUSES = ["dispatched", "en_route", "on_ground"]

# --- Pydantic Models ---

class Location(BaseModel):
    lat: float
    lng: float
    address: str | None = None
    landmark: str | None = None


class ReportPayload(ReportCreatePayload):
    zoneId: str
    needType: str
    severity: str
    familiesAffected: int
    location: Location
    inputType: str
    sourceType: ReportSourceType | None = None  # backward compatibility
    imageUrl: str | None = None
    voiceUrl: str | None = None
    transcript: str | None = None
    transcriptEnglish: str | None = None
    landmark: str | None = None
    additionalNotes: str | None = None
    ocrRaw: dict[str, Any] | None = None
    extractedData: dict[str, Any] = Field(default_factory=dict)
    confidence: int
    safetySignals: list[str] = Field(default_factory=list)
    fieldConfidences: dict[str, int] | None = None


class ReportUpdatePayload(BaseModel):
    zoneId: str | None = None
    needType: str | None = None
    severity: str | None = None
    familiesAffected: int | None = None
    personsAffected: int | None = None
    location: Location | None = None
    inputType: str | None = None
    sourceType: ReportSourceType | None = None
    householdRef: str | None = None
    visitType: str | None = None
    verificationState: str | None = None
    needIncidents: list[dict[str, Any]] | None = None
    preferredResponderType: str | None = None
    requiredSkills: list[str] | None = None
    languageNeeds: list[str] | None = None
    safeVisitTimeWindows: list[str] | None = None
    estimatedEffortMinutes: int | None = None
    revisitRecommendedAt: str | None = None
    imageUrl: str | None = None
    voiceUrl: str | None = None
    transcript: str | None = None
    transcriptEnglish: str | None = None
    landmark: str | None = None
    additionalNotes: str | None = None
    extractedData: dict | None = None
    confidence: int | None = None
    safetySignals: list[str] | None = None
    fieldConfidences: dict[str, int] | None = None


SEVERITY_ORDER = {
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}


def _normalize_severity(value: Any, default: str = "medium") -> str:
    normalized = str(value or default).strip().lower()
    if normalized not in SEVERITY_ORDER:
        return default
    return normalized


def _coerce_non_negative_int(value: Any, default: int = 0) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default


def _synthesize_persons_affected(families: int, explicit_persons: Any = None) -> int:
    persons = _coerce_non_negative_int(explicit_persons, default=0)
    if persons > 0:
        return persons
    return families * 4


def _coerce_need_incidents(data: Any) -> list[NeedIncident]:
    incidents: list[NeedIncident] = []
    if isinstance(data, list):
        for item in data:
            if not isinstance(item, dict):
                continue
            resources: list[RequiredResource] = []
            for resource in item.get("requiredResources") or []:
                if not isinstance(resource, dict):
                    continue
                resources.append(
                    RequiredResource(
                        name=str(resource.get("name") or "resource"),
                        quantity=_coerce_non_negative_int(resource.get("quantity"), 0),
                        priority=_normalize_severity(resource.get("priority"), "medium"),
                    )
                )

            incidents.append(
                NeedIncident(
                    needType=str(item.get("needType") or "general"),
                    severity=_normalize_severity(item.get("severity"), "medium"),
                    urgencyWindowHours=max(1, _coerce_non_negative_int(item.get("urgencyWindowHours"), 24)),
                    familiesAffected=_coerce_non_negative_int(item.get("familiesAffected"), 0),
                    personsAffected=_coerce_non_negative_int(item.get("personsAffected"), 0),
                    vulnerableGroups=[str(group) for group in (item.get("vulnerableGroups") or [])],
                    requiredResources=resources,
                    riskFlags=[str(flag) for flag in (item.get("riskFlags") or [])],
                )
            )
    return incidents


def _synthesize_need_incidents(payload: ReportPayload, extracted: dict[str, Any]) -> list[NeedIncident]:
    candidate = extracted.get("needIncidents") or payload.needIncidents
    incidents = _coerce_need_incidents(candidate)
    if incidents:
        return incidents

    families = _coerce_non_negative_int(extracted.get("familiesAffected"), payload.familiesAffected)
    persons = _synthesize_persons_affected(
        families,
        (extracted.get("personsAffected") if isinstance(extracted, dict) else None) or payload.personsAffected,
    )
    top_need = str(extracted.get("needType") or payload.needType or "general").strip().lower()
    severity = _normalize_severity(extracted.get("severity") or payload.severity, "medium")
    risk_flags = [str(flag) for flag in (extracted.get("safetySignals") or payload.safetySignals or [])]

    default_resource_name = f"{top_need.replace(' ', '-')}-support"

    return [
        NeedIncident(
            needType=top_need,
            severity=severity,
            urgencyWindowHours=24 if severity in {"high", "critical"} else 72,
            familiesAffected=families,
            personsAffected=persons,
            vulnerableGroups=[],
            requiredResources=[
                RequiredResource(
                    name=default_resource_name,
                    quantity=families,
                    priority=severity,
                )
            ] if families > 0 else [],
            riskFlags=risk_flags,
        )
    ]


def _normalize_assignment_profile(payload: ReportPayload, extracted: dict[str, Any]) -> AssignmentRequirementProfile:
    profile_data = extracted.get("assignmentRequirementProfile") if isinstance(extracted.get("assignmentRequirementProfile"), dict) else {}
    preferred = (
        profile_data.get("preferredResponderType")
        or extracted.get("preferredResponderType")
        or payload.preferredResponderType
        or "volunteer"
    )
    preferred = str(preferred).strip().lower()
    if preferred not in {"volunteer", "ngo_staff", "mixed"}:
        preferred = "volunteer"

    required_skills = profile_data.get("requiredSkills") or extracted.get("requiredSkills") or payload.requiredSkills or []
    language_needs = profile_data.get("languageNeeds") or extracted.get("languageNeeds") or payload.languageNeeds or []
    safe_windows = (
        profile_data.get("safeVisitTimeWindows")
        or extracted.get("safeVisitTimeWindows")
        or payload.safeVisitTimeWindows
        or []
    )
    estimated_effort = profile_data.get("estimatedEffortMinutes")
    if estimated_effort is None:
        estimated_effort = extracted.get("estimatedEffortMinutes")
    if estimated_effort is None:
        estimated_effort = payload.estimatedEffortMinutes

    revisit_at = (
        profile_data.get("revisitRecommendedAt")
        or extracted.get("revisitRecommendedAt")
        or payload.revisitRecommendedAt
    )

    return AssignmentRequirementProfile(
        preferredResponderType=preferred,
        requiredSkills=[str(skill) for skill in required_skills],
        languageNeeds=[str(lang) for lang in language_needs],
        safeVisitTimeWindows=[str(window) for window in safe_windows],
        estimatedEffortMinutes=max(5, _coerce_non_negative_int(estimated_effort, 60)),
        revisitRecommendedAt=str(revisit_at) if revisit_at else None,
    )


def _coerce_location(location_data: Any) -> ReportLocation:
    if isinstance(location_data, ReportLocation):
        return location_data
    if isinstance(location_data, BaseModel):
        location_data = location_data.model_dump()
    if isinstance(location_data, dict):
        return ReportLocation.model_validate(location_data)
    if isinstance(location_data, str):
        return ReportLocation(lat=0.0, lng=0.0, address=location_data)
    return ReportLocation(lat=0.0, lng=0.0)


def _coerce_field_confidences(data: Any) -> FieldConfidences:
    if isinstance(data, FieldConfidences):
        return data
    if isinstance(data, dict):
        return FieldConfidences.model_validate(data)
    return FieldConfidences()


def _normalize_source_type(value: Any) -> ReportSourceType:
    normalized = str(value or "scan").strip().lower()
    if normalized in {"voice", "audio"}:
        return "voice"
    return "scan"


def _normalise_extraction(payload: ReportPayload) -> CanonicalReportExtraction:
    extracted = payload.extractedData if isinstance(payload.extractedData, dict) else {}
    source_type = _normalize_source_type(
        payload.sourceType or payload.inputType or extracted.get("sourceType") or "scan"
    )

    # Gemini may return location as plain text; preserve payload coordinates and add address.
    extracted_location = extracted.get("location")
    if isinstance(extracted_location, str):
        location_data: Any = {
            "lat": payload.location.lat,
            "lng": payload.location.lng,
            "address": extracted_location,
            "landmark": payload.location.landmark,
        }
    elif extracted_location is not None:
        location_data = extracted_location
    else:
        location_data = payload.location

    field_confidences = extracted.get("fieldConfidences") or payload.fieldConfidences or {}
    families_affected = _coerce_non_negative_int(extracted.get("familiesAffected"), payload.familiesAffected)
    persons_affected = _synthesize_persons_affected(
        families_affected,
        (extracted.get("personsAffected") if isinstance(extracted, dict) else None) or payload.personsAffected,
    )
    normalized_incidents = _synthesize_need_incidents(payload, extracted)
    assignment_profile = _normalize_assignment_profile(payload, extracted)

    visit_type = str(extracted.get("visitType") or payload.visitType or "first_visit").strip().lower()
    if visit_type not in {"first_visit", "follow_up", "revisit"}:
        visit_type = "first_visit"

    verification_state = str(extracted.get("verificationState") or payload.verificationState or "unverified").strip().lower()
    if verification_state not in {"unverified", "verified", "rejected"}:
        verification_state = "unverified"

    return CanonicalReportExtraction(
        sourceType=source_type,
        needType=str(extracted.get("needType") or payload.needType),
        severity=_normalize_severity(extracted.get("severity") or payload.severity),
        familiesAffected=families_affected,
        personsAffected=persons_affected,
        location=_coerce_location(location_data),
        householdRef=str(extracted.get("householdRef") or payload.householdRef) if (extracted.get("householdRef") or payload.householdRef) else None,
        visitType=visit_type,
        verificationState=verification_state,
        needIncidents=normalized_incidents,
        assignmentRequirementProfile=assignment_profile,
        landmark=extracted.get("landmark") or payload.landmark or payload.location.landmark,
        additionalNotes=extracted.get("additionalNotes") or payload.additionalNotes,
        safetySignals=list(extracted.get("safetySignals") or payload.safetySignals or []),
        confidence=max(0, min(100, _coerce_non_negative_int(extracted.get("confidence"), payload.confidence))),
        fieldConfidences=_coerce_field_confidences(field_confidences),
        transcript=extracted.get("transcript") or payload.transcript,
        transcriptEnglish=extracted.get("transcriptEnglish") or payload.transcriptEnglish,
        imageUrl=extracted.get("imageUrl") or payload.imageUrl,
        voiceUrl=extracted.get("voiceUrl") or payload.voiceUrl,
    )


def _canonical_report_dict(payload: ReportPayload) -> dict[str, Any]:
    canonical = _normalise_extraction(payload).model_dump()
    return canonical


def _compute_terrain_inputs(canonical_report: dict[str, Any]) -> dict[str, Any]:
    incidents = canonical_report.get("needIncidents") or []
    if not incidents:
        incidents = [
            {
                "severity": canonical_report.get("severity", "medium"),
                "familiesAffected": canonical_report.get("familiesAffected", 0),
                "personsAffected": canonical_report.get("personsAffected", 0),
                "urgencyWindowHours": 72,
                "riskFlags": canonical_report.get("safetySignals") or [],
                "needType": canonical_report.get("needType") or "general",
            }
        ]

    max_severity = max(SEVERITY_ORDER.get(str(item.get("severity", "medium")), 2) for item in incidents)
    total_families = sum(_coerce_non_negative_int(item.get("familiesAffected"), 0) for item in incidents)
    total_persons = sum(_coerce_non_negative_int(item.get("personsAffected"), 0) for item in incidents)
    min_urgency = min(max(1, _coerce_non_negative_int(item.get("urgencyWindowHours"), 72)) for item in incidents)
    risk_flags = sorted(
        {
            str(flag)
            for item in incidents
            for flag in (item.get("riskFlags") or [])
        }
    )

    severity_component = min(45.0, max_severity * 11.25)
    families_component = min(20.0, total_families * 0.6)
    persons_component = min(15.0, total_persons * 0.12)
    urgency_component = min(12.0, max(0.0, (48.0 - float(min_urgency)) * 0.25))
    safety_component = min(8.0, len(risk_flags) * 2.0)
    confidence_weight = float(max(0, min(100, _coerce_non_negative_int(canonical_report.get("confidence"), 0)))) / 100.0

    base_score = severity_component + families_component + persons_component + urgency_component + safety_component
    score = min(100.0, round(base_score * (0.6 + 0.4 * confidence_weight), 2))

    if score >= 80:
        risk_level = "critical"
    elif score >= 60:
        risk_level = "high"
    elif score >= 35:
        risk_level = "medium"
    else:
        risk_level = "low"

    return {
        "incidentCount": len(incidents),
        "maxSeverity": max_severity,
        "familiesAffected": total_families,
        "personsAffected": total_persons,
        "minUrgencyWindowHours": min_urgency,
        "riskFlags": risk_flags,
        "score": score,
        "riskLevel": risk_level,
        "confidence": max(0, min(100, _coerce_non_negative_int(canonical_report.get("confidence"), 0))),
    }


def _update_zone_terrain(zone_id: str, canonical_report: dict[str, Any], created_at: datetime) -> None:
    zone_ref = db.collection("zones").document(zone_id)
    zone_snapshot = zone_ref.get()
    if not zone_snapshot.exists:
        return

    zone_data = zone_snapshot.to_dict() or {}
    terrain_inputs = _compute_terrain_inputs(canonical_report)
    current_score = float(zone_data.get("currentScore") or 0.0)
    new_score = round((current_score * 0.7) + (terrain_inputs["score"] * 0.3), 2)

    signal_counts = zone_data.get("signalCounts") if isinstance(zone_data.get("signalCounts"), dict) else {}
    incidents = canonical_report.get("needIncidents") or []
    for incident in incidents:
        need_key = str(incident.get("needType") or canonical_report.get("needType") or "general").strip().lower()
        signal_counts[need_key] = _coerce_non_negative_int(signal_counts.get(need_key), 0) + 1
    if terrain_inputs["riskFlags"]:
        signal_counts["safety"] = _coerce_non_negative_int(signal_counts.get("safety"), 0) + len(terrain_inputs["riskFlags"])

    sorted_needs = sorted(signal_counts.items(), key=lambda item: item[1], reverse=True)
    top_needs = [name for name, _ in sorted_needs[:3]]

    existing_history = zone_data.get("scoreHistory") if isinstance(zone_data.get("scoreHistory"), list) else []
    history_entry = {
        "timestamp": created_at.isoformat(),
        "score": new_score,
        "riskLevel": terrain_inputs["riskLevel"],
    }
    score_history = (existing_history + [history_entry])[-40:]

    previous_score = float(existing_history[-1].get("score", current_score)) if existing_history else current_score
    if new_score > previous_score + 2:
        trend_direction = "up"
    elif new_score < previous_score - 2:
        trend_direction = "down"
    else:
        trend_direction = "stable"

    report_volume_7d = _coerce_non_negative_int(zone_data.get("reportVolume7d"), 0) + 1
    terrain_confidence = round(
        min(100.0, (float(zone_data.get("terrainConfidence") or 0.0) * 0.6) + (terrain_inputs["confidence"] * 0.4)),
        2,
    )

    zone_ref.update(
        {
            "currentScore": new_score,
            "riskLevel": terrain_inputs["riskLevel"],
            "signalCounts": signal_counts,
            "topNeeds": top_needs,
            "trendDirection": trend_direction,
            "terrainConfidence": terrain_confidence,
            "reportVolume7d": report_volume_7d,
            "forecastScore": round((new_score * 0.85) + (terrain_inputs["score"] * 0.15), 2),
            "forecastConfidence": round(min(100.0, terrain_confidence * 0.9 + 10.0), 2),
            "scoreHistory": score_history,
            "updatedAt": created_at.isoformat(),
        }
    )


def _find_active_mission(zone_id: str, need_type: str):
    return db.collection("missions")\
        .where(filter=FieldFilter("zoneId", "==", zone_id))\
        .where(filter=FieldFilter("needType", "==", need_type))\
        .where(filter=FieldFilter("status", "in", ["dispatched", "en_route", "on_ground"]))\
        .limit(1)\
        .get()


def _normalize_need(value: str) -> str:
    return value.strip().lower().replace("-", " ")


def _get_assigned_active_mission(user_id: str, mission_id: str | None = None):
    query = db.collection("missions")\
        .where(filter=FieldFilter("assignedTo", "==", user_id))\
        .where(filter=FieldFilter("status", "in", ACTIVE_MISSION_STATUSES))

    if mission_id:
        snapshot = db.collection("missions").document(mission_id).get()
        if not snapshot.exists:
            raise HTTPException(status_code=404, detail="Assigned mission not found")
        data = snapshot.to_dict() or {}
        if data.get("assignedTo") != user_id or data.get("status") not in ACTIVE_MISSION_STATUSES:
            raise HTTPException(status_code=403, detail="Mission is not an active assignment for this field worker")
        return snapshot

    missions = query.limit(1).get()
    if not missions:
        raise HTTPException(
            status_code=403,
            detail="No active assigned mission. Reports must be submitted against an assigned mission.",
        )
    return missions[0]


def _assert_report_matches_mission(payload: ReportPayload, mission_doc) -> None:
    mission_data = mission_doc.to_dict() or {}
    mission_zone_id = str(mission_data.get("zoneId") or "").strip()
    mission_need_type = str(mission_data.get("needType") or "").strip()

    if mission_zone_id and payload.zoneId.strip() != mission_zone_id:
        raise HTTPException(
            status_code=422,
            detail=f"zoneId mismatch. Expected assigned mission zone '{mission_zone_id}'.",
        )

    if mission_need_type and _normalize_need(payload.needType) != _normalize_need(mission_need_type):
        raise HTTPException(
            status_code=422,
            detail=f"needType mismatch. Expected assigned mission need '{mission_need_type}'.",
        )


def _build_report_record(
    payload: ReportPayload,
    *,
    report_id: str,
    user_id: str,
    ngo_id: str,
    merged_into: str | None,
    created_at: datetime,
    updated_at: datetime | None = None,
) -> dict[str, Any]:
    canonical_report = _canonical_report_dict(payload)
    terrain_inputs = _compute_terrain_inputs(canonical_report)
    assignment_profile = canonical_report.get("assignmentRequirementProfile") or {}
    record = {
        "id": report_id,
        "submittedBy": user_id,
        "submittedByName": payload.extractedData.get("submittedByName") if isinstance(payload.extractedData, dict) else None,
        "ngoId": ngo_id,
        "missionId": merged_into,
        "zoneId": payload.zoneId,
        "createdAt": created_at,
        "status": "synced",
        "mergedIntoMissionId": merged_into,
        **canonical_report,
        "location": canonical_report["location"],
        "extractedData": canonical_report,
        "inputType": payload.inputType,
        "sourceType": canonical_report["sourceType"],
        "verificationState": canonical_report.get("verificationState", "unverified"),
        "visitType": canonical_report.get("visitType", "first_visit"),
        "householdRef": canonical_report.get("householdRef"),
        "needIncidents": canonical_report.get("needIncidents", []),
        "assignmentRequirementProfile": assignment_profile,
        "preferredResponderType": assignment_profile.get("preferredResponderType", "volunteer"),
        "requiredSkills": assignment_profile.get("requiredSkills", []),
        "languageNeeds": assignment_profile.get("languageNeeds", []),
        "safeVisitTimeWindows": assignment_profile.get("safeVisitTimeWindows", []),
        "estimatedEffortMinutes": assignment_profile.get("estimatedEffortMinutes", 60),
        "revisitRecommendedAt": assignment_profile.get("revisitRecommendedAt"),
        "imageUrl": canonical_report.get("imageUrl"),
        "voiceUrl": canonical_report.get("voiceUrl"),
        "transcript": canonical_report.get("transcript"),
        "transcriptEnglish": canonical_report.get("transcriptEnglish"),
        "ocrRaw": payload.ocrRaw,
        "fieldConfidences": canonical_report.get("fieldConfidences"),
        "safetySignals": canonical_report.get("safetySignals", []),
        "terrainScoringInputs": terrain_inputs,
    }
    if updated_at is not None:
        record["updatedAt"] = updated_at
    return record

class StatusUpdatePayload(BaseModel):
    status: str # 'en_route'|'on_ground'|'completed'
    location: dict # {lat, lng}

class CompletionPayload(BaseModel):
    outcome: str # 'success'|'failure'
    familiesHelped: int
    notes: str


class TextMissionUpdatePayload(BaseModel):
    text: str

# --- Helpers ---

async def trigger_synthesis_check(zone_id: str):
    """
    Placeholder for synthesis check logic.
    Check if zone now has >= 5 unmerged reports.
    """
    # Query unmerged reports for the zone
    unmerged = db.collection("reports")\
        .where(filter=FieldFilter("zoneId", "==", zone_id))\
        .where(filter=FieldFilter("status", "==", "synced"))\
        .where(filter=FieldFilter("mergedIntoMissionId", "==", None))\
        .limit(5)\
        .get()
    
    if len(unmerged) >= 5:
        logger.info("Triggering synthesis for zone %s with %s reports.", zone_id, len(unmerged))
        # Placeholder for synthesis orchestration.


def should_trigger_synthesis(zone_id: str) -> bool:
    unmerged = db.collection("reports")\
        .where(filter=FieldFilter("zoneId", "==", zone_id))\
        .where(filter=FieldFilter("status", "==", "synced"))\
        .where(filter=FieldFilter("mergedIntoMissionId", "==", None))\
        .limit(5)\
        .get()
    return len(unmerged) >= 5

# --- Endpoints ---

@router.get("/stats")
async def get_fieldworker_stats(
    user: dict = Depends(role_required("fieldworker"))
):
    """
    Returns live counters for the field worker dashboard.
    """
    try:
        # Active missions count (assigned to this specific user)
        active_missions = db.collection("missions")\
            .where(filter=FieldFilter("assignedTo", "==", user["id"]))\
            .where(filter=FieldFilter("status", "in", ["dispatched", "en_route", "on_ground"]))\
            .get()
        
        # Reports count (submitted by this specific user)
        reports = db.collection("reports")\
            .where(filter=FieldFilter("submittedBy", "==", user["id"]))\
            .get()
        
        # Unmerged reports (pending syncs to a mission)
        pending = db.collection("reports")\
            .where(filter=FieldFilter("submittedBy", "==", user["id"]))\
            .where(filter=FieldFilter("mergedIntoMissionId", "==", None))\
            .get()

        return {
            "activeMissions": len(active_missions),
            "totalReports": len(reports),
            "pendingSyncs": len(pending),
            "points": 12.8 + (len(reports) * 0.2), # Simple points logic
            "zone": user.get("zone", "Bengaluru South")
        }
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        return {
            "activeMissions": 0,
            "totalReports": 0,
            "pendingSyncs": 0,
            "points": 0,
            "zone": "Unknown"
        }

@router.post("/profile/image")
async def upload_profile_image(
    file: UploadFile = File(...),
    user: dict = Depends(role_required("fieldworker"))
):
    """
    Uploads a profile picture to GCS and updates the user's Firestore document.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # 1. Upload to GCS
    photo_url = None
    if bucket:
        try:
            contents = await file.read()
            # Static filename per user to minimize bloat
            blob_path = f"avatars/{user['id']}.jpg"
            blob = bucket.blob(blob_path)
            
            # Use specific content type and cache control to prevent browser caching
            blob.upload_from_string(
                contents, 
                content_type=file.content_type
            )
            blob.cache_control = "no-cache, max-age=0"
            blob.patch()
            blob.make_public()
            # Append timestamp to the URL to force frontend refresh
            photo_url = f"{blob.public_url}?t={int(datetime.now().timestamp())}"
        except Exception as e:
            logger.error(f"GCS upload failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload image to cloud storage")
    else:
        raise HTTPException(status_code=501, detail="Cloud storage not configured")

    # 2. Update Firestore
    try:
        db.collection("users").document(user["id"]).update({
            "photoUrl": photo_url,
            "updatedAt": datetime.now()
        })
    except Exception as e:
        logger.error(f"Firestore update failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile in database")

    return {"photoUrl": photo_url}

@router.post("/scan")
async def scan_survey(
    file: UploadFile = File(...),
    zoneId: str = Form(...),
    language: str = Form("en"),
    user: dict = Depends(role_required("fieldworker"))
):
    filename_lower = (file.filename or "").lower()
    mime_type = (file.content_type or "").lower().strip()
    supported_pdf_mimes = {"application/pdf", "application/x-pdf"}
    supported_image_mimes = {"image/png", "image/jpeg", "image/jpg", "image/webp"}

    is_supported_scan = (
        mime_type in supported_pdf_mimes
        or mime_type in supported_image_mimes
        or (mime_type.startswith("image/") if mime_type else False)
        or filename_lower.endswith((".pdf", ".png", ".jpg", ".jpeg", ".webp"))
    )
    if not is_supported_scan:
        raise HTTPException(status_code=400, detail="File must be an image or PDF")

    if not zoneId.strip():
        raise HTTPException(status_code=400, detail="zoneId is required")

    contents = await file.read()
    inferred_mime = mime_type
    if not inferred_mime or inferred_mime == "application/octet-stream":
        if filename_lower.endswith(".pdf"):
            inferred_mime = "application/pdf"
        elif filename_lower.endswith((".jpg", ".jpeg")):
            inferred_mime = "image/jpeg"
        elif filename_lower.endswith(".png"):
            inferred_mime = "image/png"
        elif filename_lower.endswith(".webp"):
            inferred_mime = "image/webp"

    try:
        extracted = await process_scan(contents, inferred_mime or "application/pdf")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not bucket:
        raise HTTPException(status_code=500, detail="Cloud storage not configured")

    timestamp = int(datetime.now().timestamp())
    extension = file.filename.split(".")[-1].lower() if file.filename and "." in file.filename else "jpg"
    blob_path = f"surveys/{user['id']}/{timestamp}.{extension}"
    blob = bucket.blob(blob_path)
    blob.upload_from_string(contents, content_type=inferred_mime or "application/octet-stream")
    blob.make_public()
    image_url = blob.public_url

    return {
        "extracted": extracted,
        "imageUrl": image_url,
        "needsReview": extracted.get("confidence", 100) < 80
    }

@router.post("/voice")
async def voice_report(
    file: UploadFile = File(...),
    language: str = Form("en"),
    user: dict = Depends(role_required("fieldworker"))
):
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be audio")

    contents = await file.read()
    try:
        extracted = await process_voice(contents, language, mime_type=file.content_type)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not bucket:
        raise HTTPException(status_code=500, detail="Cloud storage not configured")

    timestamp = int(datetime.now().timestamp())
    extension = file.filename.split(".")[-1].lower() if file.filename and "." in file.filename else "wav"
    blob_path = f"voice/{user['id']}/{timestamp}.{extension}"
    blob = bucket.blob(blob_path)
    blob.upload_from_string(contents, content_type=file.content_type)
    blob.make_public()
    voice_url = blob.public_url

    return {
        "transcript": extracted.get("transcript"),
        "extracted": extracted,
        "voiceUrl": voice_url
    }

@router.post("/reports")
async def submit_report(
    payload: ReportPayload,
    background_tasks: BackgroundTasks,
    user: dict = Depends(role_required("fieldworker"))
):
    now = datetime.now()

    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()

    report_ref = db.collection("reports").document()
    report_data = _build_report_record(
        payload,
        report_id=report_ref.id,
        user_id=user["id"],
        ngo_id=ngo_id,
        merged_into=None,
        created_at=now,
    )
    report_ref.set(report_data)
    _update_zone_terrain(payload.zoneId, report_data.get("extractedData") or {}, now)

    background_tasks.add_task(upsert_mission_from_report, report_ref.id, report_data)
    if ngo_id:
        background_tasks.add_task(synthesize_zone_insight, ngo_id, payload.zoneId)

    return {
        "reportId": report_ref.id,
        "merged": False,
        "missionId": None,
        "triggeredSynthesis": True,
    }

@router.get("/reports")
async def get_report_history(
    user: dict = Depends(role_required("fieldworker"))
):
    # Avoid composite index dependency on (submittedBy, createdAt).
    reports_snapshot = (
        db.collection("reports")
        .where(filter=FieldFilter("submittedBy", "==", user["id"]))
        .get()
    )

    reports: list[dict[str, Any]] = []
    for item in reports_snapshot:
        record = item.to_dict() or {}
        record["id"] = item.id
        reports.append(record)

    # Keep API behavior: latest 20 reports sorted by newest first.
    reports.sort(
        key=lambda report: report.get("createdAt") if isinstance(report.get("createdAt"), datetime) else datetime.min,
        reverse=True,
    )
    reports = reports[:20]

    for record in reports:
        for key in ["createdAt", "updatedAt", "resubmittedAt"]:
            value = record.get(key)
            if isinstance(value, datetime):
                record[key] = value.isoformat()

    return {
        "reports": reports,
        "total": len(reports),
    }

@router.post("/offline-sync")
async def offline_sync(
    payload: OfflineSyncRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(role_required("fieldworker"))
):
    synced_count = 0
    errors: list[dict[str, Any]] = []

    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()

    for index, report_payload in enumerate(payload.reports):
        try:
            report_payload = ReportPayload.model_validate(report_payload.model_dump())

            now = datetime.now()
            report_ref = db.collection("reports").document()
            report_data = _build_report_record(
                report_payload,
                report_id=report_ref.id,
                user_id=user["id"],
                ngo_id=ngo_id,
                merged_into=None,
                created_at=now,
            )
            report_ref.set(report_data)
            _update_zone_terrain(report_payload.zoneId, report_data.get("extractedData") or {}, now)
            background_tasks.add_task(upsert_mission_from_report, report_ref.id, report_data)
            if ngo_id:
                background_tasks.add_task(synthesize_zone_insight, ngo_id, report_payload.zoneId)

            synced_count += 1
        except HTTPException as exc:
            errors.append({"index": index, "error": str(exc.detail)})
        except Exception as exc:
            errors.append({"index": index, "error": str(exc)})

    return {
        "synced": synced_count,
        "merged": 0,
        "errors": errors,
    }


@router.patch("/reports/{report_id}")
async def update_report(
    report_id: str,
    payload: ReportUpdatePayload,
    background_tasks: BackgroundTasks,
    user: dict = Depends(role_required("fieldworker"))
):
    report_ref = db.collection("reports").document(report_id)
    report_snap = report_ref.get()

    if not report_snap.exists:
        raise HTTPException(status_code=404, detail="Report not found")

    existing_report = report_snap.to_dict() or {}
    if existing_report.get("submittedBy") != user["id"]:
        raise HTTPException(status_code=403, detail="Not allowed to edit this report")

    merged_report = dict(existing_report)
    update_data = payload.model_dump(exclude_unset=True)

    if "location" in update_data and isinstance(update_data["location"], Location):
        update_data["location"] = update_data["location"].model_dump()

    if isinstance(update_data.get("extractedData"), dict):
        existing_extracted = merged_report.get("extractedData") if isinstance(merged_report.get("extractedData"), dict) else {}
        update_data["extractedData"] = {**existing_extracted, **update_data["extractedData"]}

    merged_report.update(update_data)
    merged_report.setdefault("inputType", existing_report.get("inputType", "ocr"))
    merged_report.setdefault("zoneId", existing_report.get("zoneId"))
    merged_report.setdefault("confidence", existing_report.get("confidence", 0))
    merged_report.setdefault("familiesAffected", existing_report.get("familiesAffected", 0))
    merged_report.setdefault("personsAffected", existing_report.get("personsAffected", 0))
    merged_report.setdefault("needType", existing_report.get("needType", "General"))
    merged_report.setdefault("severity", existing_report.get("severity", "medium"))
    merged_report.setdefault("location", existing_report.get("location", {}))
    merged_report.setdefault("householdRef", existing_report.get("householdRef"))
    merged_report.setdefault("visitType", existing_report.get("visitType", "first_visit"))
    merged_report.setdefault("verificationState", existing_report.get("verificationState", "unverified"))
    merged_report.setdefault("needIncidents", existing_report.get("needIncidents", []))
    merged_report.setdefault("preferredResponderType", existing_report.get("preferredResponderType", "volunteer"))
    merged_report.setdefault("requiredSkills", existing_report.get("requiredSkills", []))
    merged_report.setdefault("languageNeeds", existing_report.get("languageNeeds", []))
    merged_report.setdefault("safeVisitTimeWindows", existing_report.get("safeVisitTimeWindows", []))
    merged_report.setdefault("estimatedEffortMinutes", existing_report.get("estimatedEffortMinutes", 60))
    merged_report.setdefault("revisitRecommendedAt", existing_report.get("revisitRecommendedAt"))

    if not isinstance(merged_report.get("location"), Location):
        merged_report["location"] = Location.model_validate(merged_report["location"])

    merged_extracted = merged_report.get("extractedData") if isinstance(merged_report.get("extractedData"), dict) else {}
    assignment_profile = merged_extracted.get("assignmentRequirementProfile") if isinstance(merged_extracted.get("assignmentRequirementProfile"), dict) else {}
    assignment_profile = {
        "preferredResponderType": merged_report.get("preferredResponderType") or assignment_profile.get("preferredResponderType") or "volunteer",
        "requiredSkills": merged_report.get("requiredSkills") or assignment_profile.get("requiredSkills") or [],
        "languageNeeds": merged_report.get("languageNeeds") or assignment_profile.get("languageNeeds") or [],
        "safeVisitTimeWindows": merged_report.get("safeVisitTimeWindows") or assignment_profile.get("safeVisitTimeWindows") or [],
        "estimatedEffortMinutes": merged_report.get("estimatedEffortMinutes") or assignment_profile.get("estimatedEffortMinutes") or 60,
        "revisitRecommendedAt": merged_report.get("revisitRecommendedAt") or assignment_profile.get("revisitRecommendedAt"),
    }

    merged_extracted.update({
        "sourceType": _normalize_source_type(merged_report.get("sourceType") or merged_report.get("inputType") or existing_report.get("sourceType") or existing_report.get("inputType") or "scan"),
        "needType": merged_report.get("needType"),
        "severity": _normalize_severity(merged_report.get("severity") or "medium"),
        "familiesAffected": merged_report.get("familiesAffected"),
        "personsAffected": merged_report.get("personsAffected"),
        "location": merged_report["location"].model_dump(),
        "householdRef": merged_report.get("householdRef"),
        "visitType": merged_report.get("visitType") or "first_visit",
        "verificationState": merged_report.get("verificationState") or "unverified",
        "needIncidents": merged_report.get("needIncidents") or [],
        "assignmentRequirementProfile": assignment_profile,
        "preferredResponderType": assignment_profile["preferredResponderType"],
        "requiredSkills": assignment_profile["requiredSkills"],
        "languageNeeds": assignment_profile["languageNeeds"],
        "safeVisitTimeWindows": assignment_profile["safeVisitTimeWindows"],
        "estimatedEffortMinutes": assignment_profile["estimatedEffortMinutes"],
        "revisitRecommendedAt": assignment_profile["revisitRecommendedAt"],
        "landmark": merged_report.get("landmark") or merged_report["location"].landmark,
        "additionalNotes": merged_report.get("additionalNotes"),
        "safetySignals": merged_report.get("safetySignals") or [],
        "confidence": merged_report.get("confidence", 0),
        "fieldConfidences": merged_report.get("fieldConfidences") or {"needType": 0, "severity": 0, "families": 0},
        "transcript": merged_report.get("transcript"),
        "transcriptEnglish": merged_report.get("transcriptEnglish"),
        "imageUrl": merged_report.get("imageUrl"),
        "voiceUrl": merged_report.get("voiceUrl"),
    })
    merged_report["extractedData"] = merged_extracted

    validated_payload = ReportPayload.model_validate({
        **merged_report,
        "location": merged_report["location"].model_dump(),
        "extractedData": merged_report.get("extractedData") or {},
        "safetySignals": merged_report.get("safetySignals") or [],
        "fieldConfidences": merged_report.get("fieldConfidences") or None,
        "inputType": merged_report.get("inputType") or "ocr",
        "confidence": merged_report.get("confidence", 0),
        "needIncidents": merged_report.get("needIncidents") or merged_extracted.get("needIncidents") or [],
        "preferredResponderType": merged_report.get("preferredResponderType") or assignment_profile["preferredResponderType"],
        "requiredSkills": merged_report.get("requiredSkills") or assignment_profile["requiredSkills"],
        "languageNeeds": merged_report.get("languageNeeds") or assignment_profile["languageNeeds"],
        "safeVisitTimeWindows": merged_report.get("safeVisitTimeWindows") or assignment_profile["safeVisitTimeWindows"],
        "estimatedEffortMinutes": merged_report.get("estimatedEffortMinutes") or assignment_profile["estimatedEffortMinutes"],
        "revisitRecommendedAt": merged_report.get("revisitRecommendedAt") or assignment_profile["revisitRecommendedAt"],
        "householdRef": merged_report.get("householdRef"),
        "visitType": merged_report.get("visitType") or "first_visit",
        "verificationState": merged_report.get("verificationState") or "unverified",
    })

    merged_into = None
    matching_missions = _find_active_mission(validated_payload.zoneId, validated_payload.needType)
    if matching_missions:
        merged_into = matching_missions[0].id

    now = datetime.now()
    updated_report = _build_report_record(
        validated_payload,
        report_id=report_id,
        user_id=user["id"],
        ngo_id=str(existing_report.get("ngoId") or user.get("ngoId") or user.get("ngo_id") or "").strip(),
        merged_into=merged_into,
        created_at=existing_report.get("createdAt") or now,
        updated_at=now,
    )
    updated_report["resubmittedAt"] = now
    updated_report["createdAt"] = existing_report.get("createdAt") or now

    report_ref.set(updated_report)
    _update_zone_terrain(validated_payload.zoneId, updated_report.get("extractedData") or {}, now)

    background_tasks.add_task(upsert_mission_from_report, report_id, updated_report)
    ngo_id = str(existing_report.get("ngoId") or user.get("ngoId") or user.get("ngo_id") or "").strip()
    if ngo_id:
        background_tasks.add_task(synthesize_zone_insight, ngo_id, validated_payload.zoneId)

    if merged_into:
        db.collection("missions").document(merged_into).collection("updates").add({
            "type": "report_resubmitted",
            "reportId": report_id,
            "timestamp": now,
            "submittedBy": user["id"],
        })

    return {
        "reportId": report_id,
        "merged": merged_into is not None,
        "missionId": merged_into,
        "report": updated_report,
    }

# --- Active Mission Endpoints ---

def _mission_timestamp_value(mission_data: dict) -> datetime:
    for key in ("updatedAt", "createdAt"):
        value = mission_data.get(key)
        if isinstance(value, datetime):
            return value
    return datetime.min


def _coerce_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        # Keep datetime arithmetic consistent by stripping tzinfo if present.
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        except ValueError:
            return None
    return None


def _compute_safety_score(interactions: list[dict[str, Any]]) -> int:
    if not interactions:
        return 50

    weights = {"positive": 1.0, "neutral": 0.5, "negative": 0.0}
    total = 0.0
    for item in interactions:
        sentiment = str((item or {}).get("sentiment") or "neutral").strip().lower()
        total += weights.get(sentiment, 0.5)

    score = int(round((total / len(interactions)) * 100))
    return max(0, min(100, score))

@router.get("/mission/active")
async def get_active_mission(
    user: dict = Depends(role_required("fieldworker"))
):
    user_id = str(user.get("id") or user.get("uid") or "").strip()
    if not user_id:
        return {"mission": None, "updates": [], "reason": "No authenticated fieldworker id found"}

    missions_snapshot = db.collection("missions")\
        .where(filter=FieldFilter("assignedTo", "==", user_id))\
        .where(filter=FieldFilter("assignedRole", "==", "fieldworker"))\
        .where(filter=FieldFilter("status", "in", ["dispatched", "en_route", "on_ground"]))\
        .get()

    missions = sorted(
        missions_snapshot,
        key=lambda doc: (
            doc.to_dict().get("priority") == "critical",
            doc.to_dict().get("priority") == "high",
            _mission_timestamp_value(doc.to_dict()),
        ),
        reverse=True,
    )

    if not missions:
        latest_assigned_snapshot = db.collection("missions")\
            .where(filter=FieldFilter("assignedTo", "==", user_id))\
            .get()

        latest_assigned = sorted(
            latest_assigned_snapshot,
            key=lambda doc: _mission_timestamp_value(doc.to_dict()),
            reverse=True,
        )

        if latest_assigned:
            last_mission = latest_assigned[0].to_dict() or {}
            last_mission["id"] = latest_assigned[0].id
            for key in ["createdAt", "updatedAt", "dispatchedAt", "completedAt", "startedAt"]:
                value = last_mission.get(key)
                if isinstance(value, datetime):
                    last_mission[key] = value.isoformat()

            reason = f"No active mission. Latest assigned mission is '{last_mission.get('status', 'unknown')}'."
            return {"mission": None, "updates": [], "lastMission": last_mission, "reason": reason}

        return {"mission": None, "updates": [], "reason": "No mission currently assigned."}
    
    mission = missions[0].to_dict()
    mission["id"] = missions[0].id
    
    # Get last 10 updates
    updates_snapshot = db.collection("missions").document(mission["id"])\
        .collection("updates")\
        .order_by("timestamp", direction="DESCENDING")\
        .limit(10)\
        .get()
    
    updates = [u.to_dict() for u in updates_snapshot]
    for u in updates:
        if "timestamp" in u and isinstance(u["timestamp"], datetime):
            u["timestamp"] = u["timestamp"].isoformat()

    for key in ["createdAt", "updatedAt", "dispatchedAt", "completedAt", "startedAt"]:
        value = mission.get(key)
        if isinstance(value, datetime):
            mission[key] = value.isoformat()

    return {"mission": mission, "updates": updates}

@router.post("/mission/{missionId}/status")
async def update_mission_status(
    missionId: str,
    payload: StatusUpdatePayload,
    user: dict = Depends(role_required("fieldworker"))
):
    mission_ref = db.collection("missions").document(missionId)
    mission_snap = mission_ref.get()
    
    if not mission_snap.exists:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    mission_data = mission_snap.to_dict()
    if mission_data.get("assignedTo") != user["id"]:
        raise HTTPException(status_code=403, detail="Not assigned to this mission")
    
    now = datetime.now()
    # 2. Write to RTDB
    rtdb.child("missionTracking").child(missionId).set({
        "volunteerId": user["id"],
        "status": payload.status,
        "location": payload.location,
        "lastUpdate": now.isoformat(),
        "isOnGround": payload.status == "on_ground"
    })
    
    # 3. Write to Firestore updates
    mission_ref.collection("updates").add({
        "type": "status_change",
        "status": payload.status,
        "timestamp": now,
        "location": payload.location,
        "submittedBy": user["id"]
    })
    
    # 4. Update status if terminal
    if payload.status in ["completed", "failed"]:
        mission_ref.update({
            "status": payload.status,
            "updatedAt": now,
            "completedAt": now if payload.status == "completed" else None,
        })
    else:
        mission_ref.update({"updatedAt": now})
        
    return {"updated": True, "rtdbWritten": True}

@router.post("/mission/{missionId}/voice-update")
async def voice_field_update(
    missionId: str,
    file: UploadFile = File(...),
    user: dict = Depends(role_required("fieldworker"))
):
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be audio")

    mission_ref = db.collection("missions").document(missionId)
    mission_snap = mission_ref.get()
    if not mission_snap.exists:
        raise HTTPException(status_code=404, detail="Mission not found")

    mission_data = mission_snap.to_dict() or {}
    if mission_data.get("assignedTo") != user["id"]:
        raise HTTPException(status_code=403, detail="Not assigned to this mission")

    contents = await file.read()
    
    # 1. Upload to GCS
    audio_url = None
    if bucket:
        timestamp = int(datetime.now().timestamp())
        blob_path = f"voice/{user['id']}/updates/{missionId}/{timestamp}.wav"
        blob = bucket.blob(blob_path)
        blob.upload_from_string(contents, content_type=file.content_type)
        blob.make_public()
        audio_url = blob.public_url
    
    # 2. Process Voice with focused prompt
    prompt = """
    Transcribe this field update. Extract key findings.
    Return JSON: {
      "transcript": "str", 
      "keyFindings": ["str"], 
      "familiesVisited": int
    }
    """
    try:
        extracted = await process_voice(contents, prompt=prompt, mime_type=file.content_type)
    except Exception as e:
        logger.error(f"Error in voice_update Gemini call: {e}")
        extracted = {"transcript": "Failed to transcribe", "keyFindings": [], "familiesVisited": 0}

    # 3. Write to updates
    update_data = {
        "type": "voice_update",
        "transcript": extracted.get("transcript"),
        "keyFindings": extracted.get("keyFindings"),
        "timestamp": datetime.now(),
        "submittedBy": user["id"],
        "audioUrl": audio_url
    }
    update_ref, _ = mission_ref.collection("updates").add(update_data)
    mission_ref.update(
        {
            "updatedAt": datetime.now(),
            "statusText": extracted.get("transcript") or mission_data.get("statusText") or "Voice update received",
        }
    )
    
    return {
        "transcript": extracted.get("transcript"),
        "keyFindings": extracted.get("keyFindings"),
        "updateId": update_ref.id
    }


@router.post("/mission/{missionId}/text-update")
async def text_field_update(
    missionId: str,
    payload: TextMissionUpdatePayload,
    user: dict = Depends(role_required("fieldworker")),
):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="text is required")

    mission_ref = db.collection("missions").document(missionId)
    mission_snap = mission_ref.get()
    if not mission_snap.exists:
        raise HTTPException(status_code=404, detail="Mission not found")

    mission_data = mission_snap.to_dict() or {}
    if mission_data.get("assignedTo") != user["id"]:
        raise HTTPException(status_code=403, detail="Not assigned to this mission")

    now = datetime.now()
    update_data = {
        "type": "text_update",
        "text": payload.text.strip(),
        "timestamp": now,
        "submittedBy": user["id"],
    }
    mission_ref.collection("updates").add(update_data)
    mission_ref.update({"updatedAt": now, "statusText": payload.text.strip()})

    return {"updated": True, "type": "text_update"}

@router.post("/mission/{missionId}/complete")
async def complete_mission(
    missionId: str,
    payload: CompletionPayload,
    user: dict = Depends(role_required("fieldworker"))
):
    mission_ref = db.collection("missions").document(missionId)
    mission_snap = mission_ref.get()
    
    if not mission_snap.exists:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    now = datetime.now()
    mission_data = mission_snap.to_dict()
    
    # 1. Update Mission
    mission_ref.update({
        "status": payload.outcome if payload.outcome == "failed" else "completed",
        "familiesHelped": payload.familiesHelped,
        "outcomeNotes": payload.notes,
        "completedAt": now
    })
    
    # 2. Delete RTDB entry
    rtdb.child("missionTracking").child(missionId).delete()
    
    # 3. Update volunteer stats
    user_ref = db.collection("users").document(user["id"])
    user_data = user_ref.get().to_dict() or {}
    mission_start = (
        _coerce_datetime(mission_data.get("startedAt"))
        or _coerce_datetime(mission_data.get("dispatchedAt"))
        or _coerce_datetime(mission_data.get("createdAt"))
    )
    if mission_start:
        duration_hours = max(0.0, (now - mission_start).total_seconds() / 3600)
    else:
        duration_hours = 0.0

    existing_hours = user_data.get("totalHours", 0)
    try:
        existing_hours = float(existing_hours)
    except (TypeError, ValueError):
        existing_hours = 0.0

    updated_total_hours = round(existing_hours + duration_hours, 2)
    user_ref.update({
        "missionsCompleted": user_data.get("missionsCompleted", 0) + 1,
        "totalHours": updated_total_hours
    })
    
    # 4. Extract safety signals from notes
    safety_extracted = False
    try:
        safety_prompt = f"""
        Extract safety observations from: '{payload.notes}'.
        Return JSON: {{
          "sentiment": "positive"|"neutral"|"negative",
          "summary": "str", 
          "safetyFlags": ["str"]
        }}
        """
        response = client.models.generate_content(
            model=GEMINI_FLASH,
            contents=safety_prompt
        )
        safety_data = json.loads(response.text.strip("```json").strip())
        
        # 5. Append to zone safety profile
        zone_id = mission_data.get("zoneId")
        if zone_id:
            zone_ref = db.collection("zones").document(zone_id)
            zone_snap = zone_ref.get()
            zone_data = zone_snap.to_dict() if zone_snap.exists else {}
            safety_profile = (zone_data or {}).get("safetyProfile") or {}
            existing_interactions = safety_profile.get("interactions") or []

            interaction = {
                "missionId": missionId,
                "timestamp": now,
                "safetyFlags": safety_data.get("safetyFlags"),
                "sentiment": safety_data.get("sentiment"),
                "summary": safety_data.get("summary")
            }

            recomputed_interactions = [
                i for i in existing_interactions if isinstance(i, dict)
            ] + [interaction]
            safety_score = _compute_safety_score(recomputed_interactions)

            zone_ref.set({
                "safetyProfile.interactions": firestore.ArrayUnion([interaction]),
                "safetyProfile.score": safety_score,
                "updatedAt": now,
            }, merge=True)
        safety_extracted = True
    except Exception as e:
        logger.error(f"Safety extraction error: {e}")

    # 6. Notify coordinator
    db.collection("notifications").add({
        "userId": mission_data.get("creatorId"), # Assuming mission creator is coordinator
        "type": "mission_completed",
        "missionId": missionId,
        "title": "Mission Completed",
        "message": f"Mission {missionId} completed by {user['name']}.",
        "timestamp": now,
        "read": False
    })

    return {
        "completed": True,
        "missionId": missionId,
        "safetyExtracted": safety_extracted
    }
