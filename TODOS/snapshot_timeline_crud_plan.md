# Snapshot & Timeline CRUD 實作計劃

## 目標
- 提供 iframe snapshot（iframe_config 快照）與 iframe timeline 的完整 CRUD API。
- 前端提供管理介面，可列出、查看、建立、覆寫、刪除、預覽與複製 snapshot/timeline，並可直接發起播放預覽。
- 遵循現有 API 風格與驗證邏輯，保持相容既有播放與 WebSocket 廣播流程。

## 後端工作
1) Snapshot CRUD API 擴充
- `GET /api/iframe-config/snapshots/{client}/{name}`：取回指定 snapshot 內容（以 `load_iframe_config_snapshot_config` 驗證），回傳 config payload + metadata。
- `PUT /api/iframe-config/snapshots/{client}/{name}`：覆寫 snapshot 檔，套用 `_validate_images`，回傳 metadata；若不存在且允許 upsert 可同時建立。
- `DELETE /api/iframe-config/snapshots/{client}/{name}`：刪除 snapshot 檔，不影響現行 config；不存在回 404。
- 可選：`POST /api/iframe-config/snapshots/{client}/{name}/clone`，body 帶 `target_client`/`target_name`，複製檔案。
- 補充檔案路徑與 client/name 驗證，重用 `_snapshot_path_for` 與 `_sanitize_client_id`。

2) Timeline CRUD API 擴充
- `POST /api/iframe-timelines`：新增 timeline，使用 `sanitize_timeline_id` + `IframeTimeline.model_validate` 後寫入 `{id}.json`，回傳 resolved payload（可加 `?resolve=false` 跳過解析）。
- `PUT /api/iframe-timelines/{id}`：覆寫/更新既有 timeline，驗證同上。
- `DELETE /api/iframe-timelines/{id}`：刪除檔案，404 不存在。
- 可選：`POST /api/iframe-timelines/{id}/clone`：body 提供 `new_id`/`target_client_id`，可批次替換 snapshot prefix 為目標 client。
- `GET /api/iframe-timelines` 已有列表，可保留；若新增 query `raw=true`，可回傳未解析版本以利編輯。

3) 測試
- 為新端點新增 FastAPI tests（驗證 200/400/404、檔案寫入、JSON format、clone 行為、resolve=true/false）。
- 覆蓋 snapshot 覆寫/刪除/clone、timeline 新增/更新/刪除/clone 的 happy path 與錯誤路徑。

## 前端工作
1) API 模組
- 新增：`listIframeTimelines`, `createIframeTimeline`, `updateIframeTimeline`, `deleteIframeTimeline`, `cloneIframeTimeline`；
  `listIframeSnapshots`, `getIframeSnapshot`, `saveIframeSnapshot`, `deleteIframeSnapshot`, `cloneIframeSnapshot`。
- 保持與現有 fetch 規格一致，錯誤拋出 `Error`。

2) 管理 UI（最小版）
- 新增一頁/面板「播放端管理」：
  - Snapshot 區：選 client → 列表 (name/時間/大小)，查看內容、覆寫（編輯 JSON 後送 PUT）、刪除、clone；可一鍵載入成當前 iframe 設定以預覽。
  - Timeline 區：列表所有 timeline（可依 client 過濾），支援新增/編輯/刪除/clone。編輯介面提供 meta + steps 表單（snapshot 選單從該 client snapshots 取值），保存後可直接播放預覽（重用 useRemoteTimelineControl）。
- 加上基本狀態提示與錯誤顯示，避免影響主播放 UI。

3) 驗證/UX
- 前端保存前可做輕量欄位檢查（id 必填、snapshot 格式 `client/name`）。
- 提供「套用並播放」按鈕：保存 timeline 後，對當前 client 呼叫 `/play` 進行快速預覽。

## 資料兼容與安全
- 保持檔案寫入在 `backend/metadata/{snapshots,timelines}/`，遵守 `sanitize_*` 規則，避免路徑穿越。
- 寫入 JSON 採 `ensure_ascii=False, indent=2`，與既有檔案風格一致。
- 所有新端點回傳結構比照現有 API：400/404/500 提供簡單文字 detail。

## 風險與後續
- 大型 timeline JSON 編輯易出錯：可考慮後續改為 schema 驗證回饋更細。
- clone/批次替換需要清楚規則，避免誤改 cross-client action target；先提供簡單 prefix 替換，進階映射留後。
