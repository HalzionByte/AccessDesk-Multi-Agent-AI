from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.errors import AppError
from app.schemas import DraftFields, DraftStage
from app.services.drafts import (
    add_message,
    create_draft,
    get_draft,
    set_draft_stage,
    update_draft_fields,
)
from app.services.events import list_case_events, list_draft_events, log_event
from app.services.orders import get_order
from tests.auth_helpers import auth_header
from tests.fakes import FakeQuery


def order_data(order_id: str, customer_uid: str) -> dict:
    return {
        "orderId": order_id,
        "customerUid": customer_uid,
        "product": "Wireless headphones",
        "qty": 1,
        "deliveredAt": datetime.now(UTC),
        "status": "Delivered",
        "fictional": True,
    }


def test_orders_route_only_returns_authenticated_customers_orders(
    client, database, token_decoder
):
    database.put("orders", "AD-ORD-1001", order_data("AD-ORD-1001", "demo-customer-1"))
    database.put("orders", "AD-ORD-1002", order_data("AD-ORD-1002", "demo-customer-2"))

    response = client.get("/orders", headers=auth_header("customer-token"))

    assert response.status_code == 200
    assert [order["orderId"] for order in response.json()] == ["AD-ORD-1001"]


def test_order_service_hides_another_customers_order(database):
    database.put("orders", "AD-ORD-1002", order_data("AD-ORD-1002", "demo-customer-2"))

    with pytest.raises(AppError) as error:
        get_order(database, "AD-ORD-1002", "demo-customer-1")

    assert error.value.status_code == 404


def test_draft_service_persists_fields_stage_and_nested_messages(database):
    database.put("orders", "AD-ORD-1001", order_data("AD-ORD-1001", "demo-customer-1"))
    draft = create_draft(database, "demo-customer-1", order_id="AD-ORD-1001")

    updated = update_draft_fields(
        database,
        draft.draft_id,
        "demo-customer-1",
        DraftFields(description="The left ear cup arrived cracked."),
    )
    staged = set_draft_stage(
        database, draft.draft_id, "demo-customer-1", DraftStage.POLICY
    )
    message = add_message(
        database,
        draft.draft_id,
        "demo-customer-1",
        actor="customer",
        text="It was damaged on arrival.",
    )

    assert updated.fields.description == "The left ear cup arrived cracked."
    assert staged.stage == DraftStage.POLICY
    assert message.text == "It was damaged on arrival."
    assert (
        "drafts",
        draft.draft_id,
        "messages",
        message.message_id,
    ) in database.documents


def test_draft_route_hides_another_customers_draft(client, database, token_decoder):
    draft = create_draft(database, "demo-customer-2")

    response = client.get(
        f"/drafts/{draft.draft_id}", headers=auth_header("customer-token")
    )

    assert response.status_code == 404
    assert response.json()["code"] == "draft_not_found"


def test_get_draft_service_hides_another_customers_draft(database):
    draft = create_draft(database, "demo-customer-2")

    with pytest.raises(AppError) as error:
        get_draft(database, draft.draft_id, "demo-customer-1")

    assert error.value.status_code == 404


def test_events_are_returned_in_created_order(database, monkeypatch):
    moments = iter(
        [
            datetime(2026, 10, 3, 10, 0, tzinfo=UTC),
            datetime(2026, 10, 3, 10, 1, tzinfo=UTC),
        ]
    )
    monkeypatch.setattr(
        "app.services.events.datetime",
        type("Clock", (), {"now": staticmethod(lambda _tz: next(moments))}),
    )

    log_event(
        database,
        draft_id="draft-1",
        actor="Intake Agent",
        action="collected order details",
        outcome="complete",
    )
    log_event(
        database,
        draft_id="draft-1",
        actor="Policy Agent",
        action="retrieved replacement requirements",
        outcome="P-1, P-3",
    )

    events = list_draft_events(database, "draft-1")
    assert [event.actor for event in events] == ["Intake Agent", "Policy Agent"]


def test_event_histories_sort_without_requiring_composite_indexes(
    database, monkeypatch
):
    moments = iter(
        [
            datetime(2026, 10, 3, 10, 1, tzinfo=UTC),
            datetime(2026, 10, 3, 10, 0, tzinfo=UTC),
        ]
    )
    monkeypatch.setattr(
        "app.services.events.datetime",
        type("Clock", (), {"now": staticmethod(lambda _tz: next(moments))}),
    )
    log_event(
        database,
        draft_id="draft-1",
        case_id="case-1",
        actor="Later",
        action="later action",
        outcome="later outcome",
    )
    log_event(
        database,
        draft_id="draft-1",
        case_id="case-1",
        actor="Earlier",
        action="earlier action",
        outcome="earlier outcome",
    )
    monkeypatch.setattr(
        FakeQuery,
        "order_by",
        lambda *_args: (_ for _ in ()).throw(AssertionError("Composite index needed")),
    )

    assert [event.actor for event in list_draft_events(database, "draft-1")] == [
        "Earlier",
        "Later",
    ]
    assert [event.actor for event in list_case_events(database, "case-1")] == [
        "Earlier",
        "Later",
    ]
