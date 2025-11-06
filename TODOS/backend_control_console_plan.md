# 後端控制台建置待辦清單（2025-11-04）

本文件整理了建立「後端導播控制台」所需的主要工作項目。目標是讓操作人員透過單一面板操控各客戶端的展示流程、字幕、音效與劇本排程。

---

## 0. 規劃與安全基礎
- [ ] 決定控制台部署方式（與現有 FastAPI 合併 vs. 獨立服務）。
- [ ] 補強 API 認證：新增 `/admin` 相關端點時要導入 JWT 或 Basic Auth（FastAPI Depends）。
- [ ] 審視現有敏感指令（iframe-config、subtitles、sound-play）權限需求，標記需保護的路由。
- [ ] 規畫 `DisplayStateManager` 與容器設定的持久化策略（檔案、DB 或記憶體 + 備援）。
- [ ] 設計 WebSocket 握手資料：客戶端登入時回報 `client_id`、能力（支援模式、螢幕資訊）、心跳頻率。
- [ ] 建立操作日誌機制，記錄每次控制台操作（時間、操作者、目標客戶端、payload）。

## 1. 最小可行控制台（MVP）
- [ ] 在 `frontend/` 新增 `/admin` Route 或獨立 Vite 專案，串接 FastAPI。
- [ ] 介面模組 A：客戶端監控
  - [ ] 呼叫 `GET /api/clients` 列出 `client_id`、連線數與已回報能力。
  - [ ] 顯示 WS 即時事件（`display_state`, `container_layout`, `subtitle_update`, `sound_play`）。
- [ ] 介面模組 B：顯示狀態控制
  - [ ] 串接 `POST /api/clients/{client_id}/display`（或等效端點）設定 `mode`、主要圖像、參數。
  - [ ] 顯示目前 `display_state` 並提供快速套用常用場景的按鈕。
- [ ] 介面模組 C：容器 / 多面板佈局
  - [ ] 透過（暫名）`PUT /api/container-layout` 送出 JSON；提供「模板」+「JSON 編輯」模式。
  - [ ] 支援 `target_client_id` 指定（至少 `desktop`、`integration_test`）。
- [ ] 介面模組 D：字幕 / Caption 管理
  - [ ] `GET /api/subtitles?client=` 抓取現況，`POST /api/subtitles` 推送；同理處理 caption。
  - [ ] 顯示倒數計時／狀態標記，並提供快捷清除功能。
- [ ] 介面模組 E：音效 / TTS 快捷（最小版）
  - [ ] 列出 `GET /api/sound-files`，讓操作者能 `POST /api/sound-play`。
  - [ ] 提供 TTS 輸入 → `POST /api/tts`（可選 `auto_play`）。
- [ ] 封裝並重用 `useControlSocket`，擴充處理 `display_state` 與 `container_layout`。

## 2. 顯示控制基礎建設
- [ ] 實作 `DisplayStateManager`：
  - [ ] 支援全域 / per-client 狀態、快照與過期時間。
  - [ ] 提供 `get/set/delete` API 與 WebSocket broadcast（訊息類型 `display_state`）。
- [ ] 重新定義容器設定模組
  - [ ] 將既有 `iframe_config` API / schema 改名為容器設定（`container_layout`）。
  - [ ] 支援面板指定 `mode`、`params`、`weight`，與獨立的 `layout` 屬性。
- [ ] 擴充 WebSocket manager
  - [ ] 保存客戶端能力資訊與最後心跳時間。
  - [ ] 新增廣播方法 `broadcast_display_state`、更新 `broadcast_iframe_config` → `broadcast_container_layout`。
- [ ] 定義新 REST 端點
  - [ ] `POST /api/clients/{client_id}/display`（或等效）變更顯示狀態。
  - [ ] `GET /api/clients/{client_id}/display` 回報目前狀態。
  - [ ] `PUT /api/container-layout` 與 `GET /api/container-layout` 支援 `target_client_id`。

## 3. 劇本與時間線支援
- [ ] 設計 `showrunner` JSON 格式（時間 t、動作類型、target_client_id、payload）。
- [ ] 動作類型包含：`set_display_state`、`apply_container_layout`、`push_subtitle`、`play_sound` 等。
- [ ] 後端新增 `/api/showrunner/run` 接收劇本並以 BackgroundTasks 排程呼叫上述 API。
- [ ] 控制台提供時間線編輯器：
  - [ ] 能新增「字幕段」、「顯示狀態」、「容器切換」、「音效」等事件。
  - [ ] 可設定延遲或精確時間戳。
  - [ ] 允許儲存/載入劇本（存成 `backend/metadata/showrunner/*.json`）。
- [ ] 加入「預覽跑」功能（僅對測試客戶端施作）。

## 4. 媒體與截圖操作
- [ ] 音效播放：整合 `GET /api/sound-files` 列出清單，`POST /api/sound-play` 指定客戶端。
- [ ] TTS 快捷：在控制台輸入文字 → `POST /api/tts`（可選自動播放 `auto_play=true`）。
- [ ] 截圖請求：提供按鈕呼叫 `POST /api/screenshots/request`，並以 WS 回報狀態；內嵌 `screen_shots/` 預覽。
- [ ] 彙整最新截圖的 thumbnail／原圖下載連結。

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
