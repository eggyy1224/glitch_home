<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: FastAPI app (`app/{api,models,services,utils}`), static mounts, and tests in `backend/tests/`.
- `frontend/`: Vite + React app (`src/` components/hooks/utils; tests in `frontend/tests/`).
- `integration_tests/`: Bash scripts for collage/display/screenshot end‑to‑end flows.
- `docs/`: System docs (start with `docs/API_QUICK_START_GUIDE.md`).
- Generated artifacts: `backend/offspring_images/`, `backend/metadata/`, `backend/generated_sounds/`, `screen_shots/`, `frontend/dist/`.

## Build, Test, and Development Commands
- Backend
  - Setup: `cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt`
  - Run API: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
  - Tests: `pytest -q` (mark-select: `pytest -m "not slow"`)
- Frontend
  - Setup: `cd frontend && npm install`
  - Dev server: `npm run dev` (proxies `/api`, `/generated_images`, `/ws` to `:8000`)
  - Build/preview: `npm run build` / `npm run preview`
  - Tests: `npm test` or `npm run test:coverage`
- Integration
  - Ensure backend (8000) and/or frontend are running, then `bash integration_tests/collage.sh` (see script headers for options).

## Coding Style & Naming Conventions
- Python: PEP 8, 4‑space indent, type hints preferred. Modules `snake_case.py`; tests `backend/tests/test_*.py`.
- JS/React: 2‑space indent, semicolons, double quotes. Components `PascalCase.jsx`; hooks `hooks/use*.js`; utilities in `utils/`.
- Keep imports relative to feature folders; avoid deep cross‑layer coupling.

## Testing Guidelines
- Backend: `pytest.ini` enforces `tests/`, `test_*.py`, markers `slow`, `integration`, `api`. Use `@pytest.mark.*` and run coverage with `pytest --cov=app --cov-report=term-missing`.
- Frontend: Vitest + RTL with `jsdom`; place tests under `frontend/tests/{unit,components,integration}/**/*.test.jsx`.
- Aim for meaningful coverage; cover core flows (image generation, collage, search, WebSocket coordination).

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`; scoping is encouraged (e.g., `feat(collage): ...`).
- PRs include: description of change, validation steps/commands, screenshots for UI, sample API payloads/responses for backend, and linked issues when applicable.

## Security & Configuration Tips
- Do not commit secrets. `.env` is ignored (see `.gitignore`). Required keys commonly include `OPENAI_API_KEY`, `GEMINI_API_KEY/GOOGLE_API_KEY`.
- Paths in env vars resolve from repo root; see `backend/README.md` for examples (`GENES_POOL_DIRS`, `OFFSPRING_DIR`, `METADATA_DIR`).

## Development Environment
- Backend: Use a Python virtual environment (venv) for all local work. Create/activate with `cd backend && python3 -m venv venv && source venv/bin/activate`; avoid global installs.

## Agent-Specific Instructions
- Maintainer will run services; agents do not manage environments.
- Base URLs: Backend `http://localhost:8000`, Frontend `http://localhost:5173` (dev proxy to backend is configured).
- Health check: `curl http://localhost:8000/health` → `{ "status": "ok" }`.
- Generate (example): `curl -X POST http://localhost:8000/api/generate/mix-two -H 'Content-Type: application/json' -d '{"count":2}'`.
- WebSocket: connect to `ws://localhost:8000/ws` when testing realtime features.
 - Quick API usage: read `docs/API_QUICK_START_GUIDE.md` for endpoints, payloads, and examples.
