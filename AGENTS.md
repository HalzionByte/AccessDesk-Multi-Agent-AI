# AccessDesk development guide

AccessDesk is a FastAPI backend with a React 19, Vite and Tailwind CSS v4
frontend. The repository root is the shared configuration and documentation
location.

## Project structure

- `backend/app/main.py` - FastAPI application entry point.
- `backend/app/routers/` - authenticated HTTP routes.
- `backend/app/services/` - deterministic domain and Firestore operations.
- `backend/app/schemas.py` - shared API and persistence models.
- `backend/tests/` - backend unit and integration-style tests.
- `frontend/src/main.jsx` - React entry point.
- `frontend/src/app/App.jsx` - provider and router composition.
- `frontend/src/app/routes.jsx` - role-aware application routes.
- `frontend/src/api/client.js` - mock/live API boundary.
- `frontend/src/components/` - shared UI and workflow components.
- `frontend/src/pages/` - customer and staff screens.
- `frontend/src/mocks/` - fictional demo fixtures.

## Local commands

Backend commands run from `backend/`:

```text
python -m pytest
python -m ruff check app tests seed.py
python -m mypy app seed.py --ignore-missing-imports
```

Frontend commands run from `frontend/`:

```text
pnpm install --frozen-lockfile
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm format
```

The backend uses port 8000 and the Vite frontend uses port 5173. Vite loads
the shared repository-root `.env` through `frontend/vite.config.ts`.

## Frontend conventions

- Use the existing components in `frontend/src/components/ui/` and
  `frontend/src/components/shared/` before adding another primitive.
- Keep mock and live behavior behind `frontend/src/api/client.js`; screens
  should not contain alternate endpoint definitions.
- Use Firebase only for browser authentication. All application data travels
  through authenticated FastAPI endpoints.
- Keep short customer-facing copy, sentence case and accessible labels.
- Run Oxfmt using the committed `frontend/.oxfmtrc.json` configuration.
- Every data screen needs loading, empty and retryable error states.

## Security and scope

- Never commit `.env`, Firebase service-account files, API keys or tokens.
- Treat model output as untrusted and validate it at deterministic service
  boundaries.
- Preserve role and ownership checks in backend routes and services.
- Do not implement another task's unfinished feature merely to bypass a
  missing dependency; document the dependency instead.
