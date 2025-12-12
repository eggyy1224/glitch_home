## 票：顯示器對應與 preset 資訊強化（不含 auto_mode 輪播）

### 背景
- 每台機器固定 3 個槽位（slot），但實體顯示器數量、排列、橫直比例不一，且允許 1:n 拼接。
- `display-mapping.json` v2 已支援 `display_ids` 與 preset 指派，但缺少橫直/比例提示；`client_presets` 也尚未保存 orient/layout 資訊。
- auto_mode 輪播由其他 agent 處理，本票不涉。

### 需求與交付物
- 交付物 1：擴充 `player-desktop/config/clients.json` 的 `client_presets` 欄位，新增 `orientation`（landscape/portrait/tiled-2x2…）、`target_aspect`（例 16:9/9:16/1:1）、`layout_hint`（1x1/2x2/1x3）。校正控制面板讀取並顯示這些提示，並在寫回 `display-mapping.json` 時保留現有 `url_params` 合併行為。
- 交付物 2：校正 UI 增加橫直/比例警告：若 slot 綁定的 display 旋轉/長寬比與 preset 的 orientation/target_aspect 明顯不符，顯示警示訊息。
- 交付物 3：Snapshot 篩選支持以 `client` 取得對應清單（`/api/iframe-config/snapshots?client=<preset>` 已有）；前端列表/選擇器能依 preset/client 過濾。若需跨群組再評估 `group` 參數，非必需可不做。
- 交付物 4（可選）：常見拼貼模板（2x2、3x3…）一鍵套用，再換圖；後端或前端對 layout/ratio vs 實機顯示器做簡易警告。
- 交付物 5：容錯與監控補強：player-desktop 載入 iframe/snapshot 失敗或圖片 404 時記 log 並落回預設頁；保持現有視窗自動重啟機制。

### 範圍外
- auto_mode 輪播與轉場邏輯（已交由其他 agent）。
