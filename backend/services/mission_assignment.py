from __future__ import annotations

from datetime import datetime
from typing import Any

from core.firebase import db
from services.mission_intelligence import generate_empathy_brief
from services.notifications_hub import notify_users


def commit_mission_assignment(
    *,
    mission_id: str,
    mission_data: dict[str, Any],
    zone: dict[str, Any],
    assignee_id: str,
    assignee_name: str,
    assignee_data: dict[str, Any],
    mission_update: dict[str, Any],
    update_event_type: str = "mission_auto_assigned",
    update_event_status: str = "dispatched",
    update_event_actor_key: str = "volunteerId",
    update_event_actor_name_key: str = "volunteerName",
    notification_type: str = "mission_assigned",
    notification_title: str | None = None,
    notification_message: str | None = None,
    notification_metadata: dict[str, Any] | None = None,
    notify_assignee: bool = True,
) -> dict[str, Any]:
    now = datetime.utcnow()
    mission_ref = db.collection("missions").document(mission_id)

    update_data = {
        **mission_update,
        "assignedTo": assignee_id,
        "assignedToName": assignee_name,
        "updatedAt": now,
    }
    update_data.setdefault("dispatchedAt", now)
    update_data.setdefault("autoAssigned", True)
    update_data.setdefault("status", update_event_status)

    update_data["empathyBrief"] = generate_empathy_brief(
        mission={**mission_data, **update_data},
        volunteer={"id": assignee_id, **assignee_data},
        zone=zone,
    )

    mission_ref.update(update_data)
    mission_ref.collection("updates").add(
        {
            "type": update_event_type,
            "status": update_event_status,
            update_event_actor_key: assignee_id,
            update_event_actor_name_key: assignee_name,
            "timestamp": now,
            "submittedBy": "system",
        }
    )

    if notify_assignee:
        notify_users(
            [assignee_id],
            type=notification_type,
            mission_id=mission_id,
            title=notification_title or str(mission_data.get("title") or "Mission assignment"),
            message=notification_message or f"New mission assigned in {zone.get('name') or 'your area'}",
            metadata=notification_metadata or {"zoneId": zone.get("id"), "zoneName": zone.get("name"), "autoAssigned": True},
            timestamp=now,
        )

    return update_data