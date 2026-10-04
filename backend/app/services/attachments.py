"""Validated local attachment storage with Firestore authorization metadata."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import anyio
from fastapi import UploadFile, status
from pydantic import ValidationError

from app.config import Settings
from app.errors import AppError
from app.schemas import Attachment, AttachmentView, AuthenticatedUser, UserRole
from app.services.drafts import get_draft

MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
MAX_ATTACHMENTS_PER_DRAFT = 3
READ_SIZE = MAX_ATTACHMENT_BYTES + 1

MIME_SIGNATURES: tuple[tuple[str, str, bytes], ...] = (
    ("image/jpeg", ".jpg", b"\xff\xd8\xff"),
    ("image/png", ".png", b"\x89PNG\r\n\x1a\n"),
    ("application/pdf", ".pdf", b"%PDF-"),
)


def _detect_type(content: bytes) -> tuple[str, str] | None:
    for mime, extension, signature in MIME_SIGNATURES:
        if content.startswith(signature):
            return mime, extension
    return None


def _safe_filename(filename: str | None, extension: str) -> str:
    candidate = Path(filename or f"attachment{extension}").name
    stem = re.sub(r"[^A-Za-z0-9 _-]", "_", Path(candidate).stem).strip(" .")
    return f"{(stem or 'attachment')[:190]}{extension}"


def _write_exclusive(path: Path, content: bytes) -> None:
    with path.open("xb") as output:
        output.write(content)


def _attachment_from_snapshot(snapshot: Any) -> Attachment:
    data = snapshot.to_dict() or {}
    data.setdefault("attachmentId", snapshot.id)
    try:
        return Attachment.model_validate(data)
    except ValidationError as exc:
        raise AppError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "attachment_data_invalid",
            "Attachment metadata is temporarily unavailable.",
        ) from exc


def _view(attachment: Attachment) -> AttachmentView:
    return AttachmentView(
        attachment_id=attachment.attachment_id,
        filename=attachment.filename,
        mime=attachment.mime,
        size=attachment.size,
    )


def list_draft_attachments(
    database: Any, draft_id: str, customer_uid: str
) -> list[Attachment]:
    """Load attachment metadata referenced by an owned draft."""

    draft = get_draft(database, draft_id, customer_uid)
    attachments: list[Attachment] = []
    for attachment_id in draft.attachment_ids:
        snapshot = database.collection("attachments").document(attachment_id).get()
        if not snapshot.exists:
            continue
        attachment = _attachment_from_snapshot(snapshot)
        if attachment.owner_uid != customer_uid or attachment.draft_id != draft_id:
            raise AppError(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "attachment_data_invalid",
                "Attachment metadata is temporarily unavailable.",
            )
        attachments.append(attachment)
    return attachments


async def save_attachment(
    database: Any,
    settings: Settings,
    *,
    draft_id: str,
    customer_uid: str,
    upload: UploadFile,
) -> AttachmentView:
    draft = get_draft(database, draft_id, customer_uid)
    if len(draft.attachment_ids) >= MAX_ATTACHMENTS_PER_DRAFT:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "attachment_limit",
            "A draft can contain at most three attachments.",
        )

    try:
        content = await upload.read(READ_SIZE)
    finally:
        await upload.close()

    if not content:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "invalid_attachment",
            "The attachment is empty.",
        )
    if len(content) > MAX_ATTACHMENT_BYTES:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "attachment_too_large",
            "Attachments must be 5 MB or smaller.",
        )

    detected = _detect_type(content)
    supplied_mime = (upload.content_type or "").split(";", maxsplit=1)[0].lower()
    if detected is None or supplied_mime != detected[0]:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "invalid_attachment_type",
            "Only JPG, PNG, and PDF attachments are allowed.",
        )

    mime, extension = detected
    attachment_reference = database.collection("attachments").document()
    stored_relative_path = Path(draft_id) / f"{attachment_reference.id}{extension}"
    destination = settings.upload_dir / stored_relative_path
    original_filename = _safe_filename(upload.filename, extension)

    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        await anyio.to_thread.run_sync(_write_exclusive, destination, content)

        transaction = database.transaction()
        draft_reference = database.collection("drafts").document(draft_id)
        current_snapshot = draft_reference.get(transaction=transaction)
        if not current_snapshot.exists:
            raise AppError(
                status.HTTP_404_NOT_FOUND, "draft_not_found", "Draft not found."
            )
        current = current_snapshot.to_dict() or {}
        if current.get("customerUid") != customer_uid:
            raise AppError(
                status.HTTP_404_NOT_FOUND, "draft_not_found", "Draft not found."
            )
        attachment_ids = list(current.get("attachmentIds", []))
        if len(attachment_ids) >= MAX_ATTACHMENTS_PER_DRAFT:
            raise AppError(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "attachment_limit",
                "A draft can contain at most three attachments.",
            )

        attachment = Attachment(
            attachment_id=attachment_reference.id,
            owner_uid=customer_uid,
            draft_id=draft_id,
            path=stored_relative_path.as_posix(),
            filename=original_filename,
            mime=mime,
            size=len(content),
        )
        attachment_ids.append(attachment.attachment_id)
        transaction.set(
            attachment_reference,
            attachment.model_dump(mode="python", by_alias=True),
        )
        transaction.update(draft_reference, {"attachmentIds": attachment_ids})
        transaction.commit()
        return _view(attachment)
    except AppError:
        destination.unlink(missing_ok=True)
        raise
    except Exception as exc:
        destination.unlink(missing_ok=True)
        raise AppError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "attachment_storage_unavailable",
            "The attachment could not be stored. Please retry.",
        ) from exc


def get_attachment_for_download(
    database: Any,
    settings: Settings,
    *,
    attachment_id: str,
    user: AuthenticatedUser,
) -> tuple[Attachment, Path]:
    snapshot = database.collection("attachments").document(attachment_id).get()
    if not snapshot.exists:
        raise AppError(status.HTTP_404_NOT_FOUND, "file_not_found", "File not found.")

    attachment = _attachment_from_snapshot(snapshot)
    if user.role != UserRole.STAFF and attachment.owner_uid != user.uid:
        raise AppError(status.HTTP_404_NOT_FOUND, "file_not_found", "File not found.")

    upload_root = settings.upload_dir.resolve()
    path = (upload_root / attachment.path).resolve()
    if not path.is_relative_to(upload_root) or not path.is_file():
        raise AppError(status.HTTP_404_NOT_FOUND, "file_not_found", "File not found.")
    return attachment, path
