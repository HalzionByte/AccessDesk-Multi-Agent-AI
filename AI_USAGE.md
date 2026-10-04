# AccessDesk AI usage

AccessDesk uses AI to understand and explain customer complaints. Authentication,
ownership, policy calculations, completeness checks, duplicate prevention,
confirmation, case creation, tracking numbers, and staff status changes remain in
deterministic backend code.

## Model and orchestration

- Provider: Groq
- Model: `groq/openai/gpt-oss-120b`
- Orchestration: CrewAI with LiteLLM
- Execution: sequential stage router, at most one agent per chat message
- Agent memory: disabled
- Maximum agent iterations: 3
- Development fallback: deterministic `LLM_MODE=mock`

The model name contains `openai`, but this project calls it through Groq and does
not require an OpenAI API key.

## Agent responsibilities

| Agent | Responsibilities | Permitted service operations |
| --- | --- | --- |
| Intake | Detect English or Roman Urdu; extract order, issue, description and requested resolution; ask one focused question | Load an owned order; save validated draft progress |
| Policy | Explain retrieved fictional policy and identify missing requirements | BM25 policy search; deterministic completeness check |
| Resolution | Prepare a factual preview and detect an existing case | Duplicate lookup; owned case status; guarded event operations |

The public chat workflow never creates a case. A case can be created only through
the confirmed backend submission endpoint, which revalidates required fields and
uses Firestore transactions, duplicate locks, and idempotency records.

## Durable workflow

The backend stores the current draft stage in Firestore:

```text
INTAKE → POLICY → COLLECT → PREVIEW → AWAIT_CONFIRM → SUBMITTED
```

Every agent output crosses a Pydantic validation boundary before it is saved.
Rate limits and timeouts return `503 llm_busy`; the existing draft remains
available for retry. Refreshing the browser restores the active draft.

## Configuration

Mock mode performs no model network calls:

```env
LLM_MODE=mock
GROQ_MODEL=groq/openai/gpt-oss-120b
```

Live mode requires a backend-only Groq key:

```env
GROQ_API_KEY=gsk_your_key
GROQ_MODEL=groq/openai/gpt-oss-120b
LLM_MODE=live
```

Never expose `GROQ_API_KEY` through a `VITE_*` variable, source code, logs, or
committed configuration. Use separate development and production keys and rotate
a key immediately if it is exposed.

`VITE_USE_MOCKS` controls the entire frontend data source and is separate from
`LLM_MODE`:

| Configuration | Behavior |
| --- | --- |
| `VITE_USE_MOCKS=true` | Browser uses local scenario fixtures; backend is bypassed |
| `VITE_USE_MOCKS=false`, `LLM_MODE=mock` | Real Firebase and backend with deterministic agents |
| `VITE_USE_MOCKS=false`, `LLM_MODE=live` | Fully integrated Firebase, backend, and Groq flow |

Restart the backend after changing `LLM_MODE`. Restart or rebuild the frontend
after changing any `VITE_*` value.

## Retrieval, validation, and AI safety

- Policy passages come from the local fictional `backend/app/data/policy.md`.
- BM25 retrieval runs in plain Python; the model cannot choose arbitrary sources.
- Policy citation IDs are filtered to the passages actually retrieved.
- Unknown intake fields remain null and order IDs are checked against owned orders.
- Customer and policy content are delimited and explicitly marked as untrusted.
- Model-generated approval promises are rejected or replaced with neutral language.
- Agent tools are allow-listed per role, and customer identity comes only from the
  verified Firebase token.
- Agents cannot approve, decline, refund, set staff statuses, or bypass customer
  confirmation.
- Only short action/outcome events are displayed; private model reasoning is not
  stored or shown.

## Evaluation

The labelled corpus contains 15 fictional complaints: six English, six Roman
Urdu, and three vague or mixed examples, including prompt injection.

Run deterministic evaluation:

```bash
cd backend
python eval/run_eval.py --mode mock
```

Run live evaluation only after configuring the Groq key:

```bash
cd backend
python eval/run_eval.py --mode live
```

The latest measured mock run processed 15/15 complaints with 100% extraction
accuracy, 100% missing-item accuracy, and 100% citation validity. These mock
results must not be represented as live-model results. A credentialled live Groq
evaluation and S1–S4 demonstration remain deployment checks.

## Current limitations

- The workflow is specialized for fictional damaged-product replacement requests.
- Roman Urdu behavior in live mode depends on model quality and critical extracted
  facts should be confirmed by the customer.
- Local lexical retrieval is intentionally simpler than semantic retrieval.
- Groq rate and token limits apply in live mode.
- Attachments currently use backend-local storage and need persistent storage or
  an object-store integration for horizontally scaled deployment.
