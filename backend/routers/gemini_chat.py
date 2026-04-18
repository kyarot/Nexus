from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from google.genai import types
from pydantic import BaseModel, Field

from core.dependencies import role_required
from core.firebase import db
from core.gemini import GEMINI_FLASH, client
from services.copilot_data_access import CoordinatorReadLayer

PREFIX = "/coordinator"
TAGS = ["coordinator"]
router = APIRouter()


class GeminiChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)


def _get_coordinator_ngo_id(user: dict[str, Any]) -> str:
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have an associated NGO")
    return ngo_id


def _serialize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize_value(item) for key, item in value.items()}
    return value


def _coerce_datetime(value: Any) -> datetime | None:
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


def _get_recent_reports(ngo_id: str, limit: int = 12) -> list[dict[str, Any]]:
    rows = list(db.collection("reports").where("ngoId", "==", ngo_id).stream())
    reports: list[dict[str, Any]] = []
    for doc in rows:
        data = doc.to_dict() or {}
        reports.append({"id": doc.id, **data})

    reports.sort(key=lambda item: _coerce_datetime(item.get("createdAt")) or datetime.min, reverse=True)
    trimmed = reports[:limit]
    return [
        {
            "id": report.get("id"),
            "zoneId": report.get("zoneId"),
            "needType": report.get("needType"),
            "severity": report.get("severity"),
            "familiesAffected": report.get("familiesAffected"),
            "personsAffected": report.get("personsAffected"),
            "createdAt": _serialize_value(report.get("createdAt")),
        }
        for report in trimmed
    ]


def _get_heatmap_summary(zone_ids: set[str], limit_points: int = 200) -> dict[str, Any]:
    points_query = (
        db.collection("terrainSignals")
        .order_by("updatedAt", direction="DESCENDING")
        .limit(limit_points)
        .stream()
    )

    since = datetime.utcnow() - timedelta(hours=168)
    total_points = 0
    need_counts: dict[str, int] = {}
    severity_counts: dict[str, int] = {}

    for doc in points_query:
        data = doc.to_dict() or {}
        zone_id = str(data.get("zoneId") or "").strip()
        if zone_id and zone_id not in zone_ids:
            continue
        updated_at = _coerce_datetime(data.get("updatedAt") or data.get("createdAt"))
        if updated_at and updated_at < since:
            continue

        total_points += 1
        need = str(data.get("needType") or "general").strip().lower()
        severity = str(data.get("severity") or "medium").strip().lower()
        need_counts[need] = need_counts.get(need, 0) + 1
        severity_counts[severity] = severity_counts.get(severity, 0) + 1

    top_needs = sorted(need_counts.items(), key=lambda item: item[1], reverse=True)[:3]
    top_severity = sorted(severity_counts.items(), key=lambda item: item[1], reverse=True)[:3]

    return {
        "totalPoints": total_points,
        "topNeeds": [item[0] for item in top_needs],
        "topSeverities": [item[0] for item in top_severity],
        "sampledWindowHours": 168,
    }


def _build_prompt(query: str, context: dict[str, Any]) -> str:
    return (
        "You are Gemini for NGO coordinators. Answer using only the context data provided. "
        "If the answer is not in the context, say so and suggest what data is missing. "
        "Keep responses concise and practical. Use bullet points when listing items. "
        "Do not use markdown symbols like *, #, or backticks. Use plain text only. "
        "If you need bullets, use lines that start with '- '.\n\n"
        f"Context JSON: {json.dumps(context, ensure_ascii=True)}\n\n"
        f"User question: {query}"
    )


@router.post("/gemini-chat/stream")
async def stream_gemini_chat(
    request: GeminiChatRequest,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> StreamingResponse:
    ngo_id = _get_coordinator_ngo_id(user)
    user_id = str(user.get("id") or user.get("uid") or "").strip()
    role = str(user.get("role") or "").strip().lower()

    read = CoordinatorReadLayer(ngo_id=ngo_id, user_id=user_id, role=role)
    zones = read.get_zones()
    zone_ids = {str(zone.get("id") or "").strip() for zone in zones if zone.get("id")}

    context_payload = {
        "generatedAt": datetime.utcnow().isoformat(),
        "zones": zones[:12],
        "insights": read.get_insights(limit=8),
        "missions": read.get_missions(status_filter="all")[:12],
        "volunteers": read.get_volunteers()[:10],
        "reports": _get_recent_reports(ngo_id, limit=12),
        "heatmap": _get_heatmap_summary(zone_ids),
    }

    context_payload = _serialize_value(context_payload)

    prompt = _build_prompt(request.query, context_payload)

    try:
        response = client.models.generate_content(
            model=GEMINI_FLASH,
            config=types.GenerateContentConfig(
                temperature=0.2,
            ),
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
        )
        response_text = " ".join(str(getattr(response, "text", "") or "").split()).strip()
    except Exception as exc:
        response_text = ""

    if response_text:
        response_text = response_text.replace("*", "").replace("#", "").replace("`", "")
        response_text = " ".join(response_text.split())

    async def event_stream() -> Any:
        if not response_text:
            error_payload = json.dumps({"error": "Gemini returned an empty response."}, ensure_ascii=True)
            yield f"event: error\ndata: {error_payload}\n\n"
            yield "event: done\ndata: {}\n\n"
            return

        for token in response_text.split():
            yield f"event: token\ndata: {token}\n\n"
            await asyncio.sleep(0)

        done_payload = json.dumps({"text": response_text}, ensure_ascii=True)
        yield f"event: done\ndata: {done_payload}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
