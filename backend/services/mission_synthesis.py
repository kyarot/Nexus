from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Any

from firebase_admin import firestore

from core.firebase import db
from core.gemini import GEMINI_FLASH, client
from services.mission_intelligence import plan_resources_for_mission

logger = logging.getLogger("nexus.mission_synthesis")

ACTIVE_MISSION_STATUSES = {"pending", "dispatched", "en_route", "on_ground"}


def _strip_json_fences(text: str) -> str:
	cleaned = text.strip()
	if cleaned.startswith("```"):
		cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
	if cleaned.endswith("```"):
		cleaned = cleaned[:-3].strip()
	return cleaned


def _serialize_firestore_value(value: Any) -> Any:
	if isinstance(value, datetime):
		return value.isoformat()
	if isinstance(value, list):
		return [_serialize_firestore_value(item) for item in value]
	if isinstance(value, dict):
		return {key: _serialize_firestore_value(item) for key, item in value.items()}
	return value


def _normalize_need(value: str) -> str:
	return value.strip().lower().replace("-", " ")


def _priority_from_severity(severity: str) -> str:
	severity = severity.strip().lower()
	if severity in {"critical"}:
		return "critical"
	if severity in {"high"}:
		return "high"
	if severity in {"low"}:
		return "low"
	return "medium"


def _extract_resources_from_report(report_data: dict[str, Any]) -> list[dict[str, Any]]:
	resources: list[dict[str, Any]] = []
	incidents = report_data.get("needIncidents") or []
	for incident in incidents:
		if not isinstance(incident, dict):
			continue
		for resource in incident.get("requiredResources") or []:
			if not isinstance(resource, dict):
				continue
			name = str(resource.get("name") or "resource").strip()
			if not name:
				continue
			resources.append(
				{
					"name": name,
					"quantity": resource.get("quantity"),
					"status": resource.get("status"),
				}
			)
	return resources


def _merge_resources(existing: list[dict[str, Any]], additions: list[dict[str, Any]]) -> list[dict[str, Any]]:
	merged: dict[str, dict[str, Any]] = {}
	for item in existing + additions:
		if not isinstance(item, dict):
			continue
		name = str(item.get("name") or "resource").strip()
		if not name:
			continue
		entry = merged.get(name) or {"name": name, "quantity": 0, "status": None}
		quantity = item.get("quantity")
		if isinstance(quantity, (int, float)):
			entry["quantity"] = (entry.get("quantity") or 0) + quantity
		elif quantity is not None:
			entry["quantity"] = quantity
		status = item.get("status")
		if status:
			entry["status"] = status
		merged[name] = entry
	return list(merged.values())


def _build_fallback_payload(report_data: dict[str, Any], zone_data: dict[str, Any]) -> dict[str, Any]:
	need_type = str(report_data.get("needType") or "general")
	zone_name = str(zone_data.get("name") or "the area")
	severity = str(report_data.get("severity") or "medium")
	families = report_data.get("familiesAffected") or 0
	notes = report_data.get("additionalNotes") or ""

	description = f"Field reports indicate {need_type} issues in {zone_name}."
	if families:
		description += f" Estimated {families} families affected."
	if notes:
		description += f" Notes: {notes}"

	return {
		"title": f"{need_type.title()} support in {zone_name}",
		"description": description,
		"priority": _priority_from_severity(severity),
		"resources": _extract_resources_from_report(report_data),
		"instructions": "Coordinate volunteer response and collect updated field intel.",
		"estimatedDurationMinutes": 60,
	}


def _build_gemini_payload(report_data: dict[str, Any], zone_data: dict[str, Any]) -> dict[str, Any]:
	fallback = _build_fallback_payload(report_data, zone_data)

	safe_zone = _serialize_firestore_value(zone_data)
	safe_report = _serialize_firestore_value(report_data)

	prompt = (
		"You are creating a volunteer mission from a field report. "
		"Return ONLY valid JSON with keys: "
		"title, description, priority (low|medium|high|critical), "
		"resources (list of {name, quantity}), instructions, estimatedDurationMinutes. "
		"Use the report and zone details below.\n\n"
		f"Zone: {json.dumps(safe_zone, ensure_ascii=True)}\n"
		f"Report: {json.dumps(safe_report, ensure_ascii=True)}\n"
	)

	try:
		response = client.models.generate_content(
			model=GEMINI_FLASH,
			contents=[{"role": "user", "parts": [{"text": prompt}]}],
		)
		raw = _strip_json_fences(getattr(response, "text", "") or "")
		if not raw:
			return fallback

		parsed = json.loads(raw)
		if not isinstance(parsed, dict):
			return fallback

		title = str(parsed.get("title") or fallback["title"]).strip()
		description = str(parsed.get("description") or fallback["description"]).strip()
		priority = str(parsed.get("priority") or fallback["priority"]).strip().lower()
		if priority not in {"low", "medium", "high", "critical"}:
			priority = fallback["priority"]

		resources = parsed.get("resources")
		if not isinstance(resources, list):
			resources = fallback["resources"]

		instructions = str(parsed.get("instructions") or fallback["instructions"]).strip()
		estimated = parsed.get("estimatedDurationMinutes")
		if not isinstance(estimated, int):
			estimated = fallback["estimatedDurationMinutes"]

		return {
			"title": title,
			"description": description,
			"priority": priority,
			"resources": resources,
			"instructions": instructions,
			"estimatedDurationMinutes": estimated,
		}
	except Exception as exc:
		logger.warning("Gemini mission synthesis failed: %s", exc)
		return fallback


def _find_existing_mission(ngo_id: str, zone_id: str, need_type: str) -> tuple[str, dict[str, Any]] | None:
	missions_snapshot = db.collection("missions").where("ngoId", "==", ngo_id).stream()
	normalized_need = _normalize_need(need_type)
	candidates: list[tuple[str, dict[str, Any]]] = []

	for doc in missions_snapshot:
		data = doc.to_dict() or {}
		if str(data.get("zoneId") or "") != zone_id:
			continue
		if _normalize_need(str(data.get("needType") or "")) != normalized_need:
			continue
		status = str(data.get("status") or "pending").lower()
		if status not in ACTIVE_MISSION_STATUSES:
			continue
		candidates.append((doc.id, data))

	if not candidates:
		return None

	candidates.sort(
		key=lambda item: item[1].get("updatedAt") if isinstance(item[1].get("updatedAt"), datetime) else datetime.min,
		reverse=True,
	)
	return candidates[0]


def _log_mission_update(mission_ref, update_type: str, report_id: str, payload: dict[str, Any]) -> None:
	update_data = {
		"type": update_type,
		"reportId": report_id,
		"timestamp": datetime.utcnow(),
		**payload,
	}
	mission_ref.collection("updates").add(update_data)


def upsert_mission_from_report(report_id: str, report_data: dict[str, Any]) -> str | None:
	ngo_id = str(report_data.get("ngoId") or "").strip()
	zone_id = str(report_data.get("zoneId") or "").strip()
	if not ngo_id or not zone_id:
		logger.warning("Report %s missing ngoId or zoneId; cannot create mission.", report_id)
		return None

	need_type = str(report_data.get("needType") or "general")
	existing = _find_existing_mission(ngo_id, zone_id, need_type)
	now = datetime.utcnow()

	if existing:
		mission_id, mission_data = existing
		mission_ref = db.collection("missions").document(mission_id)

		existing_reports = list(mission_data.get("sourceReportIds") or [])
		should_count = report_id not in existing_reports
		merged_from = mission_data.get("mergedFrom") or {}
		updated_reports = merged_from.get("reports")
		if not isinstance(updated_reports, int):
			updated_reports = len(existing_reports)
		if should_count:
			updated_reports += 1

		resources = _merge_resources(
			list(mission_data.get("resources") or []),
			_extract_resources_from_report(report_data),
		)

		mission_ref.update(
			{
				"sourceReportIds": firestore.ArrayUnion([report_id]),
				"resources": resources,
				"mergedFrom": {"reports": updated_reports, "ngos": merged_from.get("ngos", 1)},
				"updatedAt": now,
				"newUpdates": firestore.Increment(1),
			}
		)

		_log_mission_update(
			mission_ref,
			"report_linked",
			report_id,
			{
				"needType": report_data.get("needType"),
				"severity": report_data.get("severity"),
				"familiesAffected": report_data.get("familiesAffected"),
				"addedNeeds": report_data.get("needIncidents") or [],
			},
		)

		db.collection("reports").document(report_id).update(
			{
				"missionId": mission_id,
				"mergedIntoMissionId": mission_id,
				"updatedAt": now,
			}
		)
		return mission_id

	zone_ref = db.collection("zones").document(zone_id)
	zone_snapshot = zone_ref.get()
	if not zone_snapshot.exists:
		location = report_data.get("location") if isinstance(report_data.get("location"), dict) else {}
		zone_data = {
			"name": str(location.get("address") or zone_id),
			"ward": "",
			"city": "",
			"ngoIds": [ngo_id],
			"currentScore": 0,
			"riskLevel": "low",
			"scoreHistory": [],
			"signalCounts": {"food": 0, "education": 0, "health": 0, "substance": 0, "shelter": 0, "safety": 0},
			"activeMissions": 0,
			"lastIntervention": None,
			"forecastScore": 0,
			"forecastConfidence": 50,
			"generationalCohort": "",
			"safetyProfile": {"score": 50, "level": "moderate", "interactions": [], "timeOfDayFlags": {"night": False, "early_morning": False}, "specificFlags": []},
			"geometry": None,
			"lat": float(location.get("lat", 0.0) or 0.0),
			"lng": float(location.get("lng", 0.0) or 0.0),
			"updatedAt": now,
			"createdAt": now,
		}
		zone_ref.set(zone_data)
		logger.info("Created missing zone %s from report %s", zone_id, report_id)
	else:
		zone_data = zone_snapshot.to_dict() or {}
	payload = _build_gemini_payload(report_data, zone_data)
	resource_plan = plan_resources_for_mission(
		ngo_id=ngo_id,
		zone_id=zone_id,
		need_type=need_type,
		mission_title=str(payload.get("title") or ""),
		mission_description=str(payload.get("description") or ""),
		base_resources=[item for item in (payload.get("resources") or []) if isinstance(item, dict)],
	)

	mission_ref = db.collection("missions").document()
	mission_data = {
		"ngoId": ngo_id,
		"creatorId": report_data.get("submittedBy") or "system",
		"creatorName": report_data.get("submittedByName"),
		"title": payload["title"],
		"description": payload["description"],
		"zoneId": zone_id,
		"zoneName": zone_data.get("name") or "",
		"ward": zone_data.get("ward") or "",
		"city": zone_data.get("city") or "",
		"needType": need_type,
		"targetAudience": "volunteer",
		"priority": payload["priority"],
		"status": "pending",
		"assignedTo": None,
		"assignedToName": None,
		"resources": resource_plan.get("items") or payload.get("resources") or [],
		"resourcePlan": resource_plan,
		"sourceReportIds": [report_id],
		"sourceNgoIds": [ngo_id],
		"location": {
			"lat": zone_data.get("lat", 0.0),
			"lng": zone_data.get("lng", 0.0),
			"address": zone_data.get("name") or "",
			"landmark": zone_data.get("name") or "",
		},
		"instructions": payload.get("instructions"),
		"notes": report_data.get("additionalNotes"),
		"estimatedDurationMinutes": payload.get("estimatedDurationMinutes", 60),
		"progress": 0,
		"statusText": "Awaiting volunteer assignment",
		"familiesHelped": 0,
		"outcomeNotes": None,
		"mergedFrom": {"reports": 1, "ngos": 1},
		"newUpdates": 0,
		"createdAt": now,
		"updatedAt": now,
		"dispatchedAt": None,
		"startedAt": None,
		"completedAt": None,
		"autoAssigned": False,
	}

	mission_ref.set(mission_data)
	_log_mission_update(
		mission_ref,
		"mission_created_from_report",
		report_id,
		{
			"needType": report_data.get("needType"),
			"severity": report_data.get("severity"),
			"familiesAffected": report_data.get("familiesAffected"),
			"addedNeeds": report_data.get("needIncidents") or [],
		},
	)

	db.collection("reports").document(report_id).update(
		{
			"missionId": mission_ref.id,
			"mergedIntoMissionId": mission_ref.id,
			"updatedAt": now,
		}
	)

	return mission_ref.id
