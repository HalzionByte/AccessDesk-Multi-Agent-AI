"""Deterministic, durable stage router for the customer support conversation."""

from __future__ import annotations

from typing import Any

from fastapi import status

from app.agents.intake import detect_language, run_intake_agent
from app.agents.policy_agent import run_policy_agent
from app.agents.resolution import run_resolution_agent
from app.config import Settings
from app.errors import AppError
from app.schemas import (
    Attachment,
    AttachmentView,
    AuthenticatedUser,
    ChatRequest,
    ChatResponse,
    ChecklistItem,
    Draft,
    DraftFields,
    DraftStage,
    Event,
    ExistingCase,
    MissingRequirement,
    Order,
    OrderStatus,
    PolicyCitation,
    PreferredLanguage,
    RequestPreview,
)
from app.services.attachments import list_draft_attachments
from app.services.cases import find_existing_case
from app.services.checker import check_request_completeness
from app.services.drafts import (
    add_message,
    create_draft,
    get_draft,
    save_draft_progress,
)
from app.services.events import list_draft_events, log_event
from app.services.orders import get_order, list_orders
from app.services.policy import load_policy_sections, search_policy

CHECKLIST_LABELS = {
    MissingRequirement.ORDER: "Order selected",
    MissingRequirement.ISSUE_TYPE: "Issue identified",
    MissingRequirement.DESCRIPTION: "Description provided",
    MissingRequirement.IMAGE: "Photo evidence attached",
    MissingRequirement.REQUESTED_RESOLUTION: "Replacement requested",
}


def _language(draft: Draft, user: AuthenticatedUser, current_text: str) -> PreferredLanguage:
    source = draft.fields.customer_statement or current_text
    detected = detect_language(source)
    if detected == PreferredLanguage.ROMAN_URDU:
        return detected
    return user.preferred_language


def _merge_fields(draft: Draft, result: Any, customer_text: str) -> DraftFields:
    return DraftFields(
        issue_type=result.issue_type or draft.fields.issue_type,
        description=result.description or draft.fields.description,
        requested_resolution=result.resolution or draft.fields.requested_resolution,
        customer_statement=draft.fields.customer_statement or customer_text,
    )


def _attachments(database: Any, draft: Draft) -> list[Attachment]:
    return list_draft_attachments(database, draft.draft_id, draft.customer_uid)


def _check(database: Any, draft: Draft, order: Order | None) -> Any:
    image_ids = {
        item.attachment_id
        for item in _attachments(database, draft)
        if item.mime.startswith("image/")
    }
    return check_request_completeness(draft, order, image_attachment_ids=image_ids)


def _citations(ids: list[str]) -> list[PolicyCitation]:
    wanted = set(ids)
    return [item for item in load_policy_sections() if item.id in wanted]


def _events(database: Any, draft_id: str) -> list[Event]:
    return [
        Event(
            event_id=item.event_id,
            draft_id=item.draft_id,
            case_id=item.case_id,
            actor=item.actor,
            action=item.action,
            outcome=item.outcome,
            at=item.created_at,
        )
        for item in list_draft_events(database, draft_id)
    ]


def _checklist(missing: list[str]) -> list[ChecklistItem]:
    missing_set = set(missing)
    return [
        ChecklistItem(
            key=requirement.value,
            label=label,
            done=requirement.value not in missing_set,
        )
        for requirement, label in CHECKLIST_LABELS.items()
    ]


def _existing_view(case: Any | None) -> ExistingCase | None:
    if case is None:
        return None
    return ExistingCase(
        case_id=case.case_id,
        tracking_no=case.tracking_no,
        status=case.status,
    )


def _preview(
    draft: Draft,
    order: Order,
    attachments: list[Attachment],
    summary: str,
    window: str,
) -> RequestPreview:
    fields = draft.fields
    if not all(
        (
            fields.issue_type,
            fields.description,
            fields.customer_statement,
            fields.requested_resolution,
        )
    ):
        raise AppError(
            status.HTTP_409_CONFLICT,
            "draft_not_ready",
            "The draft needs more information before preview.",
        )
    return RequestPreview(
        order_id=order.order_id,
        product=order.product,
        issue=fields.issue_type or "",
        statement=fields.customer_statement or "",
        attachments=[
            AttachmentView(
                attachment_id=item.attachment_id,
                filename=item.filename,
                mime=item.mime,
                size=item.size,
            )
            for item in attachments
        ],
        resolution=fields.requested_resolution or "",
        summary=summary,
        window=(
            "Within the fictional 7-day window"
            if window == "within"
            else "Outside the fictional 7-day window; staff review required"
        ),
    )


def _respond(
    database: Any,
    draft: Draft,
    *,
    language: PreferredLanguage,
    reply: str,
    preview: RequestPreview | None = None,
    existing_case: ExistingCase | None = None,
) -> ChatResponse:
    add_message(
        database,
        draft.draft_id,
        draft.customer_uid,
        actor="assistant",
        text=reply,
    )
    return ChatResponse(
        draft_id=draft.draft_id,
        stage=draft.stage,
        reply=reply,
        language=language,
        fields=draft.fields,
        checklist=_checklist(draft.missing),
        citations=_citations(draft.policy_refs),
        preview=preview,
        existing_case=existing_case,
        events=_events(database, draft.draft_id),
    )


def _save(
    database: Any,
    draft: Draft,
    *,
    fields: DraftFields,
    order_id: str | None,
    stage: DraftStage,
    missing: list[str],
    policy_refs: list[str] | None = None,
    summary: str | None = None,
) -> Draft:
    return save_draft_progress(
        database,
        draft.draft_id,
        draft.customer_uid,
        fields=fields,
        order_id=order_id,
        stage=stage,
        missing=missing,
        policy_refs=draft.policy_refs if policy_refs is None else policy_refs,
        summary=draft.summary if summary is None else summary,
    )


def run_chat(
    database: Any,
    settings: Settings,
    user: AuthenticatedUser,
    payload: ChatRequest,
) -> ChatResponse:
    """Run exactly the agent associated with the persisted current stage."""

    if payload.draft_id:
        draft = get_draft(database, payload.draft_id, user.uid)
        if payload.order_id and draft.order_id and payload.order_id != draft.order_id:
            raise AppError(
                status.HTTP_409_CONFLICT,
                "draft_order_conflict",
                "This draft already belongs to another order.",
            )
    else:
        draft = create_draft(database, user.uid, order_id=payload.order_id)

    add_message(
        database,
        draft.draft_id,
        user.uid,
        actor="customer",
        text=payload.message,
    )
    language = _language(draft, user, payload.message)

    try:
        if draft.stage == DraftStage.INTAKE:
            owned_orders = list_orders(database, user.uid)
            selected = payload.order_id or draft.order_id
            result = run_intake_agent(
                settings,
                payload.message,
                known_order_ids=[item.order_id for item in owned_orders],
                selected_order_id=selected,
            )
            language = result.language
            fields = _merge_fields(draft, result, payload.message)
            order_id = selected or result.order_id
            staged = draft.model_copy(update={"fields": fields, "order_id": order_id})
            order = get_order(database, order_id, user.uid) if order_id else None
            checked = _check(database, staged, order)
            next_stage = DraftStage.POLICY if order else DraftStage.COLLECT
            draft = _save(
                database,
                draft,
                fields=fields,
                order_id=order_id,
                stage=next_stage,
                missing=[item.value for item in checked.missing],
                summary=fields.description,
            )
            log_event(
                database,
                actor="Intake Agent",
                action="collected order details",
                outcome=("Order verified" if order else "More information required"),
                draft_id=draft.draft_id,
            )
            reply = result.follow_up_question or (
                "Order mil gaya. Policy requirements check karne ke liye continue karein."
                if language == PreferredLanguage.ROMAN_URDU
                else "I found your order. Continue so I can check the policy requirements."
            )
            return _respond(database, draft, language=language, reply=reply)

        if draft.stage == DraftStage.POLICY:
            if not draft.order_id:
                raise AppError(
                    status.HTTP_409_CONFLICT,
                    "draft_order_missing",
                    "Select an order before checking policy.",
                )
            order = get_order(database, draft.order_id, user.uid)
            query = " ".join(
                value
                for value in (
                    draft.fields.issue_type,
                    draft.fields.description,
                    draft.fields.requested_resolution,
                    payload.message,
                )
                if value
            )
            passages = search_policy(query)
            policy_result = run_policy_agent(
                settings,
                draft.fields.customer_statement or payload.message,
                language=language,
                passages=passages,
            )
            checked = _check(database, draft, order)
            next_stage = (
                DraftStage.PREVIEW
                if not checked.missing and order.status == OrderStatus.DELIVERED
                else DraftStage.COLLECT
            )
            draft = _save(
                database,
                draft,
                fields=draft.fields,
                order_id=draft.order_id,
                stage=next_stage,
                missing=[item.value for item in checked.missing],
                policy_refs=policy_result.citation_ids,
            )
            log_event(
                database,
                actor="Policy Agent",
                action="retrieved replacement requirements",
                outcome=(
                    "Policy citations verified"
                    if policy_result.citation_ids
                    else "Policy coverage uncertain"
                ),
                draft_id=draft.draft_id,
            )
            if order.status != OrderStatus.DELIVERED:
                follow_up = " This damaged-item request can proceed after the order is delivered."
            elif checked.missing:
                follow_up = f" Please provide: {CHECKLIST_LABELS[checked.missing[0]].lower()}."
            else:
                follow_up = " The required details are complete. Ask me to prepare the preview."
            return _respond(
                database,
                draft,
                language=language,
                reply=policy_result.explanation + follow_up,
            )

        if draft.stage == DraftStage.COLLECT:
            owned_orders = list_orders(database, user.uid)
            selected = payload.order_id or draft.order_id
            result = run_intake_agent(
                settings,
                payload.message,
                known_order_ids=[item.order_id for item in owned_orders],
                selected_order_id=selected,
            )
            language = result.language if draft.fields.customer_statement is None else language
            fields = _merge_fields(draft, result, payload.message)
            order_id = selected or result.order_id
            staged = draft.model_copy(update={"fields": fields, "order_id": order_id})
            order = get_order(database, order_id, user.uid) if order_id else None
            checked = _check(database, staged, order)
            next_stage = (
                DraftStage.PREVIEW
                if not checked.missing
                and order is not None
                and order.status == OrderStatus.DELIVERED
                else DraftStage.COLLECT
            )
            draft = _save(
                database,
                draft,
                fields=fields,
                order_id=order_id,
                stage=next_stage,
                missing=[item.value for item in checked.missing],
                summary=fields.description,
            )
            log_event(
                database,
                actor="Intake Agent",
                action="collected missing details",
                outcome=("Request details complete" if not checked.missing else "More information required"),
                draft_id=draft.draft_id,
            )
            if next_stage == DraftStage.PREVIEW:
                reply = (
                    "Required details mil gaye. Preview banane ke liye continue karein."
                    if language == PreferredLanguage.ROMAN_URDU
                    else "I have the required details. Continue to prepare the preview."
                )
            else:
                reply = result.follow_up_question or (
                    f"Please provide: {CHECKLIST_LABELS[checked.missing[0]].lower()}."
                    if checked.missing
                    else "This request needs staff review before it can proceed."
                )
            return _respond(database, draft, language=language, reply=reply)

        if draft.stage == DraftStage.PREVIEW:
            if not draft.order_id or not draft.fields.issue_type:
                raise AppError(
                    status.HTTP_409_CONFLICT,
                    "draft_not_ready",
                    "The draft needs more information before preview.",
                )
            order = get_order(database, draft.order_id, user.uid)
            checked = _check(database, draft, order)
            if checked.missing:
                draft = _save(
                    database,
                    draft,
                    fields=draft.fields,
                    order_id=draft.order_id,
                    stage=DraftStage.COLLECT,
                    missing=[item.value for item in checked.missing],
                )
                return _respond(
                    database,
                    draft,
                    language=language,
                    reply=f"Please provide: {CHECKLIST_LABELS[checked.missing[0]].lower()}.",
                )
            issue_type = draft.fields.issue_type
            if issue_type is None:  # narrowed above; defensive for type checkers.
                raise AppError(
                    status.HTTP_409_CONFLICT,
                    "draft_not_ready",
                    "The draft needs an issue type before preview.",
                )
            existing = find_existing_case(database, order.order_id, issue_type)
            if existing is not None and existing.customer_uid != user.uid:
                existing = None
            resolution_result = run_resolution_agent(
                settings,
                draft=draft,
                order=order,
                language=language,
                existing_case=existing is not None,
            )
            next_stage = DraftStage.SUBMITTED if existing else DraftStage.AWAIT_CONFIRM
            draft = _save(
                database,
                draft,
                fields=draft.fields,
                order_id=draft.order_id,
                stage=next_stage,
                missing=[],
                summary=resolution_result.summary,
            )
            log_event(
                database,
                actor="Resolution Agent",
                action=("found existing case" if existing else "found no existing case"),
                outcome=(
                    "Existing case returned; no case created"
                    if existing
                    else "Preview prepared; confirmation required"
                ),
                draft_id=draft.draft_id,
            )
            preview = None
            if existing is None:
                preview = _preview(
                    draft,
                    order,
                    _attachments(database, draft),
                    resolution_result.summary,
                    checked.window,
                )
            return _respond(
                database,
                draft,
                language=language,
                reply=resolution_result.next_step,
                preview=preview,
                existing_case=_existing_view(existing),
            )

        if draft.stage == DraftStage.AWAIT_CONFIRM:
            if not draft.order_id:
                raise AppError(status.HTTP_409_CONFLICT, "draft_not_ready", "Draft is not ready.")
            order = get_order(database, draft.order_id, user.uid)
            checked = _check(database, draft, order)
            preview = _preview(
                draft,
                order,
                _attachments(database, draft),
                draft.summary or draft.fields.description or "Support request",
                checked.window,
            )
            return _respond(
                database,
                draft,
                language=language,
                reply="Review the preview and use Confirm and Submit when ready.",
                preview=preview,
            )

        existing = None
        if draft.order_id and draft.fields.issue_type:
            candidate = find_existing_case(
                database, draft.order_id, draft.fields.issue_type
            )
            if candidate is not None and candidate.customer_uid == user.uid:
                existing = candidate
        return _respond(
            database,
            draft,
            language=language,
            reply="This request has already been submitted.",
            existing_case=_existing_view(existing),
        )
    except AppError as exc:
        if exc.code in {"llm_busy", "llm_invalid_response", "llm_unavailable"}:
            log_event(
                database,
                actor="System",
                action="assistant unavailable",
                outcome="Draft preserved for retry",
                draft_id=draft.draft_id,
            )
        raise
