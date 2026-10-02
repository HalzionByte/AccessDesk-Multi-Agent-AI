"""Environment-backed application configuration."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables or a local .env file."""

    model_config = SettingsConfigDict(
        env_file=(PROJECT_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "AccessDesk API"
    environment: Literal["development", "test", "production"] = "development"

    firebase_project_id: str | None = None
    google_application_credentials: Path | None = None
    upload_dir: Path = PROJECT_DIR / "backend" / "uploads"
    cors_origin: str = "http://localhost:5173"

    groq_api_key: SecretStr | None = None
    groq_model: str = "groq/openai/gpt-oss-120b"
    llm_mode: Literal["live", "mock"] = "mock"
    seed_user_password: SecretStr | None = Field(default=None, min_length=8)

    @field_validator("firebase_project_id")
    @classmethod
    def clean_project_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("cors_origin")
    @classmethod
    def validate_cors_origins(cls, value: str) -> str:
        origins = [origin.strip().rstrip("/") for origin in value.split(",")]
        if not all(origins) or "*" in origins:
            raise ValueError("CORS_ORIGIN must contain explicit origins, not '*'.")
        for origin in origins:
            parsed = urlparse(origin)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                raise ValueError(f"Invalid CORS origin: {origin}")
        return ",".join(origins)

    @property
    def cors_origins(self) -> list[str]:
        return self.cors_origin.split(",")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return one immutable-by-convention settings instance per process."""

    return Settings()
