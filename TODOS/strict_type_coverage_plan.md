# Frontend 嚴格型別全覆蓋計畫（更新：2025-12-01）

## 目標
- `npm run typecheck:strict`（tsconfig.strict.json）涵蓋整個 `frontend/src`，含 admin_mode 與各模式。
- 嚴格模式下無 `any`/`unknown`/`never` 推斷；移除過渡設定與 `allowJs` 依賴。

## 已完成
- Admin 區塊：`TimelineEpisodeEditor`/`useTimelineEpisodeEditor`/`SnapshotPanelsEditor`，管理面板 `SnapshotManager`、`TimelineManager`、`EpisodeManager`、`ClientStateQueuePanel`、`AdminPanel` 已納入 strict 並通過。
- 新增/整理型別：`SnapshotConfig`/`SnapshotPanel` 等 admin 專用型別；修正相關 API/props/狀態的型別錯誤。
- 嚴格檢查覆蓋 tsconfig.strict.json 列出的檔案皆綠燈。

## 尚未涵蓋/待修（全域 include 後約 200+ 錯誤）
- **入口/模式映射**：`App.tsx`、`modes/createModeRenderMap.ts`（lazy component props 為 unknown、ModeLayout props mismatch、never 推斷）。
- **Collage 系列**：`CollageMode.tsx`、`CollageVersionMode.tsx`、`utils/collage*`（implicit any/unknown、payload spread、型別缺口）。
- **Kinship/3D**：`components/kinship/**`（KinshipScene、SceneClusters、ClusterFlower、Photo、IncubatorScene、PhylogenyScene、hooks/useKinship*、utils/data.ts/graph.ts），多處 implicit any、可為 undefined 的屬性存取、onPick/onCapture/camera 等 props 不匹配。
- **其他模式/元件**：`OrganicRoomScene.tsx`、`SlideMode.tsx`、`StaticMode.tsx`、`SoundPlayer.tsx`、`VideoMode.tsx`、`IframeMode.tsx` 等仍有 implicit any/null/props mismatch。
- **共用 utils**：`collageConfig.ts`、`collageMath.ts`、`collageImageProcessing.ts`、`collageStateUtils.ts` 等多處 implicit any/未知回傳型別。

## 建議修正順序
1) 調整 tsconfig.strict.json 的 include 為整個 `src`（可用臨時檔觀察錯誤清單）。
2) 先處理 `App.tsx` 與 `modes/createModeRenderMap.ts`，避免 lazy component props 被推成 unknown/never。
3) 分批處理 Collage 與 Kinship：先 utils 再元件，補最低限度 interface，清除 implicit any/unknown。
4) 收尾其他模式（Slide/Static/Video/Sound/Iframe）與剩餘 utils，對 props/可 null 欄位加守衛或型別。

## 目前狀態
- tsconfig.strict.json 維持針對已修範圍；若擴大 include 至全 src 會出現上述約 200+ 錯誤。
- admin_mode 已達嚴格型別標準且 typecheck 綠燈。
