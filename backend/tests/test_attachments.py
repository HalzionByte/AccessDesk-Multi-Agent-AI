from __future__ import annotations

from app.services.attachments import MAX_ATTACHMENT_BYTES
from app.services.drafts import create_draft
from tests.auth_helpers import auth_header
from tests.fakes import FakeDocumentReference, FakeTransaction

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"fictional-image-data"


def upload_png(client, draft_id: str, token: str = "customer-token"):
    return client.post(
        f"/drafts/{draft_id}/attachments",
        headers=auth_header(token),
        files={"file": ("damage.png", PNG_BYTES, "image/png")},
    )


def test_customer_can_upload_and_download_valid_evidence(
    client, database, settings, token_decoder
):
    draft = create_draft(database, "demo-customer-1")

    upload_response = upload_png(client, draft.draft_id)

    assert upload_response.status_code == 201
    attachment = upload_response.json()
    assert attachment["filename"] == "damage.png"
    assert attachment["mime"] == "image/png"
    stored_files = list(settings.upload_dir.rglob("*.png"))
    assert len(stored_files) == 1

    download_response = client.get(
        f"/files/{attachment['attachmentId']}",
        headers=auth_header("customer-token"),
    )
    assert download_response.status_code == 200
    assert download_response.content == PNG_BYTES
    assert download_response.headers["content-type"] == "image/png"


def test_upload_starts_transaction_before_reading_draft(
    client, database, token_decoder, monkeypatch
):
    draft = create_draft(database, "demo-customer-1")
    original_get = FakeDocumentReference.get

    def require_started_transaction(reference, transaction=None):
        if transaction is not None and not getattr(transaction, "active", False):
            raise ValueError("Transaction not in progress")
        return original_get(reference, transaction)

    def run_started_transaction(operation):
        transaction = FakeTransaction()
        transaction.active = True
        return operation(transaction)

    monkeypatch.setattr(FakeDocumentReference, "get", require_started_transaction)
    monkeypatch.setattr(database, "run_transaction", run_started_transaction)

    response = upload_png(client, draft.draft_id)

    assert response.status_code == 201
    assert len(database.collection("attachments").stream()) == 1


def test_other_customer_cannot_read_attachment_but_staff_can(
    client, database, token_decoder
):
    draft = create_draft(database, "demo-customer-1")
    attachment_id = upload_png(client, draft.draft_id).json()["attachmentId"]

    denied = client.get(
        f"/files/{attachment_id}",
        headers=auth_header("other-customer-token"),
    )
    staff = client.get(f"/files/{attachment_id}", headers=auth_header("staff-token"))

    assert denied.status_code == 404
    assert staff.status_code == 200
    assert staff.content == PNG_BYTES


def test_upload_rejects_mime_content_mismatch(client, database, token_decoder):
    draft = create_draft(database, "demo-customer-1")

    response = client.post(
        f"/drafts/{draft.draft_id}/attachments",
        headers=auth_header("customer-token"),
        files={"file": ("fake.png", b"not a png", "image/png")},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "invalid_attachment_type"


def test_upload_normalizes_untrusted_filename_extension(
    client, database, token_decoder
):
    draft = create_draft(database, "demo-customer-1")

    response = client.post(
        f"/drafts/{draft.draft_id}/attachments",
        headers=auth_header("customer-token"),
        files={"file": ("../../damage.exe", PNG_BYTES, "image/png")},
    )

    assert response.status_code == 201
    assert response.json()["filename"] == "damage.png"


def test_upload_rejects_files_larger_than_five_megabytes(
    client, database, token_decoder
):
    draft = create_draft(database, "demo-customer-1")
    oversized = b"\x89PNG\r\n\x1a\n" + b"x" * MAX_ATTACHMENT_BYTES

    response = client.post(
        f"/drafts/{draft.draft_id}/attachments",
        headers=auth_header("customer-token"),
        files={"file": ("huge.png", oversized, "image/png")},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "attachment_too_large"


def test_upload_rejects_more_than_three_attachments(client, database, token_decoder):
    draft = create_draft(database, "demo-customer-1")

    responses = [upload_png(client, draft.draft_id) for _ in range(4)]

    assert [response.status_code for response in responses] == [201, 201, 201, 422]
    assert responses[-1].json()["code"] == "attachment_limit"
