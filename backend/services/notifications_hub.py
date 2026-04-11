from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable

from core.firebase import db


def _now() -> datetime:
    return datetime.utcnow()


def notify_users(
    user_ids: Iterable[str],
    *,
    type: str,
    title: str,
    message: str,
    mission_id: str | None = None,
    request_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    timestamp: datetime | None = None,
) -> int:
    ts = timestamp or _now()
    unique_ids = {str(uid).strip() for uid in user_ids if str(uid).strip()}
    if not unique_ids:
        return 0

    sent = 0
    for user_id in unique_ids:
        payload: dict[str, Any] = {
            "userId": user_id,
            "type": type,
            "title": title,
            "message": message,
            "timestamp": ts,
            "read": False,
        }
        if mission_id:
            payload["missionId"] = mission_id
        if request_id:
            payload["requestId"] = request_id
        if metadata:
            payload["metadata"] = metadata

        db.collection("notifications").add(payload)
        sent += 1

    return sent


def _list_user_ids_by_role(ngo_id: str, role: str) -> list[str]:
    docs = (
        db.collection("users")
        .where("ngoId", "==", ngo_id)
        .where("role", "==", role)
        .stream()
    )
    return [doc.id for doc in docs]


def notify_ngo_role(
    ngo_id: str,
    role: str,
    *,
    type: str,
    title: str,
    message: str,
    mission_id: str | None = None,
    request_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    timestamp: datetime | None = None,
) -> int:
    user_ids = _list_user_ids_by_role(ngo_id, role)
    return notify_users(
        user_ids,
        type=type,
        title=title,
        message=message,
        mission_id=mission_id,
        request_id=request_id,
        metadata=metadata,
        timestamp=timestamp,
    )


def notify_ngo_coordinators(
    ngo_id: str,
    *,
    type: str,
    title: str,
    message: str,
    mission_id: str | None = None,
    request_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    timestamp: datetime | None = None,
) -> int:
    return notify_ngo_role(
        ngo_id,
        "coordinator",
        type=type,
        title=title,
        message=message,
        mission_id=mission_id,
        request_id=request_id,
        metadata=metadata,
        timestamp=timestamp,
    )
