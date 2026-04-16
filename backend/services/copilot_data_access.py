from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import Any

from google.cloud.firestore_v1.base_query import FieldFilter

from core.firebase import db, rtdb


class CoordinatorReadLayer:
    """Centralized scoped data access for Copilot tool execution."""

    def __init__(self, ngo_id: str, user_id: str, role: str) -> None:
        self.ngo_id = str(ngo_id or "").strip()
        self.user_id = str(user_id or "").strip()
        self.role = str(role or "").strip().lower()
        if not self.ngo_id:
            raise ValueError("Missing NGO scope")
        if self.role != "coordinator":
            raise PermissionError("Coordinator role required")

    @staticmethod
    def _safe_int(value: Any, default: int = 0) -> int:
        try:
            return int(round(float(value)))
        except Exception:
            return default

    @staticmethod
    def _safe_float(value: Any, default: float = 0.0) -> float:
        try:
            return float(value)
        except Exception:
            return default

    @staticmethod
    def _safe_str(value: Any, default: str = "") -> str:
        text = str(value or default).strip()
        return text or default

    @staticmethod
    def _serialize_value(value: Any) -> Any:
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, list):
            return [CoordinatorReadLayer._serialize_value(item) for item in value]
        if isinstance(value, dict):
            return {key: CoordinatorReadLayer._serialize_value(item) for key, item in value.items()}
        return value

    @staticmethod
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

    def get_ngo_name(self) -> str:
        snapshot = db.collection("ngos").document(self.ngo_id).get()
        if not snapshot.exists:
            return "Community NGO"
        data = snapshot.to_dict() or {}
        return self._safe_str(data.get("name") or "Community NGO", "Community NGO")

    def get_zones(self, risk_filter: str = "all") -> list[dict[str, Any]]:
        rows = db.collection("zones").where("ngoIds", "array_contains", self.ngo_id).stream()
        zones: list[dict[str, Any]] = []
        for doc in rows:
            data = doc.to_dict() or {}
            zone = {
                "id": doc.id,
                "name": self._safe_str(data.get("name") or doc.id, "Zone"),
                "ward": data.get("ward"),
                "city": data.get("city"),
                "lat": self._safe_float(data.get("lat")),
                "lng": self._safe_float(data.get("lng")),
                "currentScore": self._safe_float(data.get("currentScore")),
                "riskLevel": self._safe_str(data.get("riskLevel") or "low").lower(),
                "topNeeds": list(data.get("topNeeds") or []),
                "signalCounts": data.get("signalCounts") or {},
                "updatedAt": self._serialize_value(data.get("updatedAt")),
            }
            zones.append(zone)

        zones.sort(key=lambda item: item["currentScore"], reverse=True)
        normalized_filter = self._safe_str(risk_filter or "all", "all").lower()
        if normalized_filter in {"high", "high-risk", "critical", "risky"}:
            zones = [zone for zone in zones if zone["riskLevel"] in {"high", "critical"} or zone["currentScore"] >= 70]
        return zones

    def get_insights(self, limit: int = 8) -> list[dict[str, Any]]:
        try:
            docs = (
                db.collection("insights")
                .where(filter=FieldFilter("ngoId", "==", self.ngo_id))
                .order_by("generatedAt", direction="DESCENDING")
                .limit(limit)
                .stream()
            )
            rows = [doc.to_dict() or {} for doc in docs]
        except Exception:
            rows = [doc.to_dict() or {} for doc in db.collection("insights").where(filter=FieldFilter("ngoId", "==", self.ngo_id)).stream()]
            rows.sort(key=lambda item: self._coerce_datetime(item.get("generatedAt")) or datetime.min, reverse=True)
            rows = rows[:limit]
        return rows

    def get_missions(self, status_filter: str = "all", zone_id: str = "") -> list[dict[str, Any]]:
        docs = db.collection("missions").where(filter=FieldFilter("ngoId", "==", self.ngo_id)).stream()
        missions: list[dict[str, Any]] = []
        for doc in docs:
            data = doc.to_dict() or {}
            status = self._safe_str(data.get("status") or "pending", "pending").lower()
            if status_filter and status_filter != "all" and status != status_filter:
                continue
            if zone_id and self._safe_str(data.get("zoneId")) != zone_id:
                continue
            missions.append(
                {
                    "id": doc.id,
                    "title": self._safe_str(data.get("title") or "Mission", "Mission"),
                    "description": self._safe_str(data.get("description") or ""),
                    "zoneId": self._safe_str(data.get("zoneId") or ""),
                    "zoneName": self._safe_str(data.get("zoneName") or data.get("zoneId") or "Zone", "Zone"),
                    "needType": self._safe_str(data.get("needType") or "general", "general"),
                    "targetAudience": self._safe_str(data.get("targetAudience") or "fieldworker", "fieldworker"),
                    "priority": self._safe_str(data.get("priority") or "medium", "medium"),
                    "status": status,
                    "resources": data.get("resources") or [],
                    "location": data.get("location") or {"lat": 12.9716, "lng": 77.5946, "address": "Location available"},
                    "estimatedDurationMinutes": self._safe_int(data.get("estimatedDurationMinutes"), 60),
                    "progress": self._safe_int(data.get("progress"), 0),
                    "familiesHelped": self._safe_int(data.get("familiesHelped"), 0),
                    "createdAt": self._serialize_value(data.get("createdAt")),
                    "updatedAt": self._serialize_value(data.get("updatedAt")),
                }
            )

        missions.sort(key=lambda item: self._coerce_datetime(item.get("updatedAt") or item.get("createdAt")) or datetime.min, reverse=True)
        return missions

    def get_volunteers(self, search: str = "") -> list[dict[str, Any]]:
        docs = (
            db.collection("users")
            .where(filter=FieldFilter("ngoId", "==", self.ngo_id))
            .where(filter=FieldFilter("role", "==", "volunteer"))
            .stream()
        )

        ngo_name = self.get_ngo_name()
        q = self._safe_str(search).lower()
        volunteers: list[dict[str, Any]] = []
        for doc in docs:
            data = doc.to_dict() or {}
            name = self._safe_str(data.get("name") or "Volunteer", "Volunteer")
            skills = [str(skill).strip() for skill in (data.get("skills") or []) if str(skill).strip()]
            availability = self._safe_str(data.get("availability") or "available")
            if q and q not in name.lower() and q not in availability.lower() and q not in " ".join(skill.lower() for skill in skills):
                continue

            missions_completed = self._safe_int(data.get("missionsCompleted"), 0)
            success_rate = self._safe_int(data.get("successRate"), min(99, 70 + len(skills) * 4))
            burnout = self._safe_str(data.get("burnoutRisk") or "low", "low").lower()
            distance_km = self._safe_float(data.get("travelRadius") or 3.0, 3.0)
            match_percent = min(99, 60 + len(skills) * 4 + (10 if availability in {"available", "online"} else 0) + (8 if missions_completed else 0) - (8 if burnout == "high" else 0))

            volunteers.append(
                {
                    "id": doc.id,
                    "name": name,
                    "initials": "".join([part[0] for part in name.split()[:2]]).upper() or "NA",
                    "org": ngo_name,
                    "matchPercent": match_percent,
                    "distance": f"{distance_km:.1f} km",
                    "distanceKm": distance_km,
                    "skills": skills,
                    "burnout": burnout if burnout in {"low", "medium", "high"} else "low",
                    "missions": missions_completed,
                    "successRate": success_rate,
                    "color": ["bg-primary", "bg-success", "bg-warning", "bg-primary-glow", "bg-destructive"][sum(ord(ch) for ch in doc.id) % 5],
                    "availability": availability,
                    "availableNow": availability in {"available", "online"},
                    "activeMissionCount": 0,
                    "hasThisWeekActivity": bool(missions_completed),
                }
            )

        volunteers.sort(key=lambda item: (item["matchPercent"], item["successRate"]), reverse=True)
        return volunteers

    def get_alerts(self, status_filter: str = "all", severity_filter: str = "all", zone_id: str = "") -> list[dict[str, Any]]:
        try:
            rows = list(db.collection("driftAlerts").where(filter=FieldFilter("ngoId", "==", self.ngo_id)).stream())
        except Exception:
            rows = list(db.collection("driftAlerts").stream())

        alerts: list[dict[str, Any]] = []
        for doc in rows:
            data = doc.to_dict() or {}
            status = self._safe_str(data.get("status") or "active", "active").lower()
            severity = self._safe_str(data.get("severity") or "watch", "watch").lower()
            if zone_id and self._safe_str(data.get("zoneId")) != zone_id:
                continue
            if status_filter and status_filter != "all" and status != status_filter:
                continue
            if severity_filter and severity_filter != "all" and severity != severity_filter:
                continue
            alerts.append(
                {
                    "id": doc.id,
                    "zoneId": data.get("zoneId"),
                    "zoneName": self._safe_str(data.get("zoneName") or data.get("zoneId") or "Zone", "Zone"),
                    "ruleType": data.get("ruleType"),
                    "severity": severity,
                    "status": status,
                    "title": self._safe_str(data.get("title") or "Drift alert", "Drift alert"),
                    "summary": self._safe_str(data.get("summary") or ""),
                    "predictionText": data.get("predictionText"),
                    "recommendedAction": data.get("recommendedAction"),
                    "signals": data.get("signals") or [],
                    "sourceReports": data.get("sourceReports") or [],
                    "createdAt": self._serialize_value(data.get("createdAt")),
                }
            )

        alerts.sort(key=lambda item: (item.get("severity") or "", self._coerce_datetime(item.get("createdAt")) or datetime.min), reverse=True)
        return alerts

    def get_inventory(self, warehouse_id: str = "") -> list[dict[str, Any]]:
        docs = db.collection("inventoryItems").where(filter=FieldFilter("ngoId", "==", self.ngo_id)).stream()
        items: list[dict[str, Any]] = []
        for doc in docs:
            data = doc.to_dict() or {}
            if warehouse_id and self._safe_str(data.get("warehouseId")) != warehouse_id:
                continue
            items.append(
                {
                    "id": doc.id,
                    "warehouseId": data.get("warehouseId"),
                    "zoneId": data.get("zoneId"),
                    "name": self._safe_str(data.get("name") or "Item", "Item"),
                    "category": self._safe_str(data.get("category") or "general", "general"),
                    "unit": self._safe_str(data.get("unit") or "pcs", "pcs"),
                    "availableQty": self._safe_int(data.get("availableQty"), 0),
                    "thresholdQty": self._safe_int(data.get("thresholdQty"), 0),
                }
            )
        return items

    def get_collaboration(self) -> dict[str, Any]:
        ngo_snapshot = db.collection("ngos").document(self.ngo_id).get()
        ngo_data = ngo_snapshot.to_dict() or {}
        partner_ids = [str(item) for item in (ngo_data.get("partnerNgoIds") or []) if str(item).strip()]

        request_rows = list(db.collection("collaboration_requests").where(filter=FieldFilter("fromNgoId", "==", self.ngo_id)).stream())
        outgoing_pending = 0
        for doc in request_rows:
            data = doc.to_dict() or {}
            if self._safe_str(data.get("status") or "pending") == "pending":
                outgoing_pending += 1

        return {
            "partnerTotal": len(partner_ids),
            "pendingRequests": outgoing_pending,
        }

    def get_settings(self) -> dict[str, Any]:
        ngo_snapshot = db.collection("ngos").document(self.ngo_id).get()
        ngo_data = ngo_snapshot.to_dict() or {}
        zones = [str(item) for item in (ngo_data.get("zones") or []) if str(item).strip()]
        categories = [str(item) for item in (ngo_data.get("needCategories") or []) if str(item).strip()]
        return {
            "ngoName": self._safe_str(ngo_data.get("name") or "Community NGO", "Community NGO"),
            "trustScore": self._safe_float(ngo_data.get("trustScore"), 0.0),
            "trustTier": self._safe_str(ngo_data.get("trustTier") or "bronze", "bronze"),
            "zones": zones,
            "needCategories": categories,
        }

    def get_dashboard(self) -> dict[str, Any]:
        zones = self.get_zones(risk_filter="all")
        insights = self.get_insights(limit=4)
        missions = self.get_missions(status_filter="all")
        volunteers = self.get_volunteers(search="")
        volunteer_presence = rtdb.child("volunteerPresence").get() or {}

        available_presence = 0
        if isinstance(volunteer_presence, dict):
            available_presence = sum(1 for row in volunteer_presence.values() if isinstance(row, dict) and row.get("available") is True)

        avg_score = round(sum(zone["currentScore"] for zone in zones) / len(zones), 1) if zones else 0
        high_risk_count = sum(1 for zone in zones if zone["riskLevel"] in {"high", "critical"} or zone["currentScore"] >= 70)
        active_missions = sum(1 for mission in missions if mission.get("status") in {"dispatched", "en_route", "on_ground"})

        return {
            "zones": zones,
            "insights": insights,
            "missions": missions,
            "volunteers": volunteers,
            "avgScore": avg_score,
            "highRiskCount": high_risk_count,
            "activeMissions": active_missions,
            "availablePresence": available_presence,
            "trend": "up" if high_risk_count > 0 else "down",
        }

    @staticmethod
    def build_heatmap_points(zones: list[dict[str, Any]]) -> list[dict[str, Any]]:
        points: list[dict[str, Any]] = []
        for zone in zones:
            lat = zone.get("lat")
            lng = zone.get("lng")
            if not lat or not lng:
                continue
            points.append(
                {
                    "id": zone["id"],
                    "zoneId": zone["id"],
                    "lat": lat,
                    "lng": lng,
                    "weight": max(1, min(10, int(zone.get("currentScore", 0)) // 10 + 1)),
                    "riskLevel": zone.get("riskLevel"),
                    "needType": (zone.get("topNeeds") or [None])[0],
                }
            )
        return points

    @staticmethod
    def summarize_alert_severity(alerts: list[dict[str, Any]]) -> Counter:
        return Counter(str(alert.get("severity") or "watch") for alert in alerts)
