from __future__ import annotations

from app import auth as auth_module
from app.firebase import FirebaseUnavailableError
from tests.auth_helpers import auth_header


def test_me_returns_customer_profile_and_role(client, token_decoder):
    response = client.get("/me", headers=auth_header("customer-token"))

    assert response.status_code == 200
    assert response.json() == {
        "uid": "demo-customer-1",
        "name": "Ayesha Khan",
        "email": "ayesha@demo.accessdesk.app",
        "role": "customer",
        "preferredLanguage": "roman-urdu",
    }


def test_me_returns_staff_profile_and_role(client, token_decoder):
    response = client.get("/me", headers=auth_header("staff-token"))

    assert response.status_code == 200
    assert response.json()["role"] == "staff"


def test_missing_token_returns_401_in_standard_format(client):
    response = client.get("/me")

    assert response.status_code == 401
    assert response.json() == {
        "code": "authentication_required",
        "message": "A valid Bearer token is required.",
    }


def test_bad_token_returns_401(client, token_decoder):
    response = client.get("/me", headers=auth_header("bad-token"))

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"


def test_firebase_outage_fails_closed_with_503(client, monkeypatch):
    def unavailable(_: str):
        raise FirebaseUnavailableError("offline")

    monkeypatch.setattr(auth_module, "decode_firebase_token", unavailable)

    response = client.get("/me", headers=auth_header("customer-token"))

    assert response.status_code == 503
    assert response.json() == {
        "code": "auth_unavailable",
        "message": "Authentication is temporarily unavailable.",
    }


def test_customer_cannot_access_staff_route(client, token_decoder):
    response = client.get("/_test/staff", headers=auth_header("customer-token"))

    assert response.status_code == 403
    assert response.json()["code"] == "staff_required"


def test_staff_cannot_access_customer_route(client, token_decoder):
    response = client.get("/_test/customer", headers=auth_header("staff-token"))

    assert response.status_code == 403
    assert response.json()["code"] == "customer_required"


def test_token_without_role_is_forbidden(client, monkeypatch):
    monkeypatch.setattr(
        auth_module,
        "decode_firebase_token",
        lambda _: {
            "uid": "unassigned",
            "email": "none@demo.accessdesk.app",
            "name": "None",
        },
    )

    response = client.get("/me", headers=auth_header("valid-but-unassigned"))

    assert response.status_code == 403
    assert response.json()["code"] == "role_required"
