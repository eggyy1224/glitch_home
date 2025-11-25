## 背景
- Timeline/Episode 目前以 JSON 編輯，容易出錯且缺少視覺化排序、預覽與驗證；大量 snapshot/timeline 節點需要更高效率的編排工具。

## 目標
- 以視覺化 UI 編輯 timeline steps 與 episode tracks，支援拖拉排序、複製/貼上、即時驗證。
- 內建預覽：timeline 首段 snapshot 預覽、整段播放預覽；episode 播放 target map 覆寫。
- 逐步導入，保留 JSON 編輯模式並可互相同步。

## 前端需求
- Timeline Editor：列表/卡片顯示 steps（snapshot ref、duration、label、client override），可拖拉排序、複製、刪除；提供 snapshot 選擇器（搜尋/篩選 by client/tag），右側即時預覽與播放按鈕。
- Episode Editor：tracks 清單（timelineId、targetClientId、delay/offset），可排序/批次設定 target client；內建「目標 map」覆寫輸入。
- 驗證提示：表單內即時顯示缺漏（id/duration/不存在的 snapshot/timeline）；與 JSON 區塊互通（修改 UI 會更新 JSON 文本，反之亦然）。
- 佈局建議：雙欄（左列表＋操作、右預覽＋ JSON）、支援折疊與全螢幕編輯。

## 後端需求
- 驗證端點：`POST /api/iframe-timelines/validate`、`/api/episodes/validate` 回傳欄位錯誤與建議（missing snapshot/timeline、型別錯）。
- Snapshot / Timeline 搜尋輔助：`GET /api/iframe-config/snapshots/search?q=...&client=...&tag=...`（可複用資產庫計畫的搜尋）。
- 可選：`/api/iframe-timelines/{id}/simulate` 回傳播放序列展開（方便預覽）。

## 驗證
- 單元測試：UI state ↔ JSON 同步、拖拉排序結果、驗證錯誤顯示。
- API 測試：validate/simulate 正常與錯誤案例。
- 手動流程：從 UI 新建/覆寫 timeline/episode → 播放預覽 → 實際送播。

## 風險與緩解
- 大型 timeline/episode 效能：使用虛擬列表、延遲驗證（debounce）避免卡頓。
- Schema 演進：將表單欄位來源集中在 schema 定義，避免多處硬編碼。
- 使用者混用 JSON/UI：提供「鎖定模式」避免競態，並顯示最後同步時間。
