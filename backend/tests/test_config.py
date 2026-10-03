import pytest
from pydantic import ValidationError

from app.config import Settings


def test_multiple_explicit_cors_origins_are_supported():
    settings = Settings(
        cors_origin="http://localhost:5173,https://demo.example.com/",
        _env_file=None,
    )

    assert settings.cors_origins == [
        "http://localhost:5173",
        "https://demo.example.com",
    ]


def test_blank_optional_secrets_do_not_prevent_application_startup():
    settings = Settings(
        groq_api_key="",
        seed_user_password="",
        google_application_credentials="",
        _env_file=None,
    )

    assert settings.groq_api_key is None
    assert settings.seed_user_password is None
    assert settings.google_application_credentials is None


@pytest.mark.parametrize("origin", ["*", "localhost:5173", "file:///tmp/app"])
def test_unsafe_or_invalid_cors_origin_is_rejected(origin):
    with pytest.raises(ValidationError):
        Settings(cors_origin=origin, _env_file=None)
