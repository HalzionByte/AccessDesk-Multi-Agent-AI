from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.schemas import Draft, DraftFields, DraftStage, Order, OrderStatus
from app.services.checker import check_request_completeness

NOW = datetime(2026, 10, 3, 12, tzinfo=UTC)


def make_draft(**overrides) -> Draft:
    values = {
        "draft_id": "draft-checker",
        "customer_uid": "demo-customer-1",
        "order_id": "AD-ORD-1001",
        "stage": DraftStage.COLLECT,
        "fields": DraftFields(
            issue_type="damaged item",
            description="The left ear cup arrived badly cracked.",
            requested_resolution="replacement",
        ),
        "attachment_ids": ["attachment-image"],
        "created_at": NOW,
        "updated_at": NOW,
    }
    values.update(overrides)
    return Draft(**values)


def make_order(**overrides) -> Order:
    values = {
        "order_id": "AD-ORD-1001",
        "customer_uid": "demo-customer-1",
        "product": "Wireless headphones",
        "qty": 1,
        "delivered_at": NOW - timedelta(days=7),
        "status": OrderStatus.DELIVERED,
        "fictional": True,
    }
    values.update(overrides)
    return Order(**values)


def test_complete_request_at_seven_days_is_within_window():
    result = check_request_completeness(make_draft(), make_order(), now=NOW)

    assert result.missing == []
    assert result.window == "within"
    assert result.days_since_delivery == 7
    assert result.needs_staff_exception is False


def test_request_outside_window_requires_staff_exception():
    order = make_order(delivered_at=NOW - timedelta(days=8))

    result = check_request_completeness(make_draft(), order, now=NOW)

    assert result.window == "outside"
    assert result.days_since_delivery == 8
    assert result.needs_staff_exception is True


def test_not_delivered_order_is_outside_workflow():
    order = make_order(status=OrderStatus.SHIPPED, delivered_at=None)

    result = check_request_completeness(make_draft(), order, now=NOW)

    assert result.window == "outside"
    assert result.days_since_delivery is None
    assert result.needs_staff_exception is True


def test_future_delivery_timestamp_fails_closed():
    order = make_order(delivered_at=NOW + timedelta(days=1))

    result = check_request_completeness(make_draft(), order, now=NOW)

    assert result.window == "outside"
    assert result.days_since_delivery is None
    assert result.needs_staff_exception is True


def test_checker_reports_every_missing_required_field_in_stable_order():
    draft = make_draft(
        order_id=None,
        fields=DraftFields(
            issue_type=" ",
            description="too short",
            requested_resolution="refund",
        ),
        attachment_ids=[],
    )

    result = check_request_completeness(draft, None, now=NOW)

    assert [item.value for item in result.missing] == [
        "order",
        "issue_type",
        "description",
        "image",
        "requested_resolution",
    ]


def test_verified_image_ids_prevent_a_pdf_from_satisfying_photo_requirement():
    draft = make_draft(attachment_ids=["attachment-pdf", "attachment-image"])

    without_verified_image = check_request_completeness(
        draft,
        make_order(),
        image_attachment_ids={"other-image"},
        now=NOW,
    )
    with_verified_image = check_request_completeness(
        draft,
        make_order(),
        image_attachment_ids={"attachment-image"},
        now=NOW,
    )

    assert "image" in without_verified_image.missing
    assert "image" not in with_verified_image.missing
