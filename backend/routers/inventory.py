from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.dependencies import role_required
from core.firebase import db
from core.gemini import GEMINI_FLASH, client
from models.inventory import (
    InventoryItemCreatePayload,
    InventoryItemDocument,
    InventoryItemPatchPayload,
    MissionResourceRequestDecisionPayload,
    MissionResourceRequestDocument,
    WarehouseCreatePayload,
    WarehouseDocument,
)

PREFIX = "/coordinator"
TAGS = ["coordinator"]
router = APIRouter()
logger = logging.getLogger("nexus.inventory")


def _now() -> datetime:
    return datetime.utcnow()


def _coordinator_ngo_id(user: dict[str, Any]) -> str:
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have an associated NGO")
    return ngo_id


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
            return None
    if isinstance(value, dict):
        return {str(k): _serialize_for_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_serialize_for_json(v) for v in value]
    return value


def _safe_json(value: Any) -> str:
    return json.dumps(_serialize_for_json(value), ensure_ascii=True)


def _fallback_allocation_plan(
    pending_requests: list[dict[str, Any]],
    inventory_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    available_by_id = {
        str(item.get("id") or ""): float(item.get("availableQty") or 0)
        for item in inventory_rows
    }
    threshold_by_id = {
        str(item.get("id") or ""): float(item.get("thresholdQty") or 0)
        for item in inventory_rows
    }

    allocations: list[dict[str, Any]] = []
    for request in pending_requests:
        request_id = str(request.get("id") or "")
        if not request_id:
            continue

        approved_items: list[dict[str, Any]] = []
        for req_item in request.get("items") or []:
            if not isinstance(req_item, dict):
                continue
            item_id = str(req_item.get("itemId") or "").strip()
            if not item_id:
                continue
            requested_qty = float(req_item.get("requestedQty") or 0)
            if requested_qty <= 0:
                continue

            current_qty = available_by_id.get(item_id, 0.0)
            threshold_qty = threshold_by_id.get(item_id, 0.0)
            max_allocatable = max(0.0, current_qty - threshold_qty)
            alloc_qty = min(requested_qty, max_allocatable)
            if alloc_qty <= 0:
                continue

            available_by_id[item_id] = max(0.0, current_qty - alloc_qty)
            approved_items.append({"itemId": item_id, "allocatedQty": round(alloc_qty, 2)})

        if approved_items:
            allocations.append(
                {
                    "requestId": request_id,
                    "decision": "approved",
                    "note": "Auto-allocated from available stock while preserving threshold safety.",
                    "items": approved_items,
                }
            )
        else:
            allocations.append(
                {
                    "requestId": request_id,
                    "decision": "rejected",
                    "note": "Insufficient stock above threshold to auto-allocate.",
                    "items": [],
                }
            )

    return {"allocations": allocations, "strategy": "fallback"}


def _gemini_allocation_plan(
    pending_requests: list[dict[str, Any]],
    inventory_rows: list[dict[str, Any]],
    mission_map: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    fallback = _fallback_allocation_plan(pending_requests, inventory_rows)

    prompt = (
        "You are a humanitarian logistics allocator. Return ONLY valid JSON with keys: "
        "allocations (array), strategy (string). "
        "Each allocations item must include requestId (string), decision (approved|rejected), "
        "note (string), items (array of {itemId, allocatedQty}). "
        "Rules: allocate from provided inventory only, never exceed availableQty, prefer critical/high missions, "
        "preserve thresholdQty when possible, and avoid starvation across zones.\n\n"
        f"PendingRequests: {_safe_json(pending_requests)}\n"
        f"Inventory: {_safe_json(inventory_rows)}\n"
        f"MissionMap: {_safe_json(mission_map)}\n"
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
        if not isinstance(parsed, dict) or not isinstance(parsed.get("allocations"), list):
            return fallback
        return parsed
    except Exception as exc:
        logger.warning("Gemini resource auto-allocation fallback used: %s", exc)
        return fallback


@router.get("/warehouses", response_model=dict[str, Any])
async def list_warehouses(user: dict[str, Any] = Depends(role_required("coordinator"))) -> dict[str, Any]:
    ngo_id = _coordinator_ngo_id(user)
    docs = db.collection("warehouses").where("ngoId", "==", ngo_id).stream()
    warehouses: list[WarehouseDocument] = []
    for doc in docs:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        warehouses.append(WarehouseDocument.model_validate(data))
    warehouses.sort(key=lambda item: (item.zoneId, item.name.lower()))
    return {"warehouses": warehouses, "total": len(warehouses)}


@router.post("/warehouses", response_model=WarehouseDocument, status_code=status.HTTP_201_CREATED)
async def create_warehouse(
    payload: WarehouseCreatePayload,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> WarehouseDocument:
    ngo_id = _coordinator_ngo_id(user)
    now = _now()
    ref = db.collection("warehouses").document()
    data = {
        "ngoId": ngo_id,
        "zoneId": payload.zoneId.strip(),
        "name": payload.name.strip(),
        "address": payload.address.strip(),
        "managerName": payload.managerName.strip(),
        "phone": payload.phone.strip(),
        "lat": payload.lat,
        "lng": payload.lng,
        "active": True,
        "createdAt": now,
        "updatedAt": now,
    }
    ref.set(data)
    data["id"] = ref.id
    return WarehouseDocument.model_validate(data)


@router.get("/inventory/items", response_model=dict[str, Any])
async def list_inventory_items(
    user: dict[str, Any] = Depends(role_required("coordinator")),
    warehouse_id: str | None = Query(default=None, alias="warehouseId"),
) -> dict[str, Any]:
    ngo_id = _coordinator_ngo_id(user)
    docs = db.collection("inventoryItems").where("ngoId", "==", ngo_id).stream()
    items: list[InventoryItemDocument] = []
    for doc in docs:
        data = doc.to_dict() or {}
        if warehouse_id and str(data.get("warehouseId") or "") != warehouse_id:
            continue
        data["id"] = doc.id
        items.append(InventoryItemDocument.model_validate(data))
    items.sort(key=lambda item: (item.zoneId, item.name.lower()))
    return {"items": items, "total": len(items)}


@router.post("/inventory/items", response_model=InventoryItemDocument, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    payload: InventoryItemCreatePayload,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> InventoryItemDocument:
    ngo_id = _coordinator_ngo_id(user)
    warehouse = db.collection("warehouses").document(payload.warehouseId).get()
    if not warehouse.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    warehouse_data = warehouse.to_dict() or {}
    if str(warehouse_data.get("ngoId") or "") != ngo_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Warehouse does not belong to your NGO")

    now = _now()
    ref = db.collection("inventoryItems").document()
    zones_served = [zone.strip() for zone in payload.zonesServed if zone.strip()]
    data = {
        "ngoId": ngo_id,
        "warehouseId": payload.warehouseId,
        "zoneId": payload.zoneId,
        "zonesServed": zones_served,
        "name": payload.name,
        "category": payload.category,
        "unit": payload.unit,
        "availableQty": payload.availableQty,
        "thresholdQty": payload.thresholdQty,
        "metadata": {},
        "createdAt": now,
        "updatedAt": now,
    }
    ref.set(data)
    data["id"] = ref.id
    return InventoryItemDocument.model_validate(data)


@router.patch("/inventory/items/{item_id}", response_model=InventoryItemDocument)
async def patch_inventory_item(
    item_id: str,
    payload: InventoryItemPatchPayload,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> InventoryItemDocument:
    ngo_id = _coordinator_ngo_id(user)
    ref = db.collection("inventoryItems").document(item_id)
    snapshot = ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")

    data = snapshot.to_dict() or {}
    if str(data.get("ngoId") or "") != ngo_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Item does not belong to your NGO")

    update_data: dict[str, Any] = {"updatedAt": _now()}
    if payload.category is not None:
        update_data["category"] = payload.category
    if payload.unit is not None:
        update_data["unit"] = payload.unit
    if payload.availableQty is not None:
        update_data["availableQty"] = payload.availableQty
    if payload.thresholdQty is not None:
        update_data["thresholdQty"] = payload.thresholdQty

    ref.update(update_data)
    data.update(update_data)
    data["id"] = item_id
    return InventoryItemDocument.model_validate(data)


@router.get("/resource-requests", response_model=dict[str, Any])
async def list_resource_requests(
    user: dict[str, Any] = Depends(role_required("coordinator")),
    status_filter: str | None = Query(default=None, alias="status"),
) -> dict[str, Any]:
    ngo_id = _coordinator_ngo_id(user)
    docs = db.collection("missionResourceRequests").where("ngoId", "==", ngo_id).stream()
    rows: list[MissionResourceRequestDocument] = []
    for doc in docs:
        data = doc.to_dict() or {}
        if status_filter and str(data.get("status") or "") != status_filter:
            continue
        data["id"] = doc.id
        rows.append(MissionResourceRequestDocument.model_validate(data))
    rows.sort(key=lambda item: item.createdAt or datetime.min, reverse=True)
    return {"requests": rows, "total": len(rows)}


@router.post("/resource-requests/{request_id}/decision", response_model=dict[str, Any])
async def decide_resource_request(
    request_id: str,
    payload: MissionResourceRequestDecisionPayload,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    ngo_id = _coordinator_ngo_id(user)
    decision = payload.decision.strip().lower()
    if decision not in {"approved", "rejected"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Decision must be approved or rejected")

    req_ref = db.collection("missionResourceRequests").document(request_id)
    req_snap = req_ref.get()
    if not req_snap.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    req_data = req_snap.to_dict() or {}
    if str(req_data.get("ngoId") or "") != ngo_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Request does not belong to your NGO")
    if str(req_data.get("status") or "pending") != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request already resolved")

    now = _now()
    if decision == "approved":
        for item in req_data.get("items") or []:
            if not isinstance(item, dict):
                continue
            item_id = str(item.get("itemId") or "").strip()
            if not item_id:
                continue
            item_ref = db.collection("inventoryItems").document(item_id)
            item_snap = item_ref.get()
            if not item_snap.exists:
                continue
            item_data = item_snap.to_dict() or {}
            try:
                requested_qty = float(item.get("requestedQty") or 0)
                current_qty = float(item_data.get("availableQty") or 0)
            except (TypeError, ValueError):
                continue
            next_qty = max(0.0, current_qty - max(0.0, requested_qty))
            item_ref.update({"availableQty": next_qty, "updatedAt": now})

    req_ref.update(
        {
            "status": decision,
            "decisionNote": payload.note,
            "resolvedAt": now,
            "resolvedBy": str(user.get("id") or ""),
            "updatedAt": now,
        }
    )

    volunteer_id = str(req_data.get("volunteerId") or "")
    if volunteer_id:
        db.collection("notifications").add(
            {
                "userId": volunteer_id,
                "type": "resource_request_decision",
                "missionId": req_data.get("missionId"),
                "requestId": request_id,
                "title": "Resource request updated",
                "message": "Coordinator approved your request." if decision == "approved" else "Coordinator rejected your request.",
                "timestamp": now,
                "read": False,
                "metadata": {"decision": decision, "note": payload.note},
            }
        )

    return {"updated": True, "decision": decision}


@router.post("/resource-requests/auto-allocate", response_model=dict[str, Any])
async def auto_allocate_resource_requests(
    user: dict[str, Any] = Depends(role_required("coordinator")),
    limit: int = Query(default=25, ge=1, le=100),
) -> dict[str, Any]:
    ngo_id = _coordinator_ngo_id(user)
    now = _now()

    request_docs = db.collection("missionResourceRequests").where("ngoId", "==", ngo_id).where("status", "==", "pending").stream()
    pending_requests: list[dict[str, Any]] = []
    for doc in request_docs:
        row = doc.to_dict() or {}
        row["id"] = doc.id
        pending_requests.append(row)

    pending_requests.sort(
        key=lambda row: _serialize_for_json(row.get("createdAt")) or "",
        reverse=False,
    )
    pending_requests = pending_requests[:limit]

    if not pending_requests:
        return {
            "updated": True,
            "processed": 0,
            "approved": 0,
            "rejected": 0,
            "allocations": [],
            "message": "No pending resource requests found.",
        }

    inventory_docs = db.collection("inventoryItems").where("ngoId", "==", ngo_id).stream()
    inventory_rows: list[dict[str, Any]] = []
    for doc in inventory_docs:
        row = doc.to_dict() or {}
        row["id"] = doc.id
        inventory_rows.append(row)

    mission_ids = {str(req.get("missionId") or "").strip() for req in pending_requests if str(req.get("missionId") or "").strip()}
    mission_map: dict[str, dict[str, Any]] = {}
    for mission_id in mission_ids:
        mission_snap = db.collection("missions").document(mission_id).get()
        if not mission_snap.exists:
            continue
        mission_data = mission_snap.to_dict() or {}
        mission_map[mission_id] = {
            "priority": str(mission_data.get("priority") or "medium"),
            "zoneId": str(mission_data.get("zoneId") or ""),
            "needType": str(mission_data.get("needType") or "general"),
            "status": str(mission_data.get("status") or "pending"),
        }

    plan = _gemini_allocation_plan(pending_requests, inventory_rows, mission_map)
    allocations_raw = plan.get("allocations") if isinstance(plan, dict) else []
    allocations = allocations_raw if isinstance(allocations_raw, list) else []

    request_by_id = {str(req.get("id") or ""): req for req in pending_requests}
    inventory_by_id = {str(item.get("id") or ""): item for item in inventory_rows}

    approved = 0
    rejected = 0
    processed = 0
    allocation_results: list[dict[str, Any]] = []

    for allocation in allocations:
        if not isinstance(allocation, dict):
            continue
        request_id = str(allocation.get("requestId") or "").strip()
        if not request_id or request_id not in request_by_id:
            continue
        request_row = request_by_id[request_id]

        requested_items = {
            str(item.get("itemId") or "").strip(): float(item.get("requestedQty") or 0)
            for item in (request_row.get("items") or [])
            if isinstance(item, dict)
        }

        proposed_items = allocation.get("items") if isinstance(allocation.get("items"), list) else []
        applied_items: list[dict[str, Any]] = []

        for proposed in proposed_items:
            if not isinstance(proposed, dict):
                continue
            item_id = str(proposed.get("itemId") or "").strip()
            if not item_id or item_id not in requested_items or item_id not in inventory_by_id:
                continue
            requested_qty = max(0.0, requested_items[item_id])
            try:
                wanted_qty = float(proposed.get("allocatedQty") or 0)
            except (TypeError, ValueError):
                continue
            current_qty = float(inventory_by_id[item_id].get("availableQty") or 0)
            threshold_qty = float(inventory_by_id[item_id].get("thresholdQty") or 0)
            max_allocatable = max(0.0, current_qty - threshold_qty)
            final_qty = max(0.0, min(wanted_qty, requested_qty, max_allocatable))
            if final_qty <= 0:
                continue

            inventory_by_id[item_id]["availableQty"] = max(0.0, current_qty - final_qty)
            applied_items.append({"itemId": item_id, "allocatedQty": round(final_qty, 2)})

        normalized_decision = str(allocation.get("decision") or "").strip().lower()
        if not applied_items:
            normalized_decision = "rejected"
        elif normalized_decision not in {"approved", "rejected"}:
            normalized_decision = "approved"

        note = str(allocation.get("note") or "").strip()
        if not note:
            note = "Auto-allocation completed by Gemini planning."
        if normalized_decision == "approved" and len(applied_items) < len(requested_items):
            note = f"{note} Partial allocation applied based on safe stock thresholds."

        req_ref = db.collection("missionResourceRequests").document(request_id)
        req_ref.update(
            {
                "status": normalized_decision,
                "decisionNote": note,
                "resolvedAt": now,
                "resolvedBy": str(user.get("id") or ""),
                "updatedAt": now,
                "autoAllocated": True,
                "allocationItems": applied_items,
            }
        )

        if normalized_decision == "approved":
            for item in applied_items:
                item_id = item["itemId"]
                db.collection("inventoryItems").document(item_id).update(
                    {
                        "availableQty": float(inventory_by_id[item_id].get("availableQty") or 0),
                        "updatedAt": now,
                    }
                )
            approved += 1
        else:
            rejected += 1

        volunteer_id = str(request_row.get("volunteerId") or "")
        if volunteer_id:
            db.collection("notifications").add(
                {
                    "userId": volunteer_id,
                    "type": "resource_request_decision",
                    "missionId": request_row.get("missionId"),
                    "requestId": request_id,
                    "title": "Resource request auto-allocated",
                    "message": "Coordinator auto-allocation approved your request."
                    if normalized_decision == "approved"
                    else "Coordinator auto-allocation could not fulfill your request.",
                    "timestamp": now,
                    "read": False,
                    "metadata": {
                        "decision": normalized_decision,
                        "note": note,
                        "autoAllocated": True,
                        "items": applied_items,
                    },
                }
            )

        processed += 1
        allocation_results.append(
            {
                "requestId": request_id,
                "decision": normalized_decision,
                "items": applied_items,
                "note": note,
            }
        )

    return {
        "updated": True,
        "processed": processed,
        "approved": approved,
        "rejected": rejected,
        "strategy": str(plan.get("strategy") or "gemini") if isinstance(plan, dict) else "fallback",
        "allocations": allocation_results,
    }
