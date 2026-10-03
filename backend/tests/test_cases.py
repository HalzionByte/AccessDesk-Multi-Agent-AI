from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import pytest

from app.errors import AppError
from app.schemas import CaseStatus
from app.services.cases import (
    STAFF_TRANSITIONS,
    create_support_case,
    find_existing_case,
    get_case,
    validate_staff_transition,
)
from app.services.drafts import create_draft, get_draft, update_draft_fields
from tests.auth_helpers import auth_header
from tests.case_helpers import build_case, build_complete_draft


def test_confirmed_submit_creates_committed_case_and_tracking_number(
    client, database, token_decoder
):
    draft = build_complete_draft(database)

    response = client.post(
        f"/drafts/{draft.draft_id}/submit",
        headers=auth_header("customer-token"),
        json={"idempotencyKey": "request-0001", "confirmed": True},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["trackingNo"].startswith("AD-")
    assert body["status"] == "Submitted"
    assert body["fictional"] is True
    assert len(database.collection("cases").stream()) == 1
    assert (
        get_draft(database, draft.draft_id, draft.customer_uid).stage.value
        == "SUBMITTED"
    )
    attachment_id = draft.attachment_ids[0]
    assert (database.collection("attachments").document(attachment_id).get().to_dict())[
        "caseId"
    ] == body["caseId"]

    detail = client.get(
        f"/cases/{body['caseId']}", headers=auth_header("customer-token")
    )
    assert detail.status_code == 200
    assert detail.json()["events"][0]["action"] == "created case"
    assert detail.json()["attachments"][0]["filename"] == "damage.png"


def test_submit_without_confirmation_is_rejected_without_writes(
    client, database, token_decoder
):
    draft = build_complete_draft(database)

    response = client.post(
        f"/drafts/{draft.draft_id}/submit",
        headers=auth_header("customer-token"),
        json={"idempotencyKey": "request-0002", "confirmed": False},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "confirmation_required"
    assert len(database.collection("cases").stream()) == 0


def test_submit_rejects_non_boolean_confirmation(client, database, token_decoder):
    draft = build_complete_draft(database)

    response = client.post(
        f"/drafts/{draft.draft_id}/submit",
        headers=auth_header("customer-token"),
        json={"idempotencyKey": "request-boolean", "confirmed": "true"},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert len(database.collection("cases").stream()) == 0


def test_incomplete_submit_is_rejected(client, database, token_decoder):
    draft = create_draft(database, "demo-customer-1")
    update_draft_fields(
        database,
        draft.draft_id,
        draft.customer_uid,
        {"description": "too short"},
    )

    response = client.post(
        f"/drafts/{draft.draft_id}/submit",
        headers=auth_header("customer-token"),
        json={"idempotencyKey": "request-0003", "confirmed": True},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "incomplete_request"
    assert len(database.collection("cases").stream()) == 0


def test_same_idempotency_key_returns_same_case(database):
    draft = build_complete_draft(database)

    first = create_support_case(database, draft, "same-request", True)
    second = create_support_case(database, draft, "same-request", True)

    assert first.case_id == second.case_id
    assert len(database.collection("cases").stream()) == 1


def test_new_draft_for_same_order_and_issue_returns_existing_case(database):
    first_draft = build_complete_draft(database)
    first = create_support_case(database, first_draft, "request-first", True)
    second_draft = build_complete_draft(database)

    second = create_support_case(database, second_draft, "request-second", True)

    assert second.case_id == first.case_id
    assert (
        get_draft(
            database, second_draft.draft_id, second_draft.customer_uid
        ).stage.value
        == "SUBMITTED"
    )
    assert (
        find_existing_case(database, first.order_id, first.issue_type).case_id
        == first.case_id
    )
    assert len(database.collection("cases").stream()) == 1


def test_ten_simultaneous_identical_submits_create_exactly_one_case(database):
    draft = build_complete_draft(database)

    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(
            pool.map(
                lambda _: create_support_case(
                    database, draft, "concurrent-request", True
                ),
                range(10),
            )
        )

    assert len({result.case_id for result in results}) == 1
    assert len(database.collection("cases").stream()) == 1
    assert (database.collection("counters").document("cases").get().to_dict())[
        "value"
    ] == 1


def test_customer_case_routes_enforce_ownership(client, database, token_decoder):
    own_case = build_case(database, idempotency_key="own-request")
    other_case = build_case(
        database,
        idempotency_key="other-request",
        customer_uid="demo-customer-2",
        order_id="AD-ORD-2001",
    )

    listing = client.get("/cases", headers=auth_header("customer-token"))
    denied = client.get(
        f"/cases/{other_case.case_id}", headers=auth_header("customer-token")
    )

    assert listing.status_code == 200
    assert [item["caseId"] for item in listing.json()] == [own_case.case_id]
    assert denied.status_code == 404


def test_customer_cannot_call_staff_case_routes(client, database, token_decoder):
    case = build_case(database)

    response = client.patch(
        f"/staff/cases/{case.case_id}/status",
        headers=auth_header("customer-token"),
        json={"status": "Under Review"},
    )

    assert response.status_code == 403
    assert response.json()["code"] == "staff_required"


def test_every_illegal_staff_transition_is_rejected():
    statuses = list(CaseStatus)
    for current in statuses:
        allowed = STAFF_TRANSITIONS.get(current, frozenset())
        for target in statuses:
            if target in allowed:
                validate_staff_transition(current, target)
            else:
                with pytest.raises(AppError) as error:
                    validate_staff_transition(current, target)
                assert error.value.status_code == 409


def test_staff_and_customer_complete_valid_case_lifecycle(
    client, database, token_decoder
):
    case = build_case(database)
    staff_headers = auth_header("staff-token")
    customer_headers = auth_header("customer-token")

    under_review = client.patch(
        f"/staff/cases/{case.case_id}/status",
        headers=staff_headers,
        json={"status": "Under Review"},
    )
    missing_text = client.patch(
        f"/staff/cases/{case.case_id}/status",
        headers=staff_headers,
        json={"status": "Needs Information"},
    )
    needs_information = client.patch(
        f"/staff/cases/{case.case_id}/status",
        headers=staff_headers,
        json={
            "status": "Needs Information",
            "infoRequest": "Please send a photo of the serial number.",
        },
    )
    wrong_customer = client.post(
        f"/cases/{case.case_id}/reply",
        headers=auth_header("other-customer-token"),
        json={"message": "Not my case."},
    )
    reply = client.post(
        f"/cases/{case.case_id}/reply",
        headers=customer_headers,
        json={"message": "The serial number is AD-DEMO-123."},
    )
    approved = client.patch(
        f"/staff/cases/{case.case_id}/status",
        headers=staff_headers,
        json={"status": "Approved", "note": "Evidence verified."},
    )
    closed = client.patch(
        f"/staff/cases/{case.case_id}/status",
        headers=staff_headers,
        json={"status": "Closed"},
    )

    assert under_review.status_code == 200
    assert missing_text.status_code == 422
    assert needs_information.json()["status"] == "Needs Information"
    assert wrong_customer.status_code == 404
    assert reply.json()["status"] == "Under Review"
    assert approved.json()["status"] == "Approved"
    assert closed.json()["status"] == "Closed"
    assert find_existing_case(database, case.order_id, case.issue_type) is None
    assert get_case(database, case.case_id).status == CaseStatus.CLOSED
    reply_documents = (
        database.collection("cases")
        .document(case.case_id)
        .collection("replies")
        .stream()
    )
    assert len(reply_documents) == 1


def test_illegal_route_transition_returns_409(client, database, token_decoder):
    case = build_case(database)

    response = client.patch(
        f"/staff/cases/{case.case_id}/status",
        headers=auth_header("staff-token"),
        json={"status": "Approved"},
    )

    assert response.status_code == 409
    assert response.json()["code"] == "invalid_status_transition"


def test_declining_case_releases_duplicate_lock(client, database, token_decoder):
    case = build_case(database)
    headers = auth_header("staff-token")
    client.patch(
        f"/staff/cases/{case.case_id}/status",
        headers=headers,
        json={"status": "Under Review"},
    )

    response = client.patch(
        f"/staff/cases/{case.case_id}/status",
        headers=headers,
        json={"status": "Declined", "note": "Evidence did not match the order."},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "Declined"
    assert find_existing_case(database, case.order_id, case.issue_type) is None


def test_staff_can_filter_cases_by_status(client, database, token_decoder):
    submitted = build_case(database, idempotency_key="submitted-case")
    build_case(
        database,
        idempotency_key="second-case",
        order_id="AD-ORD-1002",
        issue_type="wrong item",
    )

    response = client.get(
        "/staff/cases?status=Submitted", headers=auth_header("staff-token")
    )

    assert response.status_code == 200
    assert submitted.case_id in {item["caseId"] for item in response.json()}

    detail = client.get(
        f"/staff/cases/{submitted.case_id}", headers=auth_header("staff-token")
    )
    assert detail.status_code == 200
    assert detail.json()["events"][0]["action"] == "created case"
