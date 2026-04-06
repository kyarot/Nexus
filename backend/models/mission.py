from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator


class MissionPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class MissionStatus(str, Enum):
    pending = "pending"
    dispatched = "dispatched"
    en_route = "en_route"
    on_ground = "on_ground"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class MissionLocation(BaseModel):
    lat: float = 0.0
    lng: float = 0.0
    address: str = ""
    landmark: str | None = None


class MissionResource(BaseModel):
    name: str
    quantity: str | int | None = None
    status: str | None = None


class MissionCreateRequest(BaseModel):
    title: str
    description: str
    zoneId: str
    needType: str
    targetAudience: str = "fieldworker"
    priority: MissionPriority = MissionPriority.high
    assignedTo: str | None = None
    assignedVolunteerName: str | None = None
    resources: list[MissionResource] = Field(default_factory=list)
    sourceReportIds: list[str] = Field(default_factory=list)
    sourceNgoIds: list[str] = Field(default_factory=list)
    instructions: str | None = None
    estimatedDurationMinutes: int = 45
    allowAutoAssign: bool = True
    notes: str | None = None

    @model_validator(mode="after")
    def validate_title(self) -> "MissionCreateRequest":
        if self.targetAudience not in {"fieldworker", "volunteer"}:
            raise ValueError("targetAudience must be fieldworker or volunteer")
        if not self.title.strip():
            raise ValueError("title is required")
        if not self.description.strip():
            raise ValueError("description is required")
        if not self.zoneId.strip():
            raise ValueError("zoneId is required")
        if not self.needType.strip():
            raise ValueError("needType is required")
        return self


class MissionCandidate(BaseModel):
    id: str
    name: str
    initials: str
    matchPercent: int
    distance: str
    skills: list[str] = Field(default_factory=list)
    availability: str = "available"
    burnoutRisk: str = "low"
    successRate: float = 0.0
    reason: str = ""
    zoneFamiliarity: bool = False
    travelRadius: int = 0


class MissionDocument(BaseModel):
    id: str
    ngoId: str
    creatorId: str
    creatorName: str | None = None
    title: str
    description: str
    zoneId: str
    zoneName: str = ""
    ward: str = ""
    city: str = ""
    needType: str
    targetAudience: str = "fieldworker"
    priority: MissionPriority = MissionPriority.high
    status: MissionStatus = MissionStatus.pending
    assignedTo: str | None = None
    assignedToName: str | None = None
    assignedVolunteerMatch: int = 0
    assignedVolunteerDistance: str | None = None
    assignedVolunteerReason: str | None = None
    resources: list[MissionResource] = Field(default_factory=list)
    sourceReportIds: list[str] = Field(default_factory=list)
    sourceNgoIds: list[str] = Field(default_factory=list)
    location: MissionLocation = Field(default_factory=MissionLocation)
    instructions: str | None = None
    notes: str | None = None
    estimatedDurationMinutes: int = 45
    progress: int = 0
    statusText: str | None = None
    familiesHelped: int = 0
    outcomeNotes: str | None = None
    mergedFrom: dict[str, Any] | None = None
    newUpdates: int = 0
    createdAt: datetime | None = None
    updatedAt: datetime | None = None
    dispatchedAt: datetime | None = None
    startedAt: datetime | None = None
    completedAt: datetime | None = None
    autoAssigned: bool = False


class MissionListResponse(BaseModel):
    missions: list[MissionDocument] = Field(default_factory=list)
    total: int = 0
    active: int = 0
    pending: int = 0
    completed: int = 0


class MissionCreateResponse(BaseModel):
    mission: MissionDocument
    matchedCandidate: MissionCandidate | None = None
