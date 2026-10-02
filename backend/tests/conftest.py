from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import auth as auth_module
from app.auth import CustomerUser, StaffUser
from app.config import Settings, get_settings
from app.firebase import get_database
from app.main import create_app
from tests.auth_helpers import (
    CUSTOMER_CLAIMS,
    OTHER_CUSTOMER_CLAIMS,
    STAFF_CLAIMS,
)
from tests.fakes import FakeFirestore


@pytest.fixture
def settings(tmp_path):
    return Settings(
        environment="test",
        firebase_project_id="accessdesk-test",
        upload_dir=tmp_path / "uploads",
        cors_origin="http://localhost:5173",
        _env_file=None,
    )


@pytest.fixture
def database():
    return FakeFirestore()


@pytest.fixture
def token_decoder(monkeypatch):
    def fake_decode(token: str):
        claims_by_token = {
            "customer-token": CUSTOMER_CLAIMS,
            "staff-token": STAFF_CLAIMS,
            "other-customer-token": OTHER_CUSTOMER_CLAIMS,
        }
        if token not in claims_by_token:
            raise ValueError("invalid token")
        return claims_by_token[token]

    monkeypatch.setattr(auth_module, "decode_firebase_token", fake_decode)


@pytest.fixture
def application(settings, database):
    test_app = create_app(settings)
    test_app.dependency_overrides[get_database] = lambda: database
    test_app.dependency_overrides[get_settings] = lambda: settings

    @test_app.get("/_test/customer")
    def customer_only(user: CustomerUser):
        return {"uid": user.uid}

    @test_app.get("/_test/staff")
    def staff_only(user: StaffUser):
        return {"uid": user.uid}

    return test_app


@pytest.fixture
def client(application):
    with TestClient(application, raise_server_exceptions=False) as test_client:
        yield test_client
