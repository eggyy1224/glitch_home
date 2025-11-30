# Frontend 嚴格型別全覆蓋 TODO

## 目標
- `npm run typecheck:strict`（`tsconfig.strict.json`）涵蓋整個 `frontend/src`，含 admin_mode 全部 TS/TSX。
- 關掉 `allowJs` 過渡路徑，確保新檔與既有檔皆在嚴格型別下無錯誤。

## 範圍
- `frontend/src/components/**`（含 admin panel、snapshot/timeline/episode 子面板與 kinship scene）。
- `frontend/src/hooks/**`（含新抽出的 `useTimelineEpisodeEditor.ts`、`useCollage*`、`useControlSocket*` 等）。
- `frontend/src/utils/**`（含 `adminEditorUtils.ts`）。
- 其他入口：`src/api.ts`, `src/main.tsx`, `src/modes/**`, `src/constants/**`。

## 執行步驟
1) 調整 `tsconfig.strict.json`：將 include 改為 `["src"]`（如錯誤過多，可先加 `src/components`, `src/hooks`, `src/utils` 分階段放寬）。
2) 先處理 admin_mode 相關檔案：
   - `hooks/useTimelineEpisodeEditor.ts`, `utils/adminEditorUtils.ts`, `components/TimelineEpisodeEditor.tsx`。
   - 修正 `any`、Null/undefined、物件 indexing，必要時寫 model 型別（`types/admin.ts`, `types/timeline.ts`）。
3) 逐步納入其餘面板與 hooks：
   - `SnapshotManager.tsx`, `TimelineManager.tsx`, `EpisodeManager.tsx`, `ClientStateQueuePanel.tsx`。
   - `useCollage*`, `useControlSocket*`, `useKinship*`, `useTimelineStepActions` 等。
4) 清理 JS 遺留：
   - 若有 `.jsx`/`.js` 檔仍被引用，先轉 `.tsx`/`.ts` 或在 `tsconfig` 禁止 `allowJs`。
5) 收尾與驗證：
   - `npm run typecheck:strict` 通過。
   - 跑 `npm test -- --watch=false` 確保重構無回歸。

## 風險/難度預估
- 難度：中等偏高（大量檔案，目前 many files 0% coverage in嚴格型別，可能需補 minimal 型別或拆模組）。
- 時間：視人力，估 1.5–3 天（以分階段 include/修正為主）。***
