from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Any

from core.firebase import db
from core.gemini import GEMINI_FLASH, client

logger = logging.getLogger("nexus.mission_intelligence")


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

        return payload
    except Exception as exc:
        logger.warning("Empathy brief fallback used: %s", exc)
        return default_payload
