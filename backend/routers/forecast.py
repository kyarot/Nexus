from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse

from core.dependencies import role_required
from core.firebase import db
from core.security import decode_access_token
from models.forecast import (
    ForecastBacktestingResponse,
    ForecastCalibrationResponse,
    ForecastRecomputeResponse,
    ForecastSettingsDocument,
    ForecastSettingsPatch,
    ForecastSnapshotResponse,
    ForecastSummaryResponse,
    ForecastZoneListResponse,
)
from services.forecast_pipeline import (
    generate_forecast_snapshot,
    get_forecast_backtesting,
    get_forecast_settings,
    get_forecast_summary,
    get_forecast_zone_detail,
    get_forecast_zones,
    latest_forecast_marker,
    patch_forecast_settings,
)
from services.forecast_quality import compute_monthly_calibration
from services.notifications_hub import notify_users

PREFIX = "/coordinator"
TAGS = ["coordinator"]
router = APIRouter()


def _coordinator_ngo_id(user: dict[str, Any]) -> str:
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have an associated NGO")
    return ngo_id


def _coordinator_from_stream_token(token: str) -> tuple[dict[str, Any], str]:
    jwt_payload = decode_access_token(token)
    if not jwt_payload or not isinstance(jwt_payload.get("sub"), str):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid stream token")

    uid = str(jwt_payload["sub"])
    user_snapshot = db.collection("users").document(uid).get()
    if not user_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    user = user_snapshot.to_dict() or {}
    user.setdefault("id", uid)
    role = str(user.get("role") or "").strip().lower()
    if "." in role:
        role = role.rsplit(".", maxsplit=1)[-1]
    if role != "coordinator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Coordinator role required")

    return user, _coordinator_ngo_id(user)


def _current_user_id(user: dict[str, Any]) -> str:
    return str(user.get("id") or user.get("uid") or "").strip()


def _send_forecast_recompute_notification(user: dict[str, Any], ngo_id: str, snapshot: dict[str, Any], settings: dict[str, Any]) -> None:
    user_id = _current_user_id(user)
    if not user_id:
        return

    methods = settings.get("notificationMethods") if isinstance(settings.get("notificationMethods"), dict) else {}
    push_enabled = bool(methods.get("push", False))
    if not push_enabled:
        return

    threshold = int(settings.get("threshold") or 75)
    zones = snapshot.get("zones") if isinstance(snapshot.get("zones"), list) else []
    flagged = [
        zone
        for zone in zones
        if isinstance(zone, dict)
        and str(zone.get("riskLevel") or "") in {"high", "critical"}
        and float(zone.get("confidence") or 0.0) >= threshold
    ]

    if flagged:
        highlighted = flagged[:3]
        details = ", ".join(
            f"{str(item.get('zone') or 'Zone')} (score {round(float(item.get('predictedPeakScore') or 0.0), 1)}, confidence {round(float(item.get('confidence') or 0.0), 1)}%)"
            for item in highlighted
        )
        top_action = str(highlighted[0].get("recommendedAction") or "Review zone action plan.")
        title = f"Forecast Alert: {len(flagged)} high-risk zone(s)"
        message = (
            f"Forecast recompute completed for NGO {ngo_id}. "
            f"Zones crossing confidence threshold ({threshold}%): {details}. "
            f"Recommended action: {top_action}"
        )
    else:
        title = "Forecast Update: No active alerts"
        message = (
            f"Forecast recompute completed for NGO {ngo_id}. "
            f"No zones met alert criteria (high/critical risk with confidence >= {threshold}%)."
        )

    notify_users(
        [user_id],
        type="forecast_alert",
        title=title,
        message=message,
        metadata={
            "ngoId": ngo_id,
            "runId": str(snapshot.get("runId") or ""),
            "flaggedZones": len(flagged),
            "threshold": threshold,
            "source": "forecast.recompute",
        },
        timestamp=datetime.utcnow(),
    )


def _send_forecast_calibration_notification(user: dict[str, Any], ngo_id: str, payload: dict[str, Any]) -> None:
    user_id = _current_user_id(user)
    if not user_id:
        return

    title = "Forecast Calibration Completed"
    message = (
        f"Monthly calibration finished for NGO {ngo_id}. "
        f"Version: {str(payload.get('calibrationVersion') or 'unknown')}, "
        f"zone bias entries: {int(payload.get('zoneBiasCount') or 0)}, "
        f"samples analyzed: {int(payload.get('sampleCount') or 0)}."
    )

    notify_users(
        [user_id],
        type="forecast_calibration",
        title=title,
        message=message,
        metadata={
            "ngoId": ngo_id,
            "calibrationVersion": str(payload.get("calibrationVersion") or ""),
            "zoneBiasCount": int(payload.get("zoneBiasCount") or 0),
            "sampleCount": int(payload.get("sampleCount") or 0),
            "source": "forecast.calibration",
        },
        timestamp=datetime.utcnow(),
    )


@router.get("/forecast/summary", response_model=ForecastSummaryResponse)
async def forecast_summary(
    force_refresh: bool = Query(False),
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> ForecastSummaryResponse:
    ngo_id = _coordinator_ngo_id(user)
    payload = get_forecast_summary(ngo_id, force=force_refresh)
    return ForecastSummaryResponse.model_validate(payload)


@router.get("/forecast/zones", response_model=ForecastZoneListResponse)
async def forecast_zones(
    force_refresh: bool = Query(False),
    limit: int = Query(12, ge=1, le=100),
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> ForecastZoneListResponse:
    ngo_id = _coordinator_ngo_id(user)
    payload = get_forecast_zones(ngo_id, force=force_refresh)
    zones = payload.get("zones") if isinstance(payload.get("zones"), list) else []
    return ForecastZoneListResponse.model_validate({"zones": zones[:limit], "total": len(zones)})


@router.get("/forecast/zones/{zone_id}", response_model=dict[str, Any])
async def forecast_zone_detail(
    zone_id: str,
    force_refresh: bool = Query(False),
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = _coordinator_ngo_id(user)
    payload = get_forecast_zone_detail(ngo_id, zone_id, force=force_refresh)
    if not payload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone forecast not found")
    return payload


@router.get("/forecast/snapshot", response_model=ForecastSnapshotResponse)
async def forecast_snapshot(
    force_refresh: bool = Query(False),
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> ForecastSnapshotResponse:
    ngo_id = _coordinator_ngo_id(user)
    payload = generate_forecast_snapshot(ngo_id, force=force_refresh)
    return ForecastSnapshotResponse.model_validate(
        {
            "summary": payload.get("summary") or {},
            "zones": payload.get("zones") or [],
            "zoneDetails": payload.get("zoneDetails") or {},
        }
    )


@router.get("/forecast/backtesting/dashboard", response_model=ForecastBacktestingResponse)
async def forecast_backtesting_dashboard(
    window_weeks: int = Query(12, ge=4, le=52),
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> ForecastBacktestingResponse:
    ngo_id = _coordinator_ngo_id(user)
    payload = get_forecast_backtesting(ngo_id, window_weeks=window_weeks)
    return ForecastBacktestingResponse.model_validate(payload)


@router.get("/forecast/settings", response_model=ForecastSettingsDocument)
async def forecast_settings(
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> ForecastSettingsDocument:
    ngo_id = _coordinator_ngo_id(user)
    payload = get_forecast_settings(ngo_id)
    return ForecastSettingsDocument.model_validate(payload)


@router.patch("/forecast/settings", response_model=ForecastSettingsDocument)
async def update_forecast_settings(
    patch: ForecastSettingsPatch,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> ForecastSettingsDocument:
    ngo_id = _coordinator_ngo_id(user)
    payload = patch_forecast_settings(ngo_id, patch.model_dump(exclude_none=True))
    return ForecastSettingsDocument.model_validate(payload)


@router.post("/forecast/recompute", response_model=ForecastRecomputeResponse)
async def recompute_forecast(
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> ForecastRecomputeResponse:
    ngo_id = _coordinator_ngo_id(user)
    settings = get_forecast_settings(ngo_id)
    snapshot = generate_forecast_snapshot(ngo_id, force=True)
    summary = snapshot.get("summary") if isinstance(snapshot.get("summary"), dict) else {}
    telemetry = summary.get("telemetry") if isinstance(summary.get("telemetry"), dict) else {}
    zones = snapshot.get("zones") if isinstance(snapshot.get("zones"), list) else []

    _send_forecast_recompute_notification(user, ngo_id, snapshot, settings)

    return ForecastRecomputeResponse.model_validate(
        {
            "updated": True,
            "runId": str(snapshot.get("runId") or ""),
            "generatedAt": str(summary.get("generatedAt") or ""),
            "zonesUpdated": len(zones),
            "qualityScore": float(telemetry.get("qualityScore") or 0.0),
        }
    )


@router.post("/forecast/calibration/monthly", response_model=ForecastCalibrationResponse)
async def monthly_forecast_calibration(
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> ForecastCalibrationResponse:
    ngo_id = _coordinator_ngo_id(user)
    payload = compute_monthly_calibration(ngo_id)
    # Refresh snapshot with latest calibration adjustments.
    generate_forecast_snapshot(ngo_id, force=True)
    _send_forecast_calibration_notification(user, ngo_id, payload)
    return ForecastCalibrationResponse.model_validate(payload)


@router.get("/forecast/stream")
async def forecast_stream(
    request: Request,
    token: str = Query(..., min_length=10),
) -> StreamingResponse:
    _, ngo_id = _coordinator_from_stream_token(token)

    async def event_generator():
        last_marker = ""
        while True:
            if await request.is_disconnected():
                break

            marker = latest_forecast_marker(ngo_id)
            if marker != last_marker:
                payload = {"type": "forecast_update", "updatedAt": marker}
                last_marker = marker
            else:
                payload = {"type": "heartbeat", "updatedAt": marker}

            yield f"data: {json.dumps(payload)}\\n\\n"
            await asyncio.sleep(3)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
