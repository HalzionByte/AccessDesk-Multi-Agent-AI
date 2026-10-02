from datetime import UTC, datetime

import pytest
from firebase_admin.auth import UserNotFoundError

import seed as seed_module
from app.config import Settings
from seed import APPLICATION_COLLECTIONS, build_demo_orders


def test_seed_builds_expected_fictional_order_mix():
    orders = build_demo_orders(datetime(2026, 10, 3, tzinfo=UTC))

    delivered = [order for order in orders if order["status"] == "Delivered"]
    not_delivered = [order for order in orders if order["status"] != "Delivered"]
    within_window = [
        order
        for order in delivered
        if (datetime(2026, 10, 3, tzinfo=UTC) - order["deliveredAt"]).days <= 7
    ]
    outside_window = [order for order in delivered if order not in within_window]

    assert len(orders) == 20
    assert len(within_window) == 10
    assert len(outside_window) == 6
    assert len(not_delivered) == 4
    assert all(order["fictional"] is True for order in orders)
    assert len({order["orderId"] for order in orders}) == 20


class FakeDocument:
    def __init__(self, collection: str, document_id: str, writes: list):
        self.collection = collection
        self.document_id = document_id
        self.writes = writes

    def set(self, data):
        self.writes.append((self.collection, self.document_id, data))


class FakeCollection:
    def __init__(self, name: str, database):
        self.name = name
        self.database = database

    def stream(self):
        self.database.reset_collections.append(self.name)
        return []

    def document(self, document_id: str):
        return FakeDocument(self.name, document_id, self.database.writes)


class FakeDatabase:
    def __init__(self):
        self.writes = []
        self.reset_collections = []

    def collection(self, name: str):
        return FakeCollection(name, self)


def test_reset_seed_creates_users_claims_and_orders(monkeypatch):
    database = FakeDatabase()
    firebase_app = object()
    created_users = []
    claims = []

    monkeypatch.setattr(seed_module, "get_firestore_client", lambda _: database)
    monkeypatch.setattr(seed_module, "get_firebase_app", lambda *_: firebase_app)
    monkeypatch.setattr(seed_module, "_delete_demo_auth_users", lambda: None)
    monkeypatch.setattr(
        seed_module.auth,
        "get_user",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(UserNotFoundError("missing")),
    )
    monkeypatch.setattr(
        seed_module.auth,
        "create_user",
        lambda **kwargs: created_users.append(kwargs),
    )
    monkeypatch.setattr(
        seed_module.auth,
        "set_custom_user_claims",
        lambda uid, value, **_kwargs: claims.append((uid, value)),
    )

    settings = Settings(
        firebase_project_id="accessdesk-test",
        seed_user_password="safe-demo-password",
        _env_file=None,
    )
    seed_module.seed(settings, reset=True)

    user_writes = [write for write in database.writes if write[0] == "users"]
    order_writes = [write for write in database.writes if write[0] == "orders"]
    assert database.reset_collections == list(APPLICATION_COLLECTIONS)
    assert len(created_users) == 4
    assert len(user_writes) == 4
    assert len(order_writes) == 20
    assert {value["role"] for _, value in claims} == {"customer", "staff"}
    assert all(write[2]["fictional"] is True for write in order_writes)


def test_seed_rejects_missing_demo_password_before_contacting_firebase():
    settings = Settings(firebase_project_id="accessdesk-test", _env_file=None)

    with pytest.raises(ValueError, match="SEED_USER_PASSWORD"):
        seed_module.seed(settings, reset=False)
