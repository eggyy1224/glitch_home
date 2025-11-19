# 多客戶端協調指南

> **版本**: 1.0  
> **最後更新**: 2025-11-04

---

## 概述

圖像系譜學系統支援多個前端客戶端同時連線，可透過 WebSocket 進行即時協調與通訊。每個客戶端可以有不同的角色（如展示端、控制端），並可接收定向或廣播訊息。

---

## 核心概念

### 客戶端識別

每個前端客戶端透過 `client_id` 識別：
- 在 URL 參數中指定：`?client=<client_id>`
- 透過 WebSocket 註冊：`{"type": "hello", "client_id": "<client_id>"}`

### 客戶端類型範例

- `desktop`: 桌面展示端
- `desktop2`: 第二個桌面展示端
- `mobile`: 行動裝置展示端
- `default`: 預設客戶端（未指定時）
- `display_wall`: 大型展示牆

---

## WebSocket 連線

### 連線端點

```
ws://localhost:8000/ws/screenshots
```

### 連線流程

1. **建立連線**: 前端連接到 WebSocket
2. **註冊客戶端**: 發送 `hello` 訊息註冊 `client_id`
3. **接收訊息**: 監聽後端推送的各種訊息類型

### 註冊訊息

```json
{
  "type": "hello",
  "client_id": "mobile"
}
```

---

## 訊息類型

### 1. 截圖相關

#### screenshot_request（截圖請求）
```json
{
  "type": "screenshot_request",
  "request_id": "req_20251104_123456_xyz",
  "target_client_id": "mobile",  // 可為 null（廣播給所有）
  "metadata": {
    "label": "主展示場景",
    "source": "curator_dashboard"
  }
}
```

#### screenshot_completed（截圖完成）
```json
{
  "type": "screenshot_completed",
  "request_id": "req_xxx",
  "result": {
    "filename": "screenshot_xxx.png",
    "absolute_path": "/abs/path/...",
    "relative_path": "screen_shots/..."
  }
}
```

#### screenshot_failed（截圖失敗）
```json
{
  "type": "screenshot_failed",
  "request_id": "req_xxx",
  "error": "error message"
}
```

### 2. 音效播放

#### sound_play（音效播放請求）
```json
{
  "type": "sound_play",
  "filename": "narration_xxx.mp3",
  "url": "http://localhost:8000/api/sound-files/narration_xxx.mp3"
}
```

### 3. 配置更新

#### iframe_config（Iframe 配置更新）
```json
{
  "type": "iframe_config",
  "target_client_id": "desktop",  // 可為 null（廣播給所有）
  "config": {
    "layout": "grid",
    "gap": 12,
    "columns": 2,
    "panels": [...]
  }
}
```

#### collage_config（拼貼配置更新）
```json
{
  "type": "collage_config",
  "target_client_id": "desktop_wall",  // 可為 null（廣播給所有）
  "config": {
    "images": [...],
    "image_count": 20,
    "rows": 5,
    "cols": 8,
    "mix": true,
    "stage_width": 2048,
    "stage_height": 1152,
    "seed": 987123
  }
}
```

### 4. 字幕與說明文字

#### subtitle_update（字幕更新）
```json
{
  "type": "subtitle_update",
  "target_client_id": "mobile",  // 可為 null（廣播給所有）
  "subtitle": {
    "text": "歡迎來到圖像系譜學",
    "language": "zh-TW",
    "expires_at": "2025-11-04T12:40:00Z"
  }
}
```

#### caption_update（說明文字更新）
```json
{
  "type": "caption_update",
  "target_client_id": "mobile",  // 可為 null（廣播給所有）
  "caption": {
    "text": "這是一張由 AI 生成的圖像",
    "language": "zh-TW",
    "expires_at": "2025-11-04T12:40:00Z"
  }
}
```

---

## API 端點

### 查詢在線客戶端

```bash
GET /api/clients
```

**回應**:
```json
{
  "clients": [
    {"client_id": "desktop", "connections": 1},
    {"client_id": "mobile", "connections": 1},
    {"client_id": "default", "connections": 42}
  ]
}
```

**說明**:
- `connections`: WebSocket 連線數（同一客戶端可能有多個連線）

---

## 客戶端專屬配置

系統支援為不同客戶端設定專屬配置：

### Iframe 配置

- **全域**: `backend/metadata/iframe_config.json`
- **客戶端專屬**: `backend/metadata/iframe_config__<client>.json`

**取得配置**:
```bash
GET /api/iframe-config?client=<client_id>
```

**更新配置**:
```bash
PUT /api/iframe-config
{
  "target_client_id": "desktop",
  "layout": "grid",
  "panels": [...]
}
```

### Collage 配置

- **全域**: `backend/metadata/collage_config.json`
- **客戶端專屬**: `backend/metadata/collage_config__<client>.json`

**取得配置**:
```bash
GET /api/collage-config?client=<client_id>
```

**更新配置**:
```bash
PUT /api/collage-config
{
  "target_client_id": "desktop_wall",
  "images": [...],
  "rows": 5,
  "cols": 8
}
```

---

## 使用場景

### 場景 1: 多螢幕展示

**需求**: 同時控制多個展示端（desktop、desktop2、mobile）

**步驟**:
1. 在各展示端開啟前端，指定不同的 `client_id`
2. 使用 API 分別設定各客戶端的配置
3. 透過 WebSocket 推送同步訊息

**範例**:
```bash
# 設定 desktop 的 iframe 配置
curl -X PUT http://localhost:8000/api/iframe-config \
  -H "Content-Type: application/json" \
  -d '{
    "target_client_id": "desktop",
    "layout": "grid",
    "columns": 2,
    "panels": [...]
  }'

# 設定 desktop2 的 collage 配置
curl -X PUT http://localhost:8000/api/collage-config \
  -H "Content-Type: application/json" \
  -d '{
    "target_client_id": "desktop2",
    "images": [...],
    "rows": 10,
    "cols": 10
  }'

# 推送 TTS 給 mobile
curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "歡迎來到展覽現場",
    "auto_play": true,
    "target_client_id": "mobile"
  }'
```

### 場景 2: 遠端截圖

**需求**: 從控制端請求展示端截圖

**步驟**:
1. 控制端呼叫 API 建立截圖請求
2. 後端透過 WebSocket 推送給目標客戶端
3. 展示端自動截圖並上傳
4. 後端標記請求完成

**範例**:
```bash
# 1. 建立截圖請求
REQUEST_ID=$(curl -X POST http://localhost:8000/api/screenshots/request \
  -H "Content-Type: application/json" \
  -d '{
    "target_client_id": "mobile",
    "label": "展場截圖"
  }' | jq -r '.id')

# 2. 等待完成（展示端會自動處理）
sleep 3

# 3. 查詢結果
curl -X GET "http://localhost:8000/api/screenshots/$REQUEST_ID"
```

### 場景 3: 同步播放音效

**需求**: 同時在多個展示端播放音效

**步驟**:
1. 產生或選擇音效檔案
2. 使用 `sound-play` API，不指定 `target_client_id`（廣播）
3. 所有連線的客戶端都會收到播放請求

**範例**:
```bash
# 廣播給所有客戶端
curl -X POST http://localhost:8000/api/sound-play \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "narration_xxx.mp3"
  }'

# 或指定特定客戶端
curl -X POST http://localhost:8000/api/sound-play \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "narration_xxx.mp3",
    "target_client_id": "mobile"
  }'
```

---

## 前端實作

### WebSocket 連線範例

```javascript
const ws = new WebSocket("ws://localhost:8000/ws/screenshots");
const clientId = new URLSearchParams(window.location.search).get("client") || "default";

ws.onopen = () => {
  // 註冊客戶端
  ws.send(JSON.stringify({
    type: "hello",
    client_id: clientId
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  // 處理不同類型的訊息
  switch (message.type) {
    case "screenshot_request":
      handleScreenshotRequest(message);
      break;
    case "sound_play":
      handleSoundPlay(message);
      break;
    case "iframe_config":
      handleIframeConfig(message);
      break;
    case "collage_config":
      handleCollageConfig(message);
      break;
    case "subtitle_update":
      handleSubtitleUpdate(message);
      break;
    case "caption_update":
      handleCaptionUpdate(message);
      break;
  }
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

ws.onclose = () => {
  console.log("WebSocket closed, reconnecting...");
  // 實作重連邏輯
};
```

### 使用 React Hooks

系統提供 `useControlSocket` hook 簡化 WebSocket 管理：

```javascript
import { useControlSocket } from "./hooks/useControlSocket.js";

function App() {
  const clientId = useMemo(() => 
    new URLSearchParams(window.location.search).get("client") || "default",
    []
  );

  useControlSocket({
    clientId,
    onScreenshotRequest: (message) => {
      // 處理截圖請求
    },
    onSoundPlay: (message) => {
      // 處理音效播放
    },
    onIframeConfig: (message) => {
      // 處理 iframe 配置更新
    },
    onCollageConfig: (message) => {
      // 處理 collage 配置更新
    },
    onSubtitleUpdate: (message) => {
      // 處理字幕更新
    },
    onCaptionUpdate: (message) => {
      // 處理說明文字更新
    }
  });
}
```

---

## 最佳實踐

### 1. 客戶端 ID 命名

建議使用有意義的命名：
- ✅ `desktop_main`、`desktop_side`、`mobile_entrance`
- ❌ `client1`、`test`、`abc`

### 2. 配置管理

- 為不同客戶端設定專屬配置，避免互相干擾
- 使用描述性的配置名稱
- 定期備份配置檔案

### 3. 錯誤處理

- 實作 WebSocket 重連機制
- 處理連線失敗的情況
- 記錄錯誤日誌

### 4. 效能考量

- 避免頻繁更新配置
- 使用適當的輪詢間隔
- 監控 WebSocket 連線數

---

## 故障排除

### 問題 1: 客戶端收不到訊息

**可能原因**:
- WebSocket 未正確連線
- `client_id` 不匹配
- `target_client_id` 設定錯誤

**解決方法**:
1. 檢查 WebSocket 連線狀態
2. 確認 `client_id` 是否正確註冊
3. 檢查 `GET /api/clients` 確認客戶端在線

### 問題 2: 配置更新未生效

**可能原因**:
- 前端未正確監聽 WebSocket
- 配置檔案路徑錯誤
- 客戶端專屬配置優先級問題

**解決方法**:
1. 檢查前端 WebSocket 監聽邏輯
2. 確認配置檔案是否存在
3. 檢查配置載入順序（客戶端專屬 > 全域 > 預設）

### 問題 3: 多個連線造成重複訊息

**可能原因**:
- 同一客戶端開啟多個頁面
- WebSocket 重連未清理舊連線

**解決方法**:
1. 使用 `GET /api/clients` 檢查連線數
2. 關閉多餘的頁面
3. 實作連線清理邏輯

---

## 參考資源

- [系統規格文件](../spec.md) - 完整的 API 規格
- [API 快速上手指南](./API_QUICK_START_GUIDE.md) - 快速開始範例
- [後端架構概論](./system_architecture/後端架構概論.md) - 技術實作細節
- [前端架構概論](./system_architecture/前端架構概論.md) - 前端實作細節

---

**文件結束**

