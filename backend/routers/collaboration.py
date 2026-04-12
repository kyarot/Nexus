from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from google.cloud.firestore_v1.base_query import FieldFilter
from pydantic import BaseModel, Field

from core.dependencies import role_required
from core.firebase import db
from services.notifications_hub import notify_ngo_coordinators

PREFIX = "/coordinator"
TAGS = ["coordinator"]
router = APIRouter()


class CollaborationRequestCreate(BaseModel):
    targetNgoId: str = Field(min_length=1)
    message: str | None = None


class CollaborationDecisionRequest(BaseModel):
    decision: Literal["accepted", "rejected"]
    note: str | None = None


def _now() -> datetime:
    return datetime.utcnow()


def _get_user_id(user: dict[str, Any]) -> str:
    uid = str(user.get("id") or user.get("uid") or "").strip()
    if not uid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user context")
    return uid


def _get_coordinator_ngo_id(user: dict[str, Any]) -> str:
    ngo_id = str(user.get("ngoId") or user.get("ngo_id") or "").strip()
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have an associated NGO")
    return ngo_id


def _get_ngo(ngo_id: str) -> dict[str, Any]:
    snapshot = db.collection("ngos").document(ngo_id).get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NGO not found")
    data = snapshot.to_dict() or {}
    data["id"] = ngo_id
    return data


def _serialize_request(doc_id: str, data: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "id": doc_id,
        "fromNgoId": str(data.get("fromNgoId") or ""),
        "toNgoId": str(data.get("toNgoId") or ""),
        "fromNgoName": str(data.get("fromNgoName") or ""),
        "toNgoName": str(data.get("toNgoName") or ""),
        "status": str(data.get("status") or "pending"),
        "message": str(data.get("message") or ""),
        "createdBy": str(data.get("createdBy") or ""),
        "decisionNote": str(data.get("decisionNote") or ""),
    }
    for key in ["createdAt", "updatedAt", "decidedAt"]:
        value = data.get(key)
        payload[key] = value.isoformat() if isinstance(value, datetime) else None
    return payload


def _sort_timestamp(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if hasattr(value, "to_datetime"):
        try:
            parsed = value.to_datetime()
            if isinstance(parsed, datetime):
                return parsed
        except Exception:
            return datetime.min
    return datetime.min


def _append_partner(ngo_id: str, partner_ngo_id: str) -> None:
    snapshot = db.collection("ngos").document(ngo_id).get()
    if not snapshot.exists:
        return
    data = snapshot.to_dict() or {}
    current = [str(item) for item in (data.get("partnerNgoIds") or []) if str(item).strip()]
    if partner_ngo_id in current:
        return
    current.append(partner_ngo_id)
    db.collection("ngos").document(ngo_id).update({"partnerNgoIds": current})


@router.get("/collaboration/discoverable-ngos")
async def list_discoverable_ngos(
    user: dict[str, Any] = Depends(role_required("coordinator")),
    search: str | None = Query(default=None),
) -> dict[str, Any]:
    my_ngo_id = _get_coordinator_ngo_id(user)
    my_ngo = _get_ngo(my_ngo_id)
    partner_ids = {str(item) for item in (my_ngo.get("partnerNgoIds") or []) if str(item).strip()}

    rows = db.collection("ngos").where(filter=FieldFilter("publicDiscoverable", "==", True)).stream()
    items: list[dict[str, Any]] = []
    query = (search or "").strip().lower()
    for doc in rows:
        data = doc.to_dict() or {}
        ngo_id = doc.id
        if ngo_id == my_ngo_id:
            continue
        name = str(data.get("name") or "")
        city = str(data.get("city") or "")
        if query and query not in name.lower() and query not in city.lower():
            continue
        items.append(
            {
                "id": ngo_id,
                "name": name,
                "city": city,
                "description": data.get("description"),
                "website": data.get("website"),
                "primaryEmail": data.get("primaryEmail"),
                "logoUrl": data.get("logoUrl"),
                "needCategories": list(data.get("needCategories") or []),
                "isPartner": ngo_id in partner_ids,
            }
        )

    items.sort(key=lambda item: item["name"].lower())
    return {"ngos": items, "total": len(items)}


@router.get("/collaboration/partners")
async def list_collaboration_partners(
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    my_ngo_id = _get_coordinator_ngo_id(user)
    my_ngo = _get_ngo(my_ngo_id)
    partner_ids = [str(item) for item in (my_ngo.get("partnerNgoIds") or []) if str(item).strip()]

    partners: list[dict[str, Any]] = []
    for partner_id in partner_ids:
        snapshot = db.collection("ngos").document(partner_id).get()
        if not snapshot.exists:
            continue
        data = snapshot.to_dict() or {}
        partners.append(
            {
                "id": partner_id,
                "name": str(data.get("name") or "Partner NGO"),
                "city": str(data.get("city") or ""),
                "description": data.get("description"),
                "website": data.get("website"),
                "primaryEmail": data.get("primaryEmail"),
                "logoUrl": data.get("logoUrl"),
                "needCategories": list(data.get("needCategories") or []),
                "publicDiscoverable": bool(data.get("publicDiscoverable") or False),
            }
        )

    return {"partners": partners, "total": len(partners)}


@router.get("/collaboration/requests")
async def list_collaboration_requests(
    user: dict[str, Any] = Depends(role_required("coordinator")),
    direction: Literal["incoming", "outgoing", "all"] = Query(default="all"),
    status_filter: Literal["pending", "accepted", "rejected", "all"] = Query(default="all", alias="status"),
) -> dict[str, Any]:
    my_ngo_id = _get_coordinator_ngo_id(user)

    incoming = list(db.collection("collaboration_requests").where(filter=FieldFilter("toNgoId", "==", my_ngo_id)).stream())
    outgoing = list(db.collection("collaboration_requests").where(filter=FieldFilter("fromNgoId", "==", my_ngo_id)).stream())

    docs: list[Any] = []
    if direction in {"incoming", "all"}:
        docs.extend(incoming)
    if direction in {"outgoing", "all"}:
        docs.extend(outgoing)

    unique_by_id = {doc.id: doc for doc in docs}
    items: list[tuple[str, dict[str, Any]]] = []
    for doc_id, doc in unique_by_id.items():
        data = doc.to_dict() or {}
        if status_filter != "all" and str(data.get("status") or "pending") != status_filter:
            continue
        items.append((doc_id, data))

    items.sort(key=lambda item: _sort_timestamp(item[1].get("createdAt")), reverse=True)
    return {
        "requests": [_serialize_request(doc_id, data) for doc_id, data in items],
        "total": len(items),
    }


@router.post("/collaboration/requests", status_code=status.HTTP_201_CREATED)
async def create_collaboration_request(
    payload: CollaborationRequestCreate,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    from_ngo_id = _get_coordinator_ngo_id(user)
    created_by = _get_user_id(user)
    to_ngo_id = payload.targetNgoId.strip()

    if to_ngo_id == from_ngo_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot request collaboration with your own NGO")

    from_ngo = _get_ngo(from_ngo_id)
    to_ngo = _get_ngo(to_ngo_id)

    if to_ngo_id in {str(item) for item in (from_ngo.get("partnerNgoIds") or [])}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="NGOs are already collaborating")

    # Avoid duplicate pending requests in either direction.
    outgoing_rows = list(
        db.collection("collaboration_requests")
        .where(filter=FieldFilter("fromNgoId", "==", from_ngo_id))
        .stream()
    )
    incoming_rows = list(
        db.collection("collaboration_requests")
        .where(filter=FieldFilter("fromNgoId", "==", to_ngo_id))
        .stream()
    )
    has_pending_to = any(
        str((doc.to_dict() or {}).get("toNgoId") or "") == to_ngo_id
        and str((doc.to_dict() or {}).get("status") or "pending") == "pending"
        for doc in outgoing_rows
    )
    has_pending_from = any(
        str((doc.to_dict() or {}).get("toNgoId") or "") == from_ngo_id
        and str((doc.to_dict() or {}).get("status") or "pending") == "pending"
        for doc in incoming_rows
    )
    if has_pending_to or has_pending_from:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A pending collaboration request already exists")

    now = _now()
    doc_id = uuid4().hex
    data = {
        "fromNgoId": from_ngo_id,
        "toNgoId": to_ngo_id,
        "fromNgoName": str(from_ngo.get("name") or ""),
        "toNgoName": str(to_ngo.get("name") or ""),
        "status": "pending",
        "message": (payload.message or "").strip(),
        "createdBy": created_by,
        "createdAt": now,
        "updatedAt": now,
    }

    db.collection("collaboration_requests").document(doc_id).set(data)

    notify_ngo_coordinators(
        to_ngo_id,
        type="collaboration_request",
        title="New collaboration request",
        message=f"{data['fromNgoName']} requested collaboration.",
        request_id=doc_id,
        metadata={
            "fromNgoId": from_ngo_id,
            "fromNgoName": data["fromNgoName"],
        },
        timestamp=now,
    )

    return {"created": True, "request": _serialize_request(doc_id, data)}


@router.post("/collaboration/requests/{request_id}/decision")
async def decide_collaboration_request(
    request_id: str,
    payload: CollaborationDecisionRequest,
    user: dict[str, Any] = Depends(role_required("coordinator")),
) -> dict[str, Any]:
    my_ngo_id = _get_coordinator_ngo_id(user)
    decided_by = _get_user_id(user)

    ref = db.collection("collaboration_requests").document(request_id)
    snapshot = ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    data = snapshot.to_dict() or {}
    if str(data.get("toNgoId") or "") != my_ngo_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only target NGO can decide this request")

    if str(data.get("status") or "pending") != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request already decided")

    now = _now()
    update_payload: dict[str, Any] = {
        "status": payload.decision,
        "decisionNote": (payload.note or "").strip(),
        "decidedBy": decided_by,
        "decidedAt": now,
        "updatedAt": now,
    }
    ref.update(update_payload)

    from_ngo_id = str(data.get("fromNgoId") or "")
    if payload.decision == "accepted":
        _append_partner(my_ngo_id, from_ngo_id)
        _append_partner(from_ngo_id, my_ngo_id)

    requester_ngo_name = str((db.collection("ngos").document(my_ngo_id).get().to_dict() or {}).get("name") or "Partner NGO")
    notify_ngo_coordinators(
        from_ngo_id,
        type=f"collaboration_{payload.decision}",
        title=f"Collaboration request {payload.decision}",
        message=f"{requester_ngo_name} {payload.decision} your collaboration request.",
        request_id=request_id,
        metadata={
            "toNgoId": my_ngo_id,
            "decision": payload.decision,
        },
        timestamp=now,
    )

    merged = {**data, **update_payload}
    return {"updated": True, "request": _serialize_request(request_id, merged)}
