from __future__ import annotations

from datetime import UTC, datetime

from app.schemas import DraftFields
from app.services.cases import create_support_case
from app.services.drafts import create_draft, get_draft, update_draft_fields


def build_complete_draft(
    database,
    *,
    customer_uid: str = "demo-customer-1",
    order_id: str = "AD-ORD-1001",
    issue_type: str = "damaged",
):
    database.put(
        "orders",
        order_id,
        {
            "orderId": order_id,
            "customerUid": customer_uid,
            "product": "Wireless headphones",
            "qty": 1,
            "deliveredAt": datetime.now(UTC),
            "status": "Delivered",
            "fictional": True,
        },
    )
    draft = create_draft(database, customer_uid, order_id=order_id)
    update_draft_fields(
        database,
        draft.draft_id,
        customer_uid,
        DraftFields(
            issue_type=issue_type,
            description="The left ear cup arrived cracked and does not work.",
            requested_resolution="replacement",
            customer_statement="My headphones arrived damaged.",
        ),
    )
    attachment_reference = database.collection("attachments").document()
    attachment_reference.set(
        {
            "attachmentId": attachment_reference.id,
            "ownerUid": customer_uid,
            "draftId": draft.draft_id,
            "caseId": None,
            "path": f"{draft.draft_id}/{attachment_reference.id}.png",
            "filename": "damage.png",
            "mime": "image/png",
            "size": 128,
            "createdAt": datetime.now(UTC),
        }
    )
    database.collection("drafts").document(draft.draft_id).update(
        {
            "attachmentIds": [attachment_reference.id],
            "summary": "Damaged wireless headphones need replacement.",
            "policyRefs": ["P-1", "P-3"],
        }
    )
    return get_draft(database, draft.draft_id, customer_uid)


def build_case(database, *, idempotency_key: str = "request-0001", **draft_args):
    draft = build_complete_draft(database, **draft_args)
    return create_support_case(database, draft, idempotency_key, True)
