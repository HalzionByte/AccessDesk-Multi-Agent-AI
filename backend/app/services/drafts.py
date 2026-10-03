"""Durable draft and message state independent from any language model."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

from fastapi import status
from pydantic import ValidationError

from app.errors import AppError
from app.schemas import ChatMessage, Draft, DraftFields, DraftStage
from app.services.orders import get_order


def _now() -> datetime:
    return datetime.now(UTC)


def _draft_from_snapshot(snapshot: Any) -> Draft:
    data = snapshot.to_dict() or {}
    data.setdefault("draftId", snapshot.id)
    try:
        return Draft.model_validate(data)
    except ValidationError as exc:
        raise AppError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "draft_data_invalid",
            "Draft data is temporarily unavailable.",
        ) from exc


def create_draft(
    database: Any,
    customer_uid: str,
    *,
    order_id: str | None = None,
) -> Draft:
    if order_id:
        get_order(database, order_id, customer_uid)

    reference = database.collection("drafts").document()
    now = _now()
    draft = Draft(
        draft_id=reference.id,
        customer_uid=customer_uid,
        order_id=order_id,
        stage=DraftStage.INTAKE,
        created_at=now,
        updated_at=now,
    )
    reference.set(draft.model_dump(mode="python", by_alias=True))
    return draft


def get_draft(database: Any, draft_id: str, customer_uid: str) -> Draft:
    """Return an owned draft, hiding other customers' draft identifiers."""

    snapshot = database.collection("drafts").document(draft_id).get()
    if not snapshot.exists:
        raise AppError(status.HTTP_404_NOT_FOUND, "draft_not_found", "Draft not found.")

    draft = _draft_from_snapshot(snapshot)
    if draft.customer_uid != customer_uid:
        raise AppError(status.HTTP_404_NOT_FOUND, "draft_not_found", "Draft not found.")
    return draft


def update_draft_fields(
    database: Any,
    draft_id: str,
    customer_uid: str,
    changes: DraftFields | Mapping[str, Any],
) -> Draft:
    draft = get_draft(database, draft_id, customer_uid)
    raw_changes = (
        changes.model_dump(exclude_unset=True)
        if isinstance(changes, DraftFields)
        else dict(changes)
    )
    merged = draft.fields.model_dump()
    merged.update(raw_changes)
    try:
        fields = DraftFields.model_validate(merged)
    except ValidationError as exc:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "invalid_draft_fields",
            "One or more draft fields are invalid.",
        ) from exc

    updated_at = _now()
    database.collection("drafts").document(draft_id).update(
        {
            "fields": fields.model_dump(mode="python", by_alias=True),
            "updatedAt": updated_at,
        }
    )
    return draft.model_copy(update={"fields": fields, "updated_at": updated_at})


def set_draft_stage(
    database: Any,
    draft_id: str,
    customer_uid: str,
    stage: DraftStage,
) -> Draft:
    draft = get_draft(database, draft_id, customer_uid)
    updated_at = _now()
    database.collection("drafts").document(draft_id).update(
        {"stage": stage.value, "updatedAt": updated_at}
    )
    return draft.model_copy(update={"stage": stage, "updated_at": updated_at})


def add_message(
    database: Any,
    draft_id: str,
    customer_uid: str,
    *,
    actor: str,
    text: str,
) -> ChatMessage:
    get_draft(database, draft_id, customer_uid)
    reference = (
        database.collection("drafts")
        .document(draft_id)
        .collection("messages")
        .document()
    )
    message = ChatMessage(
        message_id=reference.id,
        draft_id=draft_id,
        actor=actor,
        text=text,
        created_at=_now(),
    )
    reference.set(message.model_dump(mode="python", by_alias=True))
    return message
