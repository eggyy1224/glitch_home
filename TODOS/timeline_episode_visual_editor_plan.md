# Timeline/Episode 視覺化編輯器計劃

## 背景
- Timeline/Episode 目前以 JSON 編輯，容易出錯且缺少視覺化排序、預覽與驗證；大量 snapshot/timeline 節點需要更高效率的編排工具。
- 既有資產庫/CRUD 計畫將提供搜尋與列表，但缺乏「編排 + 預覽 + 驗證」整合流程。

## 目標
- 以視覺化 UI 編輯 timeline steps 與 episode tracks，支援拖拉排序、複製/貼上、即時驗證。
- 內建預覽：timeline 首段 snapshot 預覽、整段播放預覽；episode 播放 target map 覆寫。
- 逐步導入，保留 JSON 編輯模式並可互相同步，維持向後相容。

## 成品範圍
- Admin Panel 新增「Timeline/Episode Editor」頁籤，左右雙欄佈局（左：表單/列表；右：預覽 + JSON 區）。
- Timeline 模式：
  - 卡片/列表顯示 steps（snapshot ref `client/name`、duration、label、client override），可拖拉排序、複製/刪除/插入。
  - 提供 snapshot 選擇器（搜尋/篩選 by client/tag，重用資產庫搜尋 API）。
  - 右側預覽：顯示首個 snapshot iframe + 播放按鈕（呼叫現有播放 API）。
- Episode 模式：
  - tracks 列表：`timelineId`、`targetClientId`、`offset/delay`，支援排序、批次套用 target client、複製行。
  - 「目標 map 覆寫」表單，提供 key/value 編輯（JSON 片段或 key-value grid）。
- JSON 區：雙向同步（UI → JSON、JSON → UI），可鎖定模式避免競態，顯示最後同步時間。

## 前端需求
- 狀態管理
  - 統一的 `editorState`：當前模式（timeline/episode）、當前檔案 id、表單狀態、JSON 文本、驗證結果、dirty flag。
  - debounce JSON 解析與驗證請求，避免大量打 API；編輯中標示未保存。
- 互動
  - 拖拉：使用既有 draggable 套件（與 snapshot 資產庫保持一致）；排序後更新 `editorState` 並觸發驗證。
  - 複製/貼上：序列化 step/track 到 clipboard；貼上可跨檔案。
  - 批次操作：選取多行後設定 duration/target client。
- 驗證提示
  - 表單內即時顯示缺漏（id/duration/不存在的 snapshot/timeline）；右側 validation panel 列錯誤與修正建議。
  - JSON 區同步標記錯誤位置（基於欄位 path）。
- 預覽
  - Timeline：首步 snapshot 預覽 iframe；「播放整段」呼叫 `/playIframeTimeline`；可選 `simulate` 取得展開序列並顯示。
  - Episode：提供「以目標 map 覆寫播放」按鈕，直接呼叫 `/playEpisode`，並在右側顯示 target map。
- 儲存/載入
  - 調用已有 CRUD API（參考 `snapshot_timeline_crud_plan`）；儲存前先跑 validate。
  - 支援「另存為/複製」：複製 id、可批次替換 snapshot 前綴。

## 後端需求
- 驗證端點
  - `POST /api/iframe-timelines/validate`：body `{ timeline, resolve?: bool }`，回傳 `{errors: [{path, message, suggestion?}], normalized}`。
  - `POST /api/episodes/validate`：body `{ episode, targetMapOverride? }`，回傳類似結構；檢查 timeline 存在與 offset/delay 格式。
- 搜尋/輔助
  - `GET /api/iframe-config/snapshots/search?q=&client=&tag=`：複用資產庫邏輯；回傳 `{id, client, tags, description, previewUrl}`。
  - `GET /api/iframe-timelines/search?q=&client=&tag=`：提供 episode 編輯器選單。
- 模擬（可選）
  - `POST /api/iframe-timelines/{id}/simulate` 或 `/api/iframe-timelines/simulate`：輸入 timeline payload，回傳展開後的播放序列（含 client override）。
- 安全/一致性
  - 驗證函式集中（schema 驗證 + referential check），與 CRUD 路徑共用，避免重複邏輯。

## 驗證與測試
- 前端單元：
  - UI ↔ JSON 同步、拖拉排序結果、複製/貼上、批次操作。
  - 驗證錯誤顯示與 debounce 行為。
- 後端：
  - validate 端點：缺欄位、無效 snapshot/timeline、型別錯誤；resolve 開/關行為。
  - simulate（若實作）：確保展開序列正確並覆寫 client。
- 手動流程：
  - 新建 timeline/episode → 驗證通過 → 播放預覽 → 實際送播 → UI 顯示回饋。

## 推進階段
1) 基礎 API：後端 validate/search/simulate；前端 API 模組封裝。
2) UI 殼與狀態：雙欄佈局、editorState、JSON 同步與鎖定模式。
3) Timeline 編輯能力：step 列表、拖拉、snapshot 選擇器、預覽播放。
4) Episode 編輯能力：track 列表、批次 target、目標 map 覆寫、播放。
5) 驗證與錯誤可視化：整合 API、panel、JSON 標示；補足測試。
6) 儲存/複製流程：整合 CRUD、另存為、完成 E2E 手動驗收。

## 風險與緩解
- 大型 timeline/episode 效能：虛擬列表 + debounce 驗證；僅在焦點離開或手動觸發時送完整 payload。
- Schema 演進：將表單欄位來源集中在 schema/型別定義；共用常數避免硬編碼。
- 使用者混用 JSON/UI：提供鎖定模式、顯示最後同步時間與當前來源；衝突時需選擇以哪方為準。
- 播放與編輯競態：播放請求加 loading/禁用；若後端有佇列則標示排程資訊。
