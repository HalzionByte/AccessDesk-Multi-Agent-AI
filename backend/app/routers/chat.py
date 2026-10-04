"""Authenticated customer chat endpoint."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.agents.flow import run_chat
from app.auth import CustomerUser
from app.config import Settings, get_settings
from app.firebase import get_database
from app.schemas import ChatRequest, ChatResponse

router = APIRouter(tags=["chat"])
Database = Annotated[Any, Depends(get_database)]
AppSettings = Annotated[Settings, Depends(get_settings)]


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    user: CustomerUser,
    database: Database,
    settings: AppSettings,
) -> ChatResponse:
    return run_chat(database, settings, user, payload)
