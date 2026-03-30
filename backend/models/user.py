from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field
from pydantic import model_validator


class UserRole(str, Enum):
    coordinator = "coordinator"
    fieldworker = "fieldworker"
    volunteer = "volunteer"


class BaseSignup(BaseModel):
    name: str
    email: str
    password: str
    role: UserRole
    primary_language: str = "English"


class CoordinatorSignup(BaseSignup):
    role: Literal[UserRole.coordinator] = UserRole.coordinator
    ngo_id: str | None = None
    create_new_ngo: bool = False
    ngo_name: str | None = None
    city: str | None = None
    zones: list[str] = Field(default_factory=list)
    need_categories: list[str] = Field(default_factory=list)
    data_channels: list[str] = Field(default_factory=list)
    phone: str | None = None


class FieldWorkerSignup(BaseSignup):
    role: Literal[UserRole.fieldworker] = UserRole.fieldworker
    ngo_id: str
    zones: list[str] = Field(default_factory=list)
    additional_languages: list[str] = Field(default_factory=list)
    offline_zones: list[str] = Field(default_factory=list)
    phone: str


class VolunteerSignup(BaseSignup):
    role: Literal[UserRole.volunteer] = UserRole.volunteer
    ngo_id: str
    zones: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    travel_radius: int = 5
    emotional_capacity: Literal["light", "moderate", "intensive"] = "moderate"
    avoid_categories: list[str] = Field(default_factory=list)
    additional_languages: list[str] = Field(default_factory=list)
    phone: str


SignupRequest = CoordinatorSignup | FieldWorkerSignup | VolunteerSignup


class DNAProfile(BaseModel):
    empathy: float = 50.0
    resilience: float = 50.0
    adaptability: float = 50.0
    communication: float = 50.0
    leadership: float = 50.0
    analyticalThinking: float = 50.0
    collaboration: float = 50.0
    stamina: float = 50.0

    @model_validator(mode="after")
    def validate_range(self) -> "DNAProfile":
        for field_name in self.model_fields:
            value = float(getattr(self, field_name))
            if value < 0 or value > 100:
                raise ValueError(f"{field_name} must be between 0 and 100")
        return self


class UserDocument(BaseModel):
    id: str
    name: str
    email: str
    phone: str | None = None
    role: UserRole
    ngoId: str
    zones: list[str] = Field(default_factory=list)
    language: str = "English"
    profilePhoto: str | None = None
    availability: str = "available"
    travelRadius: int = 10
    skills: list[str] = Field(default_factory=list)
    emotionalCapacity: float = Field(75.0, ge=0, le=100)
    avoidCategories: list[str] = Field(default_factory=list)
    impactPoints: int = 0
    missionsCompleted: int = 0
    successRate: float = 0.0
    totalHours: float = 0.0
    burnoutRisk: str = "low"
    burnoutScore: float = Field(0.0, ge=0, le=100)
    dnaProfile: DNAProfile = Field(default_factory=lambda: DNAProfile())
    badges: list[str] = Field(default_factory=list)
    level: int = 1
    xp: int = 0
    primaryLanguage: str = "English"
    offlineZones: list[str] = Field(default_factory=list)
    createdAt: datetime | None = None
    updatedAt: datetime | None = None
    lastActive: datetime | None = None


class NGODocument(BaseModel):
    id: str
    name: str
    city: str
    zones: list[str] = Field(default_factory=list)
    needCategories: list[str] = Field(default_factory=list)
    dataChannels: list[str] = Field(default_factory=list)
    trustScore: float = 0.0
    trustTier: str = "bronze"
    partnerNgoIds: list[str] = Field(default_factory=list)
    collaborationSuggestions: list[str] = Field(default_factory=list)
