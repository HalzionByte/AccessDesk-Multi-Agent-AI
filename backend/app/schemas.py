"""Shared API and persistence schemas.

All feature teams extend this module instead of creating competing schema files.
API JSON uses camelCase while Python code uses snake_case.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StrictBool,
    StringConstraints,
)
from pydantic.alias_generators import to_camel

NonEmptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class AppModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


class UserRole(StrEnum):
    CUSTOMER = "customer"
    STAFF = "staff"


class PreferredLanguage(StrEnum):
    ENGLISH = "en"
    ROMAN_URDU = "roman-urdu"


class OrderStatus(StrEnum):
    PROCESSING = "Processing"
    SHIPPED = "Shipped"
    DELIVERED = "Delivered"
    CANCELLED = "Cancelled"


class DraftStage(StrEnum):
    INTAKE = "INTAKE"
    POLICY = "POLICY"
    COLLECT = "COLLECT"
    PREVIEW = "PREVIEW"
    AWAIT_CONFIRM = "AWAIT_CONFIRM"
    SUBMITTED = "SUBMITTED"


class CaseStatus(StrEnum):
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    UNDER_REVIEW = "Under Review"
    NEEDS_INFORMATION = "Needs Information"
    APPROVED = "Approved"
    DECLINED = "Declined"
    CLOSED = "Closed"


class ErrorResponse(AppModel):
    code: NonEmptyText
    message: NonEmptyText


class HealthResponse(AppModel):
    status: str = "ok"
    service: str = "AccessDesk API"


class UserProfile(AppModel):
    uid: NonEmptyText
    name: NonEmptyText
    email: EmailStr
    role: UserRole
    preferred_language: PreferredLanguage = PreferredLanguage.ENGLISH


class CustomerRegistrationRequest(AppModel):
    """Profile data allowed during self-service customer registration."""

    name: str = Field(min_length=2, max_length=100)
    preferred_language: PreferredLanguage = PreferredLanguage.ENGLISH


class Order(AppModel):
    order_id: NonEmptyText
    customer_uid: NonEmptyText
    product: NonEmptyText
    quantity: int = Field(ge=1, alias="qty")
    delivered_at: datetime | None = None
    status: OrderStatus
    fictional: bool = True


class DraftFields(AppModel):
    issue_type: str | None = None
    description: str | None = None
    requested_resolution: str | None = None
    customer_statement: str | None = None


class Draft(AppModel):
    draft_id: NonEmptyText
    customer_uid: NonEmptyText
    order_id: str | None = None
    stage: DraftStage = DraftStage.INTAKE
    fields: DraftFields = Field(default_factory=DraftFields)
    missing: list[str] = Field(default_factory=list)
    attachment_ids: list[str] = Field(default_factory=list)
    policy_refs: list[str] = Field(default_factory=list)
    summary: str | None = None
    created_at: datetime
    updated_at: datetime


class ChatMessage(AppModel):
    message_id: NonEmptyText
    draft_id: NonEmptyText
    actor: NonEmptyText
    text: NonEmptyText
    created_at: datetime


class Attachment(AppModel):
    attachment_id: NonEmptyText
    owner_uid: NonEmptyText
    draft_id: str | None = None
    case_id: str | None = None
    path: NonEmptyText
    filename: NonEmptyText
    mime: NonEmptyText
    size: int = Field(ge=0)
    created_at: datetime | None = None


class AttachmentView(AppModel):
    """Safe attachment metadata returned to browsers; never exposes disk paths."""

    attachment_id: NonEmptyText
    filename: NonEmptyText
    mime: NonEmptyText
    size: int = Field(ge=0)


class EventRecord(AppModel):
    """Firestore representation of an auditable workflow event."""

    event_id: str | None = None
    draft_id: str | None = None
    case_id: str | None = None
    actor: NonEmptyText
    actor_uid: str | None = None
    action: NonEmptyText
    outcome: NonEmptyText
    created_at: datetime


class Event(AppModel):
    """Public timeline event matching the ChatResponse contract."""

    event_id: str | None = None
    draft_id: str | None = None
    case_id: str | None = None
    actor: NonEmptyText
    action: NonEmptyText
    outcome: NonEmptyText
    created_at: datetime = Field(alias="at")


class PolicyCitation(AppModel):
    id: NonEmptyText
    title: NonEmptyText
    text: NonEmptyText


class IntakeResult(AppModel):
    """Validated output boundary for the intake agent."""

    language: PreferredLanguage
    order_id: str | None = None
    issue_type: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=4_000)
    resolution: str | None = Field(default=None, max_length=200)
    follow_up_question: str | None = Field(default=None, max_length=1_000)


class PolicyResult(AppModel):
    """Validated output boundary for policy explanations."""

    explanation: NonEmptyText
    citation_ids: list[NonEmptyText] = Field(default_factory=list)
    uncertainty: bool = False


class ResolutionResult(AppModel):
    """Validated output boundary for the resolution agent."""

    summary: NonEmptyText
    next_step: NonEmptyText
    existing_case: bool = False


class MissingRequirement(StrEnum):
    ORDER = "order"
    ISSUE_TYPE = "issue_type"
    DESCRIPTION = "description"
    IMAGE = "image"
    REQUESTED_RESOLUTION = "requested_resolution"


class CompletenessResult(AppModel):
    missing: list[MissingRequirement] = Field(default_factory=list)
    window: Literal["within", "outside"]
    days_since_delivery: int | None = Field(default=None, ge=0)
    needs_staff_exception: bool


class EvaluationLanguage(StrEnum):
    ENGLISH = "en"
    ROMAN_URDU = "roman-urdu"
    MIXED = "mixed"


class EvaluationComplaint(AppModel):
    id: NonEmptyText
    language: EvaluationLanguage
    complaint: NonEmptyText
    expected_order_id: str | None = None
    expected_issue_type: str | None = None
    expected_missing: list[MissingRequirement] = Field(default_factory=list)
    expected_policy_ids: list[NonEmptyText] = Field(default_factory=list)


class ChecklistItem(AppModel):
    key: NonEmptyText
    label: NonEmptyText
    done: bool


class RequestPreview(AppModel):
    order_id: NonEmptyText
    product: NonEmptyText
    issue: NonEmptyText
    statement: NonEmptyText
    attachments: list[AttachmentView] = Field(default_factory=list)
    resolution: NonEmptyText
    summary: NonEmptyText
    window: NonEmptyText


class ExistingCase(AppModel):
    case_id: NonEmptyText
    tracking_no: NonEmptyText
    status: CaseStatus


class ChatRequest(AppModel):
    draft_id: str | None = None
    order_id: str | None = None
    message: str = Field(min_length=1, max_length=4_000)


class ChatResponse(AppModel):
    draft_id: NonEmptyText
    stage: DraftStage
    reply: NonEmptyText
    language: PreferredLanguage
    fields: DraftFields
    checklist: list[ChecklistItem] = Field(default_factory=list)
    citations: list[PolicyCitation] = Field(default_factory=list)
    preview: RequestPreview | None = None
    existing_case: ExistingCase | None = None
    events: list[Event] = Field(default_factory=list)


class SupportCase(AppModel):
    case_id: NonEmptyText
    tracking_no: NonEmptyText
    customer_uid: NonEmptyText
    order_id: NonEmptyText
    product: NonEmptyText
    issue_type: NonEmptyText
    summary: NonEmptyText
    customer_statement: NonEmptyText
    status: CaseStatus
    policy_refs: list[str] = Field(default_factory=list)
    attachments: list[AttachmentView] = Field(default_factory=list)
    attachment_ids: list[str] = Field(default_factory=list)
    info_request: str | None = None
    staff_note: str | None = None
    created_at: datetime
    updated_at: datetime
    events: list[Event] | None = None
    fictional: bool = True


class SubmissionRequest(AppModel):
    idempotency_key: str = Field(min_length=8, max_length=200)
    confirmed: StrictBool


class CaseReplyRequest(AppModel):
    message: str = Field(min_length=1, max_length=4_000)


class StaffStatusUpdateRequest(AppModel):
    status: CaseStatus
    note: str | None = Field(default=None, max_length=4_000)
    info_request: str | None = Field(default=None, max_length=4_000)


class CaseLock(AppModel):
    case_id: NonEmptyText
    order_id: NonEmptyText
    issue_type: NonEmptyText


class SubmissionRecord(AppModel):
    idempotency_key: NonEmptyText
    case_id: NonEmptyText
    created_at: datetime


class Counter(AppModel):
    value: int = Field(ge=0)


class AuthenticatedUser(UserProfile):
    """Validated Firebase identity used by route dependencies."""

    token_claims: dict[str, Any] = Field(default_factory=dict, exclude=True)
