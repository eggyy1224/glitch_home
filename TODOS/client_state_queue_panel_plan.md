## 背景
- Admin Panel 已具 Snapshot/Timeline/Episode CRUD 與播放指令，但缺少「當前狀態回饋」與「排程/佇列」能力，無法確認指令是否生效，也無法預先安排播放。

## 目標
- 即時顯示每個 client 的心跳、當前 snapshot/timeline/episode、錯誤與當前步驟。
- 提供佇列/排程播放（snapshot/timeline/episode），可插隊、延後、取消。
- 透過 WebSocket 讓指令有回饋，並暴露 REST 端點供查詢/管理。

## 後端需求
- `GET /api/clients/state`：回傳 client 狀態（heartbeat ts、current_snapshot、current_timeline、current_episode、current_step、errors、queue size）。
- `GET /api/clients/queue?client=id`：取佇列（items: type snapshot|timeline|episode、target_id、eta、status、retries）。
- `POST /api/clients/queue`：新增佇列項（可選 eta/priority）。
- `POST /api/clients/queue/{id}/cancel`、`/delay`、`/move`：管理佇列。
- WebSocket broadcast `client_state`：狀態/佇列變化即時推送。
- 內部：heartbeat 機制（現有 socket? 定期 ping），佇列執行器（超時/重試/重排），並保護佇列與手動播放的互斥。

## 前端需求（Admin 新 Tab: 狀態/排程）
- Client 卡片列表：顯示心跳、當前播放、錯誤 badge、佇列數；支援依狀態排序/篩選。
- 佇列面板：列出項目，操作「插隊/延後/取消/重播上一個」，可直接輸入 snapshot/timeline/episode id 與 target client。
- 右側「快速派送」表單：沿用既有 API 呼叫（`restoreIframeSnapshot`、`playIframeTimeline`、`playEpisode`），並寫入佇列 API。
- 即時刷新：透過 WS 更新；fallback 輪詢（5~10s）。

## 驗證與監控
- 單元測試：佇列 CRUD、狀態格式、超時/重試邏輯。
- 前端 E2E：派送→狀態變化→佇列出隊。
- 觀測：伺服器 log 增加 `client_state`/佇列事件；可選 Prometheus 計量（佇列長度、失敗率）。

## 風險與緩解
- 佇列與手動播放衝突：鎖定期間拒絕或合併，並回傳錯誤訊息。
- 心跳缺失：前端標示「離線」，不自動重試播放；可選自動清理過期佇列。
- 佇列爆量：加上每 client 限制與分頁。
