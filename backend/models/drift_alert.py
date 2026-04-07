from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class DriftAlertSeverity(str, Enum):
    watch = "watch"
    high = "high"
    critical = "critical"


class DriftAlertStatus(str, Enum):
    active = "active"
    actioned = "actioned"
    resolved = "resolved"
    dismissed = "dismissed"
    expired = "expired"


class DriftAlertRuleType(str, Enum):
    rapid_score_rise = "rapid_score_rise"
    threshold_crossing = "threshold_crossing"
    pattern_match = "pattern_match"
    silence_high_score = "silence_high_score"


class DriftAlertSignal(BaseModel):
    label: str
    variant: str = "info"


class DriftAlertSourceReport(BaseModel):
    id: str
    needType: str | None = None
    severity: str | None = None
    familiesAffected: int | None = None
    personsAffected: int | None = None
    additionalNotes: str | None = None
    createdAt: str | None = None


class DriftAlertDocument(BaseModel):
    id: str
    ngoId: str
    zoneId: str
    zoneName: str
    ruleType: DriftAlertRuleType
    severity: DriftAlertSeverity
    status: DriftAlertStatus = DriftAlertStatus.active
    title: str
    summary: str
    predictionText: str | None = None
    recommendedAction: str | None = None
    etaToCriticalDays: float | None = None
    needType: str = "general"
    signals: list[DriftAlertSignal] = Field(default_factory=list)
    sourceReportIds: list[str] = Field(default_factory=list)
    sourceReports: list[DriftAlertSourceReport] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    linkedMissionId: str | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None
    triggeredAt: datetime | None = None
    actionedAt: datetime | None = None
    resolvedAt: datetime | None = None
    dismissedAt: datetime | None = None
    dismissedReason: str | None = None
    expiredAt: datetime | None = None


class DriftAlertListResponse(BaseModel):
    alerts: list[dict[str, Any]] = Field(default_factory=list)
    total: int = 0
    counts: dict[str, int] = Field(default_factory=dict)
