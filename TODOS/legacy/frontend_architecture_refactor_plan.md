# 前端重構計劃書（字幕／旁白模式前置作業）

## 前言
目前前端核心（尤其 `App.jsx` 與多模式元件）職責交疊、共用資源分散，導致：
- 新增旁白字幕模式時會牽動大量既有程式。
- 模式間共用 API、WebSocket、樣式時易出錯。
- 測試、故障排查難度高。

以下重構計畫分為四階段，完成後才能在穩定基礎上接續開發字幕模式與 TTS。

---

## Phase 0：啟動準備
- [ ] 梳理現有功能清單與使用路徑（Slide / Organic / 3D Kinship / Search / SoundPlayer / Screenshot Queue）。
- [ ] 列出台面上所有 URL 參數、`import.meta.env` 變數，決定哪些保留、哪些統一命名。
- [ ] 建立重構用分支（避免與展場版本衝突）。

---

## Phase 1：基礎結構重整
### 1.1 App 架構拆分
- [ ] 將 `App.jsx` 拆成「殼層」與「模式容器」：
  - `AppShell`：負責全域上下文（WebSocket、Screenshot、Sound、Narration Overlay placeholder）。
  - `ModeRouter`：解析 URL / 後端指令，決定渲染哪個模式元件。
- [ ] 拆出共用 hook：  
  `useQueryParams`、`useClientId`、`useModeFlags`（避免每次都 re-parse `window.location.search`）。
- [ ] 所有 `window`、`document` 取用改為在 `useEffect` 或判斷 `typeof window !== "undefined"` 後呼叫，為未來測試/SSR 預作準備。

### 1.2 狀態管理與 Context
- [ ] 新增 `src/state/`，建立：
  - `ModeState`：紀錄目前模式、錨點影像、播放狀態。
  - `ScreenshotQueueState`：集中管理自動截圖任務之排程與狀態（擺脫 `useRef` 雜散分佈）。
  - `SoundPlaybackState`：避免 `SoundPlayer` 直接讀 `App` state。
- [ ] 確定每個 context 的提供者位置與 scope，避免過度 re-render。

### 1.3 WebSocket 指令中心
- [ ] 建立 `services/socketClient.js`（或 `useScreenshotSocket` hook）：
  - 封裝連線／重試／心跳邏輯。
  - 提供訂閱機制（Observer pattern 或簡易 event emitter），替換 `App.jsx` 內部 `socket.onmessage` 堆疊。
- [ ] 定義事件 enum / type：`screenshot_request`、`screenshot_completed`、`sound_play` 等，以常數統一管理。

---

## Phase 2：共用資源與 UI 整合
### 2.1 API/Service 模組化
- [ ] 建立 `src/services/api/` 結構，將 `api.js` 拆為：
  - `imageSearchService`（`searchImagesByImage` 等）
  - `kinshipService`
  - `screenshotService`
  - `soundService`
  - 預留 `narrationService`（供字幕/旁白使用）
- [ ] 補上共用 `request` 包裝（錯誤處理、重試策略、timeout 設定）。

### 2.2 共用 UI 與樣式系統
- [ ] 建立 `src/components/ui/` 儲存按鈕、Badge、Panel 等常用元件，逐步替換現有 inline style。
- [ ] 確立樣式策略（CSS Modules、Tailwind 或 styled-components）；現階段先把重複的 style 物件抽離，避免 inline mutation。
- [ ] 清理現有 `styles` 常數（例如 SlideMode/OrganicRoomScene），將通用部分移至 `theme` 或共用 CSS。

### 2.3 截圖佇列重構
- [ ] 將 `requestQueueRef`, `pendingRequestIdsRef`, `isProcessingRef` 等暫存改為 `ScreenshotQueueState` 控制。
- [ ] 釐清任務種類（後續需支援 narration），設計任務物件格式：`{ id, kind, payload, status, createdAt }`。
- [ ] 調整 `processQueue` 邏輯，支援多任務種類與 hook 化（避免在 component re-render 時重新建立函式）。

---

## Phase 3：模式元件調整
### 3.1 SlideMode / OrganicRoomScene / SearchMode
- [ ] 改為從 `ModeState` 取得 anchor、imagesBase、播放參數，不再自行解析 URL。
- [ ] 梳理每個模式需要的 API，改用 Phase 2 建立的 service 層。
- [ ] 移除大量 `console.log`、inline style mutation（改用 className 或 inline style 的複製）。
- [ ] 將共用工具函式（例如 `cleanId`）移轉到 `utils/imageId.js`。

### 3.2 KinshipScene 與子組件
- [ ] 檢查 `ThreeKinshipScene.jsx` 內部狀態使用情況，與 `App` 新的狀態/事件流整合。
- [ ] 確認 FPS / Camera Preset 相關資訊透過 context 提供，不再直接 prop drilling 多層。
- [ ] 檢討 `sliderStyles` 動態注入邏輯（SlideMode 的 `<style>`），移至全域樣式或 `useEffect` 管理。

---

## Phase 4：字幕模式前置
- [ ] 設計 `NarrationOverlay` 元件（先以 mock data 顯示），放在 `AppShell`。
- [ ] 新增 `NarrationState`（含 `visible`, `currentCaption`, `queue` 等），但先不實作後端串接。
- [ ] 擴充 WebSocket handler 程式架構，保留 `narration_ready`、`narration_failed` 事件 placeholder。
- [ ] 撰寫整合測試案例（至少涵蓋：切換模式、截圖任務、SoundPlayer、字幕顯示 stub），確認重構後功能等價。

---

## 最終交付物與驗收
- [ ] 整體架構圖（更新 docs 或 README）。
- [ ] 新增/更新測試（可以是手動步驟紀錄 + 後續補自動化）。
- [ ] 主要檔案：`AppShell.jsx`, `ModeRouter.jsx`, `state/`, `services/`, `NarrationOverlay.jsx`。
- [ ] 列出待處理清單（TODO）作為字幕 / TTS 下階段需求。

執行過程請維持模組化與可回溯性，每完成階段建議執行整體功能驗證，避免後續堆疊功能時產生未知副作用。
