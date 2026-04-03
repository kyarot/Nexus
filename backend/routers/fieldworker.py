from __future__ import annotations

import logging
import json
from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from google.cloud.firestore_v1.base_query import FieldFilter

from core.dependencies import role_required
from core.storage import bucket
from core.firebase import db, rtdb
from services.ocr_service import process_scan
from services.voice_service import process_voice
from core.gemini import client, GEMINI_FLASH
from models.report import CanonicalReportExtraction, FieldConfidences, ReportLocation, ReportSourceType

logger = logging.getLogger(__name__)

router = APIRouter()
PREFIX = "/fieldworker"
TAGS = ["fieldworker"]

# --- Pydantic Models ---

class Location(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None
    landmark: Optional[str] = None

class ReportPayload(BaseModel):
    zoneId: str
    needType: str
    severity: str
    familiesAffected: int
    location: Location
    inputType: str
    sourceType: ReportSourceType | None = None
    imageUrl: Optional[str] = None
    voiceUrl: Optional[str] = None
    transcript: Optional[str] = None
    transcriptEnglish: Optional[str] = None
    landmark: Optional[str] = None
    additionalNotes: Optional[str] = None
    ocrRaw: Optional[Any] = None
    extractedData: dict = Field(default_factory=dict)
    confidence: int
    safetySignals: List[str] = Field(default_factory=list)
    fieldConfidences: dict[str, int] | None = None


class ReportUpdatePayload(BaseModel):
    zoneId: str | None = None
    needType: str | None = None
    severity: str | None = None
    familiesAffected: int | None = None
    location: Location | None = None
    inputType: str | None = None
    sourceType: ReportSourceType | None = None
    imageUrl: Optional[str] = None
    voiceUrl: Optional[str] = None
    transcript: Optional[str] = None
    transcriptEnglish: Optional[str] = None
    landmark: Optional[str] = None
    additionalNotes: Optional[str] = None
    extractedData: dict | None = None
    confidence: int | None = None
    safetySignals: List[str] | None = None
    fieldConfidences: dict[str, int] | None = None


def _coerce_location(location_data: Any) -> ReportLocation:
    if isinstance(location_data, ReportLocation):
        return location_data
    if isinstance(location_data, BaseModel):
        location_data = location_data.model_dump()
    if isinstance(location_data, dict):
        return ReportLocation.model_validate(location_data)
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
    location_data = extracted.get("location") if extracted.get("location") is not None else payload.location

    field_confidences = extracted.get("fieldConfidences") or payload.fieldConfidences or {}

    return CanonicalReportExtraction(
        sourceType=source_type,
        needType=str(extracted.get("needType") or payload.needType),
        severity=str(extracted.get("severity") or payload.severity).lower(),
        familiesAffected=int(extracted.get("familiesAffected") or payload.familiesAffected),
        location=_coerce_location(location_data),
        landmark=extracted.get("landmark") or payload.landmark or payload.location.landmark,
        additionalNotes=extracted.get("additionalNotes") or payload.additionalNotes,
        safetySignals=list(extracted.get("safetySignals") or payload.safetySignals or []),
        confidence=int(extracted.get("confidence") or payload.confidence),
        fieldConfidences=_coerce_field_confidences(field_confidences),
        transcript=extracted.get("transcript") or payload.transcript,
        transcriptEnglish=extracted.get("transcriptEnglish") or payload.transcriptEnglish,
        imageUrl=extracted.get("imageUrl") or payload.imageUrl,
        voiceUrl=extracted.get("voiceUrl") or payload.voiceUrl,
    )


def _canonical_report_dict(payload: ReportPayload) -> dict[str, Any]:
    canonical = _normalise_extraction(payload).model_dump()
    return canonical


def _find_active_mission(zone_id: str, need_type: str):
    return db.collection("missions")\
        .where(filter=FieldFilter("zoneId", "==", zone_id))\
        .where(filter=FieldFilter("needType", "==", need_type))\
        .where(filter=FieldFilter("status", "in", ["dispatched", "en_route", "on_ground"]))\
        .limit(1)\
        .get()


def _build_report_record(
    payload: ReportPayload,
    *,
    report_id: str,
    user_id: str,
    merged_into: str | None,
    created_at: datetime,
    updated_at: datetime | None = None,
) -> dict[str, Any]:
    canonical_report = _canonical_report_dict(payload)
    record = {
        "id": report_id,
        "submittedBy": user_id,
        "zoneId": payload.zoneId,
        "createdAt": created_at,
        "status": "synced",
        "mergedIntoMissionId": merged_into,
        **canonical_report,
        "location": canonical_report["location"],
        "extractedData": canonical_report,
        "inputType": payload.inputType,
        "sourceType": canonical_report["sourceType"],
        "imageUrl": canonical_report.get("imageUrl"),
        "voiceUrl": canonical_report.get("voiceUrl"),
        "transcript": canonical_report.get("transcript"),
        "transcriptEnglish": canonical_report.get("transcriptEnglish"),
        "fieldConfidences": canonical_report.get("fieldConfidences"),
        "safetySignals": canonical_report.get("safetySignals", []),
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
        logger.info(f"Triggering synthesis for zone {zone_id} with {len(unmerged)} reports.")
        # Actual synthesis logic would go here (or call another service)

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
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    contents = await file.read()
    extracted = await process_scan(contents, file.content_type)
    
    # Upload to GCS
    image_url = None
    if bucket:
        timestamp = int(datetime.now().timestamp())
        blob_path = f"surveys/{user['id']}/{timestamp}.jpg"
        blob = bucket.blob(blob_path)
        blob.upload_from_string(contents, content_type=file.content_type)
        blob.make_public()
        image_url = blob.public_url
    else:
        logger.warning("GCS bucket not configured, skipping upload")

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
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be audio")

    contents = await file.read()
    extracted = await process_voice(contents, language)
    
    # Upload to GCS
    voice_url = None
    if bucket:
        timestamp = int(datetime.now().timestamp())
        blob_path = f"voice/{user['id']}/{timestamp}.wav"
        blob = bucket.blob(blob_path)
        blob.upload_from_string(contents, content_type=file.content_type)
        blob.make_public()
        voice_url = blob.public_url
    else:
        logger.warning("GCS bucket not configured, skipping upload")

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
    # Check for duplicate active mission
    # Mission mission if zoneId AND needType match and status in active statuses
    active_missions = _find_active_mission(payload.zoneId, payload.needType)
    
    merged_into = None
    if active_missions:
        merged_into = active_missions[0].id
    
    # Create report
    report_ref = db.collection("reports").document()
    report_data = _build_report_record(
        payload,
        report_id=report_ref.id,
        user_id=user["id"],
        merged_into=merged_into,
        created_at=datetime.now(),
    )
    
    report_ref.set(report_data)
    
    triggered_synthesis = False
    if merged_into:
        # Merge report into existing mission updates if needed
        db.collection("missions").document(merged_into).collection("updates").add({
            "type": "report_merged",
            "reportId": report_ref.id,
            "timestamp": datetime.now(),
            "submittedBy": user["id"]
        })
    else:
        # Trigger synthesis check as background task
        background_tasks.add_task(trigger_synthesis_check, payload.zoneId)
        triggered_synthesis = True # Simplified for response

    return {
        "reportId": report_ref.id,
        "merged": merged_into is not None,
        "missionId": merged_into,
        "triggeredSynthesis": triggered_synthesis
    }

@router.get("/reports")
async def get_report_history(
    user: dict = Depends(role_required("fieldworker"))
):
    reports_snapshot = db.collection("reports")\
        .where(filter=FieldFilter("submittedBy", "==", user["id"]))\
        .get()
    
    reports = [r.to_dict() for r in reports_snapshot]
    
    # Sort in memory to avoid Firestore index requirement
    # Firestore timestamps can be directly compared if they are datetime objects
    reports.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    
    # Limit to 20 after sorting
    reports = reports[:20]
    for r in reports:
        if "createdAt" in r and isinstance(r["createdAt"], datetime):
            r["createdAt"] = r["createdAt"].isoformat()

    return {
        "reports": reports,
        "total": len(reports)
    }

@router.post("/offline-sync")
async def offline_sync(
    reports: List[ReportPayload],
    background_tasks: BackgroundTasks,
    user: dict = Depends(role_required("fieldworker"))
):
    synced_count = 0
    merged_count = 0
    errors = []
    
    for i, payload in enumerate(reports):
        try:
            # Process sequential to avoid race conditions
            # Check duplicate
            active_missions = db.collection("missions")\
                .where("zoneId", "==", payload.zoneId)\
                .where("needType", "==", payload.needType)\
                .where("status", "in", ["dispatched", "en_route", "on_ground"])\
                .limit(1)\
                .get()
            
            merged_into = active_missions[0].id if active_missions else None
            
            report_ref = db.collection("reports").document()
            report_data = _build_report_record(
                payload,
                report_id=report_ref.id,
                user_id=user["id"],
                merged_into=merged_into,
                created_at=datetime.now(),
            )
            report_ref.set(report_data)
            
            if merged_into:
                merged_count += 1
                db.collection("missions").document(merged_into).collection("updates").add({
                    "type": "report_merged",
                    "reportId": report_ref.id,
                    "timestamp": datetime.now(),
                    "submittedBy": user["id"]
                })
            else:
                background_tasks.add_task(trigger_synthesis_check, payload.zoneId)
            
            synced_count += 1
        except Exception as e:
            errors.append({"index": i, "error": str(e)})
            
    return {
        "synced": synced_count,
        "merged": merged_count,
        "errors": errors
    }


@router.patch("/reports/{report_id}")
async def update_report(
    report_id: str,
    payload: ReportUpdatePayload,
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
    merged_report.setdefault("needType", existing_report.get("needType", "General"))
    merged_report.setdefault("severity", existing_report.get("severity", "medium"))
    merged_report.setdefault("location", existing_report.get("location", {}))

    if not isinstance(merged_report.get("location"), Location):
        merged_report["location"] = Location.model_validate(merged_report["location"])

    merged_extracted = merged_report.get("extractedData") if isinstance(merged_report.get("extractedData"), dict) else {}
    merged_extracted.update({
        "sourceType": _normalize_source_type(merged_report.get("sourceType") or merged_report.get("inputType") or existing_report.get("sourceType") or existing_report.get("inputType") or "scan"),
        "needType": merged_report.get("needType"),
        "severity": str(merged_report.get("severity") or "medium").lower(),
        "familiesAffected": merged_report.get("familiesAffected"),
        "location": merged_report["location"].model_dump(),
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
        merged_into=merged_into,
        created_at=existing_report.get("createdAt") or now,
        updated_at=now,
    )
    updated_report["resubmittedAt"] = now
    updated_report["createdAt"] = existing_report.get("createdAt") or now

    report_ref.set(updated_report)

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

@router.get("/mission/active")
async def get_active_mission(
    user: dict = Depends(role_required("fieldworker"))
):
    missions = db.collection("missions")\
        .where("assignedTo", "==", user["id"])\
        .where("status", "in", ["dispatched", "en_route", "on_ground"])\
        .limit(1)\
        .get()
    
    if not missions:
        return {"mission": None, "updates": []}
    
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
        mission_ref.update({"status": payload.status})
        
    return {"updated": True, "rtdbWritten": True}

@router.post("/mission/{missionId}/voice-update")
async def voice_field_update(
    missionId: str,
    file: UploadFile = File(...),
    user: dict = Depends(role_required("fieldworker"))
):
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be audio")

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
        extracted = await process_voice(contents, prompt=prompt)
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
    db.collection("missions").document(missionId).collection("updates").add(update_data)
    
    return {
        "transcript": extracted.get("transcript"),
        "keyFindings": extracted.get("keyFindings"),
        "updateId": missionId # Simplified
    }

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
    user_ref.update({
        "missionsCompleted": user_data.get("missionsCompleted", 0) + 1,
        "totalHours": user_data.get("totalHours", 0) + 1 # Calc simplified
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
            zone_ref.collection("interactions").add({
                "missionId": missionId,
                "timestamp": now,
                "safetyFlags": safety_data.get("safetyFlags"),
                "sentiment": safety_data.get("sentiment"),
                "summary": safety_data.get("summary")
            })
            # Recomputing safety score could be a background task
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
