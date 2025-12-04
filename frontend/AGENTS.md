# Frontend 工作指南

（重要提醒：請用繁體中文回覆我）

## 範圍與參考
- 僅針對 `frontend/` 內的 React/Vite 開發流程；跨前後端協作與共用原則請同步閱讀 repo 根目錄的 `AGENTS.md`。
- Dev 伺服器預設在 `http://localhost:5173`，並透過 Vite proxy 轉發 `/api`, `/generated_images`, `/ws` 到 `http://localhost:8000`。

## 目錄速覽
- `src/components`: UI 元件（PascalCase）。
- `src/hooks`: 自訂 hooks（`use*.ts/tsx`）。
- `src/utils`: 共用工具函式。
- `tests/`: Vitest + RTL 測試，依 `unit/`, `components/`, `integration/` 分類，檔名 `*.test.tsx`/`*.test.ts`。
- 靜態與產出：`public/` 為靜態資源；`dist/` 為 build 輸出（勿提交）。

## 安裝與啟動
- 安裝依賴：`cd frontend && npm install`。
- 開發伺服器：`npm run dev`（自動 proxy 到 backend:8000）。
- 打包 / 預覽：`npm run build`，完成後 `npm run preview -- --port 5173`。

## 測試與型別
- 單元/元件測試：`npm test -- --watch=false --coverage` 或直接 `npm run test:coverage`。
- E2E：`npm run test:e2e`（Playwright）；更新快照 `npm run test:e2e:update`。
- 型別檢查：`npm run typecheck`（或 `typecheck:all`/`typecheck:strict`）。

## 程式風格
- 2 空白縮排、分號、雙引號；以函式型元件與 hooks 為主。
- TypeScript 為預設；除非已有 JS，新增檔案請使用 `.ts`/`.tsx` 並補齊基本型別。
- imports 依功能區分，避免跨層互相引用；ui 元件盡量拆小保持可測性。

## API 與環境變數
- 測試或 CI 若未啟動 proxy，請改用完整後端位址（例：`http://localhost:8000/api/...`）。
- Vite 變數需以 `VITE_` 開頭（例：`VITE_API_BASE`）；`.env*` 不要提交。

## 協作與提交
- Commit 採 Conventional Commits（例：`feat(frontend): ...`）。
- PR 請附：變更重點、執行的測試/型別檢查指令、若涉及 UI 請附 screenshot 或影片。

## 常見提示
- 首先閱讀 `docs/API_QUICK_START_GUIDE.md` 了解可用後端端點再接入。
- 保持 `dist/`, `test-results/`, `coverage/`、Playwright artifacts 於 git ignore 狀態；送審前檢查 `git status`。
