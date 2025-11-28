# Admin 模式操作指南（Snapshot / Timeline / Episode / 排程）

> 本指南給後續 agent 迅速上手 Admin Panel。介面位於前端 `AdminPanel.jsx`，分頁包含 Snapshot 管理、Timeline 管理、Episode 管理、Timeline/Episode Editor、狀態/排程。後端 API 走 `frontend/src/api.js`。

## 0. 進入條件與通用行為
- Base URL：`http://localhost:5173?admin_mode=true`，Admin 模式會顯示頂部五個分頁。
- `defaultClientId`：若 URL 帶 `client` 則沿用，否則預設 `desktop`，會套用到預設 JSON 與某些篩選。
- tab 切換僅影響顯示；已載入的分頁會保留狀態（visitedTabs）。
- 所有 JSON 區塊皆為即時編輯；送出時由對應 API 驗證。錯誤訊息會顯示在分頁下方的 status 行。

## 1. Snapshot 管理（單一 client 的 iframe 配置）
- 主要操作：
  - Client 欄輸入後點「重新載入列表」取得該 client 的 snapshots。
  - 列表列：`查看` 載入 JSON、`選擇` 只設置名稱、`播放` 呼叫 `/api/iframe-config/restore` 套用到 client、`刪除` 移除檔案。
  - 編輯 JSON 後填名稱按「儲存/覆寫」即寫入 `snapshots/iframe_config/<client>/<name>.json`。
  - 「填入預設」載入 `minimalConfigPayload(defaultClient)` 模板並將名稱改為 `new_snapshot`。
  - 複製：填 target client/name 後按「複製 snapshot」呼叫 clone API。
  - 預覽：右側 iframe 以 `previewSrcFromConfig` 產生 `/` 查詢字串，會附 `iframe_preview=true`。底部拖拉角可以改寬度。
- 注意：
  - Panel 需至少有 `image` 或 `url`，比對時會驗證檔名不可帶路徑。
  - 列表/載入皆使用 `resolve=true`，會把 URL 絕對化、補 metadata；錯誤會顯示在訊息列。

## 2. Timeline 管理（單 client 時間軸）
- 主要操作：
  - 左上「篩選 client」後點「重新載入列表」取得 timeline 清單。
  - 列表列：`載入` 以 `resolve=false` 讀原始 JSON 到編輯區；`刪除` 直接移除；「複製」需先載入並填 new id/target client。
  - JSON 區可直接編輯，按「建立」或「覆寫」呼叫 create/put。未填 id 會報錯。
  - 播放：  
    - 「以 iframe 預覽」使用 timelinePlaybackSrc(id) 產生內嵌播放 URL（需先有 id）。  
    - 「播放到 client」呼叫 `/api/iframe-timelines/{id}/play`，目標 client 填在右側欄位（預設抓 timeline.clientId）。
  - 預覽區：自動讀首個 step 的 snapshot，會呼叫 `/api/iframe-config/snapshots/{client}/{name}`；失敗訊息顯示在預覽區。
- 注意：
  - `steps` 至少一筆；`snapshot` 可用 `client/name` 或 name（會 fallback step.clientId → timeline.clientId）。
  - `loop`、subtitle/caption/tts/remote_clicks/video_controls/unlock_audio_targets 都可在 JSON 補上，前端不做 UI 限制。

## 3. Episode 管理（多 timeline 協同）
- 主要操作：
  - 「重新載入列表」取得 episodes；列表列的 `載入` 會把 JSON 放進右側；`刪除` 直接移除。
  - `update`/`create` 透過 JSON + 輸入框的 id 決定目標；未填 id 會報錯。
  - 複製：需先載入 source 並填 new id，按「複製 episode」。
  - 播放：填選擇性的 target map（`timeline:client` 逗號分隔）與 command prefix，再按「播放」呼叫 `/api/episodes/{id}/play`。
- 注意：
  - Episode track 至少一條；每條要有 `timelineId`，`targetClientId` 可空（沿用 timeline 預設 client）。
  - 播放時會為每條 track 發出獨立的 `timeline_control`。

## 4. Timeline/Episode Editor（表單 + JSON 雙向同步）
- 模式切換：上方 `Timeline 模式` / `Episode 模式` 按鈕會改變左側表單與右側驗證。選中時按鈕用 activeTabButtonStyle。
- 列表區：依模式顯示 timeline 或 episode 列表，`重新載入` 會走 API；點「載入」將資料帶入表單並同步 JSON。
- 表單/JSON 同步：
  - 預設雙向：表單改動會 debounce 500ms 更新 JSON；JSON 改動會反向更新表單。
  - 「鎖定 JSON」：暫停雙向同步（表單與 JSON 互不影響）。  
  - 「以表單覆寫 JSON」：把目前表單狀態寫回 JSON 區（鎖定時停用）。
  - 左上顯示「未保存變更/已同步」與最後同步時間。
- Timeline 模式表單：
  - Steps 清單：新增/複製/刪除/上下移，批次 duration；可複選後複製貼上（跨 timeline 也可）。  
  - Snapshot 選單：輸入 client/keyword 後點「更新 SNAPSHOT 選項」會列出 `listIframeSnapshots`；下拉值為 `client/name`。  
  - 播放：`直接播放到 client` 呼叫 play API，`以 iframe 預覽 timeline` 內嵌播放；保存會自動判斷 PUT 或 POST。  
  - Timeline ID 輸入框位於表單下方共用區。
- Episode 模式表單：
  - Tracks 清單：新增/複製/刪除/上下移，批次 target；可複選複製貼上。  
  - timelineId 欄有 datalist，下拉來源為已載入的 timeline 列表，會優先顯示目標 client 的 timeline。  
  - 目標 map 覆寫輸入框：播放時可覆寫單次 target。  
  - Episode ID 輸入框位於共用區；`播放 Episode（含覆寫）` 會附上覆寫 map。
- 驗證：右側顯示 Timeline/Episode 的驗證錯誤（必填 id、step/timeline/track 條件）；通過時顯示「未發現錯誤」。

## 5. 狀態 / 排程（client 線上狀態與 queue 操作）
- 客戶端列表：顯示 heartbeats、queue_size、執行中項目、錯誤；可切換「只看在線」。
- 選取 client 後右側顯示 queue 表格，列上可「取消 / 插隊 / 延後 / +30s」；類型為 timeline/episode 的列可強制「停止播放」。
- 新增佇列任務：
  - Type 選 `snapshot`/`timeline`/`episode`。  
  - `Target` 可手動輸入或點「載入可選」拉取選單（snapshot/timeline 會依 client 篩選）。  
  - 可填 priority（數字，越大越前）、retries、ETA 秒數；按「加入佇列」即呼叫 `/api/clients/queue` 新增。  
  - `clientOverride` 可覆寫目標 client，預設使用當前選取或 defaultClient。
- 手動刷新：客戶端區域有「刷新狀態」，佇列表有「刷新佇列」。

## 6. 常見作業流程
- 建 Timeline：先在 Snapshot 分頁為目標 client 建立/播放快照 → Timeline 分頁填模板、替換 step 的 snapshot 名稱 → 儲存 → 以 iframe 預覽確認。
- 建 Episode：確定各 Timeline 已存在 → Episode 分頁載入模板，填入 timelineId/targetClientId → 儲存後可用 target map 測試播放。
- 快速播放現有檔：Timeline/Episode Editor 載入 → 若只想播，直接按播放（不必改 JSON）。
- queue 播放：在狀態/排程選 client，Type 選 timeline/episode 填 target id 後加入佇列，worker 會依順序執行。

## 7. Debug / 注意事項
- resolve 失敗通常是 snapshot 或 timeline id 拼錯、client 不符，後端會回 404 或驗證錯；前端訊息列會顯示。
- 播放沒反應時確認：WS 連線、client 是否 offline、queue 是否被佔、command_id_prefix 是否需要避免去重。
- JSON 模板位置：`frontend/src/adminPanelUtils.js`（defaultTimelinePayload/defaultEpisodePayload/minimalConfigPayload）。
- 所有分頁的刪除操作沒有二次確認，務必確認 id/名稱後再按。
