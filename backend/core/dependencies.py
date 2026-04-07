from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Request, status

from core.firebase import auth, db
from core.security import decode_access_token


async def get_current_user(request: Request) -> dict[str, Any]:
    authorization = request.headers.get("Authorization")
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    parts = authorization.split(" ", maxsplit=1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization scheme",
        )

    id_token = parts[1].strip()

    # 1) Try backend JWT auth first.
    jwt_payload = decode_access_token(id_token)
    if jwt_payload and isinstance(jwt_payload.get("sub"), str):
        uid = str(jwt_payload["sub"])
        user_snapshot = db.collection("users").document(uid).get()
        if not user_snapshot.exists:
            legacy_match = list(
                db.collection("users")
                .where("id", "==", uid)
                .limit(1)
                .stream()
            )
            if legacy_match:
                user_snapshot = legacy_match[0]
        if not user_snapshot.exists:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        user_data = user_snapshot.to_dict() or {}
        user_data.setdefault("uid", user_snapshot.id)
        user_data.setdefault("id", user_snapshot.id)
        return user_data

    # 2) Fallback to Firebase ID token verification.
    try:
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token.get("uid")
        if not uid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        user_snapshot = db.collection("users").document(uid).get()
        if not user_snapshot.exists:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        user_data = user_snapshot.to_dict() or {}
        user_data.setdefault("uid", uid)
        return user_data
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase ID token",
        ) from exc


def role_required(required_role: str):
    async def role_checker(user: dict[str, Any] = Depends(get_current_user)):
        actual_role = str(user.get("role") or "").strip().lower()
        normalized_required = str(required_role or "").strip().lower()
        user_id = str(user.get("id") or user.get("uid") or "").strip()

        # Handle enum-like role serialization such as "UserRole.coordinator".
        if "." in actual_role:
            actual_role = actual_role.rsplit(".", maxsplit=1)[-1]

        # Backward compatibility: some legacy user docs may miss role even though
        # a role-scoped profile document exists.
        if not actual_role and user_id:
            role_collections = {
                "coordinator": "coordinators",
                "fieldworker": "fieldworkers",
                "volunteer": "volunteers",
            }
            for inferred_role, collection in role_collections.items():
                snapshot = db.collection(collection).document(user_id).get()
                if snapshot.exists:
                    actual_role = inferred_role
                    user["role"] = inferred_role
                    break

        if actual_role != normalized_required:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required",
            )
        return user
    return role_checker
