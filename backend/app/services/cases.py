"""Transactional support-case creation and deterministic status rules."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from hashlib import sha256
from typing import Any, TypeVar

from fastapi import status
from google.cloud.firestore_v1.base_query import FieldFilter
from google.cloud.firestore_v1.transaction import transactional
from pydantic import ValidationError

from app.errors import AppError
from app.schemas import (
    Attachment,
    AttachmentView,
    CaseStatus,
    Draft,
    DraftFields,
    DraftStage,
    SupportCase,
)
from app.services.events import list_case_events

T = TypeVar("T")

STAFF_TRANSITIONS: dict[CaseStatus, frozenset[CaseStatus]] = {
    CaseStatus.SUBMITTED: frozenset({CaseStatus.UNDER_REVIEW}),
    CaseStatus.UNDER_REVIEW: frozenset(
        {
            CaseStatus.NEEDS_INFORMATION,
            CaseStatus.APPROVED,
            CaseStatus.DECLINED,
        }
    ),
    CaseStatus.APPROVED: frozenset({CaseStatus.CLOSED}),
    CaseStatus.DECLINED: frozenset({CaseStatus.CLOSED}),
}


def _now() -> datetime:
    return datetime.now(UTC)


def _run_transaction(database: Any, operation: Callable[[Any], T]) -> T:
    """Run with Firestore retries; adapters may provide an equivalent runner."""

    adapter_runner = getattr(database, "run_transaction", None)
    if adapter_runner is not None:
        return adapter_runner(operation)
    return transactional(operation)(database.transaction())


def _digest(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def _lock_id(order_id: str, issue_type: str) -> str:
    normalized_issue = " ".join(issue_type.lower().split())
    return _digest(f"{order_id}:{normalized_issue}")


def _submission_id(customer_uid: str, idempotency_key: str) -> str:
    return _digest(f"{customer_uid}:{idempotency_key}")


def _case_from_snapshot(snapshot: Any) -> SupportCase:
    data = snapshot.to_dict() or {}
    data.setdefault("caseId", snapshot.id)
    try:
        return SupportCase.model_validate(data)
    except ValidationError as exc:
        raise AppError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "case_data_invalid",
            "Case data is temporarily unavailable.",
        ) from exc


def _read_case(
    transaction: Any,
    reference: Any,
    *,
    integrity_required: bool = False,
) -> SupportCase:
    snapshot = reference.get(transaction=transaction)
    if not snapshot.exists:
        if not integrity_required:
            raise AppError(
                status.HTTP_404_NOT_FOUND, "case_not_found", "Case not found."
            )
        raise AppError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "case_data_invalid",
            "Case data is temporarily unavailable.",
        )
    return _case_from_snapshot(snapshot)


def _incomplete_request(missing: list[str]) -> AppError:
    return AppError(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "incomplete_request",
        f"Request is incomplete: {', '.join(missing)}.",
    )


def _validate_and_load_submission(
    database: Any,
    transaction: Any,
    draft_reference: Any,
    customer_uid: str,
) -> tuple[Draft, Any]:
    draft_snapshot = draft_reference.get(transaction=transaction)
    if not draft_snapshot.exists:
        raise AppError(status.HTTP_404_NOT_FOUND, "draft_not_found", "Draft not found.")

    data = draft_snapshot.to_dict() or {}
    data.setdefault("draftId", draft_snapshot.id)
    try:
        draft = Draft.model_validate(data)
    except ValidationError as exc:
        raise AppError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "draft_data_invalid",
            "Draft data is temporarily unavailable.",
        ) from exc
    if draft.customer_uid != customer_uid:
        raise AppError(status.HTTP_404_NOT_FOUND, "draft_not_found", "Draft not found.")

    fields: DraftFields = draft.fields
    missing: list[str] = []
    if not draft.order_id:
        missing.append("order")
    if not fields.issue_type:
        missing.append("issue type")
    if not fields.description or len(fields.description.strip()) < 10:
        missing.append("description")
    if (
        not fields.requested_resolution
        or fields.requested_resolution.strip().lower() != "replacement"
    ):
        missing.append("replacement resolution")

    has_image = False
    for attachment_id in draft.attachment_ids:
        attachment_snapshot = (
            database.collection("attachments")
            .document(attachment_id)
            .get(transaction=transaction)
        )
        attachment_data = attachment_snapshot.to_dict() or {}
        if (
            attachment_snapshot.exists
            and attachment_data.get("ownerUid") == customer_uid
            and str(attachment_data.get("mime", "")).startswith("image/")
        ):
            has_image = True
            break
    if not has_image:
        missing.append("image evidence")

    if missing:
        raise _incomplete_request(missing)

    order_reference = database.collection("orders").document(draft.order_id)
    order_snapshot = order_reference.get(transaction=transaction)
    order_data = order_snapshot.to_dict() or {}
    if not order_snapshot.exists or order_data.get("customerUid") != customer_uid:
        raise AppError(status.HTTP_404_NOT_FOUND, "order_not_found", "Order not found.")
    return draft, order_data


def create_support_case(
    database: Any,
    draft: Draft,
    idempotency_key: str,
    confirmed: bool,
) -> SupportCase:
    """Create one case atomically or return the matching committed case."""

    if not confirmed:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "confirmation_required",
            "Confirm the request before submitting it.",
        )
    cleaned_idempotency_key = idempotency_key.strip()
    if not 8 <= len(cleaned_idempotency_key) <= 200:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "invalid_idempotency_key",
            "The idempotency key must contain 8 to 200 characters.",
        )

    draft_reference = database.collection("drafts").document(draft.draft_id)
    submission_reference = database.collection("submissions").document(
        _submission_id(draft.customer_uid, cleaned_idempotency_key)
    )
    new_case_reference = database.collection("cases").document()

    def create_or_get(transaction: Any) -> SupportCase:
        submission_snapshot = submission_reference.get(transaction=transaction)
        if submission_snapshot.exists:
            committed_case_id = (submission_snapshot.to_dict() or {}).get("caseId")
            if not isinstance(committed_case_id, str) or not committed_case_id:
                raise AppError(
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                    "case_data_invalid",
                    "Case data is temporarily unavailable.",
                )
            return _read_case(
                transaction,
                database.collection("cases").document(committed_case_id),
                integrity_required=True,
            )

        current_draft, order_data = _validate_and_load_submission(
            database, transaction, draft_reference, draft.customer_uid
        )
        issue_type = current_draft.fields.issue_type or ""
        lock_reference = database.collection("case_locks").document(
            _lock_id(current_draft.order_id or "", issue_type)
        )
        lock_snapshot = lock_reference.get(transaction=transaction)
        now = _now()

        if lock_snapshot.exists:
            existing_case_id = (lock_snapshot.to_dict() or {}).get("caseId")
            if not isinstance(existing_case_id, str) or not existing_case_id:
                raise AppError(
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                    "case_data_invalid",
                    "Case data is temporarily unavailable.",
                )
            existing_case = _read_case(
                transaction,
                database.collection("cases").document(existing_case_id),
                integrity_required=True,
            )
            transaction.set(
                submission_reference,
                {
                    "idempotencyKey": cleaned_idempotency_key,
                    "customerUid": draft.customer_uid,
                    "caseId": existing_case.case_id,
                    "createdAt": now,
                },
            )
            transaction.update(
                draft_reference,
                {"stage": DraftStage.SUBMITTED.value, "updatedAt": now},
            )
            return existing_case

        if current_draft.stage == DraftStage.SUBMITTED:
            raise AppError(
                status.HTTP_409_CONFLICT,
                "draft_already_submitted",
                "This draft has already been submitted.",
            )

        counter_reference = database.collection("counters").document("cases")
        counter_snapshot = counter_reference.get(transaction=transaction)
        current_count = int((counter_snapshot.to_dict() or {}).get("value", 0))
        next_count = current_count + 1
        tracking_number = f"AD-{now.year}-{next_count:04d}"
        event_reference = database.collection("events").document()

        support_case = SupportCase(
            case_id=new_case_reference.id,
            tracking_no=tracking_number,
            customer_uid=draft.customer_uid,
            order_id=current_draft.order_id or "",
            product=str(order_data.get("product", "Unknown product")),
            issue_type=issue_type,
            summary=current_draft.summary or current_draft.fields.description or "",
            customer_statement=(
                current_draft.fields.customer_statement
                or current_draft.fields.description
                or ""
            ),
            status=CaseStatus.SUBMITTED,
            policy_refs=current_draft.policy_refs,
            attachment_ids=current_draft.attachment_ids,
            created_at=now,
            updated_at=now,
            fictional=bool(order_data.get("fictional", True)),
        )

        transaction.set(
            new_case_reference,
            support_case.model_dump(mode="python", by_alias=True),
        )
        transaction.set(
            lock_reference,
            {
                "caseId": support_case.case_id,
                "orderId": support_case.order_id,
                "issueType": support_case.issue_type,
                "createdAt": now,
            },
        )
        transaction.set(
            submission_reference,
            {
                "idempotencyKey": cleaned_idempotency_key,
                "customerUid": draft.customer_uid,
                "caseId": support_case.case_id,
                "createdAt": now,
            },
        )
        for attachment_id in support_case.attachment_ids:
            transaction.update(
                database.collection("attachments").document(attachment_id),
                {"caseId": support_case.case_id},
            )
        transaction.set(counter_reference, {"value": next_count})
        transaction.set(
            event_reference,
            {
                "eventId": event_reference.id,
                "draftId": current_draft.draft_id,
                "caseId": support_case.case_id,
                "actor": "System",
                "action": "created case",
                "outcome": tracking_number,
                "createdAt": now,
            },
        )
        transaction.update(
            draft_reference,
            {"stage": DraftStage.SUBMITTED.value, "updatedAt": now},
        )
        return support_case

    return _run_transaction(database, create_or_get)


def _attachment_views(database: Any, case: SupportCase) -> list[AttachmentView]:
    views: list[AttachmentView] = []
    for attachment_id in case.attachment_ids:
        snapshot = database.collection("attachments").document(attachment_id).get()
        if not snapshot.exists:
            continue
        data = snapshot.to_dict() or {}
        data.setdefault("attachmentId", snapshot.id)
        attachment = Attachment.model_validate(data)
        views.append(
            AttachmentView(
                attachment_id=attachment.attachment_id,
                filename=attachment.filename,
                mime=attachment.mime,
                size=attachment.size,
            )
        )
    return views


def get_case(
    database: Any,
    case_id: str,
    *,
    customer_uid: str | None = None,
) -> SupportCase:
    snapshot = database.collection("cases").document(case_id).get()
    if not snapshot.exists:
        raise AppError(status.HTTP_404_NOT_FOUND, "case_not_found", "Case not found.")
    case = _case_from_snapshot(snapshot)
    if customer_uid is not None and case.customer_uid != customer_uid:
        raise AppError(status.HTTP_404_NOT_FOUND, "case_not_found", "Case not found.")
    return case.model_copy(
        update={
            "attachments": _attachment_views(database, case),
            "events": list_case_events(database, case.case_id),
        }
    )


def list_cases(
    database: Any,
    *,
    customer_uid: str | None = None,
    case_status: CaseStatus | None = None,
) -> list[SupportCase]:
    query: Any = database.collection("cases")
    if customer_uid is not None:
        query = query.where(filter=FieldFilter("customerUid", "==", customer_uid))
    if case_status is not None:
        query = query.where(filter=FieldFilter("status", "==", case_status.value))
    cases = [_case_from_snapshot(snapshot) for snapshot in query.stream()]
    return sorted(cases, key=lambda item: item.created_at, reverse=True)


def find_existing_case(
    database: Any, order_id: str, issue_type: str
) -> SupportCase | None:
    lock_snapshot = (
        database.collection("case_locks").document(_lock_id(order_id, issue_type)).get()
    )
    if not lock_snapshot.exists:
        return None
    case_id = (lock_snapshot.to_dict() or {}).get("caseId")
    if not isinstance(case_id, str) or not case_id:
        raise AppError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "case_data_invalid",
            "Case data is temporarily unavailable.",
        )
    return get_case(database, case_id)


def get_case_status(database: Any, case_id: str, customer_uid: str) -> CaseStatus:
    return get_case(database, case_id, customer_uid=customer_uid).status


def validate_staff_transition(current: CaseStatus, target: CaseStatus) -> None:
    if target not in STAFF_TRANSITIONS.get(current, frozenset()):
        raise AppError(
            status.HTTP_409_CONFLICT,
            "invalid_status_transition",
            f"A case cannot move from {current.value} to {target.value}.",
        )


def update_case_status(
    database: Any,
    case_id: str,
    *,
    target: CaseStatus,
    staff_uid: str,
    note: str | None = None,
    info_request: str | None = None,
) -> SupportCase:
    cleaned_info_request = (info_request or "").strip()
    if target == CaseStatus.NEEDS_INFORMATION and not cleaned_info_request:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "info_request_required",
            "Explain what information the customer must provide.",
        )

    case_reference = database.collection("cases").document(case_id)

    def transition(transaction: Any) -> SupportCase:
        case = _read_case(transaction, case_reference)
        validate_staff_transition(case.status, target)
        now = _now()
        updates: dict[str, Any] = {
            "status": target.value,
            "updatedAt": now,
            "infoRequest": (
                cleaned_info_request if target == CaseStatus.NEEDS_INFORMATION else None
            ),
        }
        if note is not None:
            updates["staffNote"] = note.strip() or None

        transaction.update(case_reference, updates)
        event_reference = database.collection("events").document()
        transaction.set(
            event_reference,
            {
                "eventId": event_reference.id,
                "caseId": case_id,
                "actor": "Staff",
                "actorUid": staff_uid,
                "action": "changed case status",
                "outcome": target.value,
                "createdAt": now,
            },
        )
        if target in {CaseStatus.DECLINED, CaseStatus.CLOSED}:
            lock_reference = database.collection("case_locks").document(
                _lock_id(case.order_id, case.issue_type)
            )
            transaction.delete(lock_reference)

        return case.model_copy(
            update={
                "status": target,
                "updated_at": now,
                "info_request": updates["infoRequest"],
                "staff_note": updates.get("staffNote", case.staff_note),
            }
        )

    return _run_transaction(database, transition)


def reply_to_case(
    database: Any,
    case_id: str,
    *,
    customer_uid: str,
    message: str,
) -> SupportCase:
    cleaned_message = message.strip()
    if not cleaned_message or len(cleaned_message) > 4_000:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "reply_required",
            "Reply text must contain between 1 and 4,000 characters.",
        )

    case_reference = database.collection("cases").document(case_id)
    reply_reference = case_reference.collection("replies").document()
    event_reference = database.collection("events").document()

    def reply(transaction: Any) -> SupportCase:
        case = _read_case(transaction, case_reference)
        if case.customer_uid != customer_uid:
            raise AppError(
                status.HTTP_404_NOT_FOUND, "case_not_found", "Case not found."
            )
        if case.status != CaseStatus.NEEDS_INFORMATION:
            raise AppError(
                status.HTTP_409_CONFLICT,
                "reply_not_expected",
                "This case is not waiting for customer information.",
            )

        now = _now()
        transaction.set(
            reply_reference,
            {
                "replyId": reply_reference.id,
                "customerUid": customer_uid,
                "message": cleaned_message,
                "createdAt": now,
            },
        )
        transaction.update(
            case_reference,
            {
                "status": CaseStatus.UNDER_REVIEW.value,
                "infoRequest": None,
                "updatedAt": now,
            },
        )
        transaction.set(
            event_reference,
            {
                "eventId": event_reference.id,
                "caseId": case_id,
                "actor": "Customer",
                "actorUid": customer_uid,
                "action": "provided requested information",
                "outcome": "returned to review",
                "createdAt": now,
            },
        )
        return case.model_copy(
            update={
                "status": CaseStatus.UNDER_REVIEW,
                "info_request": None,
                "updated_at": now,
            }
        )

    return _run_transaction(database, reply)
