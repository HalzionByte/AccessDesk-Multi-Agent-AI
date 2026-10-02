"""Lazy Firebase Admin initialization.

Keeping initialization lazy allows the public health endpoint and unit tests to run
without credentials. Authenticated routes still fail closed when Firebase is not
configured or unavailable.
"""

from __future__ import annotations

from pathlib import Path
from threading import Lock
from typing import Any

import firebase_admin
from firebase_admin import auth, credentials, firestore
from firebase_admin.exceptions import FirebaseError

from app.config import Settings, get_settings


class FirebaseUnavailableError(RuntimeError):
    """Raised when Firebase cannot be safely initialized or contacted."""


_initialization_lock = Lock()


def get_firebase_app(settings: Settings | None = None) -> firebase_admin.App:
    try:
        return firebase_admin.get_app()
    except ValueError:
        pass

    with _initialization_lock:
        try:
            return firebase_admin.get_app()
        except ValueError:
            pass

        active_settings = settings or get_settings()
        if not active_settings.firebase_project_id:
            raise FirebaseUnavailableError("FIREBASE_PROJECT_ID is not configured.")

        credential_path = active_settings.google_application_credentials
        try:
            if credential_path:
                path = Path(credential_path).expanduser().resolve()
                if not path.is_file():
                    raise FirebaseUnavailableError(
                        "GOOGLE_APPLICATION_CREDENTIALS does not reference a readable file."
                    )
                credential = credentials.Certificate(str(path))
            else:
                credential = credentials.ApplicationDefault()

            return firebase_admin.initialize_app(
                credential,
                {"projectId": active_settings.firebase_project_id},
            )
        except FirebaseUnavailableError:
            raise
        except (FirebaseError, OSError, ValueError) as exc:
            raise FirebaseUnavailableError("Firebase initialization failed.") from exc


def decode_firebase_token(token: str) -> dict[str, Any]:
    """Verify a Firebase ID token, including revocation status."""

    return auth.verify_id_token(token, app=get_firebase_app(), check_revoked=True)


def get_firestore_client(settings: Settings | None = None):
    """Return an authenticated Firestore client for the configured project."""

    try:
        return firestore.client(app=get_firebase_app(settings))
    except FirebaseUnavailableError:
        raise
    except Exception as exc:
        raise FirebaseUnavailableError("Firestore is unavailable.") from exc
