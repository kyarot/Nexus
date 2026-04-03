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
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        user_data = user_snapshot.to_dict() or {}
        user_data.setdefault("uid", uid)
        user_data.setdefault("id", uid)
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
        if user.get("role") != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required",
            )
        return user
    return role_checker
