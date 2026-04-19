from __future__ import annotations

import json
import logging
import re
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from google.cloud.firestore_v1.base_query import FieldFilter
from pydantic import BaseModel, Field

from core.config import settings
from core.dependencies import role_required
from core.firebase import db
from core.gemini import GEMINI_FLASH, client
from core.translation import get_translate_client

PREFIX = "/coordinator"
TAGS = ["coordinator"]
router = APIRouter()
logger = logging.getLogger("nexus.community_echo")

POSITIVE_HINTS = {
    "thanks",
    "thank",
    "helpful",
    "grateful",
    "good",
    "great",
    "clear",
    "improved",
    "support",
    "useful",
}
NEGATIVE_HINTS = {
    "late",
    "delay",
    "not",
    "bad",
    "poor",
    "confused",
    "missing",
    "issue",
    "problem",
    "worse",
}
STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "have",
    "your",
    "were",
    "been",
    "into",
    "their",
    "they",
    "our",
    "but",
    "about",
    "there",
    "would",
    "could",
    "should",
}
ACTIVE_MISSION_STATUSES = {"pending", "dispatched", "en_route", "on_ground"}
COMPLETED_MISSION_STATUSES = {"completed"}


class EchoGenerateDraftRequest(BaseModel):
    weekStart: str | None = None
    weekEnd: str | None = None
    language: str = Field(default="en", min_length=2, max_length=16)
    tone: str = Field(default="informational", min_length=3, max_length=64)
    missionIds: list[str] = Field(default_factory=list)
    zoneIds: list[str] = Field(default_factory=list)
    coordinatorNotes: str | None = Field(default=None, max_length=2000)


class EchoScheduleCampaignRequest(BaseModel):
    weekStart: str | None = None
    weekEnd: str | None = None
    language: str = Field(default="en", min_length=2, max_length=16)
    tone: str = Field(default="informational", min_length=3, max_length=64)
    draftTitle: str | None = Field(default=None, max_length=160)
    draftMessage: str = Field(min_length=8, max_length=4000)
    missionIds: list[str] = Field(default_factory=list)
    zoneIds: list[str] = Field(default_factory=list)
    sendAt: str | None = None


class EchoDispatchRequest(BaseModel):
    limit: int = Field(default=5, ge=1, le=100)


class EchoDraftResponse(BaseModel):
    draftTitle: str
    draftMessage: str
    language: str
    tone: str
    audienceCount: int
    missionCount: int
    zoneCount: int
    weekStart: str
    weekEnd: str
    highlights: list[str]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _safe_str(value: Any, default: str = "") -> str:
    text = str(value or "").strip()
    return text if text else default


def _as_utc(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, str) and value.strip():
        raw = value.strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(raw)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except ValueError:
            return None
    return None


def _parse_iso_date(value: str | None, fallback: date) -> date:
    if not value:
        return fallback
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid date format '{value}'. Use YYYY-MM-DD.",
        ) from exc


def _week_bounds(week_start: str | None, week_end: str | None) -> tuple[datetime, datetime]:
    today = _utcnow().date()
    default_start = today - timedelta(days=today.weekday())
    default_end = default_start + timedelta(days=6)

    start_date = _parse_iso_date(week_start, default_start)
    end_date = _parse_iso_date(week_end, default_end)

    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="weekEnd must be on or after weekStart",
        )

    start_dt = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(end_date, time.max, tzinfo=timezone.utc)
    return start_dt, end_dt


def _clean_text(message: str) -> str:
    return re.sub(r"\s+", " ", message.strip())


def _parse_send_at(send_at: str | None) -> datetime:
    if not send_at:
        return _utcnow()
    parsed = _as_utc(send_at)
    if not parsed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid sendAt datetime. Use ISO-8601 format.",
        )
    return parsed


def _coordinator_ngo_id(user: dict[str, Any]) -> str:
    ngo_id = _safe_str(user.get("ngoId"))
    if ngo_id:
        return ngo_id

    uid = _safe_str(user.get("id") or user.get("uid"))
    if not uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Coordinator identity not found")

    profile = db.collection("coordinators").document(uid).get()
    if profile.exists:
        profile_data = profile.to_dict() or {}
        ngo_id = _safe_str(profile_data.get("ngoId"))
        if ngo_id:
            return ngo_id

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Coordinator NGO scope not found")


def _collect_missions(ngo_id: str) -> list[dict[str, Any]]:
    missions: list[dict[str, Any]] = []
    rows = db.collection("missions").where(filter=FieldFilter("ngoId", "==", ngo_id)).stream()
    for doc in rows:
        data = doc.to_dict() or {}
        missions.append({"id": doc.id, **data})
    return missions


def _collect_reports(ngo_id: str) -> list[dict[str, Any]]:
    reports: list[dict[str, Any]] = []
    rows = db.collection("reports").where(filter=FieldFilter("ngoId", "==", ngo_id)).stream()
    for doc in rows:
        data = doc.to_dict() or {}
        reports.append({"id": doc.id, **data})
    return reports


def _collect_campaigns(ngo_id: str, limit: int = 50) -> list[dict[str, Any]]:
    campaigns: list[dict[str, Any]] = []
    rows = db.collection("communityEchoCampaigns").where(filter=FieldFilter("ngoId", "==", ngo_id)).stream()
    for doc in rows:
        data = doc.to_dict() or {}
        campaigns.append({"id": doc.id, **data})

    campaigns.sort(key=lambda item: _as_utc(item.get("createdAt")) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return campaigns[:limit]


def _collect_responses(ngo_id: str, limit: int = 200) -> list[dict[str, Any]]:
    responses: list[dict[str, Any]] = []
    rows = db.collection("communityEchoResponses").where(filter=FieldFilter("ngoId", "==", ngo_id)).stream()
    for doc in rows:
        data = doc.to_dict() or {}
        responses.append({"id": doc.id, **data})

    responses.sort(key=lambda item: _as_utc(item.get("createdAt")) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return responses[:limit]


def _filter_missions_for_week(missions: list[dict[str, Any]], start_dt: datetime, end_dt: datetime) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    for mission in missions:
        markers = [
            _as_utc(mission.get("completedAt")),
            _as_utc(mission.get("updatedAt")),
            _as_utc(mission.get("createdAt")),
        ]
        event_time = next((item for item in markers if item is not None), None)
        if event_time and start_dt <= event_time <= end_dt:
            selected.append(mission)
    return selected


def _resolve_recipients(
    reports: list[dict[str, Any]],
    missions: list[dict[str, Any]],
    mission_ids: list[str],
    zone_ids: list[str],
) -> list[dict[str, Any]]:
    mission_set = {item for item in mission_ids if item}
    zone_set = {item for item in zone_ids if item}

    source_report_ids: set[str] = set()
    mission_zone_ids: set[str] = set(zone_set)
    for mission in missions:
        mission_id = _safe_str(mission.get("id"))
        if mission_set and mission_id not in mission_set:
            continue

        mission_zone = _safe_str(mission.get("zoneId"))
        if mission_zone:
            mission_zone_ids.add(mission_zone)

        for report_id in mission.get("sourceReportIds") or []:
            as_id = _safe_str(report_id)
            if as_id:
                source_report_ids.add(as_id)

    recipients_by_hash: dict[str, dict[str, Any]] = {}

    for report in reports:
        report_id = _safe_str(report.get("id"))
        report_zone = _safe_str(report.get("zoneId"))
        report_mission = _safe_str(report.get("missionId") or report.get("mergedIntoMissionId"))

        linked = False
        if not mission_set and not zone_set:
            linked = True
        if mission_set and report_mission in mission_set:
            linked = True
        if zone_set and report_zone in zone_set:
            linked = True
        if report_id and report_id in source_report_ids:
            linked = True
        if report_zone and report_zone in mission_zone_ids:
            linked = True

        if not linked:
            continue

        phone_hash = _safe_str(report.get("publicPhoneHash"))
        phone_masked = _safe_str(
            report.get("publicPhoneMasked") or report.get("submittedByPhoneMasked"),
            "masked",
        )
        if not phone_hash:
            continue

        entry = recipients_by_hash.get(phone_hash)
        if not entry:
            entry = {
                "phoneHash": phone_hash,
                "phoneMasked": phone_masked,
                "reportIds": set(),
                "missionIds": set(),
                "zoneIds": set(),
            }
            recipients_by_hash[phone_hash] = entry

        if report_id:
            entry["reportIds"].add(report_id)
        if report_zone:
            entry["zoneIds"].add(report_zone)
        if report_mission:
            entry["missionIds"].add(report_mission)

    recipients: list[dict[str, Any]] = []
    for row in recipients_by_hash.values():
        recipients.append(
            {
                "phoneHash": row["phoneHash"],
                "phoneMasked": row["phoneMasked"],
                "reportIds": sorted(row["reportIds"]),
                "missionIds": sorted(row["missionIds"]),
                "zoneIds": sorted(row["zoneIds"]),
            }
        )
    return recipients


def _impact_rollup(missions: list[dict[str, Any]], week_missions: list[dict[str, Any]]) -> dict[str, Any]:
    completed = [m for m in missions if _safe_str(m.get("status")).lower() in COMPLETED_MISSION_STATUSES]
    active = [m for m in missions if _safe_str(m.get("status")).lower() in ACTIVE_MISSION_STATUSES]

    families_helped = sum(int(m.get("familiesHelped") or 0) for m in completed)
    week_families_helped = sum(int(m.get("familiesHelped") or 0) for m in week_missions)

    return {
        "totalMissions": len(missions),
        "activeMissions": len(active),
        "completedMissions": len(completed),
        "familiesHelped": families_helped,
        "weekFamiliesHelped": week_families_helped,
    }


def _sentiment(message: str) -> str:
    lower = _safe_str(message).lower()
    if not lower:
        return "neutral"

    positive_hits = sum(1 for token in POSITIVE_HINTS if token in lower)
    negative_hits = sum(1 for token in NEGATIVE_HINTS if token in lower)

    if positive_hits > negative_hits:
        return "positive"
    if negative_hits > positive_hits:
        return "negative"
    return "neutral"


def _extract_tags(messages: list[str], max_tags: int = 8) -> list[dict[str, Any]]:
    words: Counter[str] = Counter()
    for message in messages:
        for raw in re.findall(r"[a-zA-Z]{4,}", message.lower()):
            token = raw.strip()
            if token in STOPWORDS:
                continue
            words[token] += 1

    tags: list[dict[str, Any]] = []
    for word, count in words.most_common(max_tags):
        tags.append({"label": word.capitalize(), "count": count})
    return tags


def _translate_if_needed(text: str, language_code: str) -> str:
    code = _safe_str(language_code, "en").lower()
    if code in {"", "en"}:
        return text

    try:
        translated = get_translate_client().translate(text, target_language=code)
        translated_text = _safe_str(translated.get("translatedText"))
        return translated_text or text
    except Exception as exc:
        logger.warning("Community Echo translation failed: %s", exc)
        return text


def _draft_fallback(context: dict[str, Any], tone: str) -> str:
    highlights = context.get("highlights") or []
    lines = [
        f"This week's Community Echo update ({tone}):",
        *[f"- {item}" for item in highlights[:4]],
        "Thank you for staying connected with your community missions.",
    ]
    return "\n".join(lines)


def _generate_draft_with_gemini(context: dict[str, Any], tone: str) -> tuple[str, str, list[str]]:
    prompt = (
        "You are generating an NGO community broadcast draft. "
        "Return strict JSON with keys title (string), message (string), highlights (string array max 5). "
        "No markdown. Keep message concise and clear.\n"
        f"Tone: {tone}.\n"
        f"Context JSON: {json.dumps(context, ensure_ascii=True)}"
    )

    try:
        response = client.models.generate_content(
            model=GEMINI_FLASH,
            contents=prompt,
        )
        raw = _safe_str(getattr(response, "text", ""))
        parsed = json.loads(raw)
        title = _safe_str(parsed.get("title"), "Weekly Community Echo")
        message = _safe_str(parsed.get("message"))
        highlights = [
            _safe_str(item)
            for item in (parsed.get("highlights") or [])
            if _safe_str(item)
        ]
        if not message:
            raise ValueError("Gemini response did not include message")
        return title, message, highlights
    except Exception as exc:
        logger.warning("Gemini draft generation failed, using fallback: %s", exc)
        fallback = _draft_fallback(context, tone)
        return "Weekly Community Echo", fallback, context.get("highlights") or []


def _upsert_contacts(ngo_id: str, recipients: list[dict[str, Any]]) -> None:
    now = _utcnow()
    expires_at = now + timedelta(weeks=max(1, int(settings.COMMUNITY_ECHO_RETENTION_WEEKS)))

    for recipient in recipients:
        phone_hash = _safe_str(recipient.get("phoneHash"))
        if not phone_hash:
            continue

        ref = db.collection("communityEchoContacts").document(phone_hash)
        snapshot = ref.get()
        existing = snapshot.to_dict() or {} if snapshot.exists else {}

        linked_missions = set(existing.get("linkedMissionIds") or [])
        linked_zones = set(existing.get("linkedZoneIds") or [])
        linked_missions.update(recipient.get("missionIds") or [])
        linked_zones.update(recipient.get("zoneIds") or [])

        ref.set(
            {
                "ngoId": ngo_id,
                "phoneHash": phone_hash,
                "phoneMasked": _safe_str(recipient.get("phoneMasked"), "masked"),
                "linkedMissionIds": sorted(item for item in linked_missions if _safe_str(item)),
                "linkedZoneIds": sorted(item for item in linked_zones if _safe_str(item)),
                "updatedAt": now,
                "lastSeenAt": now,
                "expiresAt": expires_at,
                "createdAt": _as_utc(existing.get("createdAt")) or now,
            },
            merge=True,
        )


def _cleanup_expired_data(ngo_id: str) -> dict[str, int]:
    now = _utcnow()
    retention_weeks = max(1, int(settings.COMMUNITY_ECHO_RETENTION_WEEKS))
    cutoff = now - timedelta(weeks=retention_weeks)

    deleted = defaultdict(int)

    campaigns = db.collection("communityEchoCampaigns").where(filter=FieldFilter("ngoId", "==", ngo_id)).stream()
    for campaign in campaigns:
        data = campaign.to_dict() or {}
        expires_at = _as_utc(data.get("expiresAt"))
        sent_at = _as_utc(data.get("sentAt")) or _as_utc(data.get("createdAt"))
        should_delete = (expires_at is not None and expires_at <= now) or (sent_at is not None and sent_at <= cutoff)
        if not should_delete:
            continue

        campaign_id = campaign.id

        recipients = db.collection("communityEchoRecipients").where(filter=FieldFilter("campaignId", "==", campaign_id)).stream()
        for recipient in recipients:
            recipient.reference.delete()
            deleted["recipients"] += 1

        logs = db.collection("communityEchoDispatchLogs").where(filter=FieldFilter("campaignId", "==", campaign_id)).stream()
        for log in logs:
            log.reference.delete()
            deleted["dispatchLogs"] += 1

        campaign.reference.delete()
        deleted["campaigns"] += 1

    responses = db.collection("communityEchoResponses").where(filter=FieldFilter("ngoId", "==", ngo_id)).stream()
    for response in responses:
        data = response.to_dict() or {}
        expires_at = _as_utc(data.get("expiresAt"))
        created_at = _as_utc(data.get("createdAt"))
        should_delete = (expires_at is not None and expires_at <= now) or (created_at is not None and created_at <= cutoff)
        if should_delete:
            response.reference.delete()
            deleted["responses"] += 1

    contacts = db.collection("communityEchoContacts").where(filter=FieldFilter("ngoId", "==", ngo_id)).stream()
    for contact in contacts:
        data = contact.to_dict() or {}
        expires_at = _as_utc(data.get("expiresAt"))
        updated_at = _as_utc(data.get("updatedAt"))
        should_delete = (expires_at is not None and expires_at <= now) or (updated_at is not None and updated_at <= cutoff)
        if should_delete:
            contact.reference.delete()
            deleted["contacts"] += 1

    return dict(deleted)


def _dispatch_campaign(campaign_id: str, campaign_data: dict[str, Any]) -> dict[str, int]:
    now = _utcnow()
    recipients = db.collection("communityEchoRecipients").where(filter=FieldFilter("campaignId", "==", campaign_id)).stream()
    batch_limit = max(1, int(settings.COMMUNITY_ECHO_DISPATCH_BATCH_SIZE))

    sent = 0
    failed = 0
    processed = 0

    for recipient in recipients:
        if processed >= batch_limit:
            break

        recipient_data = recipient.to_dict() or {}
        recipient_status = _safe_str(recipient_data.get("status"), "queued")
        attempts = int(recipient_data.get("dispatchAttempts") or 0)

        if recipient_status == "sent":
            continue
        if attempts >= 3:
            failed += 1
            processed += 1
            continue

        phone_masked = _safe_str(recipient_data.get("phoneMasked"), "masked")
        message = _safe_str(campaign_data.get("message"))

        if not message:
            recipient.reference.set(
                {
                    "status": "failed",
                    "dispatchAttempts": attempts + 1,
                    "lastAttemptAt": now,
                    "failureReason": "missing_message",
                    "updatedAt": now,
                },
                merge=True,
            )
            failed += 1
            processed += 1
            continue

        db.collection("communityEchoDispatchLogs").add(
            {
                "campaignId": campaign_id,
                "ngoId": _safe_str(campaign_data.get("ngoId")),
                "channel": "sms_dummy",
                "provider": "dummy-static",
                "status": "sent",
                "recipientMasked": phone_masked,
                "recipientHash": _safe_str(recipient_data.get("phoneHash")),
                "sentAt": now,
                "messagePreview": message[:200],
                "expiresAt": campaign_data.get("expiresAt"),
            }
        )

        recipient.reference.set(
            {
                "status": "sent",
                "dispatchAttempts": attempts + 1,
                "lastAttemptAt": now,
                "sentAt": now,
                "updatedAt": now,
            },
            merge=True,
        )
        sent += 1
        processed += 1

    total = int(campaign_data.get("recipientsCount") or 0)
    already_sent = int(campaign_data.get("sentCount") or 0)
    already_failed = int(campaign_data.get("failedCount") or 0)
    updated_sent = already_sent + sent
    updated_failed = already_failed + failed
    campaign_status = "sent" if updated_sent >= total and updated_failed == 0 else ("partial" if updated_sent > 0 else "failed")

    db.collection("communityEchoCampaigns").document(campaign_id).set(
        {
            "status": campaign_status,
            "sentCount": updated_sent,
            "failedCount": updated_failed,
            "updatedAt": now,
            "sentAt": now if updated_sent > 0 else campaign_data.get("sentAt"),
        },
        merge=True,
    )

    return {"sent": sent, "failed": failed, "total": total}


@router.get("/community-echo/overview")
def get_community_echo_overview(
    weekStart: str | None = Query(default=None),
    weekEnd: str | None = Query(default=None),
    user: dict[str, Any] = Depends(role_required("coordinator")),
):
    ngo_id = _coordinator_ngo_id(user)
    week_start, week_end = _week_bounds(weekStart, weekEnd)

    cleanup = _cleanup_expired_data(ngo_id)

    missions = _collect_missions(ngo_id)
    reports = _collect_reports(ngo_id)
    campaigns = _collect_campaigns(ngo_id, limit=20)
    responses = _collect_responses(ngo_id, limit=150)

    week_missions = _filter_missions_for_week(missions, week_start, week_end)
    impact = _impact_rollup(missions, week_missions)

    recipients = _resolve_recipients(
        reports=reports,
        missions=week_missions,
        mission_ids=[_safe_str(m.get("id")) for m in week_missions],
        zone_ids=[_safe_str(m.get("zoneId")) for m in week_missions if _safe_str(m.get("zoneId"))],
    )

    response_messages = [_safe_str(row.get("message")) for row in responses if _safe_str(row.get("message"))]
    response_sentiments = Counter(_safe_str(row.get("sentiment"), _sentiment(_safe_str(row.get("message")))) for row in responses)
    total_responses = sum(response_sentiments.values())
    positive = response_sentiments.get("positive", 0)
    positive_pct = round((positive / total_responses) * 100) if total_responses else 0

    zone_counts = Counter(_safe_str(report.get("zoneId")) for report in reports if _safe_str(report.get("zoneId")))
    zone_docs = {
        doc.id: (doc.to_dict() or {})
        for doc in db.collection("zones").stream()
    }
    top_zones = []
    for zone_id, count in zone_counts.most_common(6):
        zone = zone_docs.get(zone_id, {})
        top_zones.append(
            {
                "zoneId": zone_id,
                "zoneName": _safe_str(zone.get("name"), zone_id),
                "linkedReports": count,
            }
        )

    return {
        "ngoId": ngo_id,
        "weekStart": week_start.date().isoformat(),
        "weekEnd": week_end.date().isoformat(),
        "summary": {
            **impact,
            "totalReports": len(reports),
            "linkedAudience": len(recipients),
            "scheduledCampaigns": sum(1 for c in campaigns if _safe_str(c.get("status")) in {"scheduled", "partial"}),
            "sentCampaigns": sum(1 for c in campaigns if _safe_str(c.get("status")) == "sent"),
            "responseCount": total_responses,
            "positiveResponsePercent": positive_pct,
        },
        "zones": top_zones,
        "responseAnalytics": {
            "total": total_responses,
            "positivePercent": positive_pct,
            "tags": _extract_tags(response_messages),
            "latest": [
                {
                    "id": row.get("id"),
                    "message": _safe_str(row.get("message")),
                    "sentiment": _safe_str(row.get("sentiment"), "neutral"),
                    "createdAt": _as_utc(row.get("createdAt")).isoformat() if _as_utc(row.get("createdAt")) else None,
                    "referenceNumber": _safe_str(row.get("referenceNumber")),
                }
                for row in responses[:4]
            ],
        },
        "campaigns": [
            {
                "id": item.get("id"),
                "status": _safe_str(item.get("status"), "scheduled"),
                "channel": _safe_str(item.get("channel"), "sms_dummy"),
                "language": _safe_str(item.get("language"), "en"),
                "tone": _safe_str(item.get("tone"), "informational"),
                "recipientsCount": int(item.get("recipientsCount") or 0),
                "sentCount": int(item.get("sentCount") or 0),
                "failedCount": int(item.get("failedCount") or 0),
                "sendAt": _as_utc(item.get("sendAt")).isoformat() if _as_utc(item.get("sendAt")) else None,
                "createdAt": _as_utc(item.get("createdAt")).isoformat() if _as_utc(item.get("createdAt")) else None,
                "weekStart": _safe_str(item.get("weekStart")),
                "weekEnd": _safe_str(item.get("weekEnd")),
                "draftTitle": _safe_str(item.get("title"), "Community Echo"),
            }
            for item in campaigns[:8]
        ],
        "cleanup": cleanup,
    }


@router.post("/community-echo/draft/generate", response_model=EchoDraftResponse)
def generate_community_echo_draft(
    payload: EchoGenerateDraftRequest,
    user: dict[str, Any] = Depends(role_required("coordinator")),
):
    ngo_id = _coordinator_ngo_id(user)
    week_start, week_end = _week_bounds(payload.weekStart, payload.weekEnd)

    missions = _collect_missions(ngo_id)
    reports = _collect_reports(ngo_id)

    week_missions = _filter_missions_for_week(missions, week_start, week_end)

    mission_ids = payload.missionIds or [_safe_str(m.get("id")) for m in week_missions]
    zone_ids = payload.zoneIds or [
        _safe_str(m.get("zoneId"))
        for m in week_missions
        if _safe_str(m.get("zoneId"))
    ]

    recipients = _resolve_recipients(
        reports=reports,
        missions=missions,
        mission_ids=mission_ids,
        zone_ids=zone_ids,
    )

    impact = _impact_rollup(missions, week_missions)

    zone_counts = Counter(_safe_str(report.get("zoneId")) for report in reports if _safe_str(report.get("zoneId")))
    top_zone_ids = [zone for zone, _ in zone_counts.most_common(3)]
    zone_name_by_id: dict[str, str] = {}
    for zone_doc in db.collection("zones").stream():
        payload_doc = zone_doc.to_dict() or {}
        zone_name_by_id[zone_doc.id] = _safe_str(payload_doc.get("name"), zone_doc.id)

    highlights = [
        f"{impact['weekFamiliesHelped']} families received support this week",
        f"{len(week_missions)} missions were active or updated in this week window",
        f"Broadcast audience linked to mission and zone: {len(recipients)} contacts",
    ]
    if top_zone_ids:
        highlights.append(
            "Top active zones: " + ", ".join(zone_name_by_id.get(zone_id, zone_id) for zone_id in top_zone_ids)
        )

    notes = _safe_str(payload.coordinatorNotes)
    context = {
        "ngoId": ngo_id,
        "weekStart": week_start.date().isoformat(),
        "weekEnd": week_end.date().isoformat(),
        "tone": payload.tone,
        "language": payload.language,
        "impact": impact,
        "highlights": highlights,
        "selectedMissionIds": mission_ids,
        "selectedZoneIds": zone_ids,
        "coordinatorNotes": notes,
    }

    title, message, model_highlights = _generate_draft_with_gemini(context, payload.tone)
    if model_highlights:
        highlights = model_highlights

    language_code = _safe_str(payload.language, "en").lower()
    translated_title = _translate_if_needed(title, language_code)
    translated_message = _translate_if_needed(message, language_code)
    translated_highlights = [_translate_if_needed(item, language_code) for item in highlights]

    return EchoDraftResponse(
        draftTitle=translated_title,
        draftMessage=translated_message,
        language=language_code,
        tone=payload.tone,
        audienceCount=len(recipients),
        missionCount=len(mission_ids),
        zoneCount=len(zone_ids),
        weekStart=week_start.date().isoformat(),
        weekEnd=week_end.date().isoformat(),
        highlights=translated_highlights,
    )


@router.post("/community-echo/campaigns/schedule")
def schedule_community_echo_campaign(
    payload: EchoScheduleCampaignRequest,
    user: dict[str, Any] = Depends(role_required("coordinator")),
):
    ngo_id = _coordinator_ngo_id(user)
    week_start, week_end = _week_bounds(payload.weekStart, payload.weekEnd)
    send_at = _parse_send_at(payload.sendAt)

    draft_message = _clean_text(payload.draftMessage)
    if len(draft_message) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Draft message is too short",
        )

    missions = _collect_missions(ngo_id)
    reports = _collect_reports(ngo_id)
    week_missions = _filter_missions_for_week(missions, week_start, week_end)

    mission_ids = payload.missionIds or [_safe_str(m.get("id")) for m in week_missions]
    zone_ids = payload.zoneIds or [
        _safe_str(m.get("zoneId"))
        for m in week_missions
        if _safe_str(m.get("zoneId"))
    ]

    recipients = _resolve_recipients(
        reports=reports,
        missions=missions,
        mission_ids=mission_ids,
        zone_ids=zone_ids,
    )

    if not recipients:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No linked recipients were found for the selected mission and zone scope",
        )

    _upsert_contacts(ngo_id, recipients)

    now = _utcnow()
    expires_at = now + timedelta(weeks=max(1, int(settings.COMMUNITY_ECHO_RETENTION_WEEKS)))

    created_by = _safe_str(user.get("id") or user.get("uid"), "unknown")
    campaign_ref = db.collection("communityEchoCampaigns").document()
    campaign_id = campaign_ref.id

    campaign_record = {
        "ngoId": ngo_id,
        "status": "scheduled",
        "channel": "sms_dummy",
        "provider": "dummy-static",
        "title": _safe_str(payload.draftTitle, "Community Echo"),
        "message": draft_message,
        "language": _safe_str(payload.language, "en").lower(),
        "tone": _safe_str(payload.tone, "informational"),
        "missionIds": mission_ids,
        "zoneIds": zone_ids,
        "recipientRule": "linked_mission_or_zone",
        "recipientsCount": len(recipients),
        "sentCount": 0,
        "failedCount": 0,
        "weekStart": week_start.date().isoformat(),
        "weekEnd": week_end.date().isoformat(),
        "sendAt": send_at,
        "createdAt": now,
        "updatedAt": now,
        "createdBy": created_by,
        "expiresAt": expires_at,
    }

    campaign_ref.set(campaign_record)

    for recipient in recipients:
        recipient_id = f"{campaign_id}_{_safe_str(recipient.get('phoneHash'))[:24]}"
        db.collection("communityEchoRecipients").document(recipient_id).set(
            {
                "campaignId": campaign_id,
                "ngoId": ngo_id,
                "phoneHash": _safe_str(recipient.get("phoneHash")),
                "phoneMasked": _safe_str(recipient.get("phoneMasked"), "masked"),
                "reportIds": recipient.get("reportIds") or [],
                "missionIds": recipient.get("missionIds") or [],
                "zoneIds": recipient.get("zoneIds") or [],
                "status": "queued",
                "dispatchAttempts": 0,
                "createdAt": now,
                "updatedAt": now,
                "expiresAt": expires_at,
            }
        )

    dispatch_result = {"sent": 0, "failed": 0, "total": len(recipients)}
    if send_at <= now:
        dispatch_result = _dispatch_campaign(campaign_id, campaign_record)

    return {
        "campaignId": campaign_id,
        "status": "scheduled" if send_at > now else ("sent" if dispatch_result["failed"] == 0 else "partial"),
        "sendAt": send_at.isoformat(),
        "recipientsCount": len(recipients),
        "dispatch": dispatch_result,
    }


@router.post("/community-echo/campaigns/dispatch-due")
def dispatch_due_campaigns(
    payload: EchoDispatchRequest,
    user: dict[str, Any] = Depends(role_required("coordinator")),
):
    ngo_id = _coordinator_ngo_id(user)
    _cleanup_expired_data(ngo_id)

    now = _utcnow()
    campaigns = _collect_campaigns(ngo_id, limit=200)

    due = [
        campaign
        for campaign in campaigns
        if _safe_str(campaign.get("status")) in {"scheduled", "partial"}
        and (_as_utc(campaign.get("sendAt")) or now) <= now
    ]

    processed = []
    for campaign in due[: payload.limit]:
        campaign_id = _safe_str(campaign.get("id"))
        if not campaign_id:
            continue
        result = _dispatch_campaign(campaign_id, campaign)
        processed.append({"campaignId": campaign_id, **result})

    return {
        "processed": len(processed),
        "campaigns": processed,
    }


@router.get("/community-echo/campaigns")
def list_community_echo_campaigns(
    limit: int = Query(default=25, ge=1, le=100),
    user: dict[str, Any] = Depends(role_required("coordinator")),
):
    ngo_id = _coordinator_ngo_id(user)
    campaigns = _collect_campaigns(ngo_id, limit=limit)

    return {
        "campaigns": [
            {
                "id": item.get("id"),
                "status": _safe_str(item.get("status"), "scheduled"),
                "channel": _safe_str(item.get("channel"), "sms_dummy"),
                "title": _safe_str(item.get("title"), "Community Echo"),
                "language": _safe_str(item.get("language"), "en"),
                "tone": _safe_str(item.get("tone"), "informational"),
                "weekStart": _safe_str(item.get("weekStart")),
                "weekEnd": _safe_str(item.get("weekEnd")),
                "recipientsCount": int(item.get("recipientsCount") or 0),
                "sentCount": int(item.get("sentCount") or 0),
                "failedCount": int(item.get("failedCount") or 0),
                "sendAt": _as_utc(item.get("sendAt")).isoformat() if _as_utc(item.get("sendAt")) else None,
                "createdAt": _as_utc(item.get("createdAt")).isoformat() if _as_utc(item.get("createdAt")) else None,
            }
            for item in campaigns
        ],
        "total": len(campaigns),
    }


@router.get("/community-echo/responses")
def list_community_echo_responses(
    limit: int = Query(default=100, ge=1, le=300),
    missionId: str | None = Query(default=None),
    zoneId: str | None = Query(default=None),
    user: dict[str, Any] = Depends(role_required("coordinator")),
):
    ngo_id = _coordinator_ngo_id(user)
    responses = _collect_responses(ngo_id, limit=max(limit, 200))

    filtered = []
    for row in responses:
        if missionId and _safe_str(row.get("missionId")) != missionId:
            continue
        if zoneId and _safe_str(row.get("zoneId")) != zoneId:
            continue
        filtered.append(row)
        if len(filtered) >= limit:
            break

    sentiments = Counter(_safe_str(row.get("sentiment"), "neutral") for row in filtered)
    total = sum(sentiments.values())
    positive_pct = round((sentiments.get("positive", 0) / total) * 100) if total else 0

    messages = [_safe_str(row.get("message")) for row in filtered if _safe_str(row.get("message"))]

    return {
        "summary": {
            "total": total,
            "positive": sentiments.get("positive", 0),
            "neutral": sentiments.get("neutral", 0),
            "negative": sentiments.get("negative", 0),
            "positivePercent": positive_pct,
            "tags": _extract_tags(messages),
        },
        "responses": [
            {
                "id": row.get("id"),
                "message": _safe_str(row.get("message")),
                "sentiment": _safe_str(row.get("sentiment"), "neutral"),
                "referenceNumber": _safe_str(row.get("referenceNumber")),
                "missionId": _safe_str(row.get("missionId")),
                "zoneId": _safe_str(row.get("zoneId")),
                "createdAt": _as_utc(row.get("createdAt")).isoformat() if _as_utc(row.get("createdAt")) else None,
            }
            for row in filtered
        ],
    }


@router.post("/community-echo/cleanup")
def cleanup_community_echo_data(user: dict[str, Any] = Depends(role_required("coordinator"))):
    ngo_id = _coordinator_ngo_id(user)
    deleted = _cleanup_expired_data(ngo_id)
    return {
        "cleanup": deleted,
        "retentionWeeks": max(1, int(settings.COMMUNITY_ECHO_RETENTION_WEEKS)),
    }
