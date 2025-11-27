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

# 如需額外跑 Playwright E2E，請在事先啟動前後端服務後設定 RUN_E2E=1 再執行
if [[ "${RUN_E2E:-}" == "1" ]]; then
  npm run test:e2e
fi
