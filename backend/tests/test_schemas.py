from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.schemas import Order, OrderStatus, SubmissionRequest


def test_order_accepts_firestore_and_api_aliases():
    order = Order.model_validate(
        {
            "orderId": "AD-ORD-1001",
            "customerUid": "demo-customer-1",
            "product": "Wireless headphones",
            "qty": 1,
            "deliveredAt": datetime.now(UTC),
            "status": OrderStatus.DELIVERED,
            "fictional": True,
        }
    )

    assert order.quantity == 1
    assert order.model_dump(mode="json")["orderId"] == "AD-ORD-1001"


def test_submission_idempotency_key_must_be_nontrivial():
    with pytest.raises(ValidationError):
        SubmissionRequest(idempotency_key="short", confirmed=True)


def test_unknown_schema_fields_are_rejected():
    with pytest.raises(ValidationError):
        SubmissionRequest(idempotency_key="request-123", confirmed=True, admin=True)
