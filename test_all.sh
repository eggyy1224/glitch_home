#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT/backend"
if [ ! -d venv ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pytest --cov=app --cov-report=term-missing
deactivate

cd "$ROOT/frontend"
npm test -- --watch=false --coverage
npm run typecheck
npm run test:e2e


