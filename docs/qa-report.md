# AccessDesk Task 10 QA record

Date: 2026-10-03  
Scope: current working tree, covering implemented Tasks 1-4 and 7-9
Test environment: Windows, Python 3.14.5 for the deterministic backend suite,
Node/Vite frontend build

This report contains measured results only. It does not treat the unimplemented
Tasks 5-6 agent workflow as passing.

## Automated results

| Check | Measured result |
| --- | --- |
| Backend tests | 59 passed |
| Backend statement coverage | 91% |
| Ruff | Passed |
| MyPy application source check | Passed for 21 files; only `firebase_admin.*` missing stubs excluded |
| Frontend unit tests | 5 passed |
| Frontend formatting | Passed |
| Frontend TypeScript check | Passed |
| Frontend production build | Passed |

## PRD QA checklist

| Requirement | Result | Evidence |
| --- | --- | --- |
| Customer A cannot access customer B order | Passed | Ownership query and service tests |
| Customer A cannot access customer B draft | Passed | Draft route and service tests |
| Customer A cannot access customer B case | Passed | Case listing/detail tests |
| Customer A cannot access customer B file | Passed | Attachment download authorization test |
| Customer cannot call staff routes or set status | Passed | Role and staff-route tests |
| Same idempotency key creates one case | Passed | Sequential retry test |
| Concurrent repeated submit creates one case | Passed | 10 simultaneous submissions test |
| Same order and issue returns existing case | Passed | Duplicate-lock test |
| Submit without confirmation is rejected | Passed | No-write confirmation test |
| Invalid files are rejected | Passed | MIME mismatch, size, count, and empty-file tests |
| Success follows committed database write | Passed for case service | Response assertions follow transactional write and event creation |
| Demo data is labelled fictional | Passed for seeded orders/case responses | Seed and case tests assert `fictional=true` |
| Model failure preserves draft and prevents false success | Not measured | Task 5/6 model and chat flow are absent |
| Prompt-injection text has no effect | Not measured | Task 5/6 agent prompts and evaluation corpus are absent |

## Evaluation metrics

| Metric required by the PRD | Result |
| --- | --- |
| Extraction accuracy | Not measured — agent implementation/eval set absent |
| Missing-item detection | Deterministic checker unit-tested; agent evaluation not measured |
| Citation validity | Policy IDs/corpus validated; agent citation output not measured |
| Duplicate prevention | Measured: 10/10 concurrent calls returned one case ID |
| Case creation after confirmation | Measured: confirmed request created one case; unconfirmed request created zero |
| Model and live evaluation date | Not measured — no live model run performed |

## Remaining integration gate

Tasks 5-6 must provide the Groq/CrewAI layer, evaluation runner, deterministic
stage router, and `POST /chat`. Task 4 now provides policy retrieval,
completeness checking, and the labelled 15-complaint corpus. Until the remaining
pieces are merged, a live end-to-end run, AI safety evaluation, and full demo
recording would be misleading.
