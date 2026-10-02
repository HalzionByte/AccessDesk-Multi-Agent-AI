"""AccessDesk FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.errors import register_error_handlers
from app.routers.drafts import router as drafts_router
from app.routers.files import router as files_router
from app.routers.identity import router as identity_router
from app.routers.orders import router as orders_router
from app.schemas import HealthResponse


def create_app(settings: Settings | None = None) -> FastAPI:
    active_settings = settings or get_settings()
    application = FastAPI(
        title=active_settings.app_name,
        version="0.1.0",
        description="Secure customer-support workflow API for fictional demo data.",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=active_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    )
    register_error_handlers(application)
    application.include_router(identity_router)
    application.include_router(orders_router)
    application.include_router(drafts_router)
    application.include_router(files_router)

    @application.get("/health", response_model=HealthResponse, tags=["system"])
    def health() -> HealthResponse:
        return HealthResponse(service=active_settings.app_name)

    return application


app = create_app()
