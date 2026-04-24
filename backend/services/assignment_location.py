from __future__ import annotations

from math import atan2, cos, radians, sin, sqrt
from typing import Any, Iterable

ACTIVE_MISSION_STATUSES = {"dispatched", "en_route", "on_ground"}


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_km = 6371.0
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return max(0.1, radius_km * c)


def zone_radius_km(zone_data: dict[str, Any]) -> float:
    try:
        radius_meters = float(zone_data.get("radiusMeters") or 1000)
    except (TypeError, ValueError):
        radius_meters = 1000.0
    return max(0.1, radius_meters / 1000.0)


def extract_location(payload: dict[str, Any] | None) -> tuple[float, float] | None:
    if not isinstance(payload, dict):
        return None
    try:
        lat = float(payload.get("lat"))
        lng = float(payload.get("lng"))
    except (TypeError, ValueError):
        return None
    if abs(lat) < 0.000001 and abs(lng) < 0.000001:
        return None
    return lat, lng


def location_distance_to_zone_km(location: dict[str, Any] | None, zone_data: dict[str, Any]) -> float | None:
    coords = extract_location(location)
    zone_coords = extract_location(zone_data)
    if not coords or not zone_coords:
        return None
    return haversine_km(coords[0], coords[1], zone_coords[0], zone_coords[1])


def location_is_within_zone(location: dict[str, Any] | None, zone_data: dict[str, Any]) -> bool:
    distance_km = location_distance_to_zone_km(location, zone_data)
    if distance_km is None:
        return False
    return distance_km <= zone_radius_km(zone_data)


def has_active_mission(mission_rows: Iterable[dict[str, Any]], user_id: str) -> bool:
    for mission in mission_rows:
        if str(mission.get("assignedTo") or "").strip() != user_id:
            continue
        if str(mission.get("status") or "").strip().lower() in ACTIVE_MISSION_STATUSES:
            return True
    return False