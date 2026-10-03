"""Authenticated identity routes."""

from fastapi import APIRouter

from app.auth import CurrentUser
from app.schemas import UserProfile

router = APIRouter(tags=["identity"])


@router.get("/me", response_model=UserProfile)
def get_me(user: CurrentUser) -> UserProfile:
    """Return the validated identity and role from the Firebase ID token."""

    return UserProfile.model_validate(user.model_dump())
