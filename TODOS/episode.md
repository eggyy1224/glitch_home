# Episode Model 實作計劃

## 現況分析

### 已存在系統

- **Timeline 系統**：完整實作於 `backend/app/api/timeline.py`、`backend/app/models/iframe_timeline.py`、`backend/app/services/iframe_timeline.py`
- API：`GET /api/iframe-timelines`、`GET /api/iframe-timelines/{id}`
- 前端：`useIframeTimelinePlayer` hook、`IframeTimelineControls` 組件
- 儲存：`backend/metadata/timelines/iframe/*.json`
- **Metadata 系統**：`backend/metadata/` 目錄結構完整
- iframe_config、collage_config snapshots
- narration metadata (`narration_*.mp3.json`)
- offspring metadata (`offspring_*.json`)
- **MCP Server**：`tools/mcp_server/` 存在，目前只有低階工具
- **前端 Dashboard**：`frontend/src/App.jsx` 可播放 timeline，但無 Episode 概念

### 缺失項目

- Episode 資料模型（Pydantic model）
- Episode API endpoints
- Episode 儲存機制（JSON 檔案或資料庫）
- 前端 Episode 選單與管理 UI
- MCP Episode 工具

## 最新進度（2025-02）

- ✅ 後端 Phase 1 (Read-only) 已落地：`backend/app/models/episode.py`、`backend/app/services/episode.py`、`backend/app/api/episode.py`
- ✅ `/api/episodes`、`/api/episodes/{id}` 可讀取 `backend/metadata/episodes/*.json`
- ✅ `backend/metadata/episodes/desktop2_opening_episode.json` 作為示例 Episode（引用 `desktop2_opening_with_media` timeline）
- ✅ 測試覆蓋：`backend/tests/test_episode.py`、`backend/tests/test_api/test_episode_api.py`
- ✅ 前端 Phase 2：API client、`useEpisodes`/`useEpisodePlayback` hook、Dashboard Episode 選單與 metadata 顯示（`frontend/src/App.jsx`、`ControlPanel`、`EpisodeSelector`）

## Phase 1：Episode 資料模型與 Read-only API

### 1.1 建立 Episode Pydantic Model（✅ 已完成）

**檔案**：`backend/app/models/episode.py`

- 欄位：
- `id`: str (UUID 或 slug)
- `title`: str
- `description`: Optional[str]
- `tags`: List[str]
- `timeline_id`: str (引用現有 timeline)
- `assets`: Dict[str, List[str]] (images, snapshots, videos, audio, subtitles)
- `clients_layout`: Optional[Dict[str, Any]] (client role 參與方式)
- `meta`: Dict (version, status, created_at, updated_at, author)
- Status 枚舉：`draft` | `published` | `archived`
- 完成：`Episode` + `EpisodeMeta` + `EpisodeStatus`，含欄位清洗/aliases

### 1.2 建立 Episode Service（✅ 已完成）

**檔案**：`backend/app/services/episode.py`

- `load_episode_definition(episode_id: str) -> Episode`
- `list_episodes(client: Optional[str] = None) -> List[Dict]`
- `resolve_episode(episode: Episode) -> ResolvedEpisode` (組裝 timeline + assets)
- 儲存位置：`backend/metadata/episodes/*.json`
- 完成：`ResolvedEpisode.to_payload()`；client 過濾含 timeline 與 clients_layout

### 1.3 建立 Episode API（✅ 已完成）

**檔案**：`backend/app/api/episode.py`

- `GET /api/episodes`：列出所有 Episode（支援 `?client=` 過濾）
- `GET /api/episodes/{episode_id}`：取得 Episode 詳細內容
- 註冊到 `backend/app/main.py` 的 router
- 完成：`episode_router` 已掛載至主應用

### 1.4 建立範例 Episode JSON（✅ 已完成）

**檔案**：`backend/metadata/episodes/desktop2_opening_episode.json`

- 引用現有 timeline：`desktop2_opening_with_media`
- 列出相關 assets（images, audio）
- 設定 clients_layout
- 作為 API smoke test 範例
- 完成：提供 tags/clientsLayout/音訊資產清單

## Phase 2：前端 Dashboard 整合

### 2.1 建立 Episode API Client（✅ 已完成）

**檔案**：`frontend/src/api.js`

- 新增 `fetchEpisodes(clientId)`、`fetchEpisode(episodeId)` 函數

### 2.2 建立 Episode Hook（✅ 已完成）

**檔案**：`frontend/src/hooks/useEpisodes.js`

- `useEpisodes(clientId)`：管理 Episode 列表與選擇
- `useEpisodePlayback(episodeId)`：解析 Episode 詳細並回傳 timelineId（搭配既有 `useIframeTimelinePlayer`）

### 2.3 更新 Dashboard UI（✅ 已完成）

**檔案**：`frontend/src/components/ControlPanel.jsx` 或新建 `EpisodeSelector.jsx`

- 新增 Episode 選單下拉
- 選擇 Episode 後自動載入對應 timeline
- 顯示 Episode metadata（title, description, tags）

### 2.4 更新 App.jsx（✅ 已完成）

**檔案**：`frontend/src/App.jsx`

- 整合 Episode 選單
- Episode 選擇後設定 `iframeTimelineId`
- 保留現有 timeline 直接選擇功能（向後相容）

## Phase 3：Episode CRUD API

### 3.1 擴充 Episode Service

**檔案**：`backend/app/services/episode.py`

- `create_episode(episode_data: Dict) -> Episode`
- `update_episode(episode_id: str, updates: Dict) -> Episode`
- `delete_episode(episode_id: str) -> bool`
- 驗證：timeline_id 存在性、assets 引用有效性

### 3.2 擴充 Episode API

**檔案**：`backend/app/api/episode.py`

- `POST /api/episodes`：建立新 Episode
- `PUT /api/episodes/{episode_id}`：更新 Episode
- `DELETE /api/episodes/{episode_id}`：刪除 Episode
- 權限檢查（Phase 1 可先跳過，Phase 2 加入）

## Phase 4：MCP Episode 工具

### 4.1 擴充 MCP Server

**檔案**：`tools/mcp_server/server.py`

- `list_episodes(client_id: Optional[str])`：列出 Episode
- `get_episode_details(episode_id: str)`：取得 Episode 詳細資訊
- `play_episode(episode_id: str, target_client_id: Optional[str])`：播放 Episode（整合 WebSocket）

### 4.2 更新 MCP 文件

**檔案**：`tools/mcp_server/README.md`、`docs/API_QUICK_START_GUIDE.md`

- 新增 Episode 工具說明
- 提供使用範例

## Phase 5：版本管理與匯入匯出（未來）

### 5.1 版本欄位擴充

- `version`: str
- `parent_version_id`: Optional[str]
- `changelog`: Optional[str]

### 5.2 匯入匯出 API

- `GET /api/episodes/{id}/export`：匯出 Episode bundle（含依賴資產清單）
- `POST /api/episodes/import`：匯入 Episode

## 實作順序與依賴

1. **Phase 1**（基礎）：Episode Model + Read-only API + 範例檔案
2. **Phase 2**（前端整合）：Dashboard Episode 選單
3. **Phase 3**（完整功能）：CRUD API
4. **Phase 4**（MCP 整合）：MCP 工具
5. **Phase 5**（進階功能）：版本管理

## 技術決策

### 儲存策略

- **Phase 1-3**：使用 JSON 檔案（`backend/metadata/episodes/*.json`）
- **未來**：可考慮 SQLite/Postgres，但目前 JSON 足夠

### 資產引用

- Episode 只引用 asset ID/檔名，不搬移實際內容
- 驗證引用存在性，但不強制（允許未來資產）

### 向後相容

- 保留現有 timeline 直接選擇功能
- Episode 為可選層級，不強制所有 timeline 都要包成 Episode

## 測試策略

- **後端**：`backend/tests/test_episode.py`
- Episode 載入、列表、解析
- CRUD 操作
- 邊界情境（缺 timeline、缺 assets）
- ✅ 現有：Read-only flows 已涵蓋
- **前端**：手動測試 Dashboard Episode 選單
- **整合**：MCP 工具端對端測試

## 文件更新

- `docs/API_QUICK_START_GUIDE.md`：新增 Episode API 章節
- `backend/README.md`：說明 Episode 模型與儲存位置
- `TODOS/episode_model_rollout_plan.md`：標記完成項目（待更新）
