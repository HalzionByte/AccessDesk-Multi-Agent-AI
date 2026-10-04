from datetime import UTC, datetime

from seed_mubashir import SAMPLE_UID, build_sample_orders


def test_sample_orders_are_distinct_and_owned_by_mubashir():
    now = datetime(2026, 10, 4, tzinfo=UTC)
    orders = build_sample_orders(now)

    assert len(orders) == 4
    assert len({order["orderId"] for order in orders}) == 4
    assert all(order["customerUid"] == SAMPLE_UID for order in orders)
    assert all(order["fictional"] is True for order in orders)
    assert len([order for order in orders if order["deliveredAt"] is not None]) == 3
    assert (
        next(order for order in orders if order["status"] == "Shipped")["deliveredAt"]
        is None
    )
