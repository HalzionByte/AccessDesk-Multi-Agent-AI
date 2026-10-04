"""Safe self-service enrollment for Firebase-authenticated customers."""

from __future__ import annotations

from typing import Any

from fastapi import status
from firebase_admin import auth as firebase_auth

from app.errors import AppError
from app.firebase import get_firebase_app
from app.schemas import CustomerRegistrationRequest, UserProfile, UserRole


def register_customer(
    database: Any,
    claims: dict[str, Any],
    payload: CustomerRegistrationRequest,
) -> UserProfile:
    """Assign only the customer role to a valid Firebase identity."""

    uid = claims.get("uid") or claims.get("sub")
    email = claims.get("email")
    if not isinstance(uid, str) or not uid or not isinstance(email, str) or not email:
        raise AppError(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_token",
            "The authentication token is missing required identity claims.",
        )

    firebase_claims = claims.get("firebase")
    if (
        isinstance(firebase_claims, dict)
        and firebase_claims.get("sign_in_provider") == "password"
        and claims.get("email_verified") is not True
    ):
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "email_verification_required",
            "Verify your email before registering.",
        )

    existing_role = claims.get("role")
    if existing_role == UserRole.STAFF.value:
        raise AppError(
            status.HTTP_409_CONFLICT,
            "account_already_registered",
            "This account is already registered as staff.",
        )
    if existing_role not in {None, UserRole.CUSTOMER.value}:
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "role_invalid",
            "This account cannot self-register.",
        )

    profile = UserProfile(
        uid=uid,
        name=payload.name,
        email=email,
        role=UserRole.CUSTOMER,
        preferred_language=payload.preferred_language,
    )
    try:
        database.collection("users").document(uid).set(
            {
                **profile.model_dump(mode="python", by_alias=True),
                "fictional": False,
                "emailVerified": bool(claims.get("email_verified", False)),
            },
            merge=True,
        )
        if existing_role is None:
            firebase_auth.set_custom_user_claims(
                uid,
                {
                    "role": UserRole.CUSTOMER.value,
                    "preferredLanguage": payload.preferred_language.value,
                },
                app=get_firebase_app(),
            )
    except Exception as exc:
        raise AppError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "registration_unavailable",
            "Registration is temporarily unavailable. Please retry.",
        ) from exc
    return profile
