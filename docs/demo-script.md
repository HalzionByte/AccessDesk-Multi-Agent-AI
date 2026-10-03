# AccessDesk three-minute demo runbook

Use fictional seeded accounts and orders only. Before recording, run the full
stack with `LLM_MODE=live` and `VITE_USE_MOCKS=false`; if the live model is
unavailable, explicitly label the fallback as mock mode.

## Preflight

- Confirm the backend health check, frontend login, Firebase roles, Firestore,
  and evidence upload directory.
- Keep the architecture slide open for the closing view.
- Use a fresh seed so tracking numbers and duplicate behavior are predictable.

## 0:00-0:45 — S1 complete request in Roman Urdu

Sign in as a fictional customer, select the delivered headphone order, and say:

> Mera headphone damaged aya hai, left side crack hai. Replacement chahiye.

Upload the fictional damage photo. Show the extracted details, missing-item
checklist, policy citation, confirmation preview, explicit Confirm and Submit
click, and the tracking number returned after the database write.

## 0:45-1:10 — S2 incomplete request

Start another request with only “product damaged.” Show that the assistant asks
for missing order/details/evidence and does not expose a submit success state.

## 1:10-1:30 — S3 repeat complaint

Repeat S1 for the same order and issue. Show the existing tracking number and
that no second case is created.

## 1:30-1:50 — S4 outside policy window

Use the older fictional order. Show the seven-day citation and neutral wording:
staff review is possible, but approval is not promised.

## 1:50-2:40 — Staff review

Sign in as staff. Search by tracking number, open the case, and show the AI
summary, original statement, evidence, policy references, and timeline. Move a
Submitted case to Under Review, request specific information, show the customer
reply returning it to review, then demonstrate the confirmation dialog before
Approve. Close the case and point out that illegal actions are never offered.

## 2:40-3:00 — Architecture and measured results

Close on `AccessDesk-architecture-v4.pptx`. Explain that the browser holds only a
Firebase identity token, FastAPI owns authorization and deterministic rules,
agents receive scoped tools, and Firestore/local evidence remain backend-only.
Quote only the latest measured figures from `qa-report.md`; do not estimate
unrun AI evaluation metrics.
