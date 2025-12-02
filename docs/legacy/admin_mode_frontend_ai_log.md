# Admin Mode Frontend AI 自我迭代紀錄

## Iteration #1
- 操作流程：打開 `/?admin_mode=true` → 停留在「SNAPSHOT 管理」分頁 → 輸入 client 預設 `desktop` → 點「查看 snapshot firework_stormy」→ 預覽顯示兩個影片 → 點「播放 snapshot firework_stormy 到 client desktop」送出播放。
- 觀察到的問題（前端/DOM）：列表與表單雜在一起，沒有明示「先選 client → 再選 snapshot → 再播放」的流程；列表項目沒有選取狀態，AI 很難知道目前哪個 snapshot 被帶入右側表單；區塊缺少有意義的 `data-*` 標示（只有零散的 action），預覽區與訊息區也沒有 role 說明。
- 對 AI agent 的困難：缺乏明確流程提示，難以推論操作順序；無法靠 DOM 判斷當前選中的 snapshot；缺少穩定 selector 來定位「步驟 1/2/3」與預覽/狀態訊息，寫自動化腳本需要硬編索引。
- 本輪計畫改動：聚焦 Snapshot 管理區塊—加入步驟說明（標註 `data-ai-role`）、將主要區塊換成 `<section>` 並加 aria label、列表項目加上選取狀態與 `data-ai-state`，並在預覽/訊息區補上易查詢的 selector。
- 實作結果：Snapshot 區塊新增「操作順序」提示、步驟 1/2/3/預覽的 `<section>` 與 `data-ai-role`；列表行加入選取狀態 `data-ai-state="selected"` 與更明確的按鈕文案；預覽/狀態訊息增加 `data-testid`/`data-ai-role`；複製/重載按鈕也標示角色。改動檔案：`frontend/src/components/SnapshotManager.jsx`。
- 再驗證：在 admin 頁重新載入後，a11y tree 出現「Snapshot 控制流程」「步驟 1/2/3」region，列表按「載入配置」後右側名稱/JSON 同步且 `目前表單名稱` 文字更新，預覽 iframe 跟著切換。下一輪將整理 Timeline 管理的預覽/播放路徑與 selectors。

## Iteration #2
- 操作流程：切到「TIMELINE 管理」，按「載入 timeline desktop_dual_opening」→ 右側 JSON/ID 更新並出現首段 snapshot 預覽 iframe → 未嘗試播放。
- 觀察到的問題：沒有流程提示，無法直接看出「先篩選 client → 選 timeline → 編輯/預覽 → 播放」；列表項目沒有選取態與 role，播放/預覽區域也缺少 `data-*`；預設 JSON 還是虛構的 `snapshot_a/b`，初始畫面就顯示 404，對 AI/使用者都易困惑。
- 對 AI agent 的困難：不易鎖定「播放到 client」的 selector 與播放狀態；無法用 DOM 辨識目前載入哪個 timeline；預設錯誤訊息會干擾判斷是否操作成功或只是預設配置失敗。
- 本輪計畫改動：替 Timeline 區塊加入步驟說明、`data-ai-role`/`data-testid`，列表行加選取狀態；重構預覽與播放區塊的語意容器與狀態標示；更新預設 timeline payload 改用現存 snapshot（避免初始 404）。
- 實作結果：Timeline 面板新增「操作順序」區塊與步驟 1–4 分區；列表行加入 `data-ai-state` 選取態、明確按鈕文案與 `data-testid`，並顯示「目前表單 ID」；右側編輯/播放與兩個預覽 iframe 都標上 `data-ai-role`/`data-testid` 與 aria status；預設 payload 改用 `desktop_snapshot`/`closing_focus`。改動檔案：`frontend/src/components/TimelineManager.jsx`、`frontend/src/adminPanelUtils.js`。
- 再驗證：重新開啟 timeline 分頁，可見步驟提示與預設 JSON 不再報 404；點「載入 timeline desktop_dual_opening」後，列表仍可辨識當前選取，預覽與播放區域的 DOM 都帶有 `data-ai-role`，播放目標狀態顯示「（待送出）」。

## Iteration #3
- 操作流程：切到「狀態 / 排程」分頁，看到多個 client 狀態卡片（大多 offline），左側按鈕可切換只看線上/idle，右側表單預設 client `desktop`、type `snapshot`，下方佇列表為空。
- 觀察到的問題：沒有任何流程提示（例如「先選 client 再填 target 再派送」）；佇列表單與 client 列表缺少語意區塊與 `data-ai-role`，難以讓腳本用 DOM 推論步驟；Target 選單提示僅用一行文字，沒有 aria/status 標記；佇列表標題全大寫，沒有說明空狀態或選擇到的 client。
- 對 AI agent 的困難：難以鎖定「目前選取的 client」、「派送按鈕」、「佇列表格」等穩定 selector；沒有 aria/status 可以判斷載入中或空佇列；不知道需要按「載入選單」才有 target 選項。
- 本輪計畫改動：為狀態/排程面板加入操作步驟提示與 `data-ai-role` 區塊，標記目前選取 client 與表單目標的 status；在 target 選單、佇列表格、派送/刷新/強制停止等操作加上描述性 microcopy 與可查詢 selector，避免 AI 誤序操作。
- 實作結果：狀態/排程頁新增「操作順序」列表、clients/表單/佇列表格分區加上 `data-ai-role`，現行 client 摘要與 queue scope 具 `role=status`；target 選單加了 `aria-describedby`、`data-testid`，派送/載入選單按鈕也加 selector；queue table 現在標示正在查看的 client。改動檔案：`frontend/src/components/ClientStateQueuePanel.jsx`。
- 再驗證：切到「狀態 / 排程」後，a11y tree 出現新 instructions，摘要顯示「目前操作 client：desktop」，Target 載入訊息與 queue 範圍都有 `data-ai-status`，佇列空狀態仍可辨識。

## Editor Mode

### Iteration #E1
- 操作流程：進入 Admin → 點選「EDITOR」→ 停留在 Timeline 模式查看列表與 steps。
- 觀察到的問題：編輯流程沒有明確說明；面板沒有全域 `data-ai-state`，難以判斷 dirty/saving；模式切換 tab 無一致的 `data-ai-role`。
- 改動計畫：在 Editor 頂部加入流程提示；為主容器/狀態條加入 `data-ai-role` 與 `data-ai-state`；為 Snapshot/Timeline/Episode tab 標記 `data-ai-role="editor-tab"` 與 tab id。
- 實作與驗證：`TimelineEpisodeEditor.jsx` 新增「Editor 流程」區塊、主容器 `data-ai-role="editor.panel"` + `data-ai-state`、狀態條 role/status，三個模式 tab 都有 `data-ai-tab-id`；在 UI 驗證可直接看到 instructions 與同步狀態。

### Iteration #E2
- 操作流程：在 Timeline 模式確認列表/steps/JSON 區域，檢查儲存與播放控制。
- 觀察到的問題：儲存/播放按鈕缺少明確角色；JSON 區域與驗證結果沒有 data-state；Timeline 列表容器缺少標記。
- 改動計畫：為主要動作區與儲存/播放按鈕加 `data-ai-role` 與狀態；JSON 區域/驗證區加入 `data-ai-role` 與 state；Timeline 列表容器加 `data-ai-role`；保持現有行為。
- 實作與驗證：`TimelineEpisodeEditor.jsx` 的基本欄位包成 `editor.primary-fields`，儲存/播放按鈕帶 `save-button`/`play-button`/`preview-button` 與 state；JSON/驗證區加 `editor.json`、`editor.validation`；`TimelineListPanel.jsx` 加 `data-ai-role="editor.timeline-list"` 與 reload 標記。重新查看 Editor，狀態條顯示 data-state，按鈕標記可用於 selector。

### Iteration #E3
- 操作流程：在 Timeline 模式查看 steps 預覽、單步表單與預覽 iframe。
- 觀察到的問題：steps 區塊與預覽 iframe 缺少可區分的角色/狀態；單步卡片沒有 data-state，AI 難以判斷選取。
- 改動計畫：為 steps 編輯區、預覽 iframe、step 卡片加 `data-ai-role`/`data-ai-state`。
- 實作與驗證：`TimelineStepsEditor.jsx` 增加 `timeline.steps-editor`、`timeline.steps-preview` 與 step card `data-ai-state`; `TimelinePreviewPlayer.jsx` 為首段/整段預覽加 `data-ai-role`。在 Editor 確認 step list 與 iframe 可用 data-* 查詢。
