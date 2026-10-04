# AccessDesk Task 10 QA record

Date: 2026-10-04
Scope: current working tree, covering implemented Tasks 1-9
Test environment: Windows, Python 3.14.5 for the deterministic backend suite,
Node/Vite frontend build

This report contains measured results only. Mock-agent results are labelled
separately from live Groq verification.

## Automated results

| Check | Measured result |
| --- | --- |
| Backend tests | 75 passed |
| Backend statement coverage | 90% |
| Ruff | Passed |
| MyPy application and evaluation check | Passed for 32 files with third-party missing imports excluded |
| Frontend unit tests | 7 passed |
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
| Model failure preserves draft and prevents false success | Passed in injected-failure integration test | `503 llm_busy`; persisted stage remains `INTAKE`; no case created |
| Prompt-injection text has no effect | Passed in mock integration test | Injection is treated as delimited data and cannot create or approve a case |

## Evaluation metrics

| Metric required by the PRD | Result |
| --- | --- |
| Extraction accuracy | Mock: 15/15 (100%) |
| Missing-item detection | Mock: 15/15 (100%) |
| Citation validity | Mock: 15/15 outputs used retrieved citation IDs only (100%) |
| Duplicate prevention | Measured: 10/10 concurrent calls returned one case ID |
| Case creation after confirmation | Measured: confirmed request created one case; unconfirmed request created zero |
| Model and live evaluation date | Not measured — no live model run performed |

## Remaining integration gate

Tasks 5-6 now provide the Groq/CrewAI layer, evaluation runner, deterministic
stage router, and `POST /chat`. A live end-to-end run still requires locally
configured Firebase and Groq credentials. No live metric or live smoke-test
claim is made in this report.
