# 截圖系統架構說明

> **版本**: 1.0  
> **最後更新**: 2025-11-07

## 📋 系統概覽

這是一個**遠端截圖請求與管理系統**，透過 WebSocket 實現後端與前端客戶端的即時通訊，支援：
- 🎯 遠端發起截圖請求
- 📸 前端自動截圖並上傳
- 🔄 請求狀態追蹤（pending → completed/failed）
- 🎨 支援多種場景模式（3D 景觀、Collage、Slide 等）
- 🎵 截圖後自動生成音效（可選）

---

## 🏗️ 架構組成

### 1. **後端組件**

#### `backend/app/services/screenshot_requests.py`
**核心管理器**：`ScreenshotRequestManager`

- **功能**：
  - 管理截圖請求的生命週期（創建、完成、失敗）
  - WebSocket 連接管理與訊息廣播
  - 客戶端註冊與狀態追蹤

- **主要方法**：
  ```python
  create_request(metadata)      # 創建截圖請求
  mark_completed(request_id, result)  # 標記完成
  mark_failed(request_id, message)   # 標記失敗
  register_client(websocket, client_id)  # 註冊客戶端
  broadcast_*()  # 各種廣播方法
  ```

#### `backend/app/services/screenshots.py`
**檔案儲存**：`save_screenshot()`

- **功能**：
  - 處理上傳的截圖檔案
  - 生成唯一檔名：`scene_{timestamp}_{token}.png`
  - 儲存到 `screen_shots/` 目錄

#### `backend/app/api/realtime.py`
**API 端點**：

- `POST /api/screenshots/request` - 創建截圖請求
- `GET /api/screenshots/{request_id}` - 查詢請求狀態
- `POST /api/screenshots/{request_id}/fail` - 回報失敗
- `POST /api/screenshots` - 上傳截圖檔案
- `WebSocket /ws/screenshots` - WebSocket 連接

### 2. **前端組件**

#### `frontend/src/hooks/useScreenshotManager.js`
**截圖管理器 Hook**

- **功能**：
  - 管理截圖請求佇列
  - 處理自動截圖流程
  - 上傳截圖到後端
  - 顯示截圖狀態訊息

- **主要方法**：
  ```javascript
  handleCaptureReady(fn)        // 註冊截圖函數
  enqueueScreenshotRequest(payload)  // 加入請求佇列
  requestCapture()               // 手動觸發截圖
  markRequestDone(requestId)     // 標記請求完成
  ```

#### `frontend/src/hooks/useControlSocket.js`
**WebSocket 連接管理**

- **功能**：
  - 建立 WebSocket 連接
  - 處理後端推送的訊息
  - 自動重連機制

- **處理的訊息類型**：
  - `screenshot_request` - 收到截圖請求
  - `screenshot_completed` - 截圖完成通知
  - `screenshot_failed` - 截圖失敗通知
  - `sound_play` - 音效播放請求
  - `iframe_config` - Iframe 配置更新
  - `collage_config` - Collage 配置更新

---

## 🔄 完整工作流程

### 流程圖

```
後端發起請求
    ↓
POST /api/screenshots/request
    ↓
ScreenshotRequestManager.create_request()
    ↓
透過 WebSocket 廣播 screenshot_request
    ↓
前端收到請求 (useControlSocket)
    ↓
加入請求佇列 (useScreenshotManager)
    ↓
執行截圖 (各場景的 captureFn)
    ↓
上傳截圖 POST /api/screenshots
    ↓
後端儲存檔案 save_screenshot()
    ↓
標記完成 mark_completed()
    ↓
透過 WebSocket 廣播 screenshot_completed
```

### 詳細步驟

#### 步驟 1: 後端發起截圖請求

```bash
curl -X POST http://localhost:8000/api/screenshots/request \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "mobile",
    "label": "展場截圖"
  }'
```

**回應**：
```json
{
  "id": "a1b2c3d4e5f6g7h8",
  "status": "pending",
  "created_at": "2025-11-07T06:00:00Z",
  "target_client_id": "mobile",
  "metadata": {"client_id": "mobile", "label": "展場截圖"}
}
```

#### 步驟 2: WebSocket 推送請求

後端自動透過 WebSocket 推送訊息給目標客戶端：

```json
{
  "type": "screenshot_request",
  "request_id": "a1b2c3d4e5f6g7h8",
  "target_client_id": "mobile",
  "metadata": {"client_id": "mobile", "label": "展場截圖"}
}
```

#### 步驟 3: 前端接收並處理

1. **useControlSocket** 收到訊息
2. 呼叫 `onScreenshotRequest` callback
3. **useScreenshotManager** 的 `enqueueScreenshotRequest()` 被觸發
4. 請求加入佇列 `requestQueueRef.current`

#### 步驟 4: 執行截圖

1. `processQueue()` 從佇列取出請求
2. 檢查 `captureFnRef.current` 是否存在
3. 呼叫 `captureFn()` 取得截圖 Blob
4. 各場景模式提供自己的 `captureFn`：
   - **3D 景觀**：使用 html2canvas
   - **Collage Mode**：使用 html2canvas（會暫停動畫）
   - **Slide Mode**：使用 html2canvas
   - **其他模式**：各自實作

#### 步驟 5: 上傳截圖

```javascript
// frontend/src/api.js
uploadScreenshot(blob, requestId, clientId)
```

**請求**：
```
POST /api/screenshots
Content-Type: multipart/form-data

file: [Blob]
request_id: "a1b2c3d4e5f6g7h8"
client_id: "mobile"
```

#### 步驟 6: 後端儲存

```python
# backend/app/services/screenshots.py
save_screenshot(upload)
```

- 生成檔名：`scene_20251107T060000_a1b2c3d4.png`
- 儲存到：`screen_shots/scene_20251107T060000_a1b2c3d4.png`
- 返回路徑資訊

#### 步驟 7: 標記完成

```python
# backend/app/services/screenshot_requests.py
mark_completed(request_id, result, processed_by)
```

- 更新請求狀態：`pending` → `completed`
- 儲存結果資訊（檔案路徑等）
- 透過 WebSocket 廣播 `screenshot_completed`

#### 步驟 8: 前端收到完成通知

前端收到 `screenshot_completed` 訊息，清除 pending 標記。

---

## 📝 請求狀態管理

### 狀態流程

```
pending → completed ✅
       ↘ failed ❌
```

### 請求記錄結構

```python
{
  "id": "request_id",
  "status": "pending" | "completed" | "failed",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp",
  "target_client_id": "client_id" | None,
  "metadata": {...},
  "result": {
    "filename": "scene_xxx.png",
    "absolute_path": "/full/path/to/file.png",
    "relative_path": "screen_shots/scene_xxx.png"
  } | None,
  "error": "error message" | None,
  "processed_by": "client_id" | None
}
```

---

## 🎯 客戶端過濾機制

### 目標客戶端指定

- **全域請求**：`target_client_id = None` → 所有客戶端都會收到
- **指定客戶端**：`target_client_id = "mobile"` → 只有 `mobile` 客戶端收到

### 前端過濾邏輯

```javascript
// frontend/src/hooks/useScreenshotManager.js
const targetClientId = payload?.target_client_id ?? payload?.metadata?.client_id ?? null;
if (targetClientId && targetClientId !== clientId) {
  return; // 忽略不屬於自己的請求
}
```

### Iframe 模式特殊處理

```javascript
// 如果頁面在 iframe 中，且父頁面是 iframe_mode，則不處理截圖請求
if (window.self !== window.top) {
  const parentUrl = window.parent.location.href;
  const parentParams = new URL(parentUrl).searchParams;
  const parentIframeMode = parentParams.get("iframe_mode") === "true";
  if (parentIframeMode) {
    return; // 忽略 iframe 內的請求
  }
}
```

---

## 🔧 各場景模式的截圖實作

### 1. 3D 景觀模式（預設）

```javascript
// frontend/src/KinshipScene.jsx
const captureScene = async () => {
  const html2canvas = await ensureHtml2Canvas();
  const canvas = await html2canvas(rootRef.current, {
    backgroundColor: "#050508",
    useCORS: true,
  });
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
};
```

### 2. Collage Mode

```javascript
// frontend/src/CollageMode.jsx
const captureScene = async () => {
  const html2canvas = await ensureHtml2Canvas();
  const canvas = await html2canvas(root, {
    backgroundColor: "#050508",
    onclone: (doc) => {
      // 暫停所有動畫，確保截圖清晰
      doc.querySelectorAll(".collage-piece").forEach((el) => {
        el.style.animation = "none";
        el.style.opacity = "1";
        el.style.transform = "none";
      });
    },
  });
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
};
```

### 3. Slide Mode

```javascript
// frontend/src/SlideMode.jsx
// 類似 3D 景觀模式，使用 html2canvas
```

---

## 🚨 錯誤處理

### 前端錯誤處理

1. **場景未準備好**：
   ```javascript
   if (!captureFn) {
     throw new Error("場景尚未準備好");
   }
   ```

2. **上傳失敗**：
   ```javascript
   try {
     await uploadScreenshot(blob, requestId, clientId);
   } catch (err) {
     await reportScreenshotFailure(requestId, err.message, clientId);
   }
   ```

3. **回報失敗 API**：
   ```bash
   POST /api/screenshots/{request_id}/fail
   {
     "error": "錯誤訊息",
     "client_id": "mobile"
   }
   ```

### 後端錯誤處理

1. **檔案類型不支援**：
   ```python
   raise ValueError("Unsupported screenshot file type")
   ```

2. **請求不存在**：
   ```python
   raise HTTPException(status_code=404, detail="screenshot request not found")
   ```

3. **儲存失敗**：
   ```python
   raise HTTPException(status_code=500, detail="failed to save screenshot")
   ```

---

## 📊 佇列管理機制

### 請求佇列

- **FIFO 佇列**：先進先出
- **防止重複**：使用 `pendingRequestIdsRef` Set 追蹤
- **佇列處理**：一次只處理一個請求，完成後處理下一個

### 佇列處理邏輯

```javascript
const processQueue = () => {
  // 1. 檢查是否正在處理
  if (isProcessingRef.current) return;
  
  // 2. 檢查是否正在截圖
  if (isCapturingRef.current) {
    // 延遲 400ms 後重試
    setTimeout(() => processQueue(), 400);
    return;
  }
  
  // 3. 取出下一個請求
  const next = requestQueueRef.current.shift();
  if (!next) return;
  
  // 4. 執行截圖
  runCaptureInternal(next.request_id, true);
};
```

---

## 🔌 WebSocket 訊息類型

### 後端 → 前端

| 訊息類型 | 說明 | 觸發時機 |
|---------|------|---------|
| `screenshot_request` | 截圖請求 | `create_request()` |
| `screenshot_completed` | 截圖完成 | `mark_completed()` |
| `screenshot_failed` | 截圖失敗 | `mark_failed()` |
| `sound_effect_ready` | 音效就緒 | `attach_sound_effect()` |
| `sound_play` | 播放音效 | `broadcast_sound_play()` |
| `iframe_config` | Iframe 配置 | `broadcast_iframe_config()` |
| `collage_config` | Collage 配置 | `broadcast_collage_config()` |
| `subtitle_update` | 字幕更新 | `broadcast_subtitle()` |
| `caption_update` | 標題更新 | `broadcast_caption()` |

### 前端 → 後端

| 訊息類型 | 說明 | 時機 |
|---------|------|------|
| `hello` | 註冊客戶端 | WebSocket 連接時 |

---

## 📁 檔案命名規則

### 截圖檔名格式

```
scene_{timestamp}_{token}.{ext}
```

- `timestamp`: UTC 時間，格式 `YYYYMMDDTHHMMSS`
- `token`: 8 位隨機 hex（4 bytes）
- `ext`: `.png` 或 `.jpg`

**範例**：
```
scene_20251107T060000_a1b2c3d4.png
```

### 儲存位置

- **配置**：`SCREENSHOT_DIR` 環境變數（預設：`screen_shots`）
- **絕對路徑**：`{project_root}/screen_shots/scene_xxx.png`
- **相對路徑**：`screen_shots/scene_xxx.png`

---

## 🎬 使用範例

### 完整工作流程範例

```bash
# 1. 創建截圖請求
REQUEST_ID=$(curl -s -X POST http://localhost:8000/api/screenshots/request \
  -H "Content-Type: application/json" \
  -d '{"client_id": "mobile", "label": "測試截圖"}' | jq -r '.id')

echo "請求 ID: $REQUEST_ID"

# 2. 等待截圖完成（前端自動處理）
sleep 5

# 3. 查詢結果
curl -s "http://localhost:8000/api/screenshots/$REQUEST_ID" | jq .

# 回應範例：
# {
#   "id": "...",
#   "status": "completed",
#   "result": {
#     "filename": "scene_20251107T060000_a1b2c3d4.png",
#     "absolute_path": "/path/to/screen_shots/scene_xxx.png",
#     "relative_path": "screen_shots/scene_xxx.png"
#   }
# }
```

### 截圖後自動分析 + 生成音效

```bash
# 1. 創建請求
REQUEST_ID=$(curl -s -X POST http://localhost:8000/api/screenshots/request \
  -H "Content-Type: application/json" \
  -d '{"client_id": "mobile"}' | jq -r '.id')

# 2. 等待截圖
sleep 5

# 3. 查詢截圖路徑
IMAGE_PATH=$(curl -s "http://localhost:8000/api/screenshots/$REQUEST_ID" | \
  jq -r '.result.relative_path')

# 4. 分析 + 生成音效
curl -X POST http://localhost:8000/api/screenshot/bundle \
  -H "Content-Type: application/json" \
  -d "{
    \"image_path\": \"$IMAGE_PATH\",
    \"request_id\": \"$REQUEST_ID\",
    \"sound_duration_seconds\": 5.0
  }" | jq .
```

---

## 🔍 除錯技巧

### 檢查客戶端連接狀態

```bash
curl http://localhost:8000/api/clients | jq .
```

### 檢查請求狀態

```bash
curl "http://localhost:8000/api/screenshots/{request_id}" | jq .
```

### 前端除錯

1. **檢查 WebSocket 連接**：
   ```javascript
   // 瀏覽器控制台
   window.__APP_CAPTURE_SCENE  // 檢查截圖函數是否註冊
   ```

2. **檢查請求佇列**：
   ```javascript
   // 在 useScreenshotManager 中加入 console.log
   console.log('Queue:', requestQueueRef.current);
   ```

### 常見問題

1. **截圖請求沒有回應**：
   - 檢查客戶端是否連接 WebSocket
   - 檢查 `client_id` 是否匹配
   - 檢查場景是否已準備好（`captureFn` 是否存在）

2. **截圖失敗**：
   - 檢查瀏覽器控制台錯誤
   - 檢查後端日誌
   - 確認 `screen_shots/` 目錄權限

3. **Iframe 模式無法截圖**：
   - 這是預期行為，iframe 內的頁面不會處理截圖請求
   - 應該從父頁面發起截圖請求

---

## 📚 相關檔案

- `backend/app/services/screenshot_requests.py` - 請求管理器
- `backend/app/services/screenshots.py` - 檔案儲存
- `backend/app/api/realtime.py` - API 端點
- `backend/app/api/storage.py` - 上傳端點
- `frontend/src/hooks/useScreenshotManager.js` - 前端管理器
- `frontend/src/hooks/useControlSocket.js` - WebSocket 連接
- `frontend/src/api.js` - API 函數

---

**本文件版本**: v1.0 (2025-11-07)

