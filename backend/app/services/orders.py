"""Order lookup with mandatory customer ownership checks."""

from __future__ import annotations

from typing import Any

from fastapi import status
from google.cloud.firestore_v1.base_query import FieldFilter
from pydantic import ValidationError

from app.errors import AppError
from app.schemas import Order


def _order_from_snapshot(snapshot: Any) -> Order:
    data = snapshot.to_dict() or {}
    data.setdefault("orderId", snapshot.id)
    try:
        return Order.model_validate(data)
    except ValidationError as exc:
        raise AppError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "order_data_invalid",
            "Order data is temporarily unavailable.",
        ) from exc


def get_order(database: Any, order_id: str, customer_uid: str) -> Order:
    """Return an owned order, hiding existence from other customers."""

    snapshot = database.collection("orders").document(order_id).get()
    if not snapshot.exists:
        raise AppError(status.HTTP_404_NOT_FOUND, "order_not_found", "Order not found.")

    order = _order_from_snapshot(snapshot)
    if order.customer_uid != customer_uid:
        raise AppError(status.HTTP_404_NOT_FOUND, "order_not_found", "Order not found.")
    return order


def list_orders(database: Any, customer_uid: str) -> list[Order]:
    """List only orders owned by the authenticated customer."""

    query = database.collection("orders").where(
        filter=FieldFilter("customerUid", "==", customer_uid)
    )
    orders = [_order_from_snapshot(snapshot) for snapshot in query.stream()]
    return sorted(orders, key=lambda order: order.order_id, reverse=True)
