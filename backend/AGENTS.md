# Backend 工作指南

（重要提醒：請用繁體中文回覆我）

## 範圍與參考
- 僅涵蓋 `backend/` 目錄的日常開發；跨前後端與全域規範請同步參考 repo 根目錄的 `AGENTS.md`。
- 假設 Base URL 為 `http://localhost:8000`，靜態與 WebSocket 皆由此服務。

## 目錄速覽
- `app/api`: FastAPI 路由與依賴。
- `app/models`: Pydantic/ORM 資料結構。
- `app/services`: 業務邏輯與協同工具。
- `app/utils`: 共用函式、設定與雜項工具。
- `tests/`: `pytest` 測試；使用 `pytest.ini` 內標記（`slow`, `integration`, `api`）。
- 產出資料夾（勿提交）：`offspring_images/`, `metadata/`, `generated_sounds/`, `logs/`。

## 環境與啟動
- 建議每次開發都在虛擬環境：`cd backend && python3 -m venv venv && source venv/bin/activate`。
- 安裝依賴：`pip install -r requirements.txt`（必要時先升級 `pip`）。
- 啟動 API：`uvicorn app.main:app --host 0.0.0.0 --port 8000`；健康檢查 `curl http://localhost:8000/health` 應回 `{ "status": "ok" }`。

## 測試與驗證
- 單元/整合測試：`pytest -q`；挑選標記：`pytest -m "not slow"` 或 `-m api` 等。
- 覆蓋率：`pytest --cov=app --cov-report=term-missing`。
- 端點自查：`curl -X POST http://localhost:8000/api/generate/mix-two -H 'Content-Type: application/json' -d '{"count":2}'`。

## 程式風格
- PEP 8、4 空白縮排；盡量補齊 type hints。
- 檔名 `snake_case.py`，測試檔遵循 `test_*.py` 置於 `backend/tests/`。
- import 以功能區域為主，避免跨層耦合。

## 環境變數與安全
- `.env` 已忽略；常用鍵：`OPENAI_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`，以及路徑類：`GENES_POOL_DIRS`, `OFFSPRING_DIR`, `METADATA_DIR`（路徑從 repo root 解析）。
- 不要提交任何憑證或大量產出檔；確認 git status 乾淨後再推送。

## 協作與提交
- Commit 使用 Conventional Commits（例：`feat(collage): ...`）。
- PR 請附：變更摘要、驗證步驟/指令、若涉及 API 提供 sample 請求與回應、必要時附 screenshot/log。

## 常見提示
- 服務由維護者統一啟動與維運，請勿在此目錄管理系統層級設定。
- 需要功能介面說明時，先看 `docs/API_QUICK_START_GUIDE.md`，再回到對應模組實作。
