"""Auditable user-visible workflow event storage."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from google.cloud.firestore_v1.base_query import FieldFilter

from app.schemas import EventRecord


def log_event(
    database: Any,
    *,
    actor: str,
    action: str,
    outcome: str,
    draft_id: str | None = None,
    case_id: str | None = None,
) -> EventRecord:
    if not draft_id and not case_id:
        raise ValueError("An event must belong to a draft or case.")

    reference = database.collection("events").document()
    event = EventRecord(
        event_id=reference.id,
        draft_id=draft_id,
        case_id=case_id,
        actor=actor,
        action=action,
        outcome=outcome,
        created_at=datetime.now(UTC),
    )
    reference.set(event.model_dump(mode="python", by_alias=True))
    return event


def list_draft_events(database: Any, draft_id: str) -> list[EventRecord]:
    query = (
        database.collection("events")
        .where(filter=FieldFilter("draftId", "==", draft_id))
        .order_by("createdAt")
    )
    events: list[EventRecord] = []
    for snapshot in query.stream():
        data = snapshot.to_dict() or {}
        data.setdefault("eventId", snapshot.id)
        events.append(EventRecord.model_validate(data))
    return events
