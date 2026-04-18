from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class WarehouseDocument(BaseModel):
    id: str
    ngoId: str
    zoneId: str
    name: str
    address: str = ""
    managerName: str = ""
    phone: str = ""
    lat: float = 0.0
    lng: float = 0.0
    active: bool = True
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class WarehouseCreatePayload(BaseModel):
    zoneId: str
    name: str
    address: str = ""
    managerName: str = ""
    phone: str = ""
    lat: float = 0.0
    lng: float = 0.0


class InventoryItemDocument(BaseModel):
    id: str
    ngoId: str
    warehouseId: str
    zoneId: str
    zonesServed: list[str] = Field(default_factory=list)
    name: str
    category: str = "General"
    unit: str = "units"
    availableQty: float = 0
    thresholdQty: float = 0
    metadata: dict[str, Any] = Field(default_factory=dict)
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class InventoryItemCreatePayload(BaseModel):
    warehouseId: str
    zoneId: str
    zonesServed: list[str] = Field(default_factory=list)
    name: str
    category: str = "General"
    unit: str = "units"
    availableQty: float = 0
    thresholdQty: float = 0


class InventoryItemPatchPayload(BaseModel):
    category: str | None = None
    unit: str | None = None
    availableQty: float | None = None
    thresholdQty: float | None = None


class MissionResourceRequestItem(BaseModel):
    itemId: str
    name: str
    requestedQty: float
    unit: str = "units"


class MissionResourceRequestDocument(BaseModel):
    id: str
    ngoId: str
    missionId: str
    volunteerId: str
    volunteerName: str = ""
    zoneId: str
    warehouseId: str
    items: list[MissionResourceRequestItem] = Field(default_factory=list)
    reason: str = ""
    status: str = "pending"
    decisionNote: str = ""
    createdAt: datetime | None = None
    updatedAt: datetime | None = None
    resolvedAt: datetime | None = None
    resolvedBy: str | None = None


class MissionResourceRequestCreatePayload(BaseModel):
    missionId: str
    warehouseId: str
    items: list[MissionResourceRequestItem] = Field(default_factory=list)
    reason: str


class MissionResourceRequestDecisionPayload(BaseModel):
    decision: str
    note: str = ""
