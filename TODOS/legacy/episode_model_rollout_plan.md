# Episode/Show 資料模型落地計劃（2025-11-17）

## 0. 背景與目標
- 現有展演是「某個 timeline + assets + metadata」的鬆散集合，缺乏可被命名、版本化、分享的單位。
- Dashboard 與 MCP 只能操作零散資源，沒有穩定的高階抽象可供播放或指令集成。
- 目標是在不推倒既有 pipeline 的情況下，建立 Episode/Show 模型，讓播放、分享、版本管理與自動化得以有一致語彙。

## 1. Episode 核心抽象

### 1.1 欄位草案
- `id`: UUID 或 slug，作為引用與分享的穩定識別。
- `title`, `description`, `tags`: 方便 Dashboard 與 MCP 搜尋、分類與呈現。
- `timeline_id`: 指向現有 timeline 物件，或在未來支援 inline 結構。
- `assets`: 正式引用的資產集合：
  - `images`, `snapshots`, `videos`, `audio`, `subtitles`，皆以資產 ID 或檔名引用既有 metadata。
- `clients_layout`: 描述不同 client role 的參與方式與預設 overrides。
- `meta`: `version`, `status`（`draft`/`published`/`archived`）, `created_at`, `updated_at`, `author`。

### 1.2 與 metadata 的關聯
- 保留 `backend/metadata/` 既有檔案（例如 `narration_*.mp3.json`），Episode 只負責引用 `asset_id`，不搬移實際內容。
- `assets.audio` 可記錄 `id`, `kind`, `client_role` 等欄位，達成重複利用與跨 Episode 共用。
- 透過引用策略，可沿用目前生成、儲存與播放流程，不需立即調整 pipeline。

### 1.3 Clients layout 與 overrides
- `clients_layout` 記錄每個 client role 的參與方式（如 `wall-left`, `overview`）與必要的初始 overrides。
- 真正的 per-step override 仍交由 timeline 定義，Episode 層只提供預設結構，避免重複設定。

## 2. API 與儲存策略

### 2.1 Phase 1：Read-only Episode 裝配層
- 從現有 timeline + metadata + config 以程式組裝 Episode 物件。
- 新增 `GET /api/episodes`（列表）與 `GET /api/episodes/{id}`（細節），初期可用靜態 JSON 定義。
- 主要用途是讓 Dashboard 與 MCP 有可選擇的「展演單位」，短期不處理寫入。

### 2.2 Phase 2：Episode 永續化與輕量編輯
- 決定儲存型態：SQLite/Postgres 或 `backend/metadata/episodes/*.json`。
- 新增 `POST /api/episodes`, `PUT /api/episodes/{id}`, `DELETE /api/episodes/{id}` 等 CRUD API。
- 仍由既有 timeline API 管理 step 細節；Episode API 只處理 metadata 與資源綁定。

### 2.3 Phase 3：版本管理與匯入／匯出
- 擴充 `version`, `parent_version_id`, `changelog` 欄位。
- `GET /api/episodes/{id}/export` 與 `POST /api/episodes/import` 支援跨場地分享。
- 需設計 bundle 結構以列出硬性依賴資產，避免遺漏必要檔案。

## 3. 實作里程碑
- [ ] Phase 1：Episode 視圖
  - [ ] 整理欄位命名與 JSON schema 草案。
  - [ ] 建立靜態 Episode 定義並提供 `GET` API。
  - [ ] Dashboard 新增 Episode 選單並以 Episode 為主語進行播放控制。
- [ ] Phase 2：Episode 永續化 + MCP 基礎整合
  - [ ] 決定儲存策略並建立 CRUD API。
  - [ ] 在 MCP server 提供 Episode 級別工具（`list_episodes`, `play_episode`）。
  - [ ] 在 docs（如 `docs/API_QUICK_START_GUIDE.md`）新增 Episode 模型章節。
- [ ] Phase 3：Episode 版本與分享
  - [ ] 設計版本欄位與 parent linkage。
  - [ ] 實作差異比對與回滾流程。
  - [ ] 完成匯入／匯出工具與 API。

## 4. 風險與緩解
- **模型一旦定義錯誤將難以修正**：先以 read-only 視圖試水溫，透過 MVP 實際播放收斂欄位需求，再進入 CRUD 阶段。
- **資產引用不一致**：統一 asset ID 規則並在 Episode 建立時驗證引用存在性，維持 pipeline 穩定。

## 5. 即刻待辦
- 收斂 Episode schema（含欄位與命名慣例），產出 JSON 參考檔。
- 在 `backend/metadata/episodes/` 放置 1~2 份手工定義的 Episode 做 API smoke test。
- 更新 Dashboard UI 規格，確認「Episode 選單 + Playback 區」需要哪些 API 欄位。
