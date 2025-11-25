## 背景
- Admin Panel 已具 Snapshot/Timeline/Episode CRUD 與播放指令，但缺少「當前狀態回饋」與「排程/佇列」能力，無法確認指令是否生效，也無法預先安排播放。

## 目標
- 即時顯示每個 client 的心跳、當前 snapshot/timeline/episode、錯誤與當前步驟。
- 提供佇列/排程播放（snapshot/timeline/episode），可插隊、延後、取消。
- 透過 WebSocket 讓指令有回饋，並暴露 REST 端點供查詢/管理。

## 範圍界定
- **後端**：FastAPI 端點、佇列執行器、WS broadcast、資料持久化（記憶體優先，預留 Redis/SQLite 選項）。
- **前端**：Admin 新增「狀態/排程」分頁，含列表、佇列操作、快速派送表單與即時更新。
- **測試與監控**：單元測試、前端 E2E、log/metrics；不做大規模重構，只在現有 service 上擴充。

## 後端需求
- `GET /api/clients/state`：回傳 client 狀態（heartbeat ts、current_snapshot、current_timeline、current_episode、current_step、errors、queue size）。
- `GET /api/clients/queue?client=id`：取佇列（items: type snapshot|timeline|episode、target_id、eta、status、retries）。
- `POST /api/clients/queue`：新增佇列項（可選 eta/priority）。
- `POST /api/clients/queue/{id}/cancel`、`/delay`、`/move`：管理佇列。
- WebSocket broadcast `client_state`：狀態/佇列變化即時推送。
- 內部：heartbeat 機制（現有 socket? 定期 ping），佇列執行器（超時/重試/重排），並保護佇列與手動播放的互斥。

### 資料模型
- `ClientState`：`client_id`、`last_heartbeat`、`current_item`（type/id/step/started_at/progress）、`errors`、`queue_size`、`status`（online/offline/busy/idle）。
- `QueueItem`：`id`、`client_id`、`type` (snapshot|timeline|episode)、`target_id`、`eta`、`priority`、`status` (pending/running/done/failed/canceled)、`retries`、`created_at`、`updated_at`、`error_message`、`payload`（可選自訂 params）。
- 儲存：先用 in-memory + background task；預留抽象介面，方便未來切換 Redis/DB。

### 佇列執行器與互斥策略
- 每個 client 一條 worker coroutine，處理 ETA/priority 排序後的 pending 項目。
- 執行時鎖住 client 播放（避免與 Admin 直接播放衝突）；若手動播放時有佇列 pending，視為「blocked」並回報在 state。
- 超時/重試：執行 API 時設定 timeout；失敗時依 `retries` 次數重試並累積 backoff；失敗次數用完標記 failed 並廣播。
- 插隊/移動：`/move` 支援調整 priority 或直接放到 queue 頭；`/delay` 調整 ETA；`/cancel` 標記並廣播。
- Heartbeat：沿用現有 socket ping，若超過閾值（例如 10s）標記 offline，佇列暫停；恢復後重新排程。

### API 與回傳格式細節
- `GET /api/clients/state` 回傳 `{ clients: [ {client_id, status, last_heartbeat, current_item, queue_size, errors} ] }`。
- `GET /api/clients/queue` 支援 `client_id` 必填、`status` 過濾、`page/limit` 分頁。
- `POST /api/clients/queue` request: `{client_id, type, target_id, eta?, priority?, payload?}`，response 回傳新 `QueueItem`。
- `/cancel` 允許批次 `ids`；`/delay` 接受 `delta_seconds` 或 `eta`；`/move` 接受 `priority` 或 `position`。
- WebSocket `client_state` payload：`{client_id, state: ClientState, queue: [QueueItem] (截斷到前 N 筆)}；支援事件型 `event` 欄位（created/updated/completed`）。`

### 服務整合點
- 在既有 `app/services/iframe.py`/`timeline.py`/`episodes.py` 包裝呼叫，讓佇列 worker 透過統一介面執行播放。
- 在 `app/main.py` WebSocket handler 中廣播 `client_state` 事件；REST 端點放在 `app/api/clients.py`。
- 新增 background task 啟動 queue workers（依活躍 client 動態建立）。
- log：在佇列事件、狀態變更處加結構化 log（含 `client_id`、`queue_item_id`、`event`）。

## 前端需求（Admin 新 Tab: 狀態/排程）
- Client 卡片列表：顯示心跳、當前播放、錯誤 badge、佇列數；支援依狀態排序/篩選。
- 佇列面板：列出項目，操作「插隊/延後/取消/重播上一個」，可直接輸入 snapshot/timeline/episode id 與 target client。
- 右側「快速派送」表單：沿用既有 API 呼叫（`restoreIframeSnapshot`、`playIframeTimeline`、`playEpisode`），並寫入佇列 API。
- 即時刷新：透過 WS 更新；fallback 輪詢（5~10s）。

### UI 流程
- Admin 選取 client → 左側卡片顯示狀態與佇列摘要 → 右側顯示該 client 的佇列詳情與控制按鈕。
- 「插隊」：送 `/move`（priority 高）或直接新增 `priority=highest`；「延後」：送 `/delay`；「取消」：送 `/cancel`。
- 「重播上一個」：從 `current_item` 取 `target_id/type` 重新推送 `POST /queue`。
- 表單驗證：必要欄位（client、type、target_id）必填，ETA/priority 選填；操作結果以 toast/Badge 顯示，並由 WS 更新畫面。

### 組件與狀態管理
- 新增 Admin Tab（依現有 Tab 系統）；建立 hooks：`useClientState`（WS + polling）、`useClientQueue`（佇列 CRUD）。
- 組件拆分：`ClientStateCard`（心跳/當前播放/queue badge）、`QueueTable`（項目列表 + 操作）、`QuickDispatchForm`。
- 狀態格式沿用後端回傳；WS event 直接更新 store，polling 作為 fallback。
- 錯誤處理：離線狀態標示灰階；佇列操作失敗顯示錯誤訊息並保持原資料。

## 驗證與監控
- 單元測試：佇列 CRUD、狀態格式、超時/重試邏輯。
- 前端 E2E：派送→狀態變化→佇列出隊。
- 觀測：伺服器 log 增加 `client_state`/佇列事件；可選 Prometheus 計量（佇列長度、失敗率）。

### 測試細節
- 後端：mock 播放 service，驗證 queue worker 執行順序、priority/eta 處理、重試與 timeout；API schema 測試；WS event 內容。
- 前端：Vitest + RTL 覆蓋 hook（WS 更新/poll fallback）、表單驗證、按鈕觸發正確 API；E2E（Playwright）跑最小 happy path。

### 監控/觀測
- Log 加上 `queue_item_id`、`client_id`、`event`（enqueue/start/success/fail/cancel/delay）供搜尋。
- 若已有 metrics，新增 gauge `client_queue_length`、counter `client_queue_failures_total`；無 Prometheus 則至少保留 log。

## 風險與緩解
- 佇列與手動播放衝突：鎖定期間拒絕或合併，並回傳錯誤訊息。
- 心跳缺失：前端標示「離線」，不自動重試播放；可選自動清理過期佇列。
- 佇列爆量：加上每 client 限制與分頁。

### 里程碑與交付順序
1) **後端 API + 資料模型**：完成 state/queue 端點與 in-memory 佇列、WS broadcast（含單元測試）。
2) **佇列執行器**：補齊 worker/鎖/重試/timeout；串接既有播放 service；觀測 log。
3) **前端 Tab**：實作 UI/Hook/操作；接上 WS 與 polling；前端測試。
4) **整合驗證**：最小 E2E（enqueue → state 變化 → 出隊播放）。
5) **最佳化**（如分頁/metrics），依時間追加。
