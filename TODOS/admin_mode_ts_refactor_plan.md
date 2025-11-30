# Admin Mode 重構＋TypeScript 實作計劃

## 範圍（約 5.2k LOC）
- 主檔：`frontend/src/AdminPanel.jsx`、`AdminPanelContext.js`、`AdminPanelStyles.js`。
- 管理/編輯：`components/TimelineEpisodeEditor.jsx`、`SnapshotManager.jsx`、`TimelineManager.jsx`、`EpisodeManager.jsx`、`ClientStateQueuePanel.jsx`、`snapshot/SnapshotPanelsEditor.jsx`、`timeline/*` 子面板。
- 模式入口：`hooks/useDisplayMode.js`、`modes/createModeRenderMap.js`。

## 目標
- 降低大檔耦合：拆分子元件/純函式，邏輯與視圖分離。
- 上 TypeScript：API/表單/狀態有明確型別，`tsc --noEmit` 納入 CI。
- 保持功能與現有測試綠燈。
ㄏ
## 里程碑
1) **基礎設置（Day 0–1）**
   - 安裝 `typescript`、`@types/react`、`@types/react-dom`、`@types/node`，補缺的 `@types/testing-library__jest-dom` 等。
   - 新增/調整 `tsconfig.json`：`jsx: react-jsx`、`moduleResolution: bundler`、`allowJs: true` 過渡、`skipLibCheck: true`、路徑別名與 Vite 對齊。
   - CI 加 `npm run typecheck`（`tsc --noEmit`），ESLint 設 TS parser（先寬鬆）。

2) **型別基礎（Day 1–2）**
   - 建 `src/types/`：`api.ts`（後端 payload）、`admin.ts`（Snapshot/Timeline/Episode/Queue 模型）、`env.d.ts`（VITE_*）。
   - `api.js` 若太大，先寫 minimal 型別並在 TS 檔匯入。

3) **重構拆分（Day 2–4，JS 為主，導出可重用函式）**
   - `TimelineEpisodeEditor` 拆：殼層（模式切換、狀態匯總）＋ `TimelineEditorPanel`、`EpisodeEditorPanel`、`SnapshotEditorPanel`；驗證/格式化/播放請求抽到 `hooks/useTimelineEpisodeEditor.ts` 或 `utils/adminEditor.ts`。
   - `SnapshotPanelsEditor` 拆：面板列表子元件、拖曳/尺寸 hook（純計算不碰 DOM 事件以外部分）。
   - `TimelineManager`、`ClientStateQueuePanel` 拆 API 資料抓取/輪詢為 hook，渲染為薄元件。
   - 抽出的純函式保持 JS 先行，方便後續直接轉 TS。

4) **逐步轉 TS（Day 4–7）**
   - 由易到難：`AdminPanelContext`、`AdminPanelStyles`、`useDisplayMode`、`createModeRenderMap` → 抽出的 hooks/utils → 較小元件（Episode/Snapshot/Timeline Manager 子面板） → 大檔殼層/子面板。
   - 過渡設定：保留 `allowJs`，必要時 `// @ts-expect-error` 限定範圍，最後清理。
   - 第三方缺型別以 minimal `d.ts` 處理。

5) **收斂與嚴格化（Day 7–8）**
   - 關閉 `allowJs`，開 `noImplicitAny`、`strictNullChecks`（如錯誤過多，可先在子資料夾啟用）。
   - 清除暫時 `ts-ignore`，lint 調整。

6) **驗證（持續，Day 3 起同步）**
   - 跑 `npm test`（Vitest）與 `npm run typecheck`；新增/更新測試覆蓋拆分後的子元件與 hooks。
   - 手動驗證：Admin 三分頁（管理/Editor/狀態），各模式的載入/儲存/播放/預覽流程。

## 風險與緩解
- **大檔拆分易出回歸**：拆前寫/補關鍵 RTL 測試（儲存、載入、播放、驗證錯誤顯示），拆後立即跑測試。
- **型別缺口**：API 回應 shape 不穩時，先用寬型別（Partial/可選），逐步收緊；外部套件缺型別用暫時 `d.ts`。
- **時間超支**：先確保拆分與 TS 基礎，嚴格模式可延後一天；每日合併可運行狀態。

## 交付標準
- Admin 相關檔案轉為 `.ts/.tsx`，`tsc --noEmit` 通過，CI 綠燈。
- 大檔拆成可維護子元件/純函式，邏輯與視圖分離，重複驗證/格式化/播放邏輯集中於 hooks/utils。
- Admin 主要流程（載入/編輯/儲存/播放/預覽）在測試與手動驗證下正常。 
