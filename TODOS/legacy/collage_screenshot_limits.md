## Collage 截圖效能觀察（2025-11-07）

### 背景
- 測試對象：`collage_mode`（含 mix 模式）在 `iframe_mode` 中執行。
- 截圖方式：使用內建 screenshot API（`/api/screenshots/request?client=desktop`），由前端 `html2canvas` 完成。
- 測試環境：Chrome，前端預設載入 `client=desktop_collage`。

### 關鍵發現
1. **畫布尺寸與切片數量都會影響成功率**。
   - 當 `stage_width × stage_height` 超過 ~1280×720 時，即便僅 800 片，依然容易只截到左上角或得到全黑圖。
   - 當切片數 (`rows × cols`) 超過 ~1200（例如 40×30），即使畫布維持 960×540，也會出現半張/黑圖或前端直接當掉。
2. 960×540 搭配 22×22（484 片）或 28×28（784 片）可以穩定截圖（檔案約 4.8–5 MB）。
3. 40×50（2000 片）在 960×540 下仍偶有成功（約 3.9 MB），但一旦拉大畫布就會失敗或瀏覽器崩潰。
4. 截圖失敗時，後端收到的檔案大小通常只有 60–70 KB，前端 Chrome 會顯示錯誤碼 5（Aw, Snap）。

### 可能的根本原因
- `html2canvas` 需要建立與畫布同尺寸的 off-screen canvas。當畫布面積（含 scale）加上大量 DOM 節點（每片切片都是一個 `div`）超過 GPU/瀏覽器限制時，會只渲染部分內容或完全失敗。
- mix 模式會為每個切片套用動畫與 overlap，可增加 layout 計算成本，延長內容穩定時間。
- iframe 截圖走 fallback（外層 `html2canvas`）時，若內部 `__APP_CAPTURE_SCENE` 尚未準備好，也會放大失敗機率。

### 建議的後續工作
1. **加入保護邏輯**：
   - 在設定面板/遠端 API 中，限制 `stage_width × stage_height × rows × cols` 超過門檻時給予警告或自動降級。
   - 或在截圖前自動縮放畫布（暫時調整 `transform/scale`），完成後還原。
2. **改進截圖流程**：
   - 優先呼叫 `__APP_CAPTURE_SCENE`，失敗才 fallback。
   - 研究分區截圖（tiling）再由後端合成，降低單次 canvas 面積。
3. **記錄遙測資訊**：
   - 截圖請求時附上 `rows`、`cols`、`stage_width`、`stage_height`、`pieceCount`，協助分析門檻。
4. **UI 提示**：
   - 在前端顯示 “建議上限”，例如 960×540 適合 ≤ 900 片、1280×720 適合 ≤ 600 片，超過則提示可能失敗。

### 目前臨時解法
- 將畫布維持在 960×540 左右，切片數控制在 800 以下，可確保截圖成功率。
- 若需要 2000 片以上，建議先降低畫布尺寸（例如 720p 以下），避免瀏覽器崩潰。

