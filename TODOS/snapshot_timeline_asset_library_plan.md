## 背景
- Snapshot/timeline JSON 在 `backend/metadata/snapshots/iframe_config/**` 持續累積（百格 slide、八路影片等），現有列表查找效率低、缺少標記與分類。

## 目標
- 為 snapshot/timeline 建立可搜尋、可標籤的資產庫；支援按 client/標籤/關鍵字篩選與收藏。
- 批次標記既有檔案並維持單一 metadata 來源。
- 在 Admin Panel 提供快速選用與預覽。

## 後端需求
- 資產 metadata 格式：在原 JSON 增加 `tags`、`description`、`author`、`created_at`、`updated_at` 等欄位，或同路徑 sidecar `*.meta.json`。
- 搜尋端點：
  - `GET /api/iframe-config/snapshots/search?q=&client=&tag=&limit=`（部分名稱、標籤、client）
  - `GET /api/iframe-timelines/search?q=&client=&tag=&limit=`
- 批次標記工具：管理腳本掃描既有檔案生成/合併 metadata，支援 CLI 指派 tag。
- 回傳列表需分頁或限制筆數；提供 `etag/version` 方便前端快取。

## 前端需求
- SnapshotManager/TimelineManager 列表加入搜尋框＋標籤篩選；顯示 tags、描述與 client。
- 收藏/置頂：本地或伺服端紀錄常用項目。
- 批次標記對話框：可勾選多筆、批次加/移除 tag。
- 預覽：沿用現有 iframe 預覽，並顯示 metadata。

## 驗證
- API 測試：搜尋條件組合（名稱、tag、client）與分頁邏輯。
- 前端：搜尋→點擊預覽→套用播放；批次標記後列表刷新顯示新 tag。

## 風險與緩解
- 標籤來源分散：強制讀寫單一 metadata 檔（或 sidecar），避免多處不一致。
- 搜尋回傳過大：預設 limit、分頁；可加伺服端速率限制。
- 老檔案無 metadata：批次工具提供預設 tag（例如 `legacy`）並允許手動修正。
