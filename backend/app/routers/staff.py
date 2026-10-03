"""Staff-only support-case review routes."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.auth import StaffUser
from app.firebase import get_database
from app.schemas import CaseStatus, StaffStatusUpdateRequest, SupportCase
from app.services.cases import get_case, list_cases, update_case_status

router = APIRouter(prefix="/staff/cases", tags=["staff cases"])
Database = Annotated[Any, Depends(get_database)]


@router.get("", response_model=list[SupportCase])
def get_staff_cases(
    user: StaffUser,
    database: Database,
    status_filter: Annotated[CaseStatus | None, Query(alias="status")] = None,
) -> list[SupportCase]:
    del user
    return list_cases(database, case_status=status_filter)


@router.get("/{case_id}", response_model=SupportCase)
def get_staff_case(
    case_id: str,
    user: StaffUser,
    database: Database,
) -> SupportCase:
    del user
    return get_case(database, case_id)


@router.patch("/{case_id}/status", response_model=SupportCase)
def change_case_status(
    case_id: str,
    payload: StaffStatusUpdateRequest,
    user: StaffUser,
    database: Database,
) -> SupportCase:
    return update_case_status(
        database,
        case_id,
        target=payload.status,
        staff_uid=user.uid,
        note=payload.note,
        info_request=payload.info_request,
    )
