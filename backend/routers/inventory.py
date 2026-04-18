from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.dependencies import role_required
from core.firebase import db
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


def _now() -> datetime:
    return datetime.utcnow()


def _coordinator_ngo_id(user: dict[str, Any]) -> str:
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have an associated NGO")
    return ngo_id


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
