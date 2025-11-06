# 後端控制台建置待辦清單（2025-11-04）

本文件整理了建立「後端導播控制台」所需的主要工作項目。目標是讓操作人員透過單一面板操控各客戶端的展示流程、字幕、音效與劇本排程。

---

## 0. 架構定義與連線資料
- [ ] 定義 `DisplayState` 與 frame schema：描述 `mode`、`params`、slot／frame 層級資訊。
- [ ] 整理 `iframe_mode` 與容器（`container_layout`）的對應關係，統一命名與儲存位置。
- [ ] 設計 WebSocket 握手 payload（`client_id`、能力標籤、心跳間隔）與狀態保存策略。
- [ ] 規劃 `GET /api/clients` 回傳欄位（連線數、最後心跳、已載入容器與 frame 快照）。
- [ ] 準備初始樣本資料／mock route，方便控制台 UI 在後端完成前可預覽資料。

> 備註：目前僅內網單人操作，本階段不處理身份驗證與授權機制。

## 1. 顯示控制後端建置
- [ ] 實作 `DisplayStateManager`：支援全域／per-client 狀態、快照與過期時間。
- [ ] 提供 `get/set/delete` API 與 `broadcast_display_state` WebSocket 事件。
- [ ] 重構容器設定模組：將既有 `iframe_config` API/schema 改為 `container_layout`，整理 metadata 檔案。
- [ ] 補齊 `collage_mode` 控制 API：定義 schema 與路由，能設定 collage 參數並同步廣播至目標 client。
- [ ] 擴充 WebSocket manager：保存客戶端能力資訊與最後心跳時間，提供 `broadcast_container_layout`。
- [ ] 定義 REST 端點：
  - [ ] `POST /api/clients/{client_id}/display` 變更顯示狀態。
  - [ ] `GET /api/clients/{client_id}/display` 回傳目前狀態與 frame 內容。
  - [ ] `PUT /api/container-layout`、`GET /api/container-layout` 支援 `target_client_id` 指定。
- [ ] 提供內部用快照工具（CLI 或腳本），方便除錯與未來回放模組使用。

## 2. 控制台最小可行版本（MVP）
- [ ] 在 FastAPI 專案內提供 `/admin` 控制台頁面（可用 Jinja2/HTMX 或內嵌單頁），直接由後端服務靜態資源與 API。
- [ ] 介面模組 A：客戶端監控
  - [ ] 呼叫 `GET /api/clients` 列出 `client_id`、連線數、能力標籤、最後心跳。
  - [ ] 顯示 WS 即時事件（`display_state`、`container_layout`、`subtitle_update`、`sound_play`）。
- [ ] 介面模組 B：顯示狀態控台
  - [ ] 串接 `POST /api/clients/{client_id}/display` 設定 `mode` 與主要圖像/參數。
  - [ ] 顯示目前 `display_state`，展開各 frame 內容，提供常用場景快捷鍵。
- [ ] 介面模組 C：容器／多面板佈局
  - [ ] 透過 `PUT /api/container-layout` 送出 JSON；提供「模板挑選」與「JSON 編輯」模式。
  - [ ] 操作時必須選擇 `target_client_id`（至少支援 `desktop`、`integration_test`）。
- [ ] 介面模組 D：字幕／Caption 管理
  - [ ] `GET /api/subtitles?client=` 取得現況，`POST /api/subtitles` 推送；同理處理 caption。
  - [ ] UI 必須明確標註目標 client，並提供倒數計時、快捷清除。
- [ ] 介面模組 E：音效／TTS 快捷
  - [ ] 列出 `GET /api/sound-files`，操作時需選擇目標 client 後才能呼叫 `POST /api/sound-play`。
  - [ ] 提供 TTS 輸入 → `POST /api/tts`（支援 `auto_play` 與送往指定 client）。
- [ ] 整合現有 WebSocket 控制邏輯（可重用 `useControlSocket` 或等效模組），擴充處理 `display_state` 與 `container_layout`；提供 per-client 操作確認提示。

## 3. 媒體與截圖操作
- [ ] 音效播放：整合 `GET /api/sound-files` 清單，`POST /api/sound-play` 支援 `target_client_id`。
- [ ] TTS 快捷：在控制台輸入文字 → `POST /api/tts`（可選 `auto_play=true`，指定 client）。
- [ ] 截圖請求：提供按鈕呼叫 `POST /api/screenshots/request`，並以 WS 回報狀態；內嵌 `screen_shots/` 預覽。
- [ ] 彙整最新截圖的 thumbnail／原圖下載連結。
 
## 4. 劇本與時間線支援
- [ ] 設計 `showrunner` JSON 格式（時間 t、動作類型、target_client_id、payload）。
- [ ] 動作類型包含：`set_display_state`、`apply_container_layout`、`push_subtitle`、`play_sound` 等。
- [ ] 後端新增 `/api/showrunner/run` 接收劇本並以 BackgroundTasks 排程呼叫上述 API。
- [ ] 控制台提供時間線編輯器：
  - [ ] 能新增「字幕段」、「顯示狀態」、「容器切換」、「音效」等事件。
  - [ ] 可設定延遲或精確時間戳。
  - [ ] 允許儲存/載入劇本（存成 `backend/metadata/showrunner/*.json`）。
- [ ] 加入「預覽跑」功能（僅對測試客戶端施作）。

## 5. 視覺提示與演出節奏工具
- [ ] 讓控制台能推送「過場遮罩」「提示字幕」：封裝固定模板的 iframe-config 或字幕內容。
- [ ] 可選擇預錄 TTS + 字幕，同步推送實時敘事。
- [ ] 接入鏡頭 preset：
  - [ ] 讀取 `GET /api/camera-presets`，列出可套用的視角。
  - [ ] 能觸發 `POST /api/camera-presets` 將目前鏡頭存成預設（配合 `useScreenshotManager`）。

## 6. 程式碼整理與文件
- [ ] 將控制台專用 API（`display_state`、`container_layout`、`showrunner` 等）補入 `docs/API_QUICK_START_GUIDE.md` 或另建 `docs/ADMIN_CONSOLE_GUIDE.md`。
- [ ] 更新 `docs/system_architecture/後端架構概論.md`，描述控制台、`DisplayStateManager` 與容器模組之間的流程。
- [ ] 撰寫常見操作腳本範例（例如「三段式展示」劇本 JSON + 操作說明）。
- [ ] 建立端對端測試腳本（可參照 `integration_tests/`）驗證劇本執行。

## 7. 進階功能（選擇性）
- [ ] 角色權限：區分導播、語音、技術員等角色能看到的控制項。
- [ ] 事件排程：支援「在某時間自動播放某劇本」，可整合 cron 或 APScheduler。
- [ ] 操作回放：把操作日誌轉換成劇本 JSON，可一鍵重播。
- [ ] 與向量搜尋整合：在控制台挑選一張圖 → 自動生成 kinship 場景並推送。

---

### 參考現有 API 路徑
- `GET /api/clients`（列出連線｜`backend/app/api/realtime.py:18`）
- `PUT /api/iframe-config` → 待改名為 `container-layout`（更新佈局｜`backend/app/api/storage.py:31`）
- `POST /api/subtitles` / `DELETE /api/subtitles`（字幕推送｜`backend/app/api/realtime.py:26`）
- `POST /api/sound-play`（音效播送｜`backend/app/api/media.py:317`）
- `POST /api/tts`（語音生成｜`backend/app/api/media.py:343`）
- `POST /api/screenshots/request`（截圖請求｜`backend/app/api/realtime.py:68`）
- `POST /api/clients/{client}/display`（待新增，顯示狀態更新）

---

> 註：本清單依照「從最少可行版本 → 排程劇本 → 進階導播工具」三階段規劃。建議完成 0 與 1 後，先和策展/導播團隊共同測試，再逐步加入劇本/媒體模組。
