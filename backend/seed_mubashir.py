"""Create one isolated fictional customer and orders for local testing.

Run from backend/ with ``python seed_mubashir.py --confirm-project PROJECT_ID``.
Existing users and orders are never deleted or reassigned.
"""

from __future__ import annotations

import argparse
from datetime import UTC, datetime, timedelta
from typing import Any

from firebase_admin import auth, firestore
from firebase_admin.auth import UserNotFoundError

from app.config import Settings, get_settings
from app.firebase import (
    FirebaseUnavailableError,
    get_firebase_app,
    get_firestore_client,
)

SAMPLE_UID = "demo-customer-mubashir"
SAMPLE_EMAIL = "mubashir@demo.accessdesk.app"
SAMPLE_NAME = "Mubashir"
ORDER_SPECS = (
    ("AD-MUB-1001", "Wireless headphones", "Delivered", 1),
    ("AD-MUB-1002", "Mechanical keyboard", "Delivered", 4),
    ("AD-MUB-1003", "Bluetooth speaker", "Delivered", 10),
    ("AD-MUB-1004", "USB-C charger", "Shipped", None),
)


def build_sample_orders(now: datetime | None = None) -> list[dict[str, Any]]:
    current = now or datetime.now(UTC)
    return [
        {
            "orderId": order_id,
            "customerUid": SAMPLE_UID,
            "product": product,
            "qty": 1,
            "deliveredAt": current - timedelta(days=days) if days is not None else None,
            "status": status,
            "fictional": True,
        }
        for order_id, product, status, days in ORDER_SPECS
    ]


def existing_user_by_uid(firebase_app: Any) -> Any | None:
    try:
        return auth.get_user(SAMPLE_UID, app=firebase_app)
    except UserNotFoundError:
        return None


def existing_user_by_email(firebase_app: Any) -> Any | None:
    try:
        return auth.get_user_by_email(SAMPLE_EMAIL, app=firebase_app)
    except UserNotFoundError:
        return None


def seed_sample(settings: Settings, *, create: bool) -> tuple[bool, int]:
    if not settings.firebase_project_id:
        raise ValueError("FIREBASE_PROJECT_ID is not configured.")
    firebase_app = get_firebase_app(settings)
    database = get_firestore_client(settings)
    by_uid = existing_user_by_uid(firebase_app)
    by_email = existing_user_by_email(firebase_app)
    if by_uid is not None and by_uid.email != SAMPLE_EMAIL:
        raise ValueError(
            "The sample UID belongs to another account; nothing was changed."
        )
    if by_email is not None and by_email.uid != SAMPLE_UID:
        raise ValueError(
            "The sample email belongs to another account; nothing was changed."
        )
    if by_uid is not None and (by_uid.custom_claims or {}).get("role") not in (
        None,
        "customer",
    ):
        raise ValueError(
            "The sample account has a non-customer role; nothing was changed."
        )

    user_ref = database.collection("users").document(SAMPLE_UID)
    user_snapshot = user_ref.get()
    if user_snapshot.exists:
        stored = user_snapshot.to_dict() or {}
        if (
            stored.get("email") != SAMPLE_EMAIL
            or stored.get("role") != "customer"
            or stored.get("fictional") is not True
        ):
            raise ValueError(
                "The sample profile conflicts with existing data; nothing was changed."
            )

    order_snapshots = [
        database.collection("orders").document(spec[0]).get() for spec in ORDER_SPECS
    ]
    for snapshot in order_snapshots:
        if snapshot.exists:
            stored = snapshot.to_dict() or {}
            if (
                stored.get("customerUid") != SAMPLE_UID
                or stored.get("fictional") is not True
            ):
                raise ValueError(
                    "A sample order ID conflicts with existing data; nothing was changed."
                )

    existing_count = sum(snapshot.exists for snapshot in order_snapshots)
    if not create:
        return by_uid is not None, existing_count
    password = settings.seed_user_password
    if password is None:
        raise ValueError(
            "SEED_USER_PASSWORD must be configured for the sample account."
        )

    if by_uid is None:
        auth.create_user(
            uid=SAMPLE_UID,
            email=SAMPLE_EMAIL,
            password=password.get_secret_value(),
            display_name=SAMPLE_NAME,
            email_verified=True,
            app=firebase_app,
        )
    elif not by_uid.email_verified or by_uid.display_name != SAMPLE_NAME:
        auth.update_user(
            SAMPLE_UID,
            display_name=SAMPLE_NAME,
            email_verified=True,
            app=firebase_app,
        )

    claims = dict(by_uid.custom_claims or {}) if by_uid is not None else {}
    claims.update({"role": "customer", "preferredLanguage": "en"})
    auth.set_custom_user_claims(SAMPLE_UID, claims, app=firebase_app)

    if not user_snapshot.exists:
        user_ref.create(
            {
                "uid": SAMPLE_UID,
                "name": SAMPLE_NAME,
                "displayName": SAMPLE_NAME,
                "email": SAMPLE_EMAIL,
                "photoURL": None,
                "providers": ["password"],
                "emailVerified": True,
                "role": "customer",
                "preferredLanguage": "en",
                "fictional": True,
                "createdAt": firestore.SERVER_TIMESTAMP,
                "updatedAt": firestore.SERVER_TIMESTAMP,
                "lastLoginAt": firestore.SERVER_TIMESTAMP,
            }
        )

    for order, snapshot in zip(build_sample_orders(), order_snapshots, strict=True):
        if not snapshot.exists:
            database.collection("orders").document(order["orderId"]).create(order)

    return True, len(ORDER_SPECS)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-project", required=True)
    parser.add_argument("--check", action="store_true", help="Inspect without writing.")
    args = parser.parse_args()
    settings = get_settings()
    if args.confirm_project != settings.firebase_project_id:
        raise SystemExit("--confirm-project must exactly match FIREBASE_PROJECT_ID.")
    try:
        account_exists, order_count = seed_sample(settings, create=not args.check)
    except (FirebaseUnavailableError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
    action = "Found" if args.check else "Ready"
    print(
        f"{action}: {SAMPLE_EMAIL}; account exists: {account_exists}; "
        f"fictional orders: {order_count}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
