"""Firebase authentication and role-based FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import ValidationError

from app.errors import AppError
from app.firebase import FirebaseUnavailableError, decode_firebase_token
from app.schemas import AuthenticatedUser, PreferredLanguage, UserRole

bearer_scheme = HTTPBearer(auto_error=False)


def _identity_from_claims(claims: dict[str, Any]) -> AuthenticatedUser:
    uid = claims.get("uid") or claims.get("sub")
    email = claims.get("email")
    role = claims.get("role")
    if role not in {UserRole.CUSTOMER.value, UserRole.STAFF.value}:
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "role_required",
            "This account does not have an AccessDesk role.",
        )
    if not isinstance(uid, str) or not uid or not isinstance(email, str) or not email:
        raise AppError(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_token",
            "The authentication token is missing required identity claims.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return AuthenticatedUser(
            uid=uid,
            name=claims.get("name") or email,
            email=email,
            role=role,
            preferred_language=claims.get(
                "preferredLanguage", PreferredLanguage.ENGLISH
            ),
            token_claims=claims,
        )
    except ValidationError as exc:
        raise AppError(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_token",
            "The authentication token is missing required identity claims.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_verified_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppError(
            status.HTTP_401_UNAUTHORIZED,
            "authentication_required",
            "A valid Bearer token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        claims = decode_firebase_token(credentials.credentials)
    except FirebaseUnavailableError as exc:
        raise AppError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "auth_unavailable",
            "Authentication is temporarily unavailable.",
        ) from exc
    except Exception as exc:
        raise AppError(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_token",
            "The authentication token is invalid or expired.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    return claims


VerifiedClaims = Annotated[dict[str, Any], Depends(get_verified_claims)]


def get_current_user(claims: VerifiedClaims) -> AuthenticatedUser:
    return _identity_from_claims(claims)


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


def require_customer(user: CurrentUser) -> AuthenticatedUser:
    if user.role != UserRole.CUSTOMER:
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "customer_required",
            "Customer access is required.",
        )
    return user


def require_staff(user: CurrentUser) -> AuthenticatedUser:
    if user.role != UserRole.STAFF:
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "staff_required",
            "Staff access is required.",
        )
    return user


CustomerUser = Annotated[AuthenticatedUser, Depends(require_customer)]
StaffUser = Annotated[AuthenticatedUser, Depends(require_staff)]
