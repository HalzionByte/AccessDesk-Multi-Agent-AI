"""Authorized evidence download route."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from app.auth import CurrentUser
from app.config import Settings, get_settings
from app.firebase import get_database
from app.services.attachments import get_attachment_for_download

router = APIRouter(prefix="/files", tags=["files"])
Database = Annotated[Any, Depends(get_database)]
AppSettings = Annotated[Settings, Depends(get_settings)]


@router.get("/{attachment_id}", response_class=FileResponse)
def download_attachment(
    attachment_id: str,
    user: CurrentUser,
    database: Database,
    settings: AppSettings,
) -> FileResponse:
    attachment, path = get_attachment_for_download(
        database,
        settings,
        attachment_id=attachment_id,
        user=user,
    )
    return FileResponse(path, media_type=attachment.mime, filename=attachment.filename)
