# 後端控制台建置待辦清單（2025-11-04）

本文件整理了建立「後端導播控制台」所需的主要工作項目。目標是讓操作人員透過單一面板操控各客戶端的展示流程、字幕、音效與劇本排程。

---

## 0. 規劃與安全基礎
- [ ] 決定控制台部署方式（與現有 FastAPI 合併 vs. 獨立服務）。
- [ ] 補強 API 認證：新增 `/admin` 相關端點時要導入 JWT 或 Basic Auth（FastAPI Depends）。
- [ ] 審視現有敏感指令（iframe-config、subtitles、sound-play）權限需求，標記需保護的路由。
- [ ] 建立操作日誌機制，記錄每次控制台操作（時間、操作者、目標客戶端、payload）。

## 1. 最小可行控制台（MVP）
- [ ] 在 `frontend/` 新增 `/admin` Route 或獨立 Vite 專案，串接 FastAPI。
- [ ] 介面模組 A：客戶端監控
  - [ ] 呼叫 `GET /api/clients` 列出 `client_id` 與連線數。
  - [ ] 顯示 WS 即時事件（`iframe_config`, `subtitle_update`, `sound_play`）。
- [ ] 介面模組 B：多面板佈局控制
  - [ ] 透過 `PUT /api/iframe-config` 送出 JSON；提供「模板按鈕」與「JSON 編輯模式」。
  - [ ] 支援 `target_client_id` 指定（至少 `desktop`、`integration_test`）。
- [ ] 介面模組 C：字幕 / Caption 管理
  - [ ] `GET /api/subtitles?client=` 抓取現況，`POST /api/subtitles` 推送；同理處理 caption。
  - [ ] 顯示倒數計時／狀態標記。
- [ ] 封裝與重用現有 hook `useControlSocket` 以顯示即時狀態。

## 2. 劇本與時間線支援
- [ ] 設計 `showrunner` JSON 格式（時間 t、動作類型、target_client_id、payload）。
- [ ] 後端新增 `/api/showrunner/run` 接收劇本並以 BackgroundTasks 排程呼叫既有 API。
- [ ] 控制台提供時間線編輯器：
  - [ ] 能新增「字幕段」、「鏡頭切換」、「iframe 佈局」等事件。
  - [ ] 可設定延遲或精確時間戳。
  - [ ] 允許儲存/載入劇本（存成 `backend/metadata/showrunner/*.json`）。
- [ ] 加入「預覽跑」功能（僅對測試客戶端施作）。

## 3. 媒體與截圖操作
- [ ] 音效播放：整合 `GET /api/sound-files` 列出清單，`POST /api/sound-play` 指定客戶端。
- [ ] TTS 快捷：在控制台輸入文字 → `POST /api/tts`（可選自動播放 `auto_play=true`）。
- [ ] 截圖請求：提供按鈕呼叫 `POST /api/screenshots/request`，並以 WS 回報狀態；內嵌 `screen_shots/` 預覽。
- [ ] 彙整最新截圖的 thumbnail／原圖下載連結。

## 4. 視覺提示與演出節奏工具
- [ ] 讓控制台能推送「過場遮罩」「提示字幕」：封裝固定模板的 iframe-config 或字幕內容。
- [ ] 可選擇預錄 TTS + 字幕，同步推送實時敘事。
- [ ] 接入鏡頭 preset：
  - [ ] 讀取 `GET /api/camera-presets`，列出可套用的視角。
  - [ ] 能觸發 `POST /api/camera-presets` 將目前鏡頭存成預設（配合 `useScreenshotManager`）。

## 5. 程式碼整理與文件
- [ ] 將控制台專用 API 補入 `docs/API_QUICK_START_GUIDE.md` 或另建 `docs/ADMIN_CONSOLE_GUIDE.md`。
- [ ] 更新 `docs/system_architecture/後端架構概論.md`，描述控制台與現有模組的流程。
- [ ] 撰寫常見操作腳本範例（例如「三段式展示」劇本 JSON + 操作說明）。
- [ ] 建立端對端測試腳本（可參照 `integration_tests/`）驗證劇本執行。

## 6. 進階功能（選擇性）
- [ ] 角色權限：區分導播、語音、技術員等角色能看到的控制項。
- [ ] 事件排程：支援「在某時間自動播放某劇本」，可整合 cron 或 APScheduler。
- [ ] 操作回放：把操作日誌轉換成劇本 JSON，可一鍵重播。
- [ ] 與向量搜尋整合：在控制台挑選一張圖 → 自動生成 kinship 場景並推送。

---

### 參考現有 API 路徑
- `GET /api/clients`（列出連線｜`backend/app/api/realtime.py:18`）
- `PUT /api/iframe-config`（更新佈局｜`backend/app/api/storage.py:31`）
- `POST /api/subtitles` / `DELETE /api/subtitles`（字幕推送｜`backend/app/api/realtime.py:26`）
- `POST /api/sound-play`（音效播送｜`backend/app/api/media.py:317`）
- `POST /api/tts`（語音生成｜`backend/app/api/media.py:343`）
- `POST /api/screenshots/request`（截圖請求｜`backend/app/api/realtime.py:68`）

---

> 註：本清單依照「從最少可行版本 → 排程劇本 → 進階導播工具」三階段規劃。建議完成 0 與 1 後，先和策展/導播團隊共同測試，再逐步加入劇本/媒體模組。
