# Player Desktop Shell – 實作規格

## 1. 架構概覽

- **主進程 (`src/main.js`)** 負責：
  - 啟動 Electron、維持單一實例
  - 讀取配置、建立 `WindowManager`
  - 處理 OS 訊號 (`SIGINT/SIGTERM`)、`uncaughtException`、`unhandledRejection`
  - 監聽 `child-process-gone` 以記錄 GPU/Renderer 異常
- **配置載入器 (`src/config-loader.js`)**：讀取 `config/clients.json`，並做嚴格驗證（URL、重複 client、display index 等）。
- **視窗管理器 (`src/window-manager.js`)**：掌管 BrowserWindow 生命週期、自動重啟、URL 參數組裝、多螢幕定位。

```
+-----------------+
| config/clients  |
+-----------------+
         |
         v
+----------------+      +--------------------+
| config-loader  |----->| WindowManager      |
+----------------+      |  - create windows  |
                         |  - restart policy |
                         +--------------------+
                                   |
                                   v
                           Electron BrowserWindow
```

## 2. 配置檔驗證

1. **檔案讀取**：若找不到檔案或 JSON 解析失敗，直接丟出錯誤，由主進程顯示 `dialog.showErrorBox`。
2. **欄位規則**：
   - `frontend_url`：預設 `http://localhost:5173`。
   - `auto_restart.cooldown_ms`：>0，預設 3000。
   - `auto_restart.max_attempts`：>0，預設 5。
   - `display_order`：`system`（預設）或 `spatial`（依 bounds 排序，較穩定對應實體擺位）。
   - `display_mapping_path`：顯示器/介面 mapping 檔（未指定時預設「與 config 檔同層的 `display-mapping.json`」；相對路徑以 config 檔所在資料夾為基準）。
   - `client_presets`：前端介面 preset 定義（可選）。用於 `--calibrate` UI 選取，並可在 mapping 中以 `preset_id` 引用。
   - `clients`：至少一筆；每筆需包含 `client_id`。`display_index` 仍建議提供，但在使用 `display_id` / `display_ids` 時允許省略（會回退為 0）。
3. **唯一性檢查**：`client_id` 不能重複，否則啟動即失敗。
4. **bounds**：若提供 `width/height` 必須為數字，可額外指定 `x/y` 以微調。

## 3. 視窗生命週期

1. **建立**：
   - 依 `display_ids`（多螢幕組合）或 `display_id`（單螢幕鎖定）或 `display_index`（排序後索引）決定目標顯示器與 bounds。
   - 若 index 超出可用螢幕數量，丟出錯誤並停止建立該視窗。
   - 設定 `fullscreen` / `kiosk` / `autoplayPolicy` / `backgroundThrottling=false` 等選項。
2. **顯示**：
   - `ready-to-show` 時若是單螢幕視窗且允許 fullscreen，會 `setFullScreen(true)` 並顯示視窗。
   - `devtools` 為 `true` 時會開啟分離式 DevTools。
3. **監控**：
   - `did-fail-load`、`render-process-gone`、`unresponsive`、`minimize` 皆由 `handleWindowFailure` 處理。
   - `did-finish-load` 成功後會把該視窗的重啟次數歸零。
4. **自動重啟**：
   - 失敗時會 `destroyWindow`（並標記不重複觸發），等待冷卻時間再呼叫 `createWindow`。
   - 若超過 `max_attempts`，停止自動重啟並在終端輸出錯誤。
5. **關閉**：
   - `shutdown()` 會將每個視窗以 `suppressRestart=true` 的方式銷毀，避免退出時又排程重啟。

## 4. URL 組裝策略

- 每個 client 的 URL 為 `frontend_url + querystring`。
- 如果配置中未指定 `client` 參數，`window-manager` 會自動補上 `client=<client_id>`。
- 其餘 Query 參數（如 `iframe_mode`, `iframe_timeline`, `incubator`）原封不動傳給前端，沿用既有播放邏輯。

## 5. 錯誤處理策略

| 類型 | 採取措施 |
|------|----------|
| 配置檔不存在 / JSON 解析失敗 | 主進程顯示錯誤彈窗並結束程式。 |
| `client_id` 重複 | 啟動前即擲出錯誤，避免多重視窗寫入相同 ID。 |
| `display_index` 超出螢幕數量 | 在 `createWindow` 阻擋並顯示錯誤訊息，提示調整配置或連接更多螢幕。 |
| 視窗載入失敗 (`did-fail-load`) | 記錄錯誤、銷毀視窗、依 `cooldown_ms` 排程重建。 |
| Renderer / GPU 崩潰 | 透過 `render-process-gone` 與 `child-process-gone` 事件記錄，並觸發重啟。 |
| 視窗被手動關閉 | 視為異常，依同樣流程自動重啟。 |
| 達到最大重啟次數 | 停止重啟並輸出錯誤，避免無限迴圈；需人工檢查原因。 |
| OS 訊號 (Ctrl+C / SIGTERM) | 記錄訊號並呼叫 `app.quit()`，同時走 `shutdown()` 確保視窗乾淨退出。 |

## 6. 單一實例策略

- `app.requestSingleInstanceLock()` 確保同一台機器只會有一個 Player Shell。
- 若使用者嘗試再次開啟，會觸發 `second-instance` 事件，Shell 會聚焦現有視窗或重新建立。

## 7. 未來擴充點

1. **配置熱載入**：監看 `clients.json`，變動時自動新增/移除視窗。
2. **監控 API**：透過 IPC / WebSocket 對外暴露 `WindowManager.summary()`，供後端查詢狀態。
3. **硬體整合**：與 GPIO / USB 控制器整合，將訊號轉為後端 API 呼叫。
4. **紀錄檔**：導入 `winston` 或其他 logger，把所有事件寫入檔案方便追蹤。
5. **健康檢查 UI**：在 Shell 內提供簡單面板顯示各 client 的最近載入狀態與錯誤次數。
6. **校正流程強化**：若 `display.id` 在某些情境不穩，可加入「依 bounds 最近鄰」或「人工確認」的自動回退策略。

