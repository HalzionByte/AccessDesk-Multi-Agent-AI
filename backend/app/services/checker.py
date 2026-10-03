"""Deterministic request-completeness and delivery-window rules."""

from __future__ import annotations

from collections.abc import Collection
from datetime import UTC, datetime
from typing import Literal

from app.schemas import (
    CompletenessResult,
    Draft,
    MissingRequirement,
    Order,
    OrderStatus,
)


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _delivery_window(
    order: Order | None,
    *,
    now: datetime,
) -> tuple[Literal["within", "outside"], int | None, bool]:
    if (
        order is None
        or order.status != OrderStatus.DELIVERED
        or order.delivered_at is None
    ):
        return "outside", None, True

    delivered_at = order.delivered_at
    if delivered_at.tzinfo is None:
        delivered_at = delivered_at.replace(tzinfo=UTC)
    current = now if now.tzinfo is not None else now.replace(tzinfo=UTC)
    days_since_delivery = (
        current.astimezone(UTC).date() - delivered_at.astimezone(UTC).date()
    ).days
    if days_since_delivery < 0:
        return "outside", None, True
    within_window = days_since_delivery <= 7
    return (
        "within" if within_window else "outside",
        days_since_delivery,
        not within_window,
    )


def check_request_completeness(
    draft: Draft,
    order: Order | None,
    *,
    image_attachment_ids: Collection[str] | None = None,
    now: datetime | None = None,
) -> CompletenessResult:
    """Check exact non-LLM requirements and the seven-day delivery window.

    ``image_attachment_ids`` lets the workflow pass attachment IDs whose stored
    MIME metadata has already been verified as ``image/*``. For compatibility
    with the two-argument PRD interface, omitted metadata treats the draft's
    validated upload IDs as evidence; final case submission independently
    re-checks MIME metadata and remains authoritative.
    """

    missing: list[MissingRequirement] = []
    order_matches = bool(
        draft.order_id and order is not None and draft.order_id == order.order_id
    )
    if not order_matches:
        missing.append(MissingRequirement.ORDER)
    if not _clean(draft.fields.issue_type):
        missing.append(MissingRequirement.ISSUE_TYPE)
    if len(_clean(draft.fields.description)) < 10:
        missing.append(MissingRequirement.DESCRIPTION)

    if image_attachment_ids is None:
        has_image = bool(draft.attachment_ids)
    else:
        has_image = bool(set(draft.attachment_ids).intersection(image_attachment_ids))
    if not has_image:
        missing.append(MissingRequirement.IMAGE)

    if _clean(draft.fields.requested_resolution).casefold() != "replacement":
        missing.append(MissingRequirement.REQUESTED_RESOLUTION)

    window, days_since_delivery, needs_staff_exception = _delivery_window(
        order if order_matches else None,
        now=now or datetime.now(UTC),
    )
    return CompletenessResult(
        missing=missing,
        window=window,
        days_since_delivery=days_since_delivery,
        needs_staff_exception=needs_staff_exception,
    )
