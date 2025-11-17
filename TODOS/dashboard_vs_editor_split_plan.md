# Control Dashboard 與 Episode Editor 拆分計劃（2025-11-17）

## 0. 背景
- 現行 Dashboard 同時承擔 Live 播放、資源調整、timeline 編輯，權限與 UI 複雜度快速累積。
- Live 導播與策展／創作流程需求不同：前者要穩定與清楚的控台，後者需要實驗與編輯工具。
- 沒有劃分角色將持續導致誤觸、心智負擔與權限管理困難。

## 1. 角色定義

### 1.1 Control Dashboard（Live 控制台）
- 對象：導播／現場操作人員。
- 職責：選擇 Episode 播放、監看 client 狀態、進行安全的 runtime override（例如 mute 某 client）。
- 限制：不得直接修改 Episode 結構或 timeline step，避免 live 期間發生破壞性變更。

### 1.2 Episode Editor（策展／創作介面）
- 對象：策展人、創作者、技術導演。
- 職責：建立與編輯 Episode、配置 timeline 與資產、進行版本與草稿管理、與 MCP/LLM 協作生成內容。
- 限制：不作為 live 控制入口，所有編輯需走草稿/發佈流程。

## 2. 不拆分的風險
- **UI 複雜化**：為支援編輯功能而塞滿控件，導致 Live 控制訊息被淹沒。
- **操作風險**：導播可能在直播期間誤刪 timeline step 或改錯資源。
- **權限管理困難**：難以限制「只能播 Episode 的帳號」，也無法針對編輯操作設立額外審核。

## 3. 漸進式拆分策略

### Phase A：現有 Dashboard 內部劃清邊界
- 使用 tab 或區塊將功能分成 `Live 控制` 與 `實驗／編輯`。
- 針對破壞性 API（刪除 step、改資源綁定）加上 server-side guard 與角色檢查。
- 讓導播在 Live 區域內僅看到 Episode 選單、播放控制、client 監控儀表。

### Phase B：抽出共用 hooks 與模組
- 把 Dashboard 中的核心邏輯抽象成 hooks/服務：`useClients()`, `useEpisodePlayback()`, `useTimelineEditor()`。
- 讓新的 `/editor` route 可以重用上述模組，避免複製或 re-implement。
- 在程式碼層面建立清楚的資料流（playback vs editing state），以利權限與測試。

### Phase C：正式拆出 Episode Editor
- 建立獨立 route（例如 `/episodes`），涵蓋 Episode 列表、搜尋、詳細頁、timeline 視覺化編輯器。
- Dashboard 僅保留 Episode 選擇與 playback 控制，把深度編輯控件移除或隱藏於 Editor。
- 在 AGENTS/docs 中撰寫 SOP，說明如何從 Editor 發佈 Episode 給 Dashboard 播放。

## 4. 實作里程碑與待辦
- [ ] Phase A：Dashboard 安全帶
  - [ ] 調整 Dashboard UI，新增 Episode 選單並將 Live 控制與實驗區塊分離。
  - [ ] 後端為高風險操作加上權限檢查與審核流程。
- [ ] Phase B：抽象化共用邏輯
  - [ ] 將 client 管理、Episode 播放、timeline 編輯封裝成 hooks/服務，寫文件與範例。
  - [ ] 建立單元測試確保 hooks 行為一致。
- [ ] Phase C：Episode Editor Route
  - [ ] 實作 Episode 列表、詳細頁與基礎 timeline 編輯 UI（含 undo/redo、草稿儲存）。
  - [ ] 提供「草稿 Episode 預覽模式」，可在測試 client 驗證，不影響正式場域。
  - [ ] 建立發佈流程，清楚把 Episode 從 draft 推送至 Dashboard。

## 5. 風險與緩解
- **拆分增加使用者心智負擔**：透過文件、引導式 UI、教學影片示範典型流程，降低轉換成本。
- **未來維護兩套 UI 成本提高**：共用 hooks/服務降低邏輯重複，並建立 Storybook/設計系統確保組件一致。
- **權限分層不完整**：在 API 層落實角色檢查與審計紀錄，必要時引入二次確認（例如重要變更需 double-confirm）。

## 6. 下一步
- 完成 Episode 模型 API 後立即把 Dashboard Playback 流程導向 `Episode + Timeline` 語彙。
- 定義 Dashboard 與 Editor 的角色矩陣，列出每種操作所需角色，供身份管理與 UI 控制使用。
- 排定 /editor route 原型開發時程，與前端 refactor 計畫（`frontend_architecture_refactor_plan.md`）同步。
