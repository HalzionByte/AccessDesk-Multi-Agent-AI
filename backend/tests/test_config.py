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


@pytest.mark.parametrize("origin", ["*", "localhost:5173", "file:///tmp/app"])
def test_unsafe_or_invalid_cors_origin_is_rejected(origin):
    with pytest.raises(ValidationError):
        Settings(cors_origin=origin, _env_file=None)
