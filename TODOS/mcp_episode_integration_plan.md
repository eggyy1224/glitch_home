# MCP／LLM 與 Episode 抽象整合計劃（2025-11-17）

## 0. 背景
- MCP server 已能操作 image search、assets listing、iframe/collage config、speak-with-subtitle 等低階工具。
- 隨著 Episode 模型成型，需要讓 MCP/LLM 能以 Episode 為主語控制展演、建立草稿與查詢資產依賴。
- 若缺少高階抽象，LLM 仍會持續操作脆弱的 config endpoint，增加錯誤率。

## 1. 現況盤點
- MCP 主要針對單一 API 或檔案層級操作，無法直接得知「哪些 Episode 可用、包含哪些 timeline 與 assets」。
- Dashboard 與 backend 目前沒有一條龍的指令可讓 Agent 一鍵播放 Episode 或取得完整描述。
- Agents/AGENTS.md 已描述多項工具，但欠缺 Episode 相關章節與使用指南。

## 2. Episode 級別工具與流程
- `list_episodes`：列出 Episode 基本資訊（title, tags, status），供選擇與搜尋。
- `get_episode_details`：回傳 Episode 內的 timeline ID、assets（images/snapshots/audio/subtitles）、clients_layout。
- `play_episode`：請求 backend/Dashboard 播放某 Episode，可附帶 target clients 或安全檢查。
- `create_episode_from_template`：依模板與資源清單建立草稿 Episode，僅於 sandbox/草稿狀態生效。
- `update_episode_metadata`：調整 title/description/tags 等非破壞性欄位，必要時需人類確認。
- 上述工具都必須回傳充足的審計資訊（日誌 ID、操作人、建議的人工確認步驟）。

## 3. 實作路線圖
- [ ] Phase 1：Read-only 整合
  - [ ] Episode API 就緒後，在 MCP server 增加 `list_episodes`、`get_episode_details`。
  - [ ] 在文檔（如 `docs/API_QUICK_START_GUIDE.md`）與 Agents 指南寫入 Episode 語彙與範例指令。
  - [ ] 建立單元測試，確認工具能處理無 Episode、Episode 缺資產等邊界情境。
- [ ] Phase 2：Playback 控制
  - [ ] 實作 `play_episode`，整合 Dashboard websocket/控制通道，並提供安全保護（例如 require operator ack）。
  - [ ] 讓 Agent 可以查詢目前播放狀態與 client 報告，以便在腳本中做條件判斷。
- [ ] Phase 3：Episode 草稿建立與治理
  - [ ] 實作 `create_episode_from_template`、`update_episode_metadata`，限定於 `draft` 狀態。
  - [ ] 設計 Sandbox 流程：MCP 建立草稿 → 人類審核 → 發佈給 Dashboard。
  - [ ] 針對版本化（`parent_version_id`、匯入/匯出）提供對應工具或 CLI。

## 4. 安全與治理
- 設計工具層級權限，預設只有 read-only 工具對所有 Agent 開放；寫入類工具需額外白名單與審計。
- 盡可能在工具回傳中附帶「下一步人工操作建議」，避免 Agent 擅自覆蓋已發佈 Episode。
- 針對 `play_episode` 與 `create_episode_from_template` 等高風險指令，加入 double-confirm 或 require operator session token。

## 5. 文件與營運配套
- 更新 `AGENTS.md` 與 `docs/API_QUICK_START_GUIDE.md`，描述 Episode 物件結構、典型 workflows、API sample。
- 在 Agents 的訓練資料或 prompt 中加入 Episode 示範，讓 LLM 習慣以 Episode 為中心思考。
- 提供監控指標（例如 Episode 播放成功率、Agent 建立草稿數量）以評估整合成效。
