from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ForecastNotificationMethods(BaseModel):
    email: bool = True
    sms: bool = True
    push: bool = False


class ForecastSettingsDocument(BaseModel):
    ngoId: str
    threshold: int = Field(default=75, ge=0, le=100)
    minConfidence: int = Field(default=65, ge=0, le=100)
    lookbackWeeks: int = Field(default=12, ge=8, le=24)
    seasonalEnabled: bool = True
    notificationMethods: ForecastNotificationMethods = Field(default_factory=ForecastNotificationMethods)
    updatedAt: str | None = None


class ForecastSettingsPatch(BaseModel):
    threshold: int | None = Field(default=None, ge=0, le=100)
    minConfidence: int | None = Field(default=None, ge=0, le=100)
    lookbackWeeks: int | None = Field(default=None, ge=8, le=24)
    seasonalEnabled: bool | None = None
    notificationMethods: ForecastNotificationMethods | None = None


class ForecastChartPoint(BaseModel):
    weekLabel: str
    weekStart: str
    score: float
    confidence: float
    isForecast: bool


class ForecastMainChart(BaseModel):
    points: list[ForecastChartPoint] = Field(default_factory=list)
    peakWeek: str = ""
    peakScore: float = 0.0
    peakConfidence: float = 0.0
    driftRatio: float = 0.0


class ForecastPerformance(BaseModel):
    accuracyScore: float = 0.0
    trendBars: list[float] = Field(default_factory=list)
    note: str = ""


class ForecastRiskRow(BaseModel):
    zoneId: str
    zone: str
    atRisk: int = 0
    need: str = "general"
    riskLevel: str = "low"


class ForecastTelemetry(BaseModel):
    qualityScore: float = 0.0
    dataFreshnessMinutes: int = 0
    lastComputeDurationMs: int = 0
    uptimePercent: float = 99.95
    modelVersion: str = ""
    calibrationVersion: str = ""


class ForecastOverview(BaseModel):
    totalZones: int = 0
    highRiskZones: int = 0
    criticalZones: int = 0
    improvingZones: int = 0


class ForecastSummaryResponse(BaseModel):
    generatedAt: str
    modelVersion: str
    windowWeeks: int
    mainChart: ForecastMainChart
    performance: ForecastPerformance
    riskAssessmentRows: list[ForecastRiskRow] = Field(default_factory=list)
    telemetry: ForecastTelemetry
    overview: ForecastOverview


class ForecastZoneCard(BaseModel):
    zoneId: str
    zone: str
    peakLabel: str
    color: str
    trend: list[float] = Field(default_factory=list)
    status: str
    badgeTone: str
    confidence: float
    predictedPeakScore: float
    riskLevel: str
    recommendedAction: str
    dominantNeed: str
    needsAtRisk: int
    dataQualityFlags: list[str] = Field(default_factory=list)


class ForecastZoneListResponse(BaseModel):
    zones: list[ForecastZoneCard] = Field(default_factory=list)
    total: int = 0


class ForecastBacktestingSeriesPoint(BaseModel):
    label: str
    accuracy: float
    mae: float


class ForecastZoneLeaderboardRow(BaseModel):
    zoneId: str
    zone: str
    mae: float
    accuracy: float
    samples: int


class ForecastBacktestingResponse(BaseModel):
    accuracyScore: float
    mae: float
    rmse: float
    directionalAccuracy: float
    within5: int
    totalEvaluated: int
    series: list[ForecastBacktestingSeriesPoint] = Field(default_factory=list)
    zoneLeaderboard: list[ForecastZoneLeaderboardRow] = Field(default_factory=list)


class ForecastSnapshotResponse(BaseModel):
    summary: ForecastSummaryResponse
    zones: list[ForecastZoneCard] = Field(default_factory=list)
    zoneDetails: dict[str, dict[str, Any]] = Field(default_factory=dict)


class ForecastRecomputeResponse(BaseModel):
    updated: bool
    runId: str
    generatedAt: str
    zonesUpdated: int
    qualityScore: float


class ForecastCalibrationResponse(BaseModel):
    updated: bool
    generatedAt: str
    calibrationVersion: str
    zoneBiasCount: int
    sampleCount: int
