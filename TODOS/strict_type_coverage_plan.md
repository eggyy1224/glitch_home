# Frontend 嚴格型別全覆蓋計畫（更新：2025-12-01）

## 目標
- `npm run typecheck:strict`（tsconfig.strict.json）涵蓋整個 `frontend/src`，含 admin_mode 與各模式。
- 嚴格模式下無 `any`/`unknown`/`never` 推斷；移除過渡設定與 `allowJs` 依賴。

## 已完成
- Admin 區塊：`TimelineEpisodeEditor`/`useTimelineEpisodeEditor`/`SnapshotPanelsEditor`，管理面板 `SnapshotManager`、`TimelineManager`、`EpisodeManager`、`ClientStateQueuePanel`、`AdminPanel` 已納入 strict 並通過。
- 新增/整理型別：`SnapshotConfig`/`SnapshotPanel` 等 admin 專用型別；修正相關 API/props/狀態的型別錯誤。
- 嚴格檢查覆蓋 tsconfig.strict.json 列出的檔案皆綠燈。

## 尚未涵蓋/待修（全域 include 後約 200+ 錯誤）
- **影音/場景模式**：`OrganicRoomScene.tsx`、`SlideMode.tsx`、`StaticMode.tsx`、`SoundPlayer.tsx`、`VideoMode.tsx`、`IframeMode.tsx` + 播放相關 hooks 仍有 implicit any/null/props mismatch，待第五包收尾。

## 建議修正順序
1) 調整 tsconfig.strict.json 的 include 為整個 `src`（可用臨時檔觀察錯誤清單）。
2) 先處理 `App.tsx` 與 `modes/createModeRenderMap.ts`，避免 lazy component props 被推成 unknown/never。
3) 分批處理 Collage 與 Kinship：先 utils 再元件，補最低限度 interface，清除 implicit any/unknown。
4) 收尾其他模式（Slide/Static/Video/Sound/Iframe）與剩餘 utils，對 props/可 null 欄位加守衛或型別。

## 目前狀態
- tsconfig.strict.json 維持針對已修範圍；若擴大 include 至全 src 會出現上述約 200+ 錯誤。
- admin_mode 已達嚴格型別標準且 typecheck 綠燈。

## 待派工（分 5 包）
1) 入口與模式映射（已完成）
   - 檔案：`src/App.tsx`、`src/modes/createModeRenderMap.ts`
   - 重點：lazy component props 被推成 `unknown`，mode map 需要明確的 ModeProps；`onApplyConfig`/iframe config handler 型別不匹配。
2) Collage 堆疊（已完成）
   - 檔案：`src/CollageMode.tsx`、`src/CollageVersionMode.tsx`、`src/hooks/useCollageConfig.ts`、`src/hooks/useCollageControls.ts`、`src/utils/collageMath.ts`、`src/utils/collageConfig.ts`、`src/utils/collageStateUtils.ts`
   - 重點：大量 implicit `any`/`unknown`，remote config payload/結果缺型別，`Promise<unknown>`、索引 `{}` 導致 TS7053；需定義 Collage API payload/state/interface。
3) Kinship 堆疊（已完成）
   - 檔案：`src/components/kinship/**`（含 hooks/utils/scene/components/trackers）、`src/hooks/useKinshipData.ts`、`src/hooks/useKinshipNavigation.ts`
   - 重點：callback 簽章 `string | number` 不一致、implicit `any`、layout 型別不符、索引缺 signature；需整理 node/edge/cluster/layout/pick 型別並套用。
4) 編輯/搜尋/截圖工具（已完成）
   - 檔案：`src/components/script/ScriptEditor.tsx`、`src/components/scene/SceneEditor.tsx`、`src/hooks/useScriptEditor.ts`、`src/hooks/useSearch.ts`、`src/hooks/useScreenshotManager.ts`、`src/hooks/useCameraPresets.ts`、`src/hooks/useControlSocketHandlers.ts`
   - 重點：`ScriptEntryRow` discriminated union 未涵蓋 `left_snapshot/right_snapshot/notes/audio_override`，select value/label 型別是 `unknown`，多個 payload/回傳值 implicit `any`。
5) 影音/場景模式與播放輔助
   - 檔案：`src/IframeMode.tsx`、`src/OrganicRoomScene.tsx`、`src/SlideMode.tsx`、`src/VideoMode.tsx`、`src/SoundPlayer.tsx`、`src/hooks/useSlidePlayback.ts`、`src/hooks/useSubtitleCaption.ts`、`src/hooks/useSoundQueue.ts`
   - 重點：事件/raf/observer 參數 implicit `any`，`ImageBitmap.close` 誤用，音檔型別不符 `SoundFile`，回傳型別缺失與 enum 值不對。

## 進度更新
- 第一包完成：`App.tsx`、`modes/createModeRenderMap.ts`、`useRemoteTimelineControl`/`useIframeTimelinePlayer` 型別收斂，lazy component props 不再為 `unknown`，iframe config handler 型別對齊 `IframeConfig`。其餘批次錯誤仍依原五包分派處理。
- 第二包完成（Collage 堆疊）：`CollageMode`/`CollageVersionMode`/`useCollageConfig`/`useCollageControls` 與 `collageMath`/`collageConfig`/`collageStateUtils` 全數補型別，清除 implicit any/unknown。剩餘錯誤集中在 Kinship、ScriptEditor、影音/搜尋等後續包。
- 第三包完成（Kinship 堆疊）：`components/kinship/**`、`useKinshipData`、`useKinshipNavigation` 等全面補型別（包含 KinshipData 欄位、graph/layout 型別對齊、onPick 簽章、react-spring 鍵名避免 `children` 保留字、trackers 回傳型別），現存錯誤已聚焦於 Script/Scene 編輯工具與影音/搜尋/截圖等其他包。
- 第四包完成（編輯/搜尋/截圖工具）：`ScriptEditor`/`SceneEditor`、`useScriptEditor`/`useSearch`/`useCameraPresets`/`useControlSocketHandlers`/`useScreenshotManager` 全數補型別，精簡 select options、promise 回傳型別與 screenshot/camera helpers；`types/scene.ts` 顯式允許 `undefined` 以符合 `exactOptionalPropertyTypes`。剩餘待處理集中在第五包影音/場景模式。
