from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ZoneRiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class SafetyLevel(str, Enum):
    safe = "safe"
    moderate = "moderate"
    caution = "caution"


class SignalCounts(BaseModel):
    food: int = 0
    education: int = 0
    health: int = 0
    substance: int = 0
    shelter: int = 0
    safety: int = 0


class SafetyInteraction(BaseModel):
    timestamp: str
    type: str  # e.g., "patrol", "community_meeting", "intervention"
    notes: str = ""
    sentiment: str = "neutral"  # "positive", "neutral", "negative"


class SafetyProfile(BaseModel):
    score: int = Field(default=50, ge=0, le=100)
    level: SafetyLevel = SafetyLevel.moderate
    interactions: list[SafetyInteraction] = Field(default_factory=list)
    timeOfDayFlags: dict[str, bool] = Field(
        default_factory=lambda: {"night": False, "early_morning": False}
    )
    specificFlags: list[str] = Field(default_factory=list)


class ZoneDocument(BaseModel):
    id: str
    name: str
    ward: str = ""
    city: str = ""
    ngoIds: list[str] = Field(default_factory=list)
    currentScore: float = Field(default=0, ge=0, le=100)
    riskLevel: ZoneRiskLevel = ZoneRiskLevel.low
    scoreHistory: list[dict[str, Any]] = Field(default_factory=list)
    signalCounts: SignalCounts = Field(default_factory=SignalCounts)
    topNeeds: list[str] = Field(default_factory=list)
    trendDirection: str = "stable"
    terrainConfidence: float = Field(default=0, ge=0, le=100)
    reportVolume7d: int = 0
    activeMissions: int = 0
    lastIntervention: Optional[str] = None
    forecastScore: float = Field(default=0, ge=0, le=100)
    forecastConfidence: float = Field(default=0, ge=0, le=100)
    generationalCohort: str = ""
    safetyProfile: SafetyProfile = Field(default_factory=SafetyProfile)
    geometry: Optional[dict[str, Any]] = None  # GeoJSON geometry
    lat: float = 0.0
    lng: float = 0.0
    updatedAt: str = ""

    class Config:
        populate_by_name = True


class ZoneCreateRequest(BaseModel):
    name: str
    ward: str = ""
    city: str = ""
    lat: float = 0.0
    lng: float = 0.0
    currentScore: float = 0.0
    riskLevel: ZoneRiskLevel = ZoneRiskLevel.low
    generationalCohort: str = ""
    geometry: Optional[dict[str, Any]] = None


class HeatmapPoint(BaseModel):
    lat: float
    lng: float
    weight: float = Field(ge=0, le=1)
    zoneId: str
    name: str
    riskLevel: ZoneRiskLevel


class DashboardMetrics(BaseModel):
    avgZoneScore: float
    zonesAtRisk: int
    activeMissions: int
    availableVolunteers: int
    recentInsights: list[dict[str, Any]] = Field(default_factory=list)
    zoneCount: int
    criticalZones: list[dict[str, Any]] = Field(default_factory=list)


class ZoneHistoryEntry(BaseModel):
    week: int
    score: float
    actual: Optional[float] = None


class ZoneHistoryResponse(BaseModel):
    zoneId: str
    history: list[ZoneHistoryEntry]


class Report(BaseModel):
    id: str
    zoneId: str
    needType: str
    severity: str
    familiesAffected: int
    createdAt: str
    sourceType: Optional[str] = None


class ZoneDetailResponse(BaseModel):
    zone: ZoneDocument
    recentReports: list[Report] = Field(default_factory=list)
