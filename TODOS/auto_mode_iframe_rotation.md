## auto_mode iframe 自動輪播（10 秒切換）

- 目標：在 iframe 播放端偵測 `auto_mode=true` 時，自動輪播該 client 的 snapshots（預設抓 `/api/iframe-config/snapshots?client=<preset>`，按 mtime 順序）。每 10 秒切換，暫無轉場動畫。
- 播放端（player-desktop 前端頁面或載入 iframe-config 的頁面）：
  - 解析 URL 參數 `auto_mode`，為 true 時啟動輪播協程；維持原有單一 snapshot 行為做 fallback。
  - 取清單：先抓對應 client 的 snapshots；若空則 fallback global；遇錯誤顯示狀態提示並停輪播。
  - 迴圈：初次載入第一筆，`setInterval` 每 10 秒切下一筆（循環）；每 N 秒（或每次切換前）重新 fetch 更新隊列。
  - 防呆：空清單不切換；URL 解析失敗/檔案缺漏需跳過並記錄；顯示「自動播放中」狀態文字，保留手動「下一張/暫停」按鈕以便現場測試。
- 設定側：
  - `clients.json` 的 preset 允許加入 `auto_mode: "true"` 作為預設 URL 參數，校正 UI 顯示該狀態。
  - 如有需要，後端 `/api/iframe-config/snapshots` 可加 `limit` 或 `order` 參數（先不做也可跑 MVP）。
- 待辦：
  - [ ] 在 iframe 前端頁面實作 `auto_mode` 解析與輪播邏輯（含錯誤/空清單處理）。
  - [ ] Player preset 加 `auto_mode`，校正 UI 呈現。
  - [ ] （可選）加淡入/黑場轉場，與本地 log/debug 面板。
