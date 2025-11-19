## Frontend 測試覆蓋率提升計劃（2025-11）

### 目標
- 現況 13.7% → 兩週內達 35%，中期（四週）達 60%。
- 關鍵畫面/Hook 需至少 40% 覆蓋（`App.jsx`, `SoundPlayer.jsx`, `useCollageControls.js`, `src/api.js` 等）。
- CI 新增 `vitest run --coverage --run --passWithNoTests=false`（先標記為允許失敗，達標後轉為必過）。

### 行動項目
1. **App Shell 與各模式**
   - 使用 React Testing Library 測 `src/App.jsx` 與 `src/modes/*`：mock router/store，驗證模式切換、基本 UI。
   - `SoundPlayer.jsx`: mock `Audio` 物件，測播放、暫停、音量、錯誤事件，覆蓋未測分支。
2. **Hooks 與狀態管理**
   - `useCollageControls.js`, `useControlSocket.js`: mock fetch/WebSocket，測連線、重試、錯誤提示。
   - `useScreenshot.js`, `useSlidePlayback.js`: 使用 fake timers 驗證輪詢與進度更新。
   - 修正 `useSubtitleCaption.test.js`，以 `act(...)` 包覆更新並設定 `globalThis.IS_REACT_ACT_ENVIRONMENT = true`。
3. **API 與 Utilities**
   - `src/api.js`: 透過 `msw` 或手動 mock fetch 測 GET/POST 成功、錯誤、timeout。
   - `src/utils/collageMath.js`, `slideMode.js`, `iframeConfig.js`: 以資料驅動測試不同輸入（超界、負值、空陣列）。
4. **Kinship / Screenshot 組件**
   - 建立縮減資料集，測 `KinshipScene`, `KinshipViewer`, `KinshipSearch` 等渲染與互動。
   - `ScreenshotMessage.jsx`, `ControlPanel.jsx`, `ModeLayout.jsx`: 撰寫互動測試模擬 props 切換與事件。
5. **報告與追蹤**
   - `package.json` 加 `test:coverage:ci="vitest run --coverage --run"`，避免互動式提示。
   - 建立 `frontend/tests/coverage-notes.md` 紀錄尚未覆蓋的模組、計畫與負責人。

### 時程
| 週次 | 里程碑 |
| --- | --- |
| Week 1 | App.jsx / SoundPlayer / api.js 測試完成，覆蓋 ≥25% |
| Week 2 | Hooks 測試（Collage/Screenshot/Playback）完成，覆蓋 ≥35%，新增 CI 指令 |
| Week 3+ | Modes、Kinship 整合測試上線，覆蓋逐步逼近 50% → 60% |

### 待跟進
- [ ] 研究是否需在 `setupTests` 中宣告 `globalThis.IS_REACT_ACT_ENVIRONMENT = true` 以清除 `act` 警告。
- [ ] 規劃將 `frontend/coverage/` HTML 報告上傳到 CI artifact，讓 UI 團隊檢視缺漏行。
