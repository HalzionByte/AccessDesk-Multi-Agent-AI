"""Create deterministic fictional demo users and orders in Firebase.

Usage from the backend directory:
    python seed.py --reset --confirm-project YOUR_FIREBASE_PROJECT_ID
"""

from __future__ import annotations

import argparse
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from firebase_admin import auth
from firebase_admin.auth import UserNotFoundError

from app.config import Settings, get_settings
from app.firebase import (
    FirebaseUnavailableError,
    get_firebase_app,
    get_firestore_client,
)


@dataclass(frozen=True)
class DemoUser:
    uid: str
    name: str
    email: str
    role: str
    preferred_language: str


DEMO_USERS = (
    DemoUser(
        "demo-customer-1",
        "Ayesha Khan",
        "ayesha@demo.accessdesk.app",
        "customer",
        "roman-urdu",
    ),
    DemoUser(
        "demo-customer-2", "Daniel Lee", "daniel@demo.accessdesk.app", "customer", "en"
    ),
    DemoUser(
        "demo-customer-3",
        "Sara Ahmed",
        "sara@demo.accessdesk.app",
        "customer",
        "roman-urdu",
    ),
    DemoUser(
        "demo-staff-1", "Omar Siddiqui", "staff@demo.accessdesk.app", "staff", "en"
    ),
)

PRODUCTS = (
    "Wireless headphones",
    "Mechanical keyboard",
    "USB-C charger",
    "Smart watch",
    "Bluetooth speaker",
    "Wireless mouse",
    "Web camera",
    "Power bank",
    "USB-C hub",
    "Gaming headset",
)

APPLICATION_COLLECTIONS = (
    "users",
    "orders",
    "drafts",
    "cases",
    "attachments",
    "events",
    "case_locks",
    "submissions",
    "counters",
)


def build_demo_orders(now: datetime | None = None) -> list[dict[str, Any]]:
    """Build 20 deterministic orders with varied policy-relevant states."""

    current_time = now or datetime.now(UTC)
    customer_uids = [user.uid for user in DEMO_USERS if user.role == "customer"]
    orders: list[dict[str, Any]] = []

    # 10 delivered within seven days, 6 older deliveries, and 4 not delivered.
    states: list[tuple[str, int | None]] = [
        *(("Delivered", days) for days in (1, 2, 3, 4, 5, 6, 7, 2, 4, 6)),
        *(("Delivered", days) for days in (8, 10, 14, 21, 30, 45)),
        ("Processing", None),
        ("Shipped", None),
        ("Processing", None),
        ("Shipped", None),
    ]

    for index, (status, days_since_delivery) in enumerate(states, start=1):
        delivered_at = (
            current_time - timedelta(days=days_since_delivery)
            if days_since_delivery is not None
            else None
        )
        orders.append(
            {
                "orderId": f"AD-ORD-{1000 + index}",
                "customerUid": customer_uids[(index - 1) % len(customer_uids)],
                "product": PRODUCTS[(index - 1) % len(PRODUCTS)],
                "qty": 2 if index in {5, 15} else 1,
                "deliveredAt": delivered_at,
                "status": status,
                "fictional": True,
            }
        )
    return orders


def _delete_documents(collections: Iterable[str], database) -> None:
    for collection_name in collections:
        for document in database.collection(collection_name).stream():
            recursive_delete = getattr(database, "recursive_delete", None)
            if recursive_delete:
                recursive_delete(document.reference)
            else:
                document.reference.delete()


def _delete_demo_auth_users() -> None:
    for demo_user in DEMO_USERS:
        try:
            auth.delete_user(demo_user.uid, app=get_firebase_app())
        except UserNotFoundError:
            continue


def seed(settings: Settings, *, reset: bool) -> None:
    if not settings.seed_user_password:
        raise ValueError(
            "SEED_USER_PASSWORD must be set and contain at least 8 characters."
        )

    database = get_firestore_client(settings)
    firebase_app = get_firebase_app(settings)

    if reset:
        _delete_documents(APPLICATION_COLLECTIONS, database)
        _delete_demo_auth_users()

    password = settings.seed_user_password.get_secret_value()
    for demo_user in DEMO_USERS:
        try:
            auth.get_user(demo_user.uid, app=firebase_app)
            auth.update_user(
                demo_user.uid,
                email=demo_user.email,
                password=password,
                display_name=demo_user.name,
                email_verified=True,
                disabled=False,
                app=firebase_app,
            )
        except UserNotFoundError:
            auth.create_user(
                uid=demo_user.uid,
                email=demo_user.email,
                password=password,
                display_name=demo_user.name,
                email_verified=True,
                app=firebase_app,
            )

        auth.set_custom_user_claims(
            demo_user.uid,
            {
                "role": demo_user.role,
                "preferredLanguage": demo_user.preferred_language,
            },
            app=firebase_app,
        )
        database.collection("users").document(demo_user.uid).set(
            {
                "name": demo_user.name,
                "email": demo_user.email,
                "role": demo_user.role,
                "preferredLanguage": demo_user.preferred_language,
                "fictional": True,
            }
        )

    for order in build_demo_orders():
        database.collection("orders").document(order["orderId"]).set(order)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed fictional AccessDesk demo data.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete all AccessDesk application documents and recreate demo data.",
    )
    parser.add_argument(
        "--confirm-project",
        required=True,
        help="Must exactly match FIREBASE_PROJECT_ID to prevent accidental writes.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    settings = get_settings()
    if not settings.firebase_project_id:
        raise SystemExit("FIREBASE_PROJECT_ID is not configured.")
    if args.confirm_project != settings.firebase_project_id:
        raise SystemExit("--confirm-project must exactly match FIREBASE_PROJECT_ID.")

    try:
        seed(settings, reset=args.reset)
    except (FirebaseUnavailableError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc

    print(
        f"Seeded 4 fictional users and 20 fictional orders in {settings.firebase_project_id}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
