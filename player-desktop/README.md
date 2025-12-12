# Player Desktop Shell

Player Desktop Shell 是一個 Electron 桌面應用程式，用來在展覽現場包覆現有的 Web 前端。它負責多螢幕視窗管理、自動播放政策設定與視窗異常恢復，讓現場僅需啟動單一應用程式即可載入所有展示 client。

## 功能概要

- 依照配置檔自動建立對應實體螢幕的播放視窗
- 強制啟用 `autoplayPolicy: "no-user-gesture-required"` 解除音訊/影片手動解鎖
- 視窗關閉、崩潰或載入失敗時自動重啟，避免人工介入
- 透過 URL 參數傳遞 `clientId`、`mode` 等資訊，沿用既有前端邏輯
- 單一應用即可管理多個 client，支援 kiosk / fullscreen 模式

## 專案結構

```
player-desktop/
├── config/
│   └── clients.json            # 多螢幕與 client 配置
├── src/
│   ├── config-loader.js        # 讀取與驗證配置檔
│   ├── window-manager.js       # 管理 BrowserWindow 生命週期
│   └── main.js                 # Electron 主進程入口
├── package.json
├── package-lock.json
├── README.md                   # 本文件
└── IMPLEMENTATION_SPEC.md      # 深入技術說明
```

## 安裝與啟動

```bash
cd /Volumes/2024data/glitch_home_project/player-desktop
npm install
npm run dev    # 或 npm start
```

預設會載入 `config/clients.json`，並連線到 `http://localhost:5173`（前端 dev server）。

> **提示**：正式部署時可改成指向已 Build 的前端網址或靜態檔案伺服器。

## Remote DevTools / MCP 連線

為了讓 chrome-devtools MCP 或其他 CDP 用戶端可以直接操控展演視窗，Player Desktop Shell 啟動時會預設打開 `remote-debugging-port=5858`（僅綁定本機回圈）。

- **自訂或停用 Port**
  - 透過環境變數：`PLAYER_DESKTOP_REMOTE_DEBUG_PORT=9222 npm run dev`
  - 透過 CLI 旗標：`npm run dev -- --remote-debug-port 9222` 或 `npm run dev -- --remote-debug-port=9222`（等號寫法亦支援 `--remote-debugging-port[=]`）
  - 設成 `0` / `false` / `off` 代表停用 remote debugging，例如 `PLAYER_DESKTOP_REMOTE_DEBUG_PORT=0 npm start`
- **驗證是否成功開啟**：啟動程式後執行 `curl http://127.0.0.1:5858/json/version`，應能收到包含 `webSocketDebuggerUrl` 的 JSON。
- **接上 chrome-devtools MCP**：
  ```toml
  [mcp_servers.chrome-devtools]
  command = "npx"
  args = ["-y", "chrome-devtools-mcp@latest", "--browserUrl=http://127.0.0.1:5858"]
  ```
  之後使用 `navigate_page`、`click`、`take_snapshot` 等 tool 時，就會直接操作 Electron 裡的展示視窗。

> ⚠️ Remote debugging 擁有完整控制權，僅在內網或佈展機啟用即可；正式版本可透過上述環境變數/旗標關閉。

## 配置檔 (`config/clients.json`)

| 欄位 | 說明 |
|------|------|
| `frontend_url` | 要載入的前端 URL。開發時預設 `http://localhost:5173`。 |
| `auto_restart.cooldown_ms` | 異常後等待多少毫秒再重啟視窗（預設 3000）。 |
| `auto_restart.max_attempts` | 單一視窗最多重啟次數（預設 5，填入較大的數字可放寬）。 |
| `single_display_mode` | 僅偵測到一個螢幕時是否允許啟動 fallback 模式。`false`（預設）會直接失敗並冒出錯誤；`true` 代表僅啟動 `display_index = 0` 的 client，其餘會被略過。 |
| `display_order` | 顯示器排序策略：`system`（預設，沿用 `screen.getAllDisplays()` 回傳順序）或 `spatial`（依螢幕 `bounds.x/y` 由左到右、由上到下排序，較穩定對應實體擺位）。 |
| `clients[].client_id` | 每個視窗的唯一 ID，也會寫入 URL `?client=` 供前端識別。 |
| `clients[].display_index` | 指定第幾個實體螢幕（0 為主螢幕）。若超出現有螢幕數量，應用程式會拒絕啟動。 |
| `clients[].display_id` | （選用）鎖定 Electron `Display.id` 指定的顯示器；若找不到該 `display_id`，會回退使用 `display_index`。可用 `npm run dev -- --dump-displays` 取得目前機器的 id/bounds。 |
| `clients[].fullscreen` | 是否自動進入全螢幕（預設 `true`）。 |
| `clients[].kiosk` | Kiosk 模式（隱藏系統 UI、避免 Alt+Tab）。 |
| `clients[].devtools` | 啟動時是否開啟 DevTools，方便除錯。 |
| `clients[].url_params` | 會附加到前端 URL 的查詢參數，例如 `iframe_mode=true`、`iframe_timeline=<id>`。若未指定 `client` 參數，系統會自動補上。 |

### 範例

```json
{
  "frontend_url": "http://localhost:5173",
  "auto_restart": {
    "cooldown_ms": 3000,
    "max_attempts": 5
  },
  "single_display_mode": false,
  "clients": [
    {
      "client_id": "desktop-main",
      "display_index": 0,
      "fullscreen": true,
      "url_params": {
        "client": "desktop-main",
        "iframe_mode": "true",
        "iframe_timeline": "desktop_wall"
      }
    },
    {
      "client_id": "desktop-side",
      "display_index": 1,
      "fullscreen": true,
      "url_params": {
        "client": "desktop-side",
        "incubator": "true",
        "phylogeny": "true"
      }
    }
  ]
}
```

## 運行流程

1. 開啟電腦後啟動 Player Desktop Shell
2. 應用程式讀取 `clients.json`，並檢查是否有重複 `client_id`
3. 根據 `display_index` 建立對應視窗並套用 URL 參數
4. 視窗載入成功後即可透過 WebSocket 與後端協同播放
5. 如果任一視窗崩潰、載入失敗或被誤關，Shell 會在冷卻時間後自動重啟

## 參數覆寫

- CLI：`npm start -- --config /path/to/custom.json`
- 環境變數：`PLAYER_DESKTOP_CONFIG=/path/to/custom.json npm run dev`
- 列出目前顯示器資訊（id/bounds）：`npm run dev -- --dump-displays`

## 螢幕校正模式（展場對應用）

當 macOS 在重開機、拔插螢幕、或變更顯示器排列後，`screen.getAllDisplays()` 的順序可能變動，導致僅用 `display_index` 時畫面跑錯螢幕。

Player Desktop Shell 提供 `--calibrate` 來建立「client ↔ 顯示器」的 mapping 檔，讓現場用單一面板快速校正：

```bash
npm run dev -- --calibrate
```

- 會在每個螢幕顯示一個大字 overlay（含 `display.id` 與 bounds）
- 主螢幕會開「控制面板」，你可以把每個 `client_id` 指派到某個 `display.id`
- 按 `Save & Launch` 會寫入 mapping 檔並直接啟動正式展演視窗

### Mapping 檔與設定

- `display_mapping_path`（可選）：mapping 檔路徑（相對路徑會以 config 檔所在資料夾為基準）。未指定時預設為「與 `clients.json` 同層的 `display-mapping.json`」
- mapping 檔存在時，啟動會自動套用到 `clients[].display_id`（找不到再回退 `display_index`）

## 疑難排解

| 問題 | 排解方式 |
|------|-----------|
| 視窗卡在主螢幕 | 確認 `display_index` 是否超出實體螢幕數量；若超出，應用程式會在終端輸出錯誤。 |
| 無法自動播放音訊 | 確保前端載入後會建立 `SoundPlayer`，並讓殼層維持 `autoplayPolicy` 預設值。 |
| 視窗不斷重啟 | 查看終端訊息，若已達 `max_attempts` 會停止重啟；調整配置後再重新啟動。 |
| 想手動重載配置 | 停止應用、修改 `clients.json`、再執行 `npm run dev`。未來可擴充熱載入。 |

## 後續規劃

- 設計簡易設定 UI 以便非技術人員管理配置
- 整合硬體按鈕 / 感測器事件，觸發 WebSocket 播放指令
- 加入視窗監控 API，供後端或監控系統查詢狀態
