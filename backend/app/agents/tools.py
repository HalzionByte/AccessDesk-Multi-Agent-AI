"""Scoped service wrappers exposed to each logical agent.

The live workflow uses the PRD's safer JSON-output/code-run-tools fallback. These
wrappers therefore execute in trusted application code, never from model-supplied
customer IDs or confirmation state.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from fastapi import status

from app.errors import AppError
from app.schemas import DraftFields, DraftStage
from app.services.attachments import list_draft_attachments
from app.services.cases import create_support_case, find_existing_case, get_case_status
from app.services.checker import check_request_completeness
from app.services.drafts import get_draft, save_draft_progress
from app.services.events import log_event
from app.services.orders import get_order
from app.services.policy import search_policy

AGENT_TOOL_PERMISSIONS: dict[str, frozenset[str]] = {
    "intake": frozenset({"get_order_details", "save_request_draft"}),
    "policy": frozenset({"search_policy", "check_request_completeness"}),
    "resolution": frozenset(
        {"find_existing_case", "create_support_case", "get_case_status", "log_event"}
    ),
}


@dataclass(frozen=True)
class ScopedTool:
    name: str
    description: str
    invoke: Callable[..., object]


@dataclass
class AgentToolbox:
    database: Any
    customer_uid: str
    backend_confirmed: bool = False

    def get_order_details(self, order_id: str) -> object:
        return get_order(self.database, order_id, self.customer_uid)

    def save_request_draft(
        self,
        draft_id: str,
        fields: DraftFields,
        order_id: str | None,
        stage: DraftStage,
        missing: list[str],
        policy_refs: list[str],
        summary: str | None,
    ) -> object:
        return save_draft_progress(
            self.database,
            draft_id,
            self.customer_uid,
            fields=fields,
            order_id=order_id,
            stage=stage,
            missing=missing,
            policy_refs=policy_refs,
            summary=summary,
        )

    def search_policy(self, query: str) -> object:
        return search_policy(query)

    def check_request_completeness(self, draft_id: str) -> object:
        draft = get_draft(self.database, draft_id, self.customer_uid)
        order = (
            get_order(self.database, draft.order_id, self.customer_uid)
            if draft.order_id
            else None
        )
        images = {
            item.attachment_id
            for item in list_draft_attachments(
                self.database, draft.draft_id, self.customer_uid
            )
            if item.mime.startswith("image/")
        }
        return check_request_completeness(draft, order, image_attachment_ids=images)

    def find_existing_case(self, order_id: str, issue_type: str) -> object:
        # Ownership is proven before disclosing any existing case.
        get_order(self.database, order_id, self.customer_uid)
        case = find_existing_case(self.database, order_id, issue_type)
        if case is not None and case.customer_uid != self.customer_uid:
            return None
        return case

    def create_support_case(
        self, draft_id: str, idempotency_key: str, confirmed: bool
    ) -> object:
        if not self.backend_confirmed or not confirmed:
            raise AppError(
                status.HTTP_403_FORBIDDEN,
                "agent_confirmation_forbidden",
                "Only a backend-confirmed customer action can create a case.",
            )
        draft = get_draft(self.database, draft_id, self.customer_uid)
        return create_support_case(self.database, draft, idempotency_key, True)

    def get_case_status(self, case_id: str) -> object:
        return get_case_status(self.database, case_id, self.customer_uid)

    def log_event(
        self, actor: str, action: str, outcome: str, draft_id: str | None = None
    ) -> object:
        if not draft_id:
            raise ValueError("Agent events must belong to the active draft.")
        get_draft(self.database, draft_id, self.customer_uid)
        return log_event(
            self.database,
            actor=actor,
            action=action,
            outcome=outcome,
            draft_id=draft_id,
        )

    def for_agent(self, agent_name: str) -> list[ScopedTool]:
        permissions = AGENT_TOOL_PERMISSIONS.get(agent_name)
        if permissions is None:
            raise ValueError(f"Unknown agent: {agent_name}")
        descriptions = {
            "get_order_details": "Load an owned order.",
            "save_request_draft": "Persist validated draft progress.",
            "search_policy": "Search the local fictional policy.",
            "check_request_completeness": "Check deterministic request requirements.",
            "find_existing_case": "Find an owned duplicate case.",
            "create_support_case": "Create only after backend-confirmed customer action.",
            "get_case_status": "Load an owned case status.",
            "log_event": "Write an owned draft workflow event.",
        }
        return [
            ScopedTool(name, descriptions[name], getattr(self, name))
            for name in sorted(permissions)
        ]
