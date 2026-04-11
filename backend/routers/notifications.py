from __future__ import annotations

import asyncio
import json
from datetime import datetime
from datetime import timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from core.dependencies import get_current_user
from core.firebase import db
from core.security import decode_access_token

PREFIX = ""
TAGS = ["notifications"]
router = APIRouter()


def _normalize_timestamp(value: Any) -> datetime:
    def _to_utc(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    if isinstance(value, datetime):
        return _to_utc(value)
    if hasattr(value, "to_datetime"):
        try:
            parsed = value.to_datetime()
            if isinstance(parsed, datetime):
                return _to_utc(parsed)
        except Exception:
            pass
    return datetime.min.replace(tzinfo=timezone.utc)


def _serialize_notification(doc_id: str, data: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "id": doc_id,
        "type": str(data.get("type") or "info"),
        "title": str(data.get("title") or "Notification"),
        "message": str(data.get("message") or ""),
        "missionId": data.get("missionId"),
        "requestId": data.get("requestId"),
        "read": bool(data.get("read") or False),
        "metadata": data.get("metadata") if isinstance(data.get("metadata"), dict) else {},
    }
    ts = _normalize_timestamp(data.get("timestamp"))
    payload["timestamp"] = ts.isoformat() if ts != datetime.min else None
    return payload


def _latest_marker(user_id: str) -> str:
    rows = db.collection("notifications").where("userId", "==", user_id).stream()
    latest = datetime.min.replace(tzinfo=timezone.utc)
    for row in rows:
        data = row.to_dict() or {}
        stamp = _normalize_timestamp(data.get("timestamp"))
        if stamp > latest:
            latest = stamp
    return latest.isoformat() if latest != datetime.min else ""


def _user_from_stream_token(token: str) -> dict[str, Any]:
    jwt_payload = decode_access_token(token)
    if not jwt_payload or not isinstance(jwt_payload.get("sub"), str):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid stream token")

    uid = str(jwt_payload["sub"])
    user_snapshot = db.collection("users").document(uid).get()
    if not user_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    user = user_snapshot.to_dict() or {}
    user.setdefault("id", uid)
    return user


@router.get("/notifications", response_model=dict[str, Any])
async def list_notifications(
    user: dict[str, Any] = Depends(get_current_user),
    unread_only: bool = Query(default=False, alias="unreadOnly"),
) -> dict[str, Any]:
    uid = str(user.get("id") or user.get("uid") or "").strip()
    if not uid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user context")

    docs = db.collection("notifications").where("userId", "==", uid).stream()
    rows = []
    unread_count = 0
    for doc in docs:
        data = doc.to_dict() or {}
        read = bool(data.get("read") or False)
        if not read:
            unread_count += 1
        if unread_only and read:
            continue
        rows.append((doc.id, data))

    rows.sort(key=lambda item: _normalize_timestamp(item[1].get("timestamp")), reverse=True)
    notifications = [_serialize_notification(doc_id, data) for doc_id, data in rows[:100]]

    return {
        "notifications": notifications,
        "total": len(notifications),
        "unread": unread_count,
    }


@router.patch("/notifications/{notification_id}/read", response_model=dict[str, Any])
async def mark_notification_read(
    notification_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    uid = str(user.get("id") or user.get("uid") or "").strip()
    ref = db.collection("notifications").document(notification_id)
    snapshot = ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    data = snapshot.to_dict() or {}
    if str(data.get("userId") or "") != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    ref.update({"read": True, "readAt": datetime.utcnow()})
    return {"updated": True}


@router.post("/notifications/read-all", response_model=dict[str, Any])
async def mark_all_read(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    uid = str(user.get("id") or user.get("uid") or "").strip()
    docs = db.collection("notifications").where("userId", "==", uid).where("read", "==", False).stream()
    updated = 0
    now = datetime.utcnow()
    for doc in docs:
        db.collection("notifications").document(doc.id).update({"read": True, "readAt": now})
        updated += 1
    return {"updated": updated}


@router.get("/notifications/stream")
async def stream_notifications(token: str):
    user = _user_from_stream_token(token)
    uid = str(user.get("id") or user.get("uid") or "").strip()

    async def event_generator():
        previous_marker = ""
        while True:
            marker = _latest_marker(uid)
            event_type = "notification_update" if marker != previous_marker else "heartbeat"
            payload = {"type": event_type, "updatedAt": marker}
            yield f"data: {json.dumps(payload)}\n\n"
            previous_marker = marker
            await asyncio.sleep(3)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
