from __future__ import annotations

import json
import logging
import re
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from core.dependencies import get_current_user
from core.firebase import db
from core.gemini import client, GEMINI_FLASH
from core.security import create_access_token, hash_password, verify_password
from models.user import (
    CoordinatorSignup,
    DNAProfile,
    FieldWorkerSignup,
    NGODocument,
    SignupRequest,
    UserDocument,
    UserRole,
    VolunteerProfileSettings,
    VolunteerSignup,
)

PREFIX = "/auth"
TAGS = ["auth"]
router = APIRouter()
logger = logging.getLogger("nexus.auth")


class RegisterRequest(BaseModel):
    uid: str
    name: str
    email: str
    role: UserRole
    ngoId: str | None = None
    ngoName: str | None = None
    city: str | None = None
    zones: list[str] = Field(default_factory=list)
    language: str = "English"
    skills: list[str] = Field(default_factory=list)
    createNewNgo: bool = False


class SignInRequest(BaseModel):
    email: str
    password: str
    role: UserRole | None = None


class NGOCreateRequest(BaseModel):
    name: str
    city: str
    zones: list[str] = Field(default_factory=list)
    needCategories: list[str] = Field(default_factory=list)
    dataChannels: list[str] = Field(default_factory=list)


class NGOUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    city: str | None = None
    zones: list[str] | None = None
    needCategories: list[str] | None = None
    dataChannels: list[str] | None = None
    trustScore: float | None = None
    trustTier: str | None = None
    partnerNgoIds: list[str] | None = None
    collaborationSuggestions: list[str] | None = None


class UserUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    phone: str | None = None
    zones: list[str] | None = None
    language: str | None = None
    profilePhoto: str | None = None
    availability: str | None = None
    travelRadius: int | None = None
    skills: list[str] | None = None
    additionalLanguages: list[str] | None = None
    emotionalCapacity: float | None = Field(default=None, ge=0, le=100)
    avoidCategories: list[str] | None = None
    volunteerProfileSettings: VolunteerProfileSettings | None = None
    burnoutRisk: str | None = None
    burnoutScore: float | None = Field(default=None, ge=0, le=100)
    dnaProfile: DNAProfile | None = None
    badges: list[str] | None = None
    level: int | None = None
    xp: int | None = None
    primaryLanguage: str | None = None
    offlineZones: list[str] | None = None
    lastActive: str | None = None


class PreseedRequest(BaseModel):
    city: str
    zones: list[str]


USER_FORBIDDEN_FIELDS = {"id", "email", "role", "ngoId", "impactPoints"}
ROLE_COLLECTIONS = {
    UserRole.coordinator: "coordinator_profiles",
    UserRole.fieldworker: "fieldworker_profiles",
    UserRole.volunteer: "volunteer_profiles",
}
EMOTIONAL_CAPACITY_SCORE = {
    "light": 40.0,
    "moderate": 65.0,
    "intensive": 85.0,
}


def _normalize_doc_id(text: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    if not normalized:
        normalized = "ngo"
    return normalized


def _is_coordinator(user: dict[str, Any]) -> bool:
    role = str(user.get("role", "")).lower()
    return role == UserRole.coordinator.value


def _get_uid_from_user(user: dict[str, Any]) -> str:
    uid = str(user.get("id") or user.get("uid") or "").strip()
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authenticated user payload",
        )
    return uid


def _get_ngo_id_from_user(user: dict[str, Any]) -> str:
    ngo_id = str(user.get("ngoId") or "").strip()
    if not ngo_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not mapped to an NGO",
        )
    return ngo_id


def _ngo_payload(
    ngo_id: str,
    name: str,
    city: str,
    zones: list[str],
    need_categories: list[str],
    data_channels: list[str],
) -> dict[str, Any]:
    return {
        "id": ngo_id,
        "name": name,
        "city": city,
        "zones": zones,
        "needCategories": need_categories,
        "dataChannels": data_channels,
        "trustScore": 0.0,
        "trustTier": "bronze",
        "partnerNgoIds": [],
        "collaborationSuggestions": [],
    }


def _user_payload(
    uid: str,
    name: str,
    email: str,
    role: UserRole,
    ngo_id: str,
    zones: list[str],
    language: str,
    skills: list[str],
) -> dict[str, Any]:
    return {
        "id": uid,
        "name": name,
        "email": email,
        "phone": None,
        "role": role.value,
        "ngoId": ngo_id,
        "zones": zones,
        "language": language,
        "profilePhoto": None,
        "availability": "available",
        "travelRadius": 10,
        "skills": skills,
        "additionalLanguages": [],
        "emotionalCapacity": 75.0,
        "avoidCategories": [],
        "volunteerProfileSettings": {
            "skillDetails": [],
            "availabilityWindows": {
                "monFri": {"morning": False, "afternoon": False, "evening": True},
                "satSun": {"morning": True, "afternoon": True, "evening": True},
            },
            "maxMissionsPerWeek": 5,
            "travelPreferences": {
                "transportModes": ["Two Wheeler"],
            },
            "emotionalPreferences": {
                "preferredMissionIntensity": "moderate",
            },
            "notificationPreferences": {
                "pushNotifications": True,
                "emailDigest": True,
                "smsAlerts": False,
            },
            "accountMeta": {
                "connectedProvider": "google",
                "connectedEmail": email,
            },
            "profileMeta": {
                "city": None,
                "zoneLabel": None,
            },
        },
        "impactPoints": 0,
        "missionsCompleted": 0,
        "successRate": 0.0,
        "totalHours": 0.0,
        "burnoutRisk": "low",
        "burnoutScore": 0.0,
        "dnaProfile": {
            "empathy": 50.0,
            "resilience": 50.0,
            "adaptability": 50.0,
            "communication": 50.0,
            "leadership": 50.0,
            "analyticalThinking": 50.0,
            "collaboration": 50.0,
            "stamina": 50.0,
        },
        "badges": [],
        "level": 1,
        "xp": 0,
        "primaryLanguage": language,
        "offlineZones": zones,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "lastActive": firestore.SERVER_TIMESTAMP,
    }


def _get_user_document(uid: str) -> UserDocument:
    user_snapshot = db.collection("users").document(uid).get()
    if not user_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    data = user_snapshot.to_dict() or {}
    data.setdefault("id", uid)
    return UserDocument.model_validate(data)


def _get_ngo_document(ngo_id: str) -> NGODocument:
    ngo_snapshot = db.collection("ngos").document(ngo_id).get()
    if not ngo_snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NGO not found")

    data = ngo_snapshot.to_dict() or {}
    data.setdefault("id", ngo_id)
    return NGODocument.model_validate(data)


def _parse_gemini_json(raw_text: str) -> Any:
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()
    return json.loads(text)


def _route_for_role(role: UserRole) -> str:
    if role == UserRole.coordinator:
        return "/dashboard"
    if role == UserRole.fieldworker:
        return "/fieldworker"
    return "/volunteer"


@router.post("/signup")
async def signup(payload: SignupRequest) -> dict[str, Any]:
    logger.info("Signup requested for email=%s role=%s", payload.email, payload.role.value)

    existing_by_email = list(
        db.collection("users")
        .where(filter=FieldFilter("email", "==", payload.email.lower()))
        .limit(1)
        .stream()
    )
    if existing_by_email:
        logger.warning("Signup rejected: duplicate email=%s", payload.email)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    ngo_id = payload.ngo_id
    if isinstance(payload, CoordinatorSignup) and payload.create_new_ngo:
        if not payload.ngo_name or not payload.city:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ngo_name and city are required when create_new_ngo=true",
            )

        ngo_id = f"{_normalize_doc_id(payload.ngo_name)}-{uuid4().hex[:8]}"
        db.collection("ngos").document(ngo_id).set(
            _ngo_payload(
                ngo_id=ngo_id,
                name=payload.ngo_name,
                city=payload.city,
                zones=payload.zones,
                need_categories=payload.need_categories,
                data_channels=payload.data_channels,
            )
        )
        logger.info("Created NGO during signup ngoId=%s", ngo_id)

    if not ngo_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ngo_id is required unless creating a new NGO as coordinator",
        )

    ngo_snapshot = db.collection("ngos").document(ngo_id).get()
    if not ngo_snapshot.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NGO not found for provided ngo_id",
        )

    if isinstance(payload, FieldWorkerSignup) and not payload.phone.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="phone is required")

    if isinstance(payload, VolunteerSignup) and not payload.phone.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="phone is required")

    uid = uuid4().hex
    user_skills: list[str] = payload.skills if isinstance(payload, VolunteerSignup) else []
    user_emotional_capacity = (
        EMOTIONAL_CAPACITY_SCORE[payload.emotional_capacity]
        if isinstance(payload, VolunteerSignup)
        else 75.0
    )
    user_phone = payload.phone if hasattr(payload, "phone") else None
    user_offline_zones = payload.offline_zones if isinstance(payload, FieldWorkerSignup) else payload.zones
    user_travel_radius = payload.travel_radius if isinstance(payload, VolunteerSignup) else 10
    user_avoid_categories = payload.avoid_categories if isinstance(payload, VolunteerSignup) else []

    user_doc = _user_payload(
        uid=uid,
        name=payload.name,
        email=payload.email.lower(),
        role=payload.role,
        ngo_id=ngo_id,
        zones=payload.zones,
        language=payload.primary_language,
        skills=user_skills,
    )
    user_doc["phone"] = user_phone
    user_doc["travelRadius"] = user_travel_radius
    user_doc["emotionalCapacity"] = user_emotional_capacity
    user_doc["avoidCategories"] = user_avoid_categories
    user_doc["offlineZones"] = user_offline_zones
    user_doc["primaryLanguage"] = payload.primary_language
    user_doc["passwordHash"] = hash_password(payload.password)
    if isinstance(payload, (FieldWorkerSignup, VolunteerSignup)):
        user_doc["additionalLanguages"] = payload.additional_languages

    if isinstance(payload, VolunteerSignup):
        user_doc["volunteerProfileSettings"] = {
            "skillDetails": [
                {"name": skill, "level": 2}
                for skill in payload.skills
            ],
            "availabilityWindows": {
                "monFri": {"morning": False, "afternoon": False, "evening": True},
                "satSun": {"morning": True, "afternoon": True, "evening": True},
            },
            "maxMissionsPerWeek": 5,
            "travelPreferences": {
                "transportModes": ["Two Wheeler"],
            },
            "emotionalPreferences": {
                "preferredMissionIntensity": payload.emotional_capacity,
            },
            "notificationPreferences": {
                "pushNotifications": True,
                "emailDigest": True,
                "smsAlerts": False,
            },
            "accountMeta": {
                "connectedProvider": "google",
                "connectedEmail": payload.email.lower(),
            },
            "profileMeta": {
                "city": None,
                "zoneLabel": payload.zones[0] if payload.zones else None,
            },
        }

    db.collection("users").document(uid).set(user_doc)

    role_collection = ROLE_COLLECTIONS[payload.role]
    role_doc: dict[str, Any] = {
        "userId": uid,
        "role": payload.role.value,
        "ngo_id": ngo_id,
        "zones": payload.zones,
        "primary_language": payload.primary_language,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }

    if isinstance(payload, CoordinatorSignup):
        role_doc.update(
            {
                "create_new_ngo": payload.create_new_ngo,
                "ngo_name": payload.ngo_name,
                "city": payload.city,
                "need_categories": payload.need_categories,
                "data_channels": payload.data_channels,
                "phone": payload.phone,
            }
        )
    elif isinstance(payload, FieldWorkerSignup):
        role_doc.update(
            {
                "additional_languages": payload.additional_languages,
                "offline_zones": payload.offline_zones,
                "phone": payload.phone,
            }
        )
    elif isinstance(payload, VolunteerSignup):
        role_doc.update(
            {
                "skills": payload.skills,
                "travel_radius": payload.travel_radius,
                "emotional_capacity": payload.emotional_capacity,
                "avoid_categories": payload.avoid_categories,
                "additional_languages": payload.additional_languages,
                "phone": payload.phone,
            }
        )

    db.collection(role_collection).document(uid).set(role_doc)
    logger.info("Saved role profile uid=%s collection=%s", uid, role_collection)

    token = create_access_token(uid)
    created_user = _get_user_document(uid)
    logger.info("Signup successful uid=%s role=%s", uid, payload.role.value)
    return {
        "accessToken": token,
        "tokenType": "bearer",
        "redirectPath": _route_for_role(created_user.role),
        "user": created_user,
    }


@router.post("/signin")
async def signin(payload: SignInRequest) -> dict[str, Any]:
    logger.info("Signin requested for email=%s", payload.email)
    matches = list(
        db.collection("users")
        .where(filter=FieldFilter("email", "==", payload.email.lower()))
        .limit(1)
        .stream()
    )
    if not matches:
        logger.warning("Signin failed: user not found email=%s", payload.email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user_snapshot = matches[0]
    user_data = user_snapshot.to_dict() or {}
    password_hash = str(user_data.get("passwordHash") or "")
    if not password_hash or not verify_password(payload.password, password_hash):
        logger.warning("Signin failed: bad password email=%s", payload.email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Always trust the Firestore document id as canonical user id.
    user_data["id"] = user_snapshot.id
    user = UserDocument.model_validate(user_data)

    if payload.role and payload.role != user.role:
        logger.warning(
            "Signin failed: role mismatch email=%s expected=%s got=%s",
            payload.email,
            user.role.value,
            payload.role.value,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is registered as {user.role.value}",
        )

    token = create_access_token(user_snapshot.id)
    logger.info("Signin successful uid=%s role=%s", user_snapshot.id, user.role.value)
    return {
        "accessToken": token,
        "tokenType": "bearer",
        "redirectPath": _route_for_role(user.role),
        "user": user,
    }


@router.get("/verify-token")
async def verify_token(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    uid = _get_uid_from_user(current_user)
    user = _get_user_document(uid)
    logger.info("Token verified for uid=%s", uid)
    return {
        "valid": True,
        "user": user,
    }


@router.post("/register")
async def register_user(payload: RegisterRequest) -> dict[str, Any]:
    ngo_id = payload.ngoId

    if payload.role == UserRole.coordinator and payload.createNewNgo:
        if not payload.ngoName or not payload.city:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ngoName and city are required when createNewNgo=true",
            )

        ngo_id = f"{_normalize_doc_id(payload.ngoName)}-{uuid4().hex[:8]}"
        ngo_doc = _ngo_payload(
            ngo_id=ngo_id,
            name=payload.ngoName,
            city=payload.city,
            zones=payload.zones,
            need_categories=[],
            data_channels=[],
        )
        db.collection("ngos").document(ngo_id).set(ngo_doc)

    if not ngo_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ngoId is required unless creating a new NGO as coordinator",
        )

    user_doc_ref = db.collection("users").document(payload.uid)
    if user_doc_ref.get().exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already exists",
        )

    user_doc = _user_payload(
        uid=payload.uid,
        name=payload.name,
        email=payload.email,
        role=payload.role,
        ngo_id=ngo_id,
        zones=payload.zones,
        language=payload.language,
        skills=payload.skills,
    )
    user_doc_ref.set(user_doc)

    created_user = _get_user_document(payload.uid)
    return {"user": created_user, "ngoId": ngo_id}


@router.get("/me", response_model=UserDocument)
async def get_me(current_user: dict[str, Any] = Depends(get_current_user)) -> UserDocument:
    uid = _get_uid_from_user(current_user)
    return _get_user_document(uid)


@router.patch("/me")
async def patch_me(
    payload: dict[str, Any],
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    forbidden_in_payload = sorted(USER_FORBIDDEN_FIELDS.intersection(payload.keys()))
    if forbidden_in_payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Forbidden fields in payload: {', '.join(forbidden_in_payload)}",
        )

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided",
        )

    validated = TypeAdapter(UserUpdateRequest).validate_python(payload)
    update_data = validated.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid updatable fields provided",
        )

    uid = _get_uid_from_user(current_user)
    update_data["updatedAt"] = firestore.SERVER_TIMESTAMP

    db.collection("users").document(uid).update(update_data)

    changed_fields = [field for field in update_data.keys() if field != "updatedAt"]
    return {"updated": True, "fields": changed_fields}


@router.post("/ngo", response_model=NGODocument)
async def create_ngo(
    payload: NGOCreateRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> NGODocument:
    if not _is_coordinator(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coordinators can create NGO records",
        )

    ngo_id = f"{_normalize_doc_id(payload.name)}-{uuid4().hex[:8]}"
    ngo_doc = _ngo_payload(
        ngo_id=ngo_id,
        name=payload.name,
        city=payload.city,
        zones=payload.zones,
        need_categories=payload.needCategories,
        data_channels=payload.dataChannels,
    )

    db.collection("ngos").document(ngo_id).set(ngo_doc)
    return NGODocument.model_validate(ngo_doc)


@router.get("/ngo/{ngo_id}", response_model=NGODocument)
async def get_ngo(
    ngo_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> NGODocument:
    user_ngo_id = _get_ngo_id_from_user(current_user)
    if ngo_id != user_ngo_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own NGO",
        )

    return _get_ngo_document(ngo_id)


@router.patch("/ngo/{ngo_id}")
async def patch_ngo(
    ngo_id: str,
    payload: NGOUpdateRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if not _is_coordinator(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coordinators can update NGO records",
        )

    user_ngo_id = _get_ngo_id_from_user(current_user)
    if ngo_id != user_ngo_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own NGO",
        )

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided",
        )

    db.collection("ngos").document(ngo_id).update(update_data)
    return {"updated": True}


@router.post("/preseed")
async def preseed_city_baseline(
    payload: PreseedRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if not _is_coordinator(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coordinators can run preseed",
        )

    prompt = (
        "Generate baseline humanitarian zone data for a city as strict JSON. "
        "Include keys: city, zones (array of objects with name, riskScore, topNeeds, notes), "
        "summary (string), recommendedActions (array of strings). "
        f"City: {payload.city}. Zones: {', '.join(payload.zones)}."
    )

    response = client.models.generate_content(
        model=GEMINI_FLASH,
        contents=prompt
    )
    raw_text = (getattr(response, "text", None) or "").strip()

    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini returned an empty response",
        )

    try:
        parsed = _parse_gemini_json(raw_text)
        return {"generated": parsed}
    except Exception:
        return {"generated": raw_text}
