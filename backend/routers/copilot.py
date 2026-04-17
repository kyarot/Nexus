from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core.config import settings
from core.dependencies import role_required
from core.firebase import db
from services.copilot_data_access import CoordinatorReadLayer, CoordinatorWriteLayer
from services.copilot_planner import CopilotPlan, CopilotReply, ToolCall, generate_plan, generate_reply
from services.copilot_voice import synthesize_copilot_speech
from services.voice_service import process_voice

router = APIRouter(prefix="/copilot", tags=["copilot"])


class CopilotSessionStartResponse(BaseModel):
    session_id: str
    status: str = "ready"
    message: str
    ui_blocks: list[dict[str, Any]] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    audio_base64: str = ""
    audio_mime_type: str = "audio/mpeg"
    voice_name: str = "en-US-Chirp3-HD-Achernar"


class CopilotQueryRequest(BaseModel):
    session_id: str
    query: str = Field(min_length=1)


class CopilotCancelRequest(BaseModel):
    session_id: str


class CopilotQueryResponse(BaseModel):
    session_id: str
    request_id: str
    text: str
    ui_blocks: list[dict[str, Any]]
    suggestions: list[str] = Field(default_factory=list)
    transcript: str = ""
    audio_base64: str = ""
    audio_mime_type: str = "audio/mpeg"
    voice_name: str = "en-US-Chirp3-HD-Achernar"
    degraded: bool = False


class CopilotVoiceResponse(CopilotQueryResponse):
    transcript: str = ""


class CopilotCancelResponse(BaseModel):
    session_id: str
    cancelled: bool


class CopilotActionConfirmRequest(BaseModel):
    session_id: str
    action_id: str
    decision: str = Field(default="confirm")


class CopilotActionConfirmResponse(BaseModel):
    session_id: str
    action_id: str
    confirmed: bool
    text: str
    ui_blocks: list[dict[str, Any]] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class _ToolExecutionResult(BaseModel):
    text: str = ""
    ui_blocks: list[dict[str, Any]] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)


_SESSION_STORE: dict[str, dict[str, Any]] = {}
_QUERY_CACHE: dict[str, dict[str, Any]] = {}
_INFLIGHT: dict[str, asyncio.Future[CopilotQueryResponse]] = {}
_INFLIGHT_LOCK = asyncio.Lock()

_CACHE_TTL_SECONDS = max(5, int(settings.COPILOT_CACHE_TTL_SECONDS))
_VOICE_BURST_WINDOW_MS = max(100, int(settings.COPILOT_VOICE_BURST_WINDOW_MS))
_DEFAULT_SUGGESTIONS = [
    "Show dashboard summary",
    "Show high-risk zones",
    "Show active missions",
    "Show volunteer availability",
]

_ACTION_TTL_SECONDS = max(300, int(getattr(settings, "COPILOT_ACTION_TTL_SECONDS", 900)))
_RATE_LIMIT_WINDOW_SECONDS = max(5, int(getattr(settings, "COPILOT_RATE_WINDOW_SECONDS", 10)))
_RATE_LIMIT_MAX_REQUESTS = max(1, int(getattr(settings, "COPILOT_RATE_MAX_REQUESTS", 3)))

TOOL_REGISTRY = {
    "dashboard": {"scope": "coordinator:read:dashboard"},
    "insights": {"scope": "coordinator:read:insights"},
    "zones": {"scope": "coordinator:read:zones"},
    "terrain": {"scope": "coordinator:read:terrain"},
    "missions": {"scope": "coordinator:read:missions"},
    "volunteers": {"scope": "coordinator:read:volunteers"},
    "alerts": {"scope": "coordinator:read:alerts"},
    "inventory": {"scope": "coordinator:read:inventory"},
    "resource_requests": {"scope": "coordinator:read:inventory"},
    "collaboration": {"scope": "coordinator:read:collaboration"},
    "settings": {"scope": "coordinator:read:settings"},
    "dispatch_mission": {"scope": "coordinator:write:missions"},
    "approve_resource_request": {"scope": "coordinator:write:inventory"},
    "reject_resource_request": {"scope": "coordinator:write:inventory"},
    "add_volunteer": {"scope": "coordinator:write:volunteers"},
}

COPILOT_CAPABILITIES = [
    {
        "id": "dashboard",
        "label": "Dashboard summary",
        "type": "read",
        "sources": ["firestore:zones", "firestore:missions", "firestore:insights", "rtdb:volunteerPresence"],
    },
    {
        "id": "alerts",
        "label": "Drift alerts & predictions",
        "type": "read",
        "sources": ["firestore:driftAlerts"],
    },
    {
        "id": "missions",
        "label": "Mission status and dispatch",
        "type": "read",
        "sources": ["firestore:missions"],
    },
    {
        "id": "dispatch_mission",
        "label": "Dispatch mission",
        "type": "write",
        "sources": ["firestore:missions", "firestore:users", "firestore:notifications"],
    },
    {
        "id": "resource_requests",
        "label": "Resource request approvals",
        "type": "read",
        "sources": ["firestore:missionResourceRequests"],
    },
    {
        "id": "approve_resource_request",
        "label": "Approve resource requests",
        "type": "write",
        "sources": ["firestore:missionResourceRequests", "firestore:inventoryItems", "firestore:notifications"],
    },
    {
        "id": "add_volunteer",
        "label": "Add volunteer",
        "type": "write",
        "sources": ["firestore:users"],
    },
]


def _extract_user_id(user: dict[str, Any]) -> str:
    uid = str(user.get("uid") or user.get("id") or "").strip()
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authenticated user payload")
    return uid


def _extract_user_role(user: dict[str, Any]) -> str:
    role = str(user.get("role") or "").strip().lower()
    if "." in role:
        role = role.rsplit(".", maxsplit=1)[-1]
    return role


def _extract_ngo_id(user: dict[str, Any]) -> str:
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have an associated NGO")
    return ngo_id


def _validate_session(session_id: str, user_id: str) -> dict[str, Any]:
    session = _SESSION_STORE.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Copilot session not found")
    if session.get("user_id") != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Session access denied")
    return session


def _cache_key(ngo_id: str, query: str) -> str:
    normalized = " ".join(query.strip().lower().split())
    return hashlib.sha256(f"{ngo_id}|{normalized}".encode("utf-8")).hexdigest()


def _read_cache(key: str) -> CopilotQueryResponse | None:
    if not settings.COPILOT_CACHE_ENABLED:
        return None
    row = _QUERY_CACHE.get(key)
    if not row:
        return None
    expires_at = row.get("expires_at")
    if not isinstance(expires_at, datetime) or expires_at <= datetime.utcnow():
        _QUERY_CACHE.pop(key, None)
        return None
    return row.get("response")


def _write_cache(key: str, response: CopilotQueryResponse) -> None:
    if not settings.COPILOT_CACHE_ENABLED:
        return
    _QUERY_CACHE[key] = {
        "response": response,
        "expires_at": datetime.utcnow() + timedelta(seconds=_CACHE_TTL_SECONDS),
    }


def _remember_turn(session: dict[str, Any], query: str, response: str) -> None:
    memory = session.setdefault("memory", [])
    memory.append({"query": query, "response": response})
    if len(memory) > 12:
        session["memory"] = memory[-12:]


def _normalize_suggestions(suggestions: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in suggestions:
        text = " ".join(str(item or "").split()).strip()
        if not text or text.lower() in seen:
            continue
        seen.add(text.lower())
        ordered.append(text)
    return ordered[:6] if ordered else _DEFAULT_SUGGESTIONS[:3]


def _ensure_not_cancelled(session: dict[str, Any], request_id: str) -> None:
    if session.get("cancelled_request_id") == request_id:
        raise HTTPException(status_code=499, detail="Request cancelled")


def _tool_auth_guard(tool_name: str, role: str) -> None:
    if role != "coordinator" or tool_name not in TOOL_REGISTRY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Tool not allowed: {tool_name}")


def _enforce_rate_limit(session: dict[str, Any]) -> None:
    now = datetime.utcnow().timestamp()
    history = session.setdefault("rate_history", [])
    history = [entry for entry in history if isinstance(entry, (int, float)) and now - entry <= _RATE_LIMIT_WINDOW_SECONDS]
    if len(history) >= _RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Copilot is receiving too many requests. Please wait a moment and try again.",
        )
    history.append(now)
    session["rate_history"] = history


def _register_pending_action(session: dict[str, Any], action_type: str, args: dict[str, Any]) -> str:
    action_id = f"action_{uuid.uuid4().hex[:10]}"
    pending = session.setdefault("pending_actions", {})
    pending[action_id] = {
        "action_type": action_type,
        "args": args,
        "expires_at": (datetime.utcnow() + timedelta(seconds=_ACTION_TTL_SECONDS)).isoformat(),
    }
    return action_id


def _load_pending_action(session: dict[str, Any], action_id: str) -> dict[str, Any] | None:
    pending = session.get("pending_actions") or {}
    record = pending.get(action_id)
    if not record:
        return None
    expires_at = record.get("expires_at")
    if isinstance(expires_at, str):
        try:
            if datetime.fromisoformat(expires_at) <= datetime.utcnow():
                pending.pop(action_id, None)
                return None
        except ValueError:
            pending.pop(action_id, None)
            return None
    return record


def _tool_dashboard(read: CoordinatorReadLayer, _: dict[str, Any]) -> _ToolExecutionResult:
    data = read.get_dashboard()
    zones = data["zones"]
    ui_blocks: list[dict[str, Any]] = [
        {"component": "community_pulse_donut", "props": {"score": int(data["avgScore"]), "label": "Community Pulse", "trend": data["trend"]}},
        {"component": "stat_metric_card", "props": {"label": "Avg Zone Score", "value": data["avgScore"], "delta": f"{len(zones)} zones tracked", "accent": "indigo"}},
        {"component": "stat_metric_card", "props": {"label": "Zones At Risk", "value": data["highRiskCount"], "delta": "Score >= 70", "deltaDirection": "up", "accent": "amber"}},
        {"component": "stat_metric_card", "props": {"label": "Active Missions", "value": data["activeMissions"], "delta": "Operational dispatch", "accent": "green"}},
        {"component": "stat_metric_card", "props": {"label": "Volunteers Active", "value": data["availablePresence"], "delta": "Presence feed", "accent": "purple"}},
        {"component": "need_terrain_map", "props": {"zones": zones, "heatmapPoints": read.build_heatmap_points(zones), "opacity": 0.9, "showLegend": True, "className": "h-[300px]"}},
    ]

    for insight in data.get("insights", [])[:2]:
        sev = str(insight.get("severity") or "watch").lower()
        if sev not in {"critical", "high", "watch", "resolved"}:
            sev = "watch"
        ui_blocks.append(
            {
                "component": "gemini_insight_card",
                "props": {
                    "variant": sev,
                    "zone": str(insight.get("zoneName") or insight.get("zoneId") or "Insight"),
                    "signals": insight.get("signals") or [],
                    "description": str(insight.get("summary") or "No summary available."),
                    "sourceCount": f"{int(insight.get('reportCount') or 0)} reports",
                    "timestamp": str(insight.get("generatedAt") or ""),
                },
            }
        )

    return _ToolExecutionResult(
        text="Live dashboard metrics are ready.",
        ui_blocks=ui_blocks,
        suggestions=["Show high-risk zones", "Show active missions", "Show volunteer availability"],
        context={"dashboard": {"avgScore": data["avgScore"], "highRiskCount": data["highRiskCount"], "activeMissions": data["activeMissions"]}},
    )


def _tool_insights(read: CoordinatorReadLayer, _: dict[str, Any]) -> _ToolExecutionResult:
    insights = read.get_insights(limit=8)
    if not insights:
        return _ToolExecutionResult(
            text="No Gemini insights are available yet.",
            ui_blocks=[{"component": "empty_state", "props": {"heading": "No Gemini Insights Yet", "subtext": "Run synthesis to populate insight cards.", "actionLabel": "Open insights"}}],
            suggestions=["Show dashboard summary", "Show high-risk zones", "Show active missions"],
            context={"insights": []},
        )

    ui_blocks: list[dict[str, Any]] = [
        {"component": "stat_metric_card", "props": {"label": "Insights Found", "value": len(insights), "delta": "Live synthesis rows", "accent": "indigo"}},
    ]
    for insight in insights[:6]:
        sev = str(insight.get("severity") or "watch").lower()
        if sev not in {"critical", "high", "watch", "resolved"}:
            sev = "watch"
        ui_blocks.append(
            {
                "component": "gemini_insight_card",
                "props": {
                    "variant": sev,
                    "zone": str(insight.get("zoneName") or insight.get("zoneId") or "Insight"),
                    "signals": insight.get("signals") or [],
                    "description": str(insight.get("summary") or "No summary available."),
                    "sourceCount": f"{int(insight.get('reportCount') or 0)} reports",
                    "timestamp": str(insight.get("generatedAt") or ""),
                    "sourceReports": insight.get("sourceReports") or [],
                },
            }
        )

    return _ToolExecutionResult(
        text=f"Found {len(insights)} Gemini insights.",
        ui_blocks=ui_blocks,
        suggestions=["Show high-risk zones", "Show dashboard summary", "Show drift alerts"],
        context={"insights": insights[:10]},
    )


def _tool_zones(read: CoordinatorReadLayer, args: dict[str, Any]) -> _ToolExecutionResult:
    risk_filter = str(args.get("risk_filter") or "high-risk")
    zones = read.get_zones(risk_filter=risk_filter)
    if not zones:
        return _ToolExecutionResult(
            text="No zones matched the requested filter.",
            ui_blocks=[{"component": "empty_state", "props": {"heading": "No Matching Zones", "subtext": "Try a broader filter to view zone risk signals.", "actionLabel": "Show all zones"}}],
            suggestions=["Show all zones", "Show dashboard summary", "Show terrain map"],
            context={"zones": []},
        )

    top_names = ", ".join(zone["name"] for zone in zones[:3])
    ui_blocks: list[dict[str, Any]] = [
        {"component": "stat_metric_card", "props": {"label": "Zones Found", "value": len(zones), "delta": f"Top: {top_names}", "accent": "amber"}},
        {"component": "need_terrain_map", "props": {"zones": zones, "heatmapPoints": read.build_heatmap_points(zones), "opacity": 0.82, "showLegend": True, "className": "h-[360px]"}},
    ]

    for zone in zones[:4]:
        sev = "critical" if zone["riskLevel"] == "critical" else "high" if zone["riskLevel"] == "high" else "watch"
        ui_blocks.append(
            {
                "component": "gemini_insight_card",
                "props": {
                    "variant": sev,
                    "zone": zone["name"],
                    "signals": [{"label": f"Score {int(zone['currentScore'])}", "variant": "danger" if sev in {"critical", "high"} else "warning"}],
                    "description": "Zone risk details are grounded in live operational data.",
                    "sourceCount": "Live zone data",
                    "timestamp": str(zone.get("updatedAt") or ""),
                },
            }
        )

    return _ToolExecutionResult(
        text=f"Found {len(zones)} zones for the selected risk filter.",
        ui_blocks=ui_blocks,
        suggestions=["Show terrain map", "Show dashboard summary", "Show drift alerts"],
        context={"zones": [{"id": z["id"], "name": z["name"], "score": z["currentScore"], "riskLevel": z["riskLevel"]} for z in zones[:10]]},
    )


def _tool_terrain(read: CoordinatorReadLayer, args: dict[str, Any]) -> _ToolExecutionResult:
    return _tool_zones(read, {**args, "risk_filter": str(args.get("risk_filter") or "all")})


def _tool_missions(read: CoordinatorReadLayer, args: dict[str, Any]) -> _ToolExecutionResult:
    missions = read.get_missions(status_filter=str(args.get("status") or "all"), zone_id=str(args.get("zone_id") or args.get("zoneId") or ""))
    zones = read.get_zones(risk_filter="all")

    active = sum(1 for mission in missions if str(mission.get("status")) in {"dispatched", "en_route", "on_ground"})
    pending = sum(1 for mission in missions if str(mission.get("status")) == "pending")
    completed = sum(1 for mission in missions if str(mission.get("status")) == "completed")

    ui_blocks: list[dict[str, Any]] = [
        {"component": "stat_metric_card", "props": {"label": "Missions", "value": len(missions), "delta": f"{active} active · {pending} pending", "accent": "green"}},
        {"component": "stat_metric_card", "props": {"label": "Completed", "value": completed, "delta": "Successful mission closures", "accent": "purple"}},
        {"component": "missions_live_map", "props": {"missions": missions, "zones": zones, "className": "h-[420px]"}},
    ]

    return _ToolExecutionResult(
        text=f"Found {len(missions)} missions.",
        ui_blocks=ui_blocks,
        suggestions=["Show mission priorities", "Show high-risk zones", "Show volunteer availability"],
        context={"missions": [{"id": m["id"], "title": m["title"], "status": m["status"], "zoneName": m["zoneName"]} for m in missions[:20]]},
    )


def _tool_volunteers(read: CoordinatorReadLayer, args: dict[str, Any]) -> _ToolExecutionResult:
    volunteers = read.get_volunteers(search=str(args.get("search") or args.get("query_scope") or ""))
    high_burnout = sum(1 for item in volunteers if item.get("burnout") == "high")

    ui_blocks: list[dict[str, Any]] = [
        {"component": "stat_metric_card", "props": {"label": "Volunteer Pool", "value": len(volunteers), "delta": f"{sum(1 for item in volunteers if item.get('availableNow'))} available now", "accent": "indigo"}},
        {"component": "stat_metric_card", "props": {"label": "Burnout Risk", "value": high_burnout, "delta": "High-risk profiles detected", "deltaDirection": "up", "accent": "red"}},
    ]

    for item in volunteers[:6]:
        ui_blocks.append({"component": "volunteer_avatar_card", "props": {**item, "compact": True}})

    return _ToolExecutionResult(
        text=f"Found {len(volunteers)} volunteers ranked by fit and readiness.",
        ui_blocks=ui_blocks,
        suggestions=["Show active missions", "Show high-risk zones", "Show dashboard summary"],
        context={"volunteers": [{"id": v["id"], "name": v["name"], "availableNow": v["availableNow"], "matchPercent": v["matchPercent"]} for v in volunteers[:20]]},
    )


def _tool_alerts(read: CoordinatorReadLayer, args: dict[str, Any]) -> _ToolExecutionResult:
    alerts = read.get_alerts(
        status_filter=str(args.get("status") or "all"),
        severity_filter=str(args.get("severity") or "all"),
        zone_id=str(args.get("zone_id") or args.get("zoneId") or ""),
    )

    if not alerts:
        return _ToolExecutionResult(
            text="No active drift alerts are available.",
            ui_blocks=[{"component": "empty_state", "props": {"heading": "No Drift Alerts", "subtext": "Your current alert queue is empty.", "actionLabel": "Evaluate alerts"}}],
            suggestions=["Show high-risk zones", "Show dashboard summary", "Show active missions"],
            context={"alerts": []},
        )

    counts = read.summarize_alert_severity(alerts)
    ui_blocks: list[dict[str, Any]] = [
        {
            "component": "stat_metric_card",
            "props": {
                "label": "Active Alerts",
                "value": len([alert for alert in alerts if str(alert.get("status")) in {"active", "actioned"}]),
                "delta": f"{counts.get('critical', 0)} critical · {counts.get('high', 0)} high",
                "deltaDirection": "up",
                "accent": "red",
            },
        }
    ]

    for alert in alerts[:5]:
        sev = str(alert.get("severity") or "watch")
        variant = "critical" if sev == "critical" else "high" if sev == "high" else "watch"
        ui_blocks.append(
            {
                "component": "gemini_insight_card",
                "props": {
                    "variant": variant,
                    "zone": str(alert.get("zoneName") or "Zone"),
                    "signals": alert.get("signals") or [{"label": str(alert.get("recommendedAction") or alert.get("summary") or "Alert"), "variant": "warning"}],
                    "description": str(alert.get("summary") or alert.get("predictionText") or "Alert summary unavailable."),
                    "sourceCount": f"{alert.get('status') or 'active'} · {alert.get('ruleType') or 'rule'}",
                    "timestamp": str(alert.get("createdAt") or ""),
                },
            }
        )

    return _ToolExecutionResult(
        text=f"Found {len(alerts)} drift alerts in the current scope.",
        ui_blocks=ui_blocks,
        suggestions=["Show high-risk zones", "Show active missions", "Show dashboard summary"],
        context={"alerts": [{"id": a["id"], "zoneName": a["zoneName"], "severity": a["severity"], "status": a["status"]} for a in alerts[:20]]},
    )


def _tool_dispatch_mission(session: dict[str, Any], read: CoordinatorReadLayer, args: dict[str, Any]) -> _ToolExecutionResult:
    mission_id = str(args.get("mission_id") or args.get("missionId") or "").strip()
    volunteer_id = str(args.get("volunteer_id") or args.get("volunteerId") or "").strip()
    note = str(args.get("note") or "").strip()
    if not mission_id or not volunteer_id:
        return _ToolExecutionResult(
            text="Which mission and volunteer should I dispatch?",
            ui_blocks=[{"component": "empty_state", "props": {"heading": "Mission dispatch needs details", "subtext": "Share the mission and volunteer IDs or open missions and volunteers for selection."}}],
            suggestions=["Show active missions", "Show volunteer availability", "Show dashboard summary"],
        )

    action_id = _register_pending_action(session, "dispatch_mission", {"mission_id": mission_id, "volunteer_id": volunteer_id, "note": note})
    return _ToolExecutionResult(
        text="I can dispatch this mission now. Do you want me to proceed?",
        ui_blocks=[
            {
                "component": "action_card",
                "props": {
                    "actionId": action_id,
                    "title": "Dispatch mission",
                    "summary": f"Mission {mission_id} -> volunteer {volunteer_id}",
                    "impact": "Volunteer will be notified and mission status will change to dispatched.",
                    "confirmLabel": "Confirm dispatch",
                    "cancelLabel": "Cancel",
                    "severity": "high",
                },
            }
        ],
        suggestions=["Confirm dispatch", "Cancel"],
        context={"pendingAction": {"actionId": action_id, "type": "dispatch_mission"}},
    )


def _tool_resource_request_decision(session: dict[str, Any], read: CoordinatorReadLayer, args: dict[str, Any], decision: str) -> _ToolExecutionResult:
    request_id = str(args.get("request_id") or args.get("requestId") or "").strip()
    note = str(args.get("note") or "").strip()
    if not request_id:
        return _ToolExecutionResult(
            text="Which resource request should I update?",
            ui_blocks=[{"component": "empty_state", "props": {"heading": "Resource request needed", "subtext": "Share the request ID or ask me to list pending requests."}}],
            suggestions=["Show pending resource requests", "Show inventory status", "Show dashboard summary"],
        )

    action_type = "approve_resource_request" if decision == "approved" else "reject_resource_request"
    action_id = _register_pending_action(session, action_type, {"request_id": request_id, "decision": decision, "note": note})
    return _ToolExecutionResult(
        text=f"I can {decision} this resource request now. Do you want me to proceed?",
        ui_blocks=[
            {
                "component": "action_card",
                "props": {
                    "actionId": action_id,
                    "title": f"{decision.title()} resource request",
                    "summary": f"Request {request_id}",
                    "impact": "Inventory and volunteer notifications will update.",
                    "confirmLabel": f"Confirm {decision}",
                    "cancelLabel": "Cancel",
                    "severity": "medium",
                },
            }
        ],
        suggestions=[f"Confirm {decision}", "Cancel"],
        context={"pendingAction": {"actionId": action_id, "type": action_type}},
    )


def _tool_add_volunteer(session: dict[str, Any], read: CoordinatorReadLayer, args: dict[str, Any]) -> _ToolExecutionResult:
    name = str(args.get("name") or "").strip()
    phone = str(args.get("phone") or "").strip()
    skills = args.get("skills") or []
    availability = str(args.get("availability") or "available").strip()
    if not name:
        return _ToolExecutionResult(
            text="What is the volunteer name?",
            ui_blocks=[{"component": "empty_state", "props": {"heading": "Volunteer details needed", "subtext": "Share the volunteer name and any skills to add."}}],
            suggestions=["Show volunteer availability", "Show active missions", "Show dashboard summary"],
        )

    action_id = _register_pending_action(
        session,
        "add_volunteer",
        {"name": name, "phone": phone, "skills": skills if isinstance(skills, list) else [], "availability": availability},
    )
    return _ToolExecutionResult(
        text="I can add this volunteer now. Do you want me to proceed?",
        ui_blocks=[
            {
                "component": "action_card",
                "props": {
                    "actionId": action_id,
                    "title": "Add volunteer",
                    "summary": name,
                    "impact": "Volunteer profile will be created in your NGO roster.",
                    "confirmLabel": "Confirm add",
                    "cancelLabel": "Cancel",
                    "severity": "low",
                },
            }
        ],
        suggestions=["Confirm add", "Cancel"],
        context={"pendingAction": {"actionId": action_id, "type": "add_volunteer"}},
    )


def _tool_inventory(read: CoordinatorReadLayer, args: dict[str, Any]) -> _ToolExecutionResult:
    items = read.get_inventory(warehouse_id=str(args.get("warehouse_id") or args.get("warehouseId") or ""))
    if not items:
        return _ToolExecutionResult(
            text="No inventory items are available for this scope.",
            ui_blocks=[{"component": "empty_state", "props": {"heading": "No Inventory Items", "subtext": "Create inventory records to track stock status.", "actionLabel": "Open inventory"}}],
            suggestions=["Show dashboard summary", "Show high-risk zones", "Show collaboration"],
            context={"inventory": []},
        )

    low_stock = sum(1 for item in items if item["availableQty"] <= item["thresholdQty"])
    top_item = max(items, key=lambda item: item["availableQty"] - item["thresholdQty"])
    ui_blocks = [
        {"component": "stat_metric_card", "props": {"label": "Inventory Items", "value": len(items), "delta": f"{low_stock} low stock", "accent": "purple"}},
        {"component": "stat_metric_card", "props": {"label": "Low Stock", "value": low_stock, "delta": "Needs replenishment", "deltaDirection": "up", "accent": "amber"}},
        {
            "component": "gemini_insight_card",
            "props": {
                "variant": "watch",
                "zone": str(top_item.get("name") or "Inventory"),
                "signals": [{"label": f"{top_item['availableQty']} {top_item['unit']} available", "variant": "info"}],
                "description": f"Inventory focus: {top_item['name']} in category {top_item['category']}.",
                "sourceCount": "Live inventory data",
                "timestamp": "",
            },
        },
    ]

    return _ToolExecutionResult(
        text=f"Found {len(items)} inventory items with {low_stock} below threshold.",
        ui_blocks=ui_blocks,
        suggestions=["Show warehouse status", "Show dashboard summary", "Show active missions"],
        context={"inventory": [{"id": i["id"], "name": i["name"], "availableQty": i["availableQty"], "thresholdQty": i["thresholdQty"]} for i in items[:20]]},
    )


def _tool_resource_requests(read: CoordinatorReadLayer, args: dict[str, Any]) -> _ToolExecutionResult:
    status_filter = str(args.get("status") or "pending")
    requests = read.get_resource_requests(status_filter=status_filter)
    if not requests:
        return _ToolExecutionResult(
            text="No pending resource requests are available.",
            ui_blocks=[{"component": "empty_state", "props": {"heading": "No Resource Requests", "subtext": "There are no pending requests in this scope."}}],
            suggestions=["Show inventory status", "Show dashboard summary", "Show active missions"],
            context={"resourceRequests": []},
        )

    ui_blocks: list[dict[str, Any]] = [
        {"component": "stat_metric_card", "props": {"label": "Resource Requests", "value": len(requests), "delta": "Awaiting decision", "accent": "purple"}},
    ]

    for request in requests[:4]:
        ui_blocks.append(
            {
                "component": "gemini_insight_card",
                "props": {
                    "variant": "watch",
                    "zone": str(request.get("missionTitle") or "Resource Request"),
                    "signals": [{"label": f"{request.get('volunteerName') or 'Volunteer'}", "variant": "info"}],
                    "description": str(request.get("note") or "Resource request awaiting coordinator decision."),
                    "sourceCount": f"{request.get('status') or 'pending'}",
                    "timestamp": str(request.get("createdAt") or ""),
                },
            }
        )

    return _ToolExecutionResult(
        text=f"Found {len(requests)} resource requests awaiting review.",
        ui_blocks=ui_blocks,
        suggestions=["Approve a resource request", "Reject a resource request", "Show inventory status"],
        context={"resourceRequests": requests[:10]},
    )


def _tool_collaboration(read: CoordinatorReadLayer, _: dict[str, Any]) -> _ToolExecutionResult:
    data = read.get_collaboration()
    ui_blocks = [
        {"component": "stat_metric_card", "props": {"label": "Partner NGOs", "value": data["partnerTotal"], "delta": "Active collaborations", "accent": "indigo"}},
        {"component": "stat_metric_card", "props": {"label": "Pending Requests", "value": data["pendingRequests"], "delta": "Awaiting decision", "deltaDirection": "up", "accent": "amber"}},
    ]
    return _ToolExecutionResult(
        text=f"Collaboration has {data['partnerTotal']} partners and {data['pendingRequests']} pending requests.",
        ui_blocks=ui_blocks,
        suggestions=["Show organization settings", "Show dashboard summary", "Show inventory status"],
        context={"collaboration": data},
    )


def _tool_settings(read: CoordinatorReadLayer, _: dict[str, Any]) -> _ToolExecutionResult:
    data = read.get_settings()
    ui_blocks = [
        {"component": "stat_metric_card", "props": {"label": "Trust Score", "value": data["trustScore"], "delta": str(data["trustTier"]).title(), "accent": "green" if float(data["trustScore"]) >= 70 else "amber"}},
        {"component": "stat_metric_card", "props": {"label": "Configured Zones", "value": len(data["zones"]), "delta": ", ".join(data["zones"][:3]) if data["zones"] else "No zones configured", "accent": "indigo"}},
        {"component": "stat_metric_card", "props": {"label": "Need Categories", "value": len(data["needCategories"]), "delta": ", ".join(data["needCategories"][:3]) if data["needCategories"] else "No categories configured", "accent": "purple"}},
    ]
    return _ToolExecutionResult(
        text=f"Organization profile loaded for {data['ngoName']}.",
        ui_blocks=ui_blocks,
        suggestions=["Show collaboration", "Show dashboard summary", "Show high-risk zones"],
        context={"settings": data},
    )


_TOOL_HANDLERS = {
    "dashboard": _tool_dashboard,
    "insights": _tool_insights,
    "zones": _tool_zones,
    "terrain": _tool_terrain,
    "missions": _tool_missions,
    "volunteers": _tool_volunteers,
    "alerts": _tool_alerts,
    "inventory": _tool_inventory,
    "resource_requests": _tool_resource_requests,
    "collaboration": _tool_collaboration,
    "settings": _tool_settings,
    "dispatch_mission": _tool_dispatch_mission,
    "approve_resource_request": lambda session, read, args: _tool_resource_request_decision(session, read, args, "approved"),
    "reject_resource_request": lambda session, read, args: _tool_resource_request_decision(session, read, args, "rejected"),
    "add_volunteer": _tool_add_volunteer,
}


def _execute_tool_call(session: dict[str, Any], read: CoordinatorReadLayer, role: str, tool_call: ToolCall) -> _ToolExecutionResult:
    _tool_auth_guard(tool_call.tool, role)
    handler = _TOOL_HANDLERS.get(tool_call.tool)
    if not handler:
        return _ToolExecutionResult()
    if tool_call.tool in {"dispatch_mission", "approve_resource_request", "reject_resource_request", "add_volunteer"}:
        return handler(session, read, tool_call.args)
    return handler(read, tool_call.args)


def _build_grounded_context(tool_results: list[_ToolExecutionResult], plan: CopilotPlan) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for item in tool_results:
        merged.update(item.context)
    merged["plan"] = {
        "plan_summary": plan.plan_summary,
        "intent": plan.intent,
        "out_of_scope": plan.out_of_scope,
        "requires_clarification": plan.requires_clarification,
        "tool_calls": [call.model_dump() for call in plan.tool_calls],
    }
    return merged


def _extract_ui_blocks(tool_results: list[_ToolExecutionResult]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for item in tool_results:
        blocks.extend(item.ui_blocks)
    if blocks:
        return blocks
    return [
        {
            "component": "empty_state",
            "props": {
                "heading": "Ask For A Live View",
                "subtext": "Try dashboard, zones, terrain, missions, volunteers, alerts, inventory, collaboration, or settings.",
                "actionLabel": "Show dashboard summary",
            },
        }
    ]


def _merge_suggestions(tool_results: list[_ToolExecutionResult], reply: CopilotReply) -> list[str]:
    merged: list[str] = []
    for item in tool_results:
        merged.extend(item.suggestions)
    merged.extend(reply.suggestions)
    return _normalize_suggestions(merged)


def _build_daily_briefing(read: CoordinatorReadLayer, user_name: str) -> tuple[str, list[dict[str, Any]], list[str]]:
    alerts = read.get_alerts(status_filter="active", severity_filter="all", zone_id="")
    missions = read.get_missions(status_filter="pending")
    resource_requests = read.get_resource_requests(status_filter="pending")
    volunteers = read.get_volunteers(search="available")

    critical_alerts = [alert for alert in alerts if alert.get("severity") in {"critical", "high"}]
    pending_missions = len(missions)
    pending_requests = len(resource_requests)
    available_volunteers = sum(1 for volunteer in volunteers if volunteer.get("availableNow"))

    headline = []
    if critical_alerts:
        headline.append(f"{len(critical_alerts)} critical alerts")
    if pending_requests:
        headline.append(f"{pending_requests} resource requests")
    if pending_missions:
        headline.append(f"{pending_missions} pending missions")
    if not headline:
        headline.append("No critical blockers right now")

    message = (
        f"Hi {user_name}, here is today\'s coordinator briefing: "
        f"{', '.join(headline)}. How can I help?"
    )

    ui_blocks: list[dict[str, Any]] = [
        {"component": "stat_metric_card", "props": {"label": "Critical Alerts", "value": len(critical_alerts), "delta": "Review urgent signals", "accent": "red"}},
        {"component": "stat_metric_card", "props": {"label": "Pending Missions", "value": pending_missions, "delta": "Need dispatch", "accent": "amber"}},
        {"component": "stat_metric_card", "props": {"label": "Resource Requests", "value": pending_requests, "delta": "Awaiting decision", "accent": "purple"}},
        {"component": "stat_metric_card", "props": {"label": "Volunteers Available", "value": available_volunteers, "delta": "Ready now", "accent": "green"}},
    ]

    if critical_alerts:
        top_alert = critical_alerts[0]
        ui_blocks.append(
            {
                "component": "gemini_insight_card",
                "props": {
                    "variant": "critical" if top_alert.get("severity") == "critical" else "high",
                    "zone": str(top_alert.get("zoneName") or "Zone"),
                    "signals": top_alert.get("signals") or [],
                    "description": str(top_alert.get("summary") or "Critical alert requires attention."),
                    "sourceCount": str(top_alert.get("ruleType") or "alert"),
                    "timestamp": str(top_alert.get("createdAt") or ""),
                },
            }
        )

    suggestions = _normalize_suggestions([
        "Show dashboard summary",
        "Show high-risk zones",
        "Show active missions",
        "Show pending resource requests",
    ])

    return message, ui_blocks, suggestions


def _session_greeting(user_name: str) -> str:
    return (
        f"Hi {user_name}, I am ready to plan your next coordinator action. "
        "Tell me what you want to prioritize and I will pull live operational context."
    )


async def _run_query_for_session(session: dict[str, Any], session_id: str, query: str) -> CopilotQueryResponse:
    request_id = f"req_{uuid.uuid4().hex[:10]}"
    session["active_request_id"] = request_id
    session["cancelled_request_id"] = ""

    role = str(session.get("role") or "").lower()
    read = CoordinatorReadLayer(ngo_id=str(session.get("ngo_id") or ""), user_id=str(session.get("user_id") or ""), role=role)

    memory = list(session.get("memory") or [])
    if settings.COPILOT_PLANNER_ENABLED:
        planner_result = generate_plan(query=query, memory=memory)
    else:
        planner_result = SimpleNamespace(plan=CopilotPlan(plan_summary="Planner disabled", out_of_scope=True, tool_calls=[]), degraded=True)
    plan = planner_result.plan

    tool_results: list[_ToolExecutionResult] = []
    if not plan.requires_clarification and not plan.out_of_scope:
        for call in plan.tool_calls:
            _ensure_not_cancelled(session, request_id)
            try:
                tool_results.append(_execute_tool_call(session, read, role, call))
            except HTTPException:
                raise
            except Exception as exc:
                logging.getLogger(__name__).warning("Copilot tool '%s' failed: %s", call.tool, exc)

    grounded_context = _build_grounded_context(tool_results, plan)
    reply = generate_reply(
        query=query,
        plan=plan,
        grounded_context=grounded_context,
        memory=memory,
        fallback_suggestions=_DEFAULT_SUGGESTIONS,
    )

    _ensure_not_cancelled(session, request_id)

    if not reply.response_text.strip():
        reply = CopilotReply(
            response_text="The AI provider is temporarily unavailable. Please retry in a moment.",
            suggestions=_DEFAULT_SUGGESTIONS[:3],
        )

    ui_blocks = _extract_ui_blocks(tool_results)
    suggestions = _merge_suggestions(tool_results, reply)

    try:
        speech = synthesize_copilot_speech(reply.response_text)
    except Exception as exc:
        logging.getLogger(__name__).warning("Copilot TTS failed for session %s: %s", session_id, exc)
        speech = {"audio_base64": "", "audio_mime_type": "audio/mpeg", "voice_name": "en-US-Chirp3-HD-Achernar"}

    _remember_turn(session, query=query, response=reply.response_text)

    return CopilotQueryResponse(
        session_id=session_id,
        request_id=request_id,
        text=reply.response_text,
        ui_blocks=ui_blocks,
        suggestions=suggestions,
        transcript=query,
        audio_base64=str(speech.get("audio_base64") or ""),
        audio_mime_type=str(speech.get("audio_mime_type") or "audio/mpeg"),
        voice_name=str(speech.get("voice_name") or "en-US-Chirp3-HD-Achernar"),
        degraded=bool(planner_result.degraded),
    )


async def _run_query_with_coalescing(session: dict[str, Any], session_id: str, query: str) -> CopilotQueryResponse:
    key = _cache_key(str(session.get("ngo_id") or ""), query)
    cached = _read_cache(key)
    if cached:
        return cached

    async with _INFLIGHT_LOCK:
        existing = _INFLIGHT.get(key)
        if existing:
            return await existing
        loop = asyncio.get_running_loop()
        fut: asyncio.Future[CopilotQueryResponse] = loop.create_future()
        _INFLIGHT[key] = fut

    try:
        response = await _run_query_for_session(session=session, session_id=session_id, query=query)
        _write_cache(key, response)
        if not fut.done():
            fut.set_result(response)
        return response
    except Exception as exc:
        if not fut.done():
            fut.set_exception(exc)
        raise
    finally:
        async with _INFLIGHT_LOCK:
            _INFLIGHT.pop(key, None)


@router.post("/session/start", response_model=CopilotSessionStartResponse)
async def start_copilot_session(user: dict[str, Any] = Depends(role_required("coordinator"))) -> CopilotSessionStartResponse:
    user_id = _extract_user_id(user)
    ngo_id = _extract_ngo_id(user)
    role = _extract_user_role(user)
    user_name = str(user.get("name") or user.get("displayName") or "there").strip() or "there"

    session_id = f"copilot_{uuid.uuid4().hex[:12]}"
    _SESSION_STORE[session_id] = {
        "user_id": user_id,
        "ngo_id": ngo_id,
        "role": role,
        "user_name": user_name,
        "created_at": datetime.utcnow().isoformat(),
        "memory": [],
        "cancelled_request_id": "",
        "active_request_id": "",
        "last_voice_query": "",
        "last_voice_at": "",
    }

    read = CoordinatorReadLayer(ngo_id=ngo_id, user_id=user_id, role=role)
    greeting_message, briefing_blocks, briefing_suggestions = _build_daily_briefing(read, user_name)

    try:
        speech = synthesize_copilot_speech(greeting_message)
    except Exception as exc:
        logging.getLogger(__name__).warning("Copilot greeting TTS failed for session %s: %s", session_id, exc)
        speech = {"audio_base64": "", "audio_mime_type": "audio/mpeg", "voice_name": "en-US-Chirp3-HD-Achernar"}

    return CopilotSessionStartResponse(
        session_id=session_id,
        message=greeting_message,
        ui_blocks=briefing_blocks,
        suggestions=briefing_suggestions,
        audio_base64=str(speech.get("audio_base64") or ""),
        audio_mime_type=str(speech.get("audio_mime_type") or "audio/mpeg"),
        voice_name=str(speech.get("voice_name") or "en-US-Chirp3-HD-Achernar"),
    )


@router.post("/cancel", response_model=CopilotCancelResponse)
async def cancel_copilot_query(
    request: CopilotCancelRequest,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> CopilotCancelResponse:
    user_id = _extract_user_id(user)
    session = _validate_session(request.session_id, user_id)
    active_request_id = str(session.get("active_request_id") or "")
    if active_request_id:
        session["cancelled_request_id"] = active_request_id
    return CopilotCancelResponse(session_id=request.session_id, cancelled=bool(active_request_id))


@router.post("/query", response_model=CopilotQueryResponse)
async def query_copilot(
    request: CopilotQueryRequest,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> CopilotQueryResponse:
    user_id = _extract_user_id(user)
    session = _validate_session(request.session_id, user_id)
    _enforce_rate_limit(session)
    return await _run_query_with_coalescing(session, request.session_id, request.query)


@router.post("/query/stream")
async def query_copilot_stream(
    request: CopilotQueryRequest,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> StreamingResponse:
    user_id = _extract_user_id(user)
    session = _validate_session(request.session_id, user_id)
    _enforce_rate_limit(session)
    response = await _run_query_with_coalescing(session, request.session_id, request.query)

    async def event_stream() -> Any:
        for token in response.text.split():
            yield f"event: token\ndata: {token}\n\n"
            await asyncio.sleep(0)

        yield f"event: ui_blocks\ndata: {json.dumps(response.ui_blocks, ensure_ascii=True)}\n\n"
        yield f"event: suggestions\ndata: {json.dumps(response.suggestions, ensure_ascii=True)}\n\n"
        yield f"event: done\ndata: {json.dumps({
            'session_id': response.session_id,
            'request_id': response.request_id,
            'text': response.text,
            'ui_blocks': response.ui_blocks,
            'suggestions': response.suggestions,
            'audio_base64': response.audio_base64,
            'audio_mime_type': response.audio_mime_type,
            'voice_name': response.voice_name,
            'degraded': response.degraded,
        }, ensure_ascii=True)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/voice", response_model=CopilotVoiceResponse)
async def voice_copilot(
    session_id: str = Form(...),
    file: UploadFile = File(...),
    language: str = Form("en"),
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> CopilotVoiceResponse:
    user_id = _extract_user_id(user)
    session = _validate_session(session_id, user_id)
    _enforce_rate_limit(session)

    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be audio")

    audio_bytes = await file.read()
    try:
        extracted = await process_voice(audio_bytes, language=language, mime_type=file.content_type)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    transcript = str(extracted.get("transcriptEnglish") or extracted.get("transcript") or "").strip()
    if not transcript:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not understand the spoken request")

    now = datetime.utcnow()
    last_voice_query = str(session.get("last_voice_query") or "")
    last_voice_at_raw = session.get("last_voice_at")
    within_burst_window = False
    if isinstance(last_voice_at_raw, str) and last_voice_at_raw:
        try:
            last_at = datetime.fromisoformat(last_voice_at_raw)
            within_burst_window = (now - last_at).total_seconds() * 1000 < _VOICE_BURST_WINDOW_MS
        except ValueError:
            within_burst_window = False

    if settings.COPILOT_VOICE_COALESCE_ENABLED and transcript.lower() == last_voice_query.lower() and within_burst_window:
        key = _cache_key(str(session.get("ngo_id") or ""), transcript)
        cached = _read_cache(key)
        if cached:
            return CopilotVoiceResponse(**cached.model_dump(), transcript=transcript)

    session["last_voice_query"] = transcript
    session["last_voice_at"] = now.isoformat()

    response = await _run_query_with_coalescing(session, session_id, transcript)

    return CopilotVoiceResponse(
        session_id=response.session_id,
        request_id=response.request_id,
        text=response.text,
        ui_blocks=response.ui_blocks,
        suggestions=response.suggestions,
        transcript=transcript,
        audio_base64=response.audio_base64,
        audio_mime_type=response.audio_mime_type,
        voice_name=response.voice_name,
        degraded=response.degraded,
    )


@router.get("/capabilities", response_model=dict[str, Any])
async def copilot_capabilities(user: dict[str, Any] = Depends(role_required("coordinator"))) -> dict[str, Any]:
    _extract_user_id(user)
    return {"capabilities": COPILOT_CAPABILITIES}


@router.post("/action/confirm", response_model=CopilotActionConfirmResponse)
async def confirm_copilot_action(
    request: CopilotActionConfirmRequest,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> CopilotActionConfirmResponse:
    user_id = _extract_user_id(user)
    session = _validate_session(request.session_id, user_id)
    record = _load_pending_action(session, request.action_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found or expired")

    decision = str(request.decision or "confirm").strip().lower()
    if decision not in {"confirm", "cancel"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Decision must be confirm or cancel")

    if decision == "cancel":
        session.get("pending_actions", {}).pop(request.action_id, None)
        db.collection("copilot_audit").add(
            {
                "actionId": request.action_id,
                "actionType": str(record.get("action_type") or ""),
                "ngoId": str(session.get("ngo_id") or ""),
                "userId": user_id,
                "decision": "cancel",
                "timestamp": datetime.utcnow(),
                "payload": record.get("args") or {},
            }
        )
        return CopilotActionConfirmResponse(
            session_id=request.session_id,
            action_id=request.action_id,
            confirmed=False,
            text="Action cancelled.",
            ui_blocks=[],
            suggestions=_DEFAULT_SUGGESTIONS[:3],
        )

    write = CoordinatorWriteLayer(ngo_id=str(session.get("ngo_id") or ""), user_id=user_id, role=str(session.get("role") or ""))
    action_type = str(record.get("action_type") or "")
    args = record.get("args") or {}
    result_text = "Action completed."

    try:
        if action_type == "approve_resource_request":
            write.approve_resource_request(str(args.get("request_id") or ""), "approved", str(args.get("note") or ""))
            result_text = "Resource request approved."
        elif action_type == "reject_resource_request":
            write.approve_resource_request(str(args.get("request_id") or ""), "rejected", str(args.get("note") or ""))
            result_text = "Resource request rejected."
        elif action_type == "dispatch_mission":
            write.dispatch_mission(str(args.get("mission_id") or ""), str(args.get("volunteer_id") or ""), str(args.get("note") or ""))
            result_text = "Mission dispatched and volunteer notified."
        elif action_type == "add_volunteer":
            write.add_volunteer(
                str(args.get("name") or ""),
                str(args.get("phone") or ""),
                list(args.get("skills") or []),
                str(args.get("availability") or "available"),
            )
            result_text = "Volunteer added to the roster."
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown action type")
        db.collection("copilot_audit").add(
            {
                "actionId": request.action_id,
                "actionType": action_type,
                "ngoId": str(session.get("ngo_id") or ""),
                "userId": user_id,
                "decision": "confirm",
                "timestamp": datetime.utcnow(),
                "payload": args,
            }
        )
    finally:
        session.get("pending_actions", {}).pop(request.action_id, None)

    return CopilotActionConfirmResponse(
        session_id=request.session_id,
        action_id=request.action_id,
        confirmed=True,
        text=result_text,
        ui_blocks=[],
        suggestions=_DEFAULT_SUGGESTIONS[:3],
    )
