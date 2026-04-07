from __future__ import annotations

from typing import Any
from typing import Literal

from pydantic import BaseModel, Field


ReportSourceType = Literal["scan", "voice"]
VerificationState = Literal["unverified", "verified", "rejected"]
VisitType = Literal["first_visit", "follow_up", "revisit"]
ResponderType = Literal["volunteer", "ngo_staff", "mixed"]


class ReportLocation(BaseModel):
    lat: float
    lng: float
    address: str | None = None
    landmark: str | None = None


class FieldConfidences(BaseModel):
    needType: int = 0
    severity: int = 0
    families: int = 0
    persons: int = 0
    location: int = 0


class RequiredResource(BaseModel):
    name: str
    quantity: int = 0
    priority: Literal["low", "medium", "high", "critical"] = "medium"


class NeedIncident(BaseModel):
    needType: str
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    urgencyWindowHours: int = 24
    familiesAffected: int = 0
    personsAffected: int = 0
    vulnerableGroups: list[str] = Field(default_factory=list)
    requiredResources: list[RequiredResource] = Field(default_factory=list)
    riskFlags: list[str] = Field(default_factory=list)


class AssignmentRequirementProfile(BaseModel):
    preferredResponderType: ResponderType = "volunteer"
    requiredSkills: list[str] = Field(default_factory=list)
    languageNeeds: list[str] = Field(default_factory=list)
    safeVisitTimeWindows: list[str] = Field(default_factory=list)
    estimatedEffortMinutes: int = 60
    revisitRecommendedAt: str | None = None


class CanonicalReportExtraction(BaseModel):
    sourceType: ReportSourceType
    needType: str
    severity: str
    familiesAffected: int
    personsAffected: int = 0
    location: ReportLocation
    householdRef: str | None = None
    visitType: VisitType = "first_visit"
    verificationState: VerificationState = "unverified"
    needIncidents: list[NeedIncident] = Field(default_factory=list)
    assignmentRequirementProfile: AssignmentRequirementProfile = Field(default_factory=AssignmentRequirementProfile)
    landmark: str | None = None
    additionalNotes: str | None = None
    safetySignals: list[str] = Field(default_factory=list)
    confidence: int = Field(default=0, ge=0, le=100)
    fieldConfidences: FieldConfidences = Field(default_factory=FieldConfidences)
    transcript: str | None = None
    transcriptEnglish: str | None = None
    imageUrl: str | None = None
    voiceUrl: str | None = None


class ReportCreatePayload(BaseModel):
    missionId: str | None = None
    zoneId: str
    needType: str
    severity: str
    familiesAffected: int
    personsAffected: int | None = None
    location: ReportLocation
    inputType: str
    sourceType: ReportSourceType = "scan"
    householdRef: str | None = None
    visitType: VisitType = "first_visit"
    verificationState: VerificationState = "unverified"
    needIncidents: list[NeedIncident] = Field(default_factory=list)
    preferredResponderType: ResponderType = "volunteer"
    requiredSkills: list[str] = Field(default_factory=list)
    languageNeeds: list[str] = Field(default_factory=list)
    safeVisitTimeWindows: list[str] = Field(default_factory=list)
    estimatedEffortMinutes: int = 60
    revisitRecommendedAt: str | None = None
    imageUrl: str | None = None
    voiceUrl: str | None = None
    transcript: str | None = None
    ocrRaw: dict[str, Any] | None = None
    extractedData: dict[str, Any] = Field(default_factory=dict)
    confidence: int = Field(default=0, ge=0, le=100)
    safetySignals: list[str] = Field(default_factory=list)


class ReportSubmitResult(BaseModel):
    reportId: str
    merged: bool
    missionId: str | None = None
    triggeredSynthesis: bool


class OfflineSyncRequest(BaseModel):
    reports: list[ReportCreatePayload] = Field(default_factory=list)
