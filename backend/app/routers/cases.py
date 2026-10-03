"""Customer case submission, listing, details, and reply routes."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.auth import CustomerUser
from app.firebase import get_database
from app.schemas import CaseReplyRequest, SubmissionRequest, SupportCase
from app.services.cases import create_support_case, get_case, list_cases, reply_to_case
from app.services.drafts import get_draft

router = APIRouter(tags=["cases"])
Database = Annotated[Any, Depends(get_database)]


@router.post("/drafts/{draft_id}/submit", response_model=SupportCase)
def submit_draft(
    draft_id: str,
    payload: SubmissionRequest,
    user: CustomerUser,
    database: Database,
) -> SupportCase:
    draft = get_draft(database, draft_id, user.uid)
    return create_support_case(
        database,
        draft,
        payload.idempotency_key,
        payload.confirmed,
    )


@router.get("/cases", response_model=list[SupportCase])
def get_own_cases(user: CustomerUser, database: Database) -> list[SupportCase]:
    return list_cases(database, customer_uid=user.uid)


@router.get("/cases/{case_id}", response_model=SupportCase)
def get_own_case(case_id: str, user: CustomerUser, database: Database) -> SupportCase:
    return get_case(database, case_id, customer_uid=user.uid)


@router.post("/cases/{case_id}/reply", response_model=SupportCase)
def reply_to_information_request(
    case_id: str,
    payload: CaseReplyRequest,
    user: CustomerUser,
    database: Database,
) -> SupportCase:
    return reply_to_case(
        database,
        case_id,
        customer_uid=user.uid,
        message=payload.message,
    )
