from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Any

from core.firebase import db
from core.gemini import GEMINI_FLASH, client

logger = logging.getLogger("nexus.mission_intelligence")


def _safe_lower(value: Any) -> str:
    return str(value or "").strip().lower()


def _mission_need_label(mission: dict[str, Any]) -> str:
    return str(mission.get("needType") or "community support").strip() or "community support"


def _mission_zone_label(mission: dict[str, Any], zone: dict[str, Any]) -> str:
    return str(mission.get("zoneName") or zone.get("name") or "Assigned zone").strip() or "Assigned zone"


def _default_trigger_summary(mission: dict[str, Any]) -> str:
    description = str(mission.get("description") or "").strip()
    if description:
        return description[:180]
    need = _mission_need_label(mission)
    return f"Recent reports indicate urgent {need.lower()} need in this area."


def _build_dynamic_decision_tree(mission: dict[str, Any], zone: dict[str, Any], language: str) -> list[dict[str, str]]:
    need = _mission_need_label(mission)
    zone_label = _mission_zone_label(mission, zone)
    language_label = str(language or "English")
    return [
        {
            "id": "01",
            "if": f"Family asks what support is available right now for {need.lower()}.",
            "response": f"Start with immediate options in {zone_label}, explain what can be delivered today, and confirm consent before action.",
        },
        {
            "id": "02",
            "if": "Household is anxious or distrustful.",
            "response": "Acknowledge their concern, share one clear next step, and avoid promises you cannot guarantee.",
        },
        {
            "id": "03",
            "if": f"Conversation needs language support ({language_label}).",
            "response": f"Switch to {language_label} if possible, keep sentences short, and repeat key safety and follow-up information.",
        },
    ]


def ensure_dynamic_empathy_brief(
    payload: dict[str, Any],
    mission: dict[str, Any],
    volunteer: dict[str, Any],
    zone: dict[str, Any] | None = None,
) -> dict[str, Any]:
    zone = zone or {}
    merged = dict(payload or {})

    mission_context = merged.get("missionContext") if isinstance(merged.get("missionContext"), dict) else {}
    language = str(volunteer.get("primaryLanguage") or mission.get("language") or mission_context.get("language") or "English")
    trigger_summary = str(mission_context.get("triggerSummary") or "").strip() or _default_trigger_summary(mission)

    mission_context = {
        **mission_context,
        "zone": _mission_zone_label(mission, zone),
        "status": str(mission.get("status") or mission_context.get("status") or "dispatched"),
        "language": language,
        "triggerSummary": trigger_summary,
    }
    merged["missionContext"] = mission_context

    need_label = _mission_need_label(mission)
    zone_label = _mission_zone_label(mission, zone)

    say_first = str(merged.get("sayFirst") or "").strip()
    if not say_first or "listen first and support safely" in _safe_lower(say_first):
        merged["sayFirst"] = f"I am here to support your {need_label.lower()} needs in {zone_label}. Let us take this one step at a time."

    say_tags = merged.get("sayTags") if isinstance(merged.get("sayTags"), list) else []
    if not say_tags:
        merged["sayTags"] = ["Calm", "Practical", need_label.title()]

    avoid = merged.get("avoid") if isinstance(merged.get("avoid"), list) else []
    normalized_avoid: list[dict[str, str]] = []
    for item in avoid[:4]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip() or "Overpromising outcomes"
        note = str(item.get("note") or "").strip() or "Set realistic next steps and confirm what can be done now."
        normalized_avoid.append({"title": title, "note": note})
    if not normalized_avoid:
        normalized_avoid = [
            {"title": "Overpromising outcomes", "note": "Set realistic next steps and confirm what can be done now."},
            {"title": "Technical jargon", "note": "Use plain language and verify understanding."},
        ]
    merged["avoid"] = normalized_avoid

    decision_tree = merged.get("decisionTree") if isinstance(merged.get("decisionTree"), list) else []
    generic_if = "community response changes"
    generic_resp = "acknowledge concern and provide the next practical support step."
    is_generic_tree = (
        not decision_tree
        or all(
            isinstance(node, dict)
            and _safe_lower(node.get("if")) == generic_if
            and _safe_lower(node.get("response")) == generic_resp
            for node in decision_tree[:3]
        )
    )
    if is_generic_tree:
        merged["decisionTree"] = _build_dynamic_decision_tree(mission, zone, language)
    else:
        cleaned_tree: list[dict[str, str]] = []
        for idx, node in enumerate(decision_tree[:6], start=1):
            if not isinstance(node, dict):
                continue
            cleaned_tree.append(
                {
                    "id": str(node.get("id") or str(idx).zfill(2)),
                    "if": str(node.get("if") or f"Situation update {idx}"),
                    "response": str(node.get("response") or "Acknowledge concern and proceed with a practical, safe next step."),
                }
            )
        merged["decisionTree"] = cleaned_tree or _build_dynamic_decision_tree(mission, zone, language)

    zone_safety = merged.get("zoneSafety") if isinstance(merged.get("zoneSafety"), dict) else {}
    timeline = zone_safety.get("timeline") if isinstance(zone_safety.get("timeline"), list) else []
    if not timeline:
        timeline = [
            {"date": "Today", "note": f"Monitor {need_label.lower()} response in {zone_label}", "status": "warning"},
            {"date": "Yesterday", "note": "Last support cycle completed with coordinator confirmation", "status": "success"},
        ]
    zone_safety["timeline"] = timeline[:4]
    merged["zoneSafety"] = zone_safety

    return merged


def _strip_json_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()
    return cleaned


def _serialize_for_json(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if hasattr(value, "to_datetime"):
        try:
            parsed = value.to_datetime()
            if isinstance(parsed, datetime):
                return parsed.isoformat()
        except Exception:
            pass
    if isinstance(value, dict):
        return {str(key): _serialize_for_json(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize_for_json(item) for item in value]
    return value


def _safe_json(value: Any) -> str:
    return json.dumps(_serialize_for_json(value), ensure_ascii=True)


def _resource_fallback(base_resources: list[dict[str, Any]], inventory_rows: list[dict[str, Any]]) -> dict[str, Any]:
    normalized_items: list[dict[str, Any]] = []
    for row in inventory_rows[:8]:
        try:
            qty = float(row.get("availableQty") or 0)
        except (TypeError, ValueError):
            qty = 0
        if qty <= 0:
            continue
        normalized_items.append(
            {
                "itemId": str(row.get("id") or ""),
                "name": str(row.get("name") or "resource"),
                "quantity": min(max(1, int(qty // 3 or 1)), int(max(1, qty))),
                "unit": str(row.get("unit") or "units"),
                "warehouseId": str(row.get("warehouseId") or ""),
                "warehouseName": str(row.get("warehouseName") or "Warehouse"),
                "status": "planned",
            }
        )

    if not normalized_items and base_resources:
        for item in base_resources:
            name = str(item.get("name") or "resource")
            quantity = item.get("quantity")
            try:
                quantity_val = int(float(quantity)) if quantity is not None else 1
            except (TypeError, ValueError):
                quantity_val = 1
            normalized_items.append(
                {
                    "itemId": "",
                    "name": name,
                    "quantity": max(1, quantity_val),
                    "unit": "units",
                    "warehouseId": "",
                    "warehouseName": "",
                    "status": "planned",
                }
            )

    warehouse_id = normalized_items[0].get("warehouseId") if normalized_items else ""
    warehouse_name = normalized_items[0].get("warehouseName") if normalized_items else ""

    return {
        "selectedWarehouseId": warehouse_id,
        "selectedWarehouseName": warehouse_name,
        "items": normalized_items,
        "rationale": "Generated from available stock and mission need.",
        "generatedAt": datetime.utcnow().isoformat(),
    }


def _warehouse_rows_for_zone(ngo_id: str, zone_id: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    docs = db.collection("warehouses").where("ngoId", "==", ngo_id).where("active", "==", True).stream()
    for doc in docs:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        rows.append(data)

    preferred = [row for row in rows if str(row.get("zoneId") or "") == zone_id]
    if preferred:
        return preferred + [row for row in rows if row not in preferred]
    return rows


def _inventory_rows(ngo_id: str, warehouse_ids: list[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    docs = db.collection("inventoryItems").where("ngoId", "==", ngo_id).stream()
    wanted = set(warehouse_ids)
    for doc in docs:
        data = doc.to_dict() or {}
        if wanted and str(data.get("warehouseId") or "") not in wanted:
            continue
        data["id"] = doc.id
        rows.append(data)
    return rows


def plan_resources_for_mission(
    *,
    ngo_id: str,
    zone_id: str,
    need_type: str,
    mission_title: str,
    mission_description: str,
    base_resources: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    base_resources = base_resources or []
    warehouses = _warehouse_rows_for_zone(ngo_id, zone_id)
    warehouse_ids = [str(item.get("id") or "") for item in warehouses if str(item.get("id") or "")]

    inventory = _inventory_rows(ngo_id, warehouse_ids)
    warehouse_name_by_id = {str(item.get("id") or ""): str(item.get("name") or "Warehouse") for item in warehouses}

    for item in inventory:
        item["warehouseName"] = warehouse_name_by_id.get(str(item.get("warehouseId") or ""), "Warehouse")

    fallback = _resource_fallback(base_resources, inventory)
    if not inventory:
        return fallback

    prompt = (
        "You optimize mission resources. Return ONLY valid JSON with keys: "
        "selectedWarehouseId (string), selectedWarehouseName (string), rationale (string), "
        "items (list of {itemId,name,quantity,unit,warehouseId,warehouseName,status}). "
        "Rules: use only available inventory items, quantity must be <= availableQty, choose minimum adequate kit.\n\n"
        f"NeedType: {need_type}\n"
        f"MissionTitle: {mission_title}\n"
        f"MissionDescription: {mission_description}\n"
        f"BaseResources: {_safe_json(base_resources)}\n"
        f"Warehouses: {_safe_json(warehouses)}\n"
        f"Inventory: {_safe_json(inventory)}\n"
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

        items = parsed.get("items")
        if not isinstance(items, list):
            return fallback

        available_by_id: dict[str, float] = {}
        for row in inventory:
            available_by_id[str(row.get("id") or "")] = float(row.get("availableQty") or 0)

        clean_items: list[dict[str, Any]] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            item_id = str(item.get("itemId") or "").strip()
            if not item_id or item_id not in available_by_id:
                continue
            try:
                qty = float(item.get("quantity") or 0)
            except (TypeError, ValueError):
                continue
            qty = max(0, min(qty, available_by_id[item_id]))
            if qty <= 0:
                continue
            clean_items.append(
                {
                    "itemId": item_id,
                    "name": str(item.get("name") or "resource"),
                    "quantity": int(qty) if float(qty).is_integer() else round(qty, 2),
                    "unit": str(item.get("unit") or "units"),
                    "warehouseId": str(item.get("warehouseId") or ""),
                    "warehouseName": str(item.get("warehouseName") or "Warehouse"),
                    "status": str(item.get("status") or "planned"),
                }
            )

        if not clean_items:
            return fallback

        return {
            "selectedWarehouseId": str(parsed.get("selectedWarehouseId") or clean_items[0].get("warehouseId") or ""),
            "selectedWarehouseName": str(parsed.get("selectedWarehouseName") or clean_items[0].get("warehouseName") or "Warehouse"),
            "items": clean_items,
            "rationale": str(parsed.get("rationale") or "Generated from available stock and mission need."),
            "generatedAt": datetime.utcnow().isoformat(),
        }
    except Exception as exc:
        logger.warning("Mission resource planning fallback used: %s", exc)
        return fallback


def rank_candidate_support_with_gemini(
    *,
    ngo_id: str,
    zone: dict[str, Any],
    need_type: str,
    mission_title: str,
    mission_description: str,
    candidates: list[dict[str, Any]],
) -> list[str]:
    if not candidates:
        return []

    fallback_order = [str(candidate.get("id") or "").strip() for candidate in candidates if str(candidate.get("id") or "").strip()]
    if not fallback_order:
        return []

    prompt = (
        "Rank partner NGO support candidates for worst-case mission fallback. Return ONLY valid JSON with keys: "
        "orderedCandidateIds (array of strings), rationale (string). "
        "Do not introduce candidates that are not in the provided list. Prioritize availability, skill fit, zone familiarity, "
        "burnout safety, and mission urgency. This ranking only applies when local staffing is exhausted and partner NGOs are collaborating.\n\n"
        f"HostNGOId: {ngo_id}\n"
        f"Zone: {_safe_json(zone)}\n"
        f"NeedType: {need_type}\n"
        f"MissionTitle: {mission_title}\n"
        f"MissionDescription: {mission_description}\n"
        f"Candidates: {_safe_json(candidates)}\n"
        f"FallbackOrder: {_safe_json(fallback_order)}\n"
    )

    try:
        response = client.models.generate_content(
            model=GEMINI_FLASH,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
        )
        raw = _strip_json_fences(getattr(response, "text", "") or "")
        if not raw:
            return fallback_order

        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return fallback_order

        ordered_ids = parsed.get("orderedCandidateIds")
        if not isinstance(ordered_ids, list):
            return fallback_order

        normalized = []
        seen: set[str] = set()
        allowed = set(fallback_order)
        for item in ordered_ids:
            candidate_id = str(item or "").strip()
            if candidate_id and candidate_id in allowed and candidate_id not in seen:
                normalized.append(candidate_id)
                seen.add(candidate_id)

        if not normalized:
            return fallback_order

        for candidate_id in fallback_order:
            if candidate_id not in seen:
                normalized.append(candidate_id)

        return normalized
    except Exception as exc:
        logger.warning("Partner candidate ranking fallback used: %s", exc)
        return fallback_order


def generate_empathy_brief(mission: dict[str, Any], volunteer: dict[str, Any], zone: dict[str, Any] | None = None) -> dict[str, Any]:
    zone = zone or {}
    default_payload = {
        "missionContext": {
            "zone": str(mission.get("zoneName") or zone.get("name") or "Assigned Zone"),
            "status": str(mission.get("status") or "dispatched"),
            "language": str(volunteer.get("primaryLanguage") or mission.get("language") or "English"),
            "triggerSummary": str(mission.get("description") or "Recent community distress signals detected."),
        },
        "trust": 72,
        "pulse": [35, 48, 62, 40, 70, 55, 44],
        "zoneSafety": {
            "score": int((zone.get("safetyProfile") or {}).get("score") or 64),
            "level": str((zone.get("safetyProfile") or {}).get("level") or "moderate"),
            "timeline": [
                {"date": "Today", "note": "Stay visible and coordinate through known contacts", "status": "warning"},
                {"date": "Yesterday", "note": "Aid distribution completed safely", "status": "success"},
            ],
            "visitTip": "Prefer daytime entry and keep communication channel active.",
            "specificNotes": ["Check building access before carrying supplies", "Avoid congested lane after sunset"],
        },
        "sayFirst": "I am here to listen first and support you with practical help.",
        "sayTags": ["Supportive", "Low Pressure"],
        "avoid": [
            {"title": "Dismissive statements", "note": "Do not minimize current stress."},
            {"title": "Policy jargon", "note": "Use simple and humane language."},
        ],
        "decisionTree": [
            {
                "id": "01",
                "if": "We can manage on our own.",
                "response": "I respect that. I can still help with specific items you choose.",
            },
            {
                "id": "02",
                "if": "When will this get better?",
                "response": "I cannot promise a date, but I can improve immediate safety and supplies now.",
            },
        ],
    }

    prompt = (
        "Generate a volunteer empathy briefing as JSON. Return ONLY JSON with keys: "
        "missionContext, trust, pulse, zoneSafety, sayFirst, sayTags, avoid, decisionTree. "
        "Keep concise, practical, trauma-aware, and mission specific.\n\n"
        f"Mission: {_safe_json(mission)}\n"
        f"Volunteer: {_safe_json(volunteer)}\n"
        f"Zone: {_safe_json(zone)}\n"
    )

    try:
        response = client.models.generate_content(
            model=GEMINI_FLASH,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
        )
        raw = _strip_json_fences(getattr(response, "text", "") or "")
        if not raw:
            return default_payload
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return default_payload

        payload = default_payload | parsed
        trust = payload.get("trust")
        try:
            trust_int = int(float(trust))
        except (TypeError, ValueError):
            trust_int = default_payload["trust"]
        payload["trust"] = max(0, min(100, trust_int))

        pulse = payload.get("pulse")
        if not isinstance(pulse, list) or len(pulse) < 3:
            payload["pulse"] = default_payload["pulse"]
        else:
            normalized = []
            for val in pulse[:7]:
                try:
                    normalized.append(max(10, min(100, int(float(val)))))
                except (TypeError, ValueError):
                    normalized.append(40)
            payload["pulse"] = normalized

        return ensure_dynamic_empathy_brief(payload, mission, volunteer, zone)
    except Exception as exc:
        logger.warning("Empathy brief fallback used: %s", exc)
        return ensure_dynamic_empathy_brief(default_payload, mission, volunteer, zone)
