from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ReportSourceType = Literal["scan", "voice"]


class ReportLocation(BaseModel):
    lat: float
    lng: float
    address: str | None = None
    landmark: str | None = None


class FieldConfidences(BaseModel):
    needType: int = 0
    severity: int = 0
    families: int = 0


class CanonicalReportExtraction(BaseModel):
    sourceType: ReportSourceType
    needType: str
    severity: str
    familiesAffected: int
    location: ReportLocation
    landmark: str | None = None
    additionalNotes: str | None = None
    safetySignals: list[str] = Field(default_factory=list)
    confidence: int = Field(default=0, ge=0, le=100)
    fieldConfidences: FieldConfidences = Field(default_factory=FieldConfidences)
    transcript: str | None = None
    transcriptEnglish: str | None = None
    imageUrl: str | None = None
    voiceUrl: str | None = None
