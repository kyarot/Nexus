from __future__ import annotations

import asyncio
import json
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core.dependencies import role_required
from core.firebase import db
from core.security import decode_access_token
from models.mission import MissionCreateRequest
from routers.missions import create_mission
from services.drift_alerts import (
    action_alert_for_ngo,
    dismiss_alert_for_ngo,
    evaluate_ngo_drift_alerts,
    evaluate_zone_drift_alerts,
    get_alert_for_ngo,
    latest_alert_update_marker,
    list_alerts_for_ngo,
    mission_payload_from_alert,
)

PREFIX = "/coordinator"
TAGS = ["coordinator"]
router = APIRouter()


class DriftDismissPayload(BaseModel):
    reason: str = Field(min_length=3, max_length=280)


def _get_coordinator_ngo_id(user: dict[str, Any]) -> str:
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have an associated NGO")
    return ngo_id


def _coordinator_user_from_token(token: str) -> tuple[dict[str, Any], str]:
    jwt_payload = decode_access_token(token)
    if not jwt_payload or not isinstance(jwt_payload.get("sub"), str):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid stream token")

    uid = str(jwt_payload["sub"])
    user_snapshot = db.collection("users").document(uid).get()
    if not user_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    user = user_snapshot.to_dict() or {}
    user.setdefault("id", uid)
    if user.get("role") != "coordinator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Coordinator role required")

    ngo_id = _get_coordinator_ngo_id(user)
    return user, ngo_id


@router.get("/drift-alerts", response_model=dict[str, Any])
async def list_drift_alerts(
    user: dict[str, Any] = Depends(role_required("coordinator")),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    severity_filter: Optional[str] = Query(default=None, alias="severity"),
    zone_id: Optional[str] = Query(default=None, alias="zoneId"),
) -> dict[str, Any]:
    ngo_id = _get_coordinator_ngo_id(user)

    # Keep alerts near real-time by re-evaluating before read.
    if zone_id:
        evaluate_zone_drift_alerts(ngo_id, zone_id)
    else:
        evaluate_ngo_drift_alerts(ngo_id)

    alerts = list_alerts_for_ngo(ngo_id)

    if zone_id:
        alerts = [alert for alert in alerts if str(alert.get("zoneId") or "") == zone_id]
    if status_filter:
        status_needle = status_filter.strip().lower()
        alerts = [alert for alert in alerts if str(alert.get("status") or "").lower() == status_needle]
    if severity_filter:
        severity_needle = severity_filter.strip().lower()
        alerts = [alert for alert in alerts if str(alert.get("severity") or "").lower() == severity_needle]

    counts = {
        "total": len(alerts),
        "active": sum(1 for alert in alerts if str(alert.get("status") or "") == "active"),
        "actioned": sum(1 for alert in alerts if str(alert.get("status") or "") == "actioned"),
        "resolved": sum(1 for alert in alerts if str(alert.get("status") or "") == "resolved"),
        "dismissed": sum(1 for alert in alerts if str(alert.get("status") or "") == "dismissed"),
        "expired": sum(1 for alert in alerts if str(alert.get("status") or "") == "expired"),
        "critical": sum(1 for alert in alerts if str(alert.get("severity") or "") == "critical"),
        "high": sum(1 for alert in alerts if str(alert.get("severity") or "") == "high"),
        "watch": sum(1 for alert in alerts if str(alert.get("severity") or "") == "watch"),
    }

    return {
        "alerts": alerts,
        "total": len(alerts),
        "counts": counts,
    }


@router.post("/drift-alerts/evaluate", response_model=dict[str, Any])
async def evaluate_drift_alerts(
    user: dict[str, Any] = Depends(role_required("coordinator")),
    zone_id: Optional[str] = Query(default=None, alias="zoneId"),
) -> dict[str, Any]:
    ngo_id = _get_coordinator_ngo_id(user)
    result = evaluate_zone_drift_alerts(ngo_id, zone_id) if zone_id else evaluate_ngo_drift_alerts(ngo_id)
    return {"updated": int(result.get("updated") or 0), "triggered": int(result.get("triggered") or 0)}


@router.post("/drift-alerts/{alert_id}/create-mission", response_model=dict[str, Any])
async def create_mission_from_drift_alert(
    alert_id: str,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = _get_coordinator_ngo_id(user)
    alert = get_alert_for_ngo(ngo_id, alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drift alert not found")

    linked_mission = str(alert.get("linkedMissionId") or "").strip()
    if linked_mission:
        return {
            "alert": alert,
            "mission": {"id": linked_mission},
            "created": False,
            "autoAssigned": True,
        }

    payload_data = mission_payload_from_alert(alert, ngo_id)
    mission_request = MissionCreateRequest.model_validate(payload_data)
    mission_response = await create_mission(payload=mission_request, user=user)

    updated_alert = action_alert_for_ngo(
        ngo_id=ngo_id,
        alert_id=alert_id,
        mission_id=mission_response.mission.id,
        actor_id=str(user.get("id") or "") or None,
    )

    return {
        "alert": updated_alert,
        "mission": mission_response.model_dump(),
        "created": True,
        "autoAssigned": bool((mission_response.mission.autoAssigned if mission_response and mission_response.mission else False)),
    }


@router.post("/drift-alerts/{alert_id}/dismiss", response_model=dict[str, Any])
async def dismiss_drift_alert(
    alert_id: str,
    payload: DriftDismissPayload,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = _get_coordinator_ngo_id(user)
    updated = dismiss_alert_for_ngo(
        ngo_id=ngo_id,
        alert_id=alert_id,
        reason=payload.reason,
        actor_id=str(user.get("id") or "") or None,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drift alert not found")
    return {"alert": updated}


@router.get("/drift-alerts/stream")
async def stream_drift_alerts(token: str):
    _, ngo_id = _coordinator_user_from_token(token)

    async def generator():
        previous_marker = ""
        while True:
            marker = latest_alert_update_marker(ngo_id)
            if marker != previous_marker:
                payload = {
                    "type": "drift_alert_update",
                    "updatedAt": marker,
                }
                yield f"data: {json.dumps(payload)}\n\n"
                previous_marker = marker
            await asyncio.sleep(4)

    return StreamingResponse(generator(), media_type="text/event-stream")
