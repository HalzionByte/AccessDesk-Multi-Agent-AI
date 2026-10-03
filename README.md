# AccessDesk

### Multi-agent AI customer support for small online stores

AccessDesk turns informal customer complaints into complete, trackable support cases. A customer can describe a damaged delivery in English or Roman Urdu, and three focused AI agents help identify the order, explain the relevant replacement policy, collect missing evidence, and prepare a case for staff review.

> **Hackathon project:** Generative AI and Agentic AI · 1-day build  
> All stores, customers, orders, policies, and examples in this project are fictional demo data.

## The problem

Small online stores repeatedly handle the same support workflow: find an order, check the policy, ask for missing photos, summarize the complaint, and prevent duplicate requests. This manual process is slow for staff and frustrating for customers—especially when customers naturally communicate in a mix of English and Roman Urdu.

AccessDesk automates the preparation and tracking of a support case while keeping every consequential decision in trusted backend code or with a human staff member.

## What AccessDesk does

- Understands informal complaints in English and Roman Urdu.
- Extracts the order number, issue, description, and requested resolution.
- Verifies that the order belongs to the signed-in customer.
- Retrieves relevant policy passages and shows traceable citations.
- Checks the exact seven-day replacement window in backend code.
- Requests missing details or photo evidence one item at a time.
- Detects an existing active case before creating another one.
- Previews the complete request before submission.
- Creates a case only after explicit customer confirmation.
- Gives customers a tracking number and staff a review dashboard.

## Core principle: AI understands, the backend decides

AccessDesk uses AI for language understanding and communication—not for authorization or irreversible actions.

| AI agents | Trusted backend |
| --- | --- |
| Understand English and Roman Urdu | Authenticates users and enforces roles |
| Extract complaint details | Verifies order ownership |
| Ask focused follow-up questions | Calculates dates and applies exact policy rules |
| Explain retrieved policy passages | Validates required fields and confirmation |
| Draft a factual case summary | Prevents duplicates and ensures idempotency |
| Explain the next step | Writes cases and controls status transitions |

The AI cannot approve a replacement, issue a refund, bypass a policy rule, or change a case status. Store staff always make the final decision.

## How it works

1. The customer signs in and describes the problem.
2. The **Customer Intake Agent** extracts complaint details, while the backend verifies the order and its owner.
3. The **Policy Agent** retrieves relevant policy sections, explains them in the customer's language, and identifies missing information.
4. The customer supplies any missing details and uploads evidence.
5. The **Resolution Agent** checks for an existing case and prepares a request preview.
6. The customer clicks **Confirm and Submit**.
7. The backend validates the request and atomically creates one case with a tracking number such as `AD-2026-0001`.
8. Staff review the evidence and decide whether to request more information, approve, or decline.

## The agent team

| Agent | Responsibility | Allowed tools |
| --- | --- | --- |
| Customer Intake Agent | Detect language, extract details, ask one focused question, and draft a factual summary | `get_order_details`, `save_request_draft` |
| Policy Agent | Retrieve policy passages, cite their IDs, explain requirements, and check completeness | `search_policy`, `check_request_completeness` |
| Resolution Agent | Find existing cases, prepare the request preview, submit only after backend-confirmed consent, and report status | `find_existing_case`, guarded `create_support_case`, `get_case_status` |

A deterministic stage router runs only the agent needed for the current step. Agent memory is disabled, execution is capped, and durable workflow state lives in the database.

## Architecture

```text
┌──────────────────────┐
│ React + Vite client  │
└──────────┬───────────┘
           │ Firebase ID token
           ▼
┌──────────────────────┐       ┌────────────────────────┐
│ FastAPI backend      │──────▶│ Plain Python services  │
│ auth + route guards  │       │ rules, validation, I/O │
└──────────┬───────────┘       └──────────┬─────────────┘
           │                              │
           │ controlled agent stages      ├── Firestore
           ▼                              └── Local attachments
┌──────────────────────┐
│ CrewAI agents        │──────▶ Groq (`openai/gpt-oss-120b`)
│ scoped tools only    │
└──────────────────────┘
```

The browser uses Firebase Authentication but never accesses Firestore directly. Firestore rules deny client access; all application data passes through FastAPI authorization and validation.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS |
| Backend | Python, FastAPI, Pydantic |
| Authentication and database | Firebase Auth, Cloud Firestore |
| Agent orchestration | CrewAI with controlled sequential stages |
| Language model | Groq `openai/gpt-oss-120b` |
| Policy retrieval | Local BM25 with `rank_bm25` |
| Attachments | Local backend storage with Firestore metadata |

## Demo scenarios

- **Complete request:** a Roman Urdu complaint becomes a cited preview and one confirmed support case.
- **Incomplete request:** the assistant asks for missing information and photo evidence.
- **Repeated complaint:** the existing active case is returned instead of creating a duplicate.
- **Outside policy window:** the rule is explained and the request is routed to staff without promising approval.

Example customer message:

> Mera headphone damaged aya hai, replacement chahiye.

## Safety and reliability

- Firebase ID tokens and custom `customer` / `staff` role claims protect every route except `/health`.
- Ownership checks prevent customers from accessing another customer's orders, drafts, cases, or files.
- A Firestore transaction combines case creation, duplicate locking, idempotency, event logging, and tracking-number allocation.
- The submit endpoint rejects requests without explicit confirmation.
- Required information is validated outside the LLM.
- Policy citations must be a subset of passages actually retrieved.
- Uploaded files are limited to JPG, PNG, or PDF, up to 5 MB each and three per draft.
- Rate limits and model failures preserve the draft and never show a false success.
- Prompt-injection text is treated as untrusted customer data.
- Staff actions follow a validated case-status state machine.

## Case lifecycle

```text
Draft → Submitted → Under Review ─┬→ Needs Information → Under Review
                                  ├→ Approved → Closed
                                  └→ Declined → Closed
```

Customers cannot change case status. Invalid transitions return `409 Conflict`.

## Planned repository structure

```text
AccessDesk-Multi-Agent-AI/
├── backend/
│   ├── app/
│   │   ├── agents/       # Intake, policy, resolution, and stage router
│   │   ├── data/         # Fictional policy document
│   │   ├── routers/      # Customer, staff, chat, and file endpoints
│   │   ├── services/     # Deterministic business rules and persistence
│   │   ├── auth.py
│   │   ├── config.py
│   │   ├── main.py
│   │   └── schemas.py
│   ├── eval/             # English and Roman Urdu evaluation set
│   ├── tests/
│   ├── seed.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── mocks/
│       └── pages/
├── .env.example
├── AccessDesk PRD.md
└── README.md
```

## Local setup

The commands below describe the intended development environment once the backend and frontend are implemented.

### Prerequisites

- Python 3.11–3.13 (CrewAI does not currently support Python 3.14)
- Node.js 20+
- A Firebase project with Firestore and email/password authentication enabled
- A Firebase Admin service-account credential
- A Groq API key for live agent calls

### 1. Configure environment variables

Copy `.env.example` to `.env` and provide the required values:

```env
GROQ_API_KEY=
GROQ_MODEL=groq/openai/gpt-oss-120b
LLM_MODE=mock

FIREBASE_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=
UPLOAD_DIR=./backend/uploads
CORS_ORIGIN=http://localhost:5173

VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_API_URL=http://localhost:8000
VITE_USE_MOCKS=true
```

Keep service-account files and API keys out of version control.

### 2. Start the backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment, then run:

```bash
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`; use `GET /health` for a health check.

### 3. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

Use `LLM_MODE=mock` and `VITE_USE_MOCKS=true` during development. Switch both to their live modes for an integrated demo after configuring Firebase and Groq.

## API overview

All routes require a Firebase Bearer token except `/health`.

| Method and route | Role | Purpose |
| --- | --- | --- |
| `GET /me` | Any | Return the signed-in user's profile and role |
| `GET /orders` | Customer | List the customer's orders |
| `POST /chat` | Customer | Run the agent needed for the current draft stage |
| `POST /drafts/{id}/attachments` | Customer | Upload supporting evidence |
| `GET /drafts/{id}` | Customer | Return the draft and request preview |
| `POST /drafts/{id}/submit` | Customer | Confirm and idempotently create or retrieve a case |
| `GET /cases` | Customer | List the customer's cases |
| `POST /cases/{id}/reply` | Customer | Reply to a staff information request |
| `GET /staff/cases` | Staff | Search and filter all cases |
| `PATCH /staff/cases/{id}/status` | Staff | Apply a valid case transition |
| `GET /files/{attachmentId}` | Owner or staff | Retrieve authorized evidence |

API errors use a consistent shape:

```json
{
  "code": "string",
  "message": "string"
}
```

## Evaluation and testing goals

The planned evaluation set contains 15 labelled complaints: six English, six Roman Urdu, and three vague or mixed-language examples. The final project should report measured—not estimated—results for:

- complaint-field extraction accuracy;
- missing-item detection;
- policy-citation validity;
- duplicate prevention under concurrent submission;
- case creation only after confirmation;
- prompt-injection resistance;
- authorization and ownership isolation.

Recommended checks:

```bash
cd backend
pytest
python eval/run_eval.py
```

## Current project status

Tasks 1–3 and 7–9 are implemented. The backend provides authenticated identity,
orders, drafts, attachments and customer case workflows. The frontend provides
Firebase authentication with a mock-mode fallback, the shared design system,
the customer support experience, My Cases, and the staff review dashboard.
Task 10 QA and demo assets cover the implemented system, but its live AI
integration and evaluation remain blocked by missing Tasks 4–6; in particular,
live support chat requires the Task 6 `POST /chat` endpoint. See `Task 7.txt`
through `Task 10.txt` and `docs/qa-report.md` for verification notes.

## Limitations

- The demo focuses on damaged-product replacements for one fictional electronics store.
- Policy retrieval uses local lexical BM25 search rather than semantic embeddings.
- Attachments are stored locally and are not suitable for horizontally scaled production deployment.
- Roman Urdu understanding depends on model quality and should be confirmed by the customer when critical fields are extracted.
- Live Groq usage is subject to shared token and rate limits; mock mode is provided for development and backup demonstrations.
- AccessDesk prepares requests and assists reviewers; it does not autonomously approve claims or issue payments.

## Hackathon pitch

AccessDesk shows a practical pattern for trustworthy agentic software: let specialized AI agents handle messy language, while deterministic services enforce identity, policy, consent, and data integrity. The result is faster support for small stores without handing business-critical decisions to the model.

---

Built for a Generative AI and Agentic AI hackathon. The complete product specification is maintained locally in `AccessDesk PRD.md`.
