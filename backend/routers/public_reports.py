from __future__ import annotations

import hashlib
import hmac
import logging
import math
import re
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from pydantic import BaseModel, Field

from core.config import settings
from core.firebase import db, rtdb
from services.drift_alerts import evaluate_zone_drift_alerts
from services.insights_synthesis import synthesize_zone_insight
from services.mission_synthesis import upsert_mission_from_report
from services.notifications_hub import notify_ngo_coordinators

PREFIX = "/public/community-voice"
TAGS = ["public"]
router = APIRouter()
logger = logging.getLogger("nexus.public_reports")

SEVERITY_MAP: dict[str, str] = {
    "critical": "critical",
    "high": "high",
    "urgent": "high",
    "normal": "medium",
    "medium": "medium",
    "low": "low",
}

CATEGORY_TO_NEED: dict[str, str] = {
    "food": "food",
    "water": "water",
    "health": "health",
    "fire": "safety",
    "fire/danger": "safety",
    "safety": "safety",
    "other": "general",
}

EVENT_LABELS: dict[str, str] = {
    "mission_created": "Mission Created",
    "mission_created_from_report": "Mission Created",
    "mission_assigned": "Team Assigned",
    "status_change": "Mission Status Updated",
    "report_linked": "Report Grouped",
    "text_update": "Field Update",
    "voice_update": "Voice Update",
    "report_resubmitted": "Report Updated",
}


class PublicReportLocation(BaseModel):
    lat: float
    lng: float
    address: str | None = None
    landmark: str | None = None


class PublicReportSubmitRequest(BaseModel):
    phoneNumber: str = Field(min_length=7, max_length=20)
    problemText: str = Field(min_length=10, max_length=3000)
    category: str = Field(min_length=2, max_length=64)
    urgencyLevel: str = Field(min_length=2, max_length=32)
    location: PublicReportLocation
    language: str | None = Field(default="en", max_length=24)


class PublicReportTrackRequest(BaseModel):
    referenceNumber: str = Field(min_length=5, max_length=32)
    phoneNumber: str = Field(min_length=7, max_length=20)


class PublicReportFeedbackRequest(BaseModel):
    referenceNumber: str = Field(min_length=5, max_length=32)
    phoneNumber: str = Field(min_length=7, max_length=20)
    message: str = Field(min_length=3, max_length=1000)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc_datetime(value: Any) -> datetime | None:
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _epoch_datetime() -> datetime:
    return datetime(1970, 1, 1, tzinfo=timezone.utc)


def _safe_str(value: Any, default: str = "") -> str:
    text = str(value or "").strip()
    return text if text else default


def _normalize_phone(value: str) -> str:
    digits = re.sub(r"\D+", "", value or "")
    if len(digits) < 7:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid phone number",
        )
    return digits


def _normalize_reference(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9-]+", "", (value or "").upper().strip())
    return cleaned


def _normalize_category(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", (value or "").strip().lower())
    return cleaned


def _normalize_need_type(category: str) -> str:
    normalized = _normalize_category(category)
    return CATEGORY_TO_NEED.get(normalized, "general")


def _normalize_severity(value: str) -> str:
    normalized = _normalize_category(value)
    return SEVERITY_MAP.get(normalized, "medium")


def _urgency_window_hours(severity: str) -> int:
    if severity == "critical":
        return 6
    if severity == "high":
        return 24
    if severity == "medium":
        return 72
    return 96


def _tracking_salt() -> str:
    configured = _safe_str(settings.PUBLIC_TRACKING_SALT)
    return configured or _safe_str(settings.JWT_SECRET_KEY, "nexus-public-salt")


def _hash_with_salt(raw: str) -> str:
    digest = hmac.new(
        _tracking_salt().encode("utf-8"),
        raw.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return digest


def _phone_hash(phone_number: str) -> str:
    return _hash_with_salt(f"phone:{phone_number}")


def _mask_phone(phone_number: str) -> str:
    if len(phone_number) <= 4:
        return phone_number
    return f"{'*' * (len(phone_number) - 4)}{phone_number[-4:]}"


def _get_client_ip(request: Request) -> str:
    forwarded_for = _safe_str(request.headers.get("x-forwarded-for"))
    if forwarded_for:
        return forwarded_for.split(",", maxsplit=1)[0].strip()
    return _safe_str(getattr(request.client, "host", ""), "unknown")


def _haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)

    a = math.sin(d_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2.0) ** 2
    return radius * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def _generate_reference() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return f"NCH-{''.join(secrets.choice(alphabet) for _ in range(8))}"


def _ensure_unique_reference(max_attempts: int = 6) -> str:
    for _ in range(max_attempts):
        ref = _generate_reference()
        exists = list(
            db.collection("reports")
            .where(filter=FieldFilter("publicReference", "==", ref))
            .limit(1)
            .stream()
        )
        if not exists:
            return ref
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate tracking reference",
    )


def _to_iso(value: Any) -> str | None:
    as_dt = _as_utc_datetime(value)
    if as_dt is not None:
        return as_dt.isoformat()
    if isinstance(value, str):
        return value
    return None


def _feedback_sentiment(message: str) -> str:
    text = _safe_str(message).lower()
    if not text:
        return "neutral"

    positive_tokens = ["thank", "helpful", "grateful", "good", "great", "clear", "support"]
    negative_tokens = ["late", "delay", "bad", "confused", "missing", "problem", "issue"]

    positive = sum(1 for token in positive_tokens if token in text)
    negative = sum(1 for token in negative_tokens if token in text)

    if positive > negative:
        return "positive"
    if negative > positive:
        return "negative"
    return "neutral"


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _audit(event_type: str, payload: dict[str, Any]) -> None:
    try:
        db.collection("publicReportAudit").add({
            "eventType": event_type,
            "payload": payload,
            "timestamp": _utcnow(),
        })
    except Exception as exc:
        logger.warning("Failed to write public audit event %s: %s", event_type, exc)


def _record_metric(key: str, amount: int = 1) -> None:
    try:
        db.collection("publicReportMetrics").document("summary").set(
            {
                key: firestore.Increment(amount),
                "updatedAt": _utcnow(),
            },
            merge=True,
        )
    except Exception as exc:
        logger.warning("Failed to update public metric %s: %s", key, exc)


def _apply_rate_limit(limit_key: str, limit: int, window_minutes: int = 60) -> None:
    now = _utcnow()
    ref = db.collection("publicRateLimits").document(limit_key)
    snapshot = ref.get()
    current = snapshot.to_dict() if snapshot.exists else {}

    window_start = _as_utc_datetime(current.get("windowStart"))
    count = _safe_int(current.get("count"), 0)

    if not window_start or (now - window_start) >= timedelta(minutes=window_minutes):
        ref.set({
            "windowStart": now,
            "count": 1,
            "limit": limit,
            "updatedAt": now,
        })
        return

    if count >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )

    ref.set({"count": count + 1, "updatedAt": now}, merge=True)


def _check_and_update_dedupe(
    phone_hash: str,
    category: str,
    problem_text: str,
    location: PublicReportLocation,
    *,
    report_id: str | None = None,
    reference: str | None = None,
    enforce_window: bool = True,
) -> None:
    problem_signature = re.sub(r"\s+", " ", problem_text.strip().lower())[:220]
    location_signature = f"{location.lat:.3f}:{location.lng:.3f}:{_safe_str(location.address).lower()[:60]}"
    dedupe_fingerprint = _hash_with_salt(
        f"dedupe:{phone_hash}:{_normalize_category(category)}:{problem_signature}:{location_signature}"
    )

    ref_doc = db.collection("publicReportDedup").document(dedupe_fingerprint)
    now = _utcnow()
    snapshot = ref_doc.get()

    if snapshot.exists:
        data = snapshot.to_dict() or {}
        last_submitted = _as_utc_datetime(data.get("lastSubmittedAt"))
        if enforce_window and last_submitted and (now - last_submitted) <= timedelta(minutes=settings.PUBLIC_DEDUPE_WINDOW_MINUTES):
            existing_reference = _safe_str(data.get("referenceNumber"), "")
            detail = "Duplicate report detected. Please wait a few minutes before sending the same report again."
            if existing_reference:
                detail = f"Duplicate report detected. Use reference {existing_reference} to track existing request."
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)

    write_payload = {
        "lastSubmittedAt": now,
        "updatedAt": now,
    }
    if report_id:
        write_payload["reportId"] = report_id
    if reference:
        write_payload["referenceNumber"] = reference

    ref_doc.set(write_payload, merge=True)


def _ensure_zone_document(zone_id: str, zone_name: str, ngo_id: str, location: PublicReportLocation) -> None:
    zone_ref = db.collection("zones").document(zone_id)
    snapshot = zone_ref.get()
    now = _utcnow()

    if snapshot.exists:
        current = snapshot.to_dict() or {}
        ngo_ids = [str(item) for item in (current.get("ngoIds") or []) if str(item).strip()]
        if ngo_id not in ngo_ids:
            ngo_ids.append(ngo_id)
            zone_ref.set({"ngoIds": ngo_ids, "updatedAt": now}, merge=True)
        return

    zone_ref.set(
        {
            "name": zone_name,
            "ward": "",
            "city": "",
            "ngoIds": [ngo_id],
            "currentScore": 0,
            "riskLevel": "low",
            "scoreHistory": [],
            "signalCounts": {
                "food": 0,
                "education": 0,
                "health": 0,
                "substance": 0,
                "shelter": 0,
                "safety": 0,
            },
            "activeMissions": 0,
            "lastIntervention": None,
            "forecastScore": 0,
            "forecastConfidence": 50,
            "generationalCohort": "",
            "safetyProfile": {
                "score": 50,
                "level": "moderate",
                "interactions": [],
                "timeOfDayFlags": {"night": False, "early_morning": False},
                "specificFlags": [],
            },
            "geometry": {"type": "Point", "coordinates": [location.lng, location.lat]},
            "lat": location.lat,
            "lng": location.lng,
            "radiusMeters": 1000,
            "createdAt": now,
            "updatedAt": now,
        }
    )


def _load_ngos() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for doc in db.collection("ngos").stream():
        data = doc.to_dict() or {}
        rows.append({"id": doc.id, **data})
    return rows


def _load_zones_index() -> dict[str, list[dict[str, Any]]]:
    by_ngo: dict[str, list[dict[str, Any]]] = {}
    for doc in db.collection("zones").stream():
        data = doc.to_dict() or {}
        zone = {"id": doc.id, **data}
        for ngo_id in [str(item) for item in (data.get("ngoIds") or []) if str(item).strip()]:
            by_ngo.setdefault(ngo_id, []).append(zone)
    return by_ngo


def _resolve_ngo_and_zone(category: str, location: PublicReportLocation) -> tuple[dict[str, Any], dict[str, Any]]:
    category_norm = _normalize_category(category)
    need_type = _normalize_need_type(category_norm)

    ngos = _load_ngos()
    if not ngos:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="No NGOs are configured")

    zones_by_ngo = _load_zones_index()

    scored: list[tuple[int, int, float, str, dict[str, Any], dict[str, Any]]] = []
    fallback: list[tuple[float, str, dict[str, Any], dict[str, Any]]] = []

    for ngo in ngos:
        ngo_id = _safe_str(ngo.get("id"))
        if not ngo_id:
            continue

        ngo_categories = [_normalize_category(item) for item in (ngo.get("needCategories") or []) if _safe_str(item)]
        category_match = int(category_norm in ngo_categories or need_type in ngo_categories)

        zones = zones_by_ngo.get(ngo_id) or []
        if not zones:
            continue

        best_zone: dict[str, Any] | None = None
        best_distance = float("inf")
        in_radius = 0

        for zone in zones:
            zone_lat = _safe_float(zone.get("lat"), 0.0)
            zone_lng = _safe_float(zone.get("lng"), 0.0)
            if zone_lat == 0.0 and zone_lng == 0.0:
                continue
            distance = _haversine_meters(location.lat, location.lng, zone_lat, zone_lng)
            radius = max(500.0, _safe_float(zone.get("radiusMeters"), 1000.0))
            zone_in_radius = int(distance <= radius)

            if distance < best_distance:
                best_distance = distance
                in_radius = zone_in_radius
                best_zone = zone

        if not best_zone:
            continue

        if category_match:
            scored.append(
                (
                    category_match,
                    in_radius,
                    best_distance,
                    _safe_str(ngo.get("name"), ngo_id).lower(),
                    ngo,
                    best_zone,
                )
            )
        else:
            fallback.append((best_distance, _safe_str(ngo.get("name"), ngo_id).lower(), ngo, best_zone))

    if scored:
        scored.sort(key=lambda item: (-item[0], -item[1], item[2], item[3]))
        _, _, _, _, ngo, zone = scored[0]
        return ngo, zone

    if fallback:
        fallback.sort(key=lambda item: (item[0], item[1]))
        _, _, ngo, zone = fallback[0]
        return ngo, zone

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="No NGO coverage available for the submitted location",
    )


def _count_pending_reports(ngo_id: str, zone_id: str, need_type: str) -> int:
    now = _utcnow()
    window_start = now - timedelta(days=settings.PUBLIC_SYNTHESIS_LOOKBACK_DAYS)
    normalized_need = _normalize_need_type(need_type)

    rows = (
        db.collection("reports")
        .where(filter=FieldFilter("ngoId", "==", ngo_id))
        .limit(2000)
        .stream()
    )

    count = 0
    for row in rows:
        data = row.to_dict() or {}
        if _safe_str(data.get("zoneId")) != zone_id:
            continue
        if _normalize_need_type(_safe_str(data.get("needType"))) != normalized_need:
            continue
        if _safe_str(data.get("mergedIntoMissionId")):
            continue
        created_at = _as_utc_datetime(data.get("createdAt"))
        if created_at and created_at < window_start:
            continue
        count += 1
    return count


def _run_public_synthesis(ngo_id: str, zone_id: str, need_type: str) -> None:
    threshold = max(1, int(settings.PUBLIC_SYNTHESIS_MIN_REPORTS))
    pending_count = _count_pending_reports(ngo_id, zone_id, need_type)
    if pending_count < threshold:
        return

    rows = (
        db.collection("reports")
        .where(filter=FieldFilter("ngoId", "==", ngo_id))
        .limit(2000)
        .stream()
    )

    candidates: list[tuple[datetime, str, dict[str, Any]]] = []
    for row in rows:
        data = row.to_dict() or {}
        if _safe_str(data.get("zoneId")) != zone_id:
            continue
        if _normalize_need_type(_safe_str(data.get("needType"))) != _normalize_need_type(need_type):
            continue
        if _safe_str(data.get("mergedIntoMissionId")):
            continue

        created_at = _as_utc_datetime(data.get("createdAt")) or _epoch_datetime()
        candidates.append((created_at, row.id, data))

    candidates.sort(key=lambda item: item[0])
    for _, report_id, report_data in candidates:
        try:
            upsert_mission_from_report(report_id, report_data)
        except Exception as exc:
            logger.warning("Mission synthesis failed for report %s: %s", report_id, exc)

    try:
        synthesize_zone_insight(ngo_id, zone_id)
    except Exception as exc:
        logger.warning("Insight synthesis failed for ngo=%s zone=%s: %s", ngo_id, zone_id, exc)

    try:
        evaluate_zone_drift_alerts(ngo_id, zone_id)
    except Exception as exc:
        logger.warning("Drift alert synthesis failed for ngo=%s zone=%s: %s", ngo_id, zone_id, exc)


@router.post("/reports", response_model=dict[str, Any])
async def submit_public_report(
    payload: PublicReportSubmitRequest,
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    now = _utcnow()
    client_ip = _get_client_ip(request)
    normalized_phone = _normalize_phone(payload.phoneNumber)
    phone_hash = _phone_hash(normalized_phone)

    ip_hash = _hash_with_salt(f"ip:{client_ip}")
    _apply_rate_limit(f"phone:{phone_hash}", limit=max(1, int(settings.PUBLIC_RATE_LIMIT_PHONE_PER_HOUR)))
    _apply_rate_limit(f"ip:{ip_hash}", limit=max(1, int(settings.PUBLIC_RATE_LIMIT_IP_PER_HOUR)))

    _check_and_update_dedupe(
        phone_hash,
        payload.category,
        payload.problemText,
        payload.location,
    )

    ngo, zone = _resolve_ngo_and_zone(payload.category, payload.location)

    ngo_id = _safe_str(ngo.get("id"))
    ngo_name = _safe_str(ngo.get("name"), "Assigned NGO")
    zone_id = _safe_str(zone.get("id")) or f"public-{abs(int(payload.location.lat * 1000))}-{abs(int(payload.location.lng * 1000))}"
    zone_name = _safe_str(zone.get("name"), payload.location.address or zone_id)

    _ensure_zone_document(zone_id, zone_name, ngo_id, payload.location)

    severity = _normalize_severity(payload.urgencyLevel)
    need_type = _normalize_need_type(payload.category)
    urgency_hours = _urgency_window_hours(severity)

    report_ref = db.collection("reports").document()
    reference = _ensure_unique_reference()
    tracking_token = secrets.token_urlsafe(24)

    canonical_report = {
        "sourceType": "scan",
        "needType": need_type,
        "severity": severity,
        "familiesAffected": 1,
        "personsAffected": 1,
        "location": {
            "lat": payload.location.lat,
            "lng": payload.location.lng,
            "address": payload.location.address,
            "landmark": payload.location.landmark,
        },
        "householdRef": None,
        "visitType": "first_visit",
        "verificationState": "unverified",
        "needIncidents": [
            {
                "needType": need_type,
                "severity": severity,
                "urgencyWindowHours": urgency_hours,
                "familiesAffected": 1,
                "personsAffected": 1,
                "vulnerableGroups": [],
                "requiredResources": [
                    {
                        "name": f"{need_type}-support",
                        "quantity": 1,
                        "priority": severity if severity in {"low", "medium", "high", "critical"} else "medium",
                    }
                ],
                "riskFlags": [],
            }
        ],
        "assignmentRequirementProfile": {
            "preferredResponderType": "volunteer",
            "requiredSkills": ["community-outreach"],
            "languageNeeds": [_safe_str(payload.language, "en")],
            "safeVisitTimeWindows": ["08:00-20:00"],
            "estimatedEffortMinutes": 60,
            "revisitRecommendedAt": None,
        },
        "landmark": payload.location.landmark,
        "additionalNotes": payload.problemText,
        "safetySignals": [],
        "confidence": 85,
        "fieldConfidences": {
            "needType": 85,
            "severity": 85,
            "families": 50,
            "persons": 50,
            "location": 90,
        },
        "transcript": None,
        "transcriptEnglish": None,
        "imageUrl": None,
        "voiceUrl": None,
    }

    report_data = {
        "id": report_ref.id,
        "submittedBy": f"public:{phone_hash[:16]}",
        "submittedByName": "Public Reporter",
        "submittedByPhoneMasked": _mask_phone(normalized_phone),
        "ngoId": ngo_id,
        "missionId": None,
        "zoneId": zone_id,
        "createdAt": now,
        "updatedAt": now,
        "status": "synced",
        "mergedIntoMissionId": None,
        "needType": need_type,
        "severity": severity,
        "familiesAffected": 1,
        "personsAffected": 1,
        "location": canonical_report["location"],
        "extractedData": canonical_report,
        "inputType": "public_text",
        "sourceType": "scan",
        "verificationState": "unverified",
        "visitType": "first_visit",
        "householdRef": None,
        "needIncidents": canonical_report["needIncidents"],
        "assignmentRequirementProfile": canonical_report["assignmentRequirementProfile"],
        "preferredResponderType": canonical_report["assignmentRequirementProfile"]["preferredResponderType"],
        "requiredSkills": canonical_report["assignmentRequirementProfile"]["requiredSkills"],
        "languageNeeds": canonical_report["assignmentRequirementProfile"]["languageNeeds"],
        "safeVisitTimeWindows": canonical_report["assignmentRequirementProfile"]["safeVisitTimeWindows"],
        "estimatedEffortMinutes": canonical_report["assignmentRequirementProfile"]["estimatedEffortMinutes"],
        "revisitRecommendedAt": canonical_report["assignmentRequirementProfile"]["revisitRecommendedAt"],
        "imageUrl": None,
        "voiceUrl": None,
        "transcript": None,
        "transcriptEnglish": None,
        "ocrRaw": None,
        "fieldConfidences": canonical_report["fieldConfidences"],
        "safetySignals": [],
        "additionalNotes": payload.problemText,
        "publicReference": reference,
        "publicTrackingToken": tracking_token,
        "publicPhoneHash": phone_hash,
        "publicPhoneMasked": _mask_phone(normalized_phone),
        "publicCategory": _safe_str(payload.category),
        "publicUrgencyLabel": _safe_str(payload.urgencyLevel),
        "publicLanguage": _safe_str(payload.language, "en"),
        "publicChannel": "community-voice",
        "publicClientIpHash": ip_hash,
        "publicAssignedNgoName": ngo_name,
    }
    report_ref.set(report_data)

    _check_and_update_dedupe(
        phone_hash,
        payload.category,
        payload.problemText,
        payload.location,
        report_id=report_ref.id,
        reference=reference,
        enforce_window=False,
    )

    notify_ngo_coordinators(
        ngo_id,
        type="public_report_received",
        title=f"Public report: {_safe_str(payload.category, 'General')}",
        message=f"New public report in {zone_name}. Reference {reference}.",
        request_id=report_ref.id,
        metadata={
            "referenceNumber": reference,
            "zoneId": zone_id,
            "zoneName": zone_name,
            "needType": need_type,
            "severity": severity,
            "publicChannel": "community-voice",
        },
        timestamp=now,
    )

    background_tasks.add_task(_run_public_synthesis, ngo_id, zone_id, need_type)

    _audit(
        "public_report_submitted",
        {
            "reportId": report_ref.id,
            "referenceNumber": reference,
            "ngoId": ngo_id,
            "zoneId": zone_id,
            "needType": need_type,
            "severity": severity,
            "clientIpHash": ip_hash,
            "phoneHashPrefix": phone_hash[:12],
        },
    )
    _record_metric("submitted", 1)
    _record_metric(f"submitted_need_{need_type}", 1)

    return {
        "reportId": report_ref.id,
        "referenceNumber": reference,
        "trackingToken": tracking_token,
        "ngo": {
            "id": ngo_id,
            "name": ngo_name,
        },
        "zone": {
            "id": zone_id,
            "name": zone_name,
        },
        "acceptedAt": now.isoformat(),
    }


@router.post("/track", response_model=dict[str, Any])
async def track_public_report(
    payload: PublicReportTrackRequest,
    request: Request,
) -> dict[str, Any]:
    reference = _normalize_reference(payload.referenceNumber)
    normalized_phone = _normalize_phone(payload.phoneNumber)
    phone_hash = _phone_hash(normalized_phone)
    ip_hash = _hash_with_salt(f"ip:{_get_client_ip(request)}")

    docs = list(
        db.collection("reports")
        .where(filter=FieldFilter("publicReference", "==", reference))
        .limit(3)
        .stream()
    )

    if not docs:
        _audit("public_track_not_found", {"referenceNumber": reference, "clientIpHash": ip_hash})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    docs.sort(
        key=lambda doc: _as_utc_datetime(doc.to_dict().get("createdAt")) or _epoch_datetime(),
        reverse=True,
    )

    report_doc = docs[0]
    report_data = report_doc.to_dict() or {}
    if not hmac.compare_digest(_safe_str(report_data.get("publicPhoneHash")), phone_hash):
        _audit("public_track_phone_mismatch", {"referenceNumber": reference, "clientIpHash": ip_hash})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    ngo_id = _safe_str(report_data.get("ngoId"))
    ngo_name = _safe_str(report_data.get("publicAssignedNgoName"), "Assigned NGO")
    if ngo_id:
        ngo_snapshot = db.collection("ngos").document(ngo_id).get()
        if ngo_snapshot.exists:
            ngo_name = _safe_str((ngo_snapshot.to_dict() or {}).get("name"), ngo_name)

    mission_id = _safe_str(report_data.get("missionId") or report_data.get("mergedIntoMissionId"))
    mission_data: dict[str, Any] = {}
    mission_updates: list[dict[str, Any]] = []
    tracking_data: dict[str, Any] = {}

    if mission_id:
        mission_snapshot = db.collection("missions").document(mission_id).get()
        if mission_snapshot.exists:
            mission_data = mission_snapshot.to_dict() or {}

            updates_snapshot = (
                db.collection("missions")
                .document(mission_id)
                .collection("updates")
                .order_by("timestamp", direction=firestore.Query.DESCENDING)
                .limit(30)
                .stream()
            )
            mission_updates = [item.to_dict() or {} for item in updates_snapshot]

            try:
                tracking_raw = rtdb.child("missionTracking").child(mission_id).get() or {}
                if isinstance(tracking_raw, dict):
                    tracking_data = tracking_raw
            except Exception:
                tracking_data = {}

    timeline: list[dict[str, Any]] = []

    timeline.append(
        {
            "event": "Report Logged",
            "description": "Your report was received and secured in the Nexus system.",
            "timestamp": _to_iso(report_data.get("createdAt")),
            "state": "completed",
        }
    )

    timeline.append(
        {
            "event": "Routed to NGO",
            "description": f"Assigned to {ngo_name} based on category and coverage zone.",
            "timestamp": _to_iso(report_data.get("updatedAt") or report_data.get("createdAt")),
            "state": "completed",
        }
    )

    if mission_id and mission_data:
        timeline.append(
            {
                "event": "Linked to Mission",
                "description": f"Your report is now linked to mission {mission_id}.",
                "timestamp": _to_iso(mission_data.get("createdAt") or mission_data.get("updatedAt")),
                "state": "completed",
            }
        )

        for update in reversed(mission_updates):
            update_type = _safe_str(update.get("type"), "update")
            timeline.append(
                {
                    "event": EVENT_LABELS.get(update_type, update_type.replace("_", " ").title()),
                    "description": _safe_str(update.get("text") or update.get("status") or update.get("transcript"), "Mission update received."),
                    "timestamp": _to_iso(update.get("timestamp")),
                    "state": "completed" if update_type != "status_change" else "active",
                }
            )

    mission_status = _safe_str(mission_data.get("status") if mission_data else report_data.get("status"), "synced")
    mission_progress = _safe_int(mission_data.get("progress") if mission_data else 0, 0)

    _audit(
        "public_track_success",
        {
            "referenceNumber": reference,
            "reportId": report_doc.id,
            "ngoId": ngo_id,
            "missionId": mission_id or None,
            "clientIpHash": ip_hash,
        },
    )
    _record_metric("tracked", 1)

    return {
        "referenceNumber": reference,
        "ngo": {
            "id": ngo_id,
            "name": ngo_name,
        },
        "report": {
            "id": report_doc.id,
            "category": _safe_str(report_data.get("publicCategory"), _safe_str(report_data.get("needType"), "general")),
            "urgency": _safe_str(report_data.get("publicUrgencyLabel"), _safe_str(report_data.get("severity"), "medium")),
            "description": _safe_str(report_data.get("additionalNotes")),
            "zoneId": _safe_str(report_data.get("zoneId")),
            "submittedAt": _to_iso(report_data.get("createdAt")),
            "status": _safe_str(report_data.get("status"), "synced"),
        },
        "mission": {
            "id": mission_id or None,
            "title": _safe_str(mission_data.get("title")) if mission_data else None,
            "status": mission_status,
            "progress": mission_progress,
            "statusText": _safe_str(mission_data.get("statusText")) if mission_data else None,
            "familiesHelped": _safe_int(mission_data.get("familiesHelped"), 0) if mission_data else 0,
            "trackingAvailable": bool(tracking_data),
            "tracking": {
                "status": _safe_str(tracking_data.get("status")),
                "lastUpdate": _safe_str(tracking_data.get("lastUpdate")),
                "location": tracking_data.get("location") if isinstance(tracking_data.get("location"), dict) else None,
            },
        },
        "timeline": timeline,
        "verifiedWithPhone": True,
        "requires": {
            "referenceNumber": True,
            "phoneNumber": True,
        },
    }


@router.post("/feedback", response_model=dict[str, Any])
async def submit_public_feedback(
    payload: PublicReportFeedbackRequest,
    request: Request,
) -> dict[str, Any]:
    reference = _normalize_reference(payload.referenceNumber)
    normalized_phone = _normalize_phone(payload.phoneNumber)
    phone_hash = _phone_hash(normalized_phone)
    ip_hash = _hash_with_salt(f"ip:{_get_client_ip(request)}")

    docs = list(
        db.collection("reports")
        .where(filter=FieldFilter("publicReference", "==", reference))
        .limit(3)
        .stream()
    )

    if not docs:
        _audit("public_feedback_not_found", {"referenceNumber": reference, "clientIpHash": ip_hash})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    docs.sort(
        key=lambda doc: _as_utc_datetime(doc.to_dict().get("createdAt")) or _epoch_datetime(),
        reverse=True,
    )

    report_doc = docs[0]
    report_data = report_doc.to_dict() or {}
    if not hmac.compare_digest(_safe_str(report_data.get("publicPhoneHash")), phone_hash):
        _audit("public_feedback_phone_mismatch", {"referenceNumber": reference, "clientIpHash": ip_hash})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    message = re.sub(r"\s+", " ", payload.message.strip())
    sentiment = _feedback_sentiment(message)
    now = _utcnow()
    retention_weeks = max(1, int(settings.COMMUNITY_ECHO_RETENTION_WEEKS))

    feedback_ref = db.collection("communityEchoResponses").document()
    feedback_ref.set(
        {
            "ngoId": _safe_str(report_data.get("ngoId")),
            "zoneId": _safe_str(report_data.get("zoneId")),
            "missionId": _safe_str(report_data.get("missionId") or report_data.get("mergedIntoMissionId")),
            "reportId": report_doc.id,
            "referenceNumber": reference,
            "phoneHash": phone_hash,
            "message": message,
            "sentiment": sentiment,
            "source": "public_track_page",
            "createdAt": now,
            "updatedAt": now,
            "expiresAt": now + timedelta(weeks=retention_weeks),
        }
    )

    _audit(
        "public_feedback_submitted",
        {
            "feedbackId": feedback_ref.id,
            "referenceNumber": reference,
            "reportId": report_doc.id,
            "ngoId": _safe_str(report_data.get("ngoId")),
            "clientIpHash": ip_hash,
        },
    )
    _record_metric("feedback_submitted", 1)

    return {
        "feedbackId": feedback_ref.id,
        "accepted": True,
        "sentiment": sentiment,
        "retentionWeeks": retention_weeks,
    }
