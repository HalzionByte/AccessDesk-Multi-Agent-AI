from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.auth import CustomerUser, StaffUser
from app.config import Settings
from app.main import create_app


@pytest.fixture
def application():
    settings = Settings(
        environment="test",
        firebase_project_id="accessdesk-test",
        cors_origin="http://localhost:5173",
        _env_file=None,
    )
    test_app = create_app(settings)

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
