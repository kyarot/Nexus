from __future__ import annotations

import logging
from typing import Any

from core.firebase import db
from services.assignment_location import ACTIVE_MISSION_STATUSES, has_active_mission, location_distance_to_zone_km, location_is_within_zone
from services.mission_assignment import commit_mission_assignment

logger = logging.getLogger("nexus.auto_assignment_service")


def auto_assign_mission_to_user(user_id: str, location: dict[str, Any]):
    """
    Checks for pending missions in the zone where the user is now located.
    If a mission is found, assigns it to the user.
    """
    try:
        user_ref = db.collection("users").document(user_id)
        user_snap = user_ref.get()
        if not user_snap.exists:
            return None
        
        user_data = user_snap.to_dict() or {}
        ngo_id = user_data.get("ngoId")
        role = user_data.get("role")
        
        if not ngo_id or not role:
            return None

        # Check if user already has an active mission
        active_missions = list(
            db.collection("missions")
            .where("assignedTo", "==", user_id)
            .where("status", "in", list(ACTIVE_MISSION_STATUSES))
            .limit(5)
            .stream()
        )
        if has_active_mission((doc.to_dict() or {} for doc in active_missions), user_id):
            logger.info(f"User {user_id} already has an active mission. Skipping auto-assignment.")
            return None

        lat = location.get("lat")
        lng = location.get("lng")
        if lat is None or lng is None:
            return None

        zones_docs = db.collection("zones").where("ngoIds", "array_contains", ngo_id).stream()

        matched_zone = None
        for doc in zones_docs:
            zone_data = doc.to_dict() or {}
            if location_is_within_zone({"lat": lat, "lng": lng}, zone_data):
                matched_zone = zone_data
                matched_zone["id"] = doc.id
                break

        if not matched_zone:
            logger.info(f"User {user_id} is not within any zone radius. Skipping.")
            return None

        pending_missions = (
            db.collection("missions")
            .where("ngoId", "==", ngo_id)
            .where("zoneId", "==", matched_zone["id"])
            .where("status", "==", "pending")
            .where("targetAudience", "==", role)
            .order_by("priority", direction="DESCENDING")
            .limit(1)
            .get()
        )

        if not pending_missions:
            logger.info(f"No pending missions in zone {matched_zone['id']} for role {role}.")
            return None

        mission_doc = pending_missions[0]
        mission_id = mission_doc.id
        mission_data = mission_doc.to_dict() or {}

        commit_mission_assignment(
            mission_id=mission_id,
            mission_data=mission_data,
            zone=matched_zone,
            assignee_id=user_id,
            assignee_name=str(user_data.get("name") or "Responder"),
            assignee_data=user_data,
            mission_update={
                "status": "dispatched",
                "statusText": f"{role.replace('_', ' ').title()} en route",
                "assignedVolunteerDistance": round(location_distance_to_zone_km({"lat": lat, "lng": lng}, matched_zone) or 0.1, 2),
            },
            notification_title=mission_data.get("title", "Mission Assigned"),
            notification_message=f"New mission auto-assigned based on your current location in {matched_zone['name']}.",
            notification_metadata={
                "zoneId": matched_zone["id"],
                "zoneName": matched_zone["name"],
                "autoAssigned": True,
            },
        )

        logger.info(f"Successfully auto-assigned mission {mission_id} to user {user_id}.")
        return mission_id

    except Exception as e:
        logger.error(f"Error in auto_assign_mission_to_user: {e}")
        return None
