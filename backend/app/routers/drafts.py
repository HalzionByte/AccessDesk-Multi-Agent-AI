"""Customer draft and evidence routes."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.auth import CustomerUser
from app.config import Settings, get_settings
from app.firebase import get_database
from app.schemas import AttachmentView, Draft
from app.services.attachments import save_attachment
from app.services.drafts import get_draft

router = APIRouter(prefix="/drafts", tags=["drafts"])
Database = Annotated[Any, Depends(get_database)]
AppSettings = Annotated[Settings, Depends(get_settings)]


@router.get("/{draft_id}", response_model=Draft)
def get_own_draft(draft_id: str, user: CustomerUser, database: Database) -> Draft:
    return get_draft(database, draft_id, user.uid)


@router.post(
    "/{draft_id}/attachments",
    response_model=AttachmentView,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    draft_id: str,
    user: CustomerUser,
    database: Database,
    settings: AppSettings,
    file: Annotated[UploadFile, File(description="JPG, PNG, or PDF; maximum 5 MB")],
) -> AttachmentView:
    return await save_attachment(
        database,
        settings,
        draft_id=draft_id,
        customer_uid=user.uid,
        upload=file,
    )
