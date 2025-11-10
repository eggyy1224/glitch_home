# Project Context

## Purpose
Spec-driven development for a full-stack app (FastAPI backend + Vite/React frontend) featuring image generation/collage, search, and WebSocket coordination. This document captures project conventions that OpenSpec changes must follow.

## Tech Stack
- Backend: Python, FastAPI, Uvicorn, PyTest
- Frontend: Vite, React, Vitest + React Testing Library
- Tooling: Bash integration scripts, ripgrep for search

## Project Structure
- `backend/`: FastAPI app (`app/{api,models,services,utils}`), static mounts, tests in `backend/tests/`.
- `frontend/`: Vite + React app (`src/` components/hooks/utils; tests in `frontend/tests/`).
- `integration_tests/`: Bash scripts for collage/display/screenshot end‑to‑end flows.
- `docs/`: System docs (start with `docs/API_QUICK_START_GUIDE.md`).
- Generated artifacts: `backend/offspring_images/`, `backend/metadata/`, `backend/generated_sounds/`, `screen_shots/`, `frontend/dist/`.

## Build, Run, and Test

### Backend
- Setup: `cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt`
- Run API: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Tests: `pytest -q` (selective: `pytest -m "not slow"`)

### Frontend
- Setup: `cd frontend && npm install`
- Dev server: `npm run dev` (proxies `/api`, `/generated_images`, `/ws` to `:8000`)
- Build/preview: `npm run build` / `npm run preview`
- Tests: `npm test` or `npm run test:coverage`

### Integration
- Ensure backend (8000) and/or frontend are running, then `bash integration_tests/collage.sh` (see script headers for options).

## Coding Style & Naming

### Python
- PEP 8, 4‑space indent, prefer type hints.
- Modules `snake_case.py`; tests `backend/tests/test_*.py`.

### JavaScript/React
- 2‑space indent, semicolons, double quotes.
- Components `PascalCase.jsx`; hooks `hooks/use*.js`; utilities in `utils/`.
- Keep imports relative to feature folders; avoid deep cross‑layer coupling.

## Testing Guidelines
- Backend: `pytest.ini` enforces `tests/`, `test_*.py`, markers `slow`, `integration`, `api`.
- Use `@pytest.mark.*` and run coverage: `pytest --cov=app --cov-report=term-missing`.
- Frontend: Vitest + RTL with `jsdom`; tests under `frontend/tests/{unit,components,integration}/**/*.test.jsx`.
- Aim for meaningful coverage of core flows (image generation, collage, search, WebSocket coordination).

## Git & PR Workflow
- Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`; scoping encouraged, e.g., `feat(collage): ...`.
- PRs include: description, validation steps/commands, screenshots for UI, sample API payloads/responses for backend, and linked issues when applicable.

## Security & Configuration
- Do not commit secrets. `.env` is ignored (see `.gitignore`).
- Common keys: `OPENAI_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`.
- Paths in env vars resolve from repo root; examples in `backend/README.md` (`GENES_POOL_DIRS`, `OFFSPRING_DIR`, `METADATA_DIR`).

## Development Environment
- Use a Python virtual environment (venv) for all backend work: `cd backend && python3 -m venv venv && source venv/bin/activate`.
- Avoid global installs.

## Agent Usage (Local Dev Assumptions)
- Maintainer runs services; agents do not manage environments.
- Base URLs: Backend `http://localhost:8000`, Frontend `http://localhost:5173`.
- Health check: `curl http://localhost:8000/health` → `{ "status": "ok" }`.
- Example generate: `curl -X POST http://localhost:8000/api/generate/mix-two -H 'Content-Type: application/json' -d '{"count":2}'`.
- WebSocket: `ws://localhost:8000/ws` for realtime features.
- Quick API usage: see `docs/API_QUICK_START_GUIDE.md` for endpoints, payloads, and examples.

## OpenSpec Conventions
- Use proposals for new capabilities, breaking changes, architecture shifts, or meaningful performance/security work. Bug fixes and non‑breaking chores can skip proposals.
- Follow `openspec/AGENTS.md` for workflow, deltas format, and validation. Key points:
  - Unique, verb‑led `change-id` (e.g., `add-…`, `update-…`).
  - Scaffold `proposal.md`, `tasks.md`, optional `design.md`, and deltas under `openspec/changes/<id>/specs/<capability>/spec.md`.
  - Deltas must use `## ADDED|MODIFIED|REMOVED|RENAMED Requirements` and each requirement must include at least one `#### Scenario:`.
  - Validate with `openspec validate <id> --strict` before requesting approval.

## Domain Context
- Core flows: image generation, collage creation, search, and WebSocket coordination between frontend and backend.
- Generated outputs stored under: `backend/offspring_images/`, `backend/metadata/`, `backend/generated_sounds/`, `screen_shots/`.

## Important Constraints
- Keep implementations simple and focused; avoid unnecessary complexity.
- Respect existing structure and naming conventions in each layer.
- Do not modify unrelated code or tests within a change.

## External Dependencies
- OpenAI APIs, Google Gemini/Vertex (keys via environment variables).
- Node/npm ecosystem for frontend; Python ecosystem for backend.
