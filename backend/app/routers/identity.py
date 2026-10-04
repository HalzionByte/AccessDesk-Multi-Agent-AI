"""Authenticated identity routes."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.auth import CurrentUser, VerifiedClaims
from app.firebase import get_database
from app.schemas import CustomerRegistrationRequest, UserProfile
from app.services.users import register_customer

router = APIRouter(tags=["identity"])
Database = Annotated[Any, Depends(get_database)]


@router.post("/auth/register", response_model=UserProfile)
def register_customer_account(
    payload: CustomerRegistrationRequest,
    claims: VerifiedClaims,
    database: Database,
) -> UserProfile:
    """Enroll an authenticated Firebase account as a customer only."""

    return register_customer(database, claims, payload)


@router.get("/me", response_model=UserProfile)
def get_me(user: CurrentUser) -> UserProfile:
    """Return the validated identity and role from the Firebase ID token."""

    return UserProfile.model_validate(user.model_dump())
