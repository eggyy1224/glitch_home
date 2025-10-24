# 圖像系譜學系統 - API 快速上手指南（For AI Agents）

> **版本**: 1.0  
> **最後更新**: 2025-10-24  
> **目標讀者**: AI Assistant / Agent

---

## 🎯 5 分鐘快速入門

### 系統是什麼？
一個 **AI 圖像循環演化系統**，能夠：
- 🖼️ 自動生成圖像後代（透過 Gemini）
- 🔍 搜尋相似圖像（向量搜尋）
- 📊 追溯親緣關係（家族樹）
- 📸 遠端截圖管理（WebSocket）
- 🔊 生成配套音效（ElevenLabs）
- 🎬 多種視覺化展示（7 種模式）

### 開始前必知

```bash
# ✅ 系統已啟動的標誌
後端: http://localhost:8000/health → {"status": "ok"}
前端: http://localhost:5173 → React app loads

# 🔑 三個必要的 API Key
GEMINI_API_KEY=...
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
```

---

## 🚀 常見任務與快速命令

### 任務 1: 生成新的圖像後代

```bash
# 方案 A: 隨機抽取 2 張父圖進行混合
curl -X POST http://localhost:8000/api/generate/mix-two \
  -H "Content-Type: application/json"

# 方案 B: 指定父圖
curl -X POST http://localhost:8000/api/generate/mix-two \
  -H "Content-Type: application/json" \
  -d '{
    "parents": [
      "offspring_20250929_114940_017.png",
      "offspring_20250923_161624_066.png"
    ],
    "count": 2,
    "prompt": "artistic blend with emphasis on form",
    "output_format": "png"
  }'
```

### 任務 2: 搜尋相似圖像

```bash
# 方案 A: 文字搜尋（語意搜尋）
curl -X POST http://localhost:8000/api/search/text \
  -H "Content-Type: application/json" \
  -d '{"query": "白馬 夜晚", "top_k": 15}'

# 方案 B: 圖像搜尋（以圖搜圖）
curl -X POST http://localhost:8000/api/search/image \
  -H "Content-Type: application/json" \
  -d '{
    "image_path": "backend/offspring_images/offspring_20250929_114940_017.png",
    "top_k": 15
  }'
```

### 任務 3: 追溯親緣關係

```bash
# 查詢某張圖像的所有親戚
curl -X GET "http://localhost:8000/api/kinship?img=offspring_20250929_114940_017.png&depth=-1"

# 結果包含:
# - parents: 父母
# - children: 子代
# - siblings: 兄弟姊妹
# - ancestors: 所有祖先
# - lineage_graph: 親緣圖 (nodes + edges)
```

### 任務 4: 從遠端客戶端截圖

```bash
# 步驟 1: 建立截圖請求
REQUEST_ID=$(curl -X POST http://localhost:8000/api/screenshots/request \
  -H "Content-Type: application/json" \
  -d '{"client_id": "mobile"}' | jq -r '.id')

# 步驟 2: 等待 mobile 客戶端自動截圖（WebSocket 會推送）
sleep 3

# 步驟 3: 查詢結果
curl -X GET "http://localhost:8000/api/screenshots/$REQUEST_ID" | jq '.result'

# 返回: {filename, absolute_path, relative_path}
```

### 任務 5: 分析截圖 + 生成音效

```bash
# 一次完成分析 + 音效生成
curl -X POST http://localhost:8000/api/screenshot/bundle \
  -H "Content-Type: application/json" \
  -d '{
    "image_path": "screen_shots/scene_20251024T070747_a15e78bc.png",
    "sound_duration_seconds": 5.0,
    "sound_prompt_influence": 0.75
  }' | jq .

# 返回: {analysis, sound, used_prompt, ...}
```

### 任務 6: 播放音效到特定客戶端

```bash
# 向 mobile 客戶端推送音效播放請求
curl -X POST http://localhost:8000/api/sound-play \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "scene_20251014T053433_116e8efc.mp3",
    "target_client_id": "mobile"
  }'

# 前端的 SoundPlayer 會自動接收並播放
```

### 任務 7: 管理 Iframe 多面板配置

```bash
# 取得當前 iframe 配置（針對特定客戶端）
curl -X GET "http://localhost:8000/api/iframe-config?client=mobile"

# 更新 iframe 配置（推送給所有客戶端或特定客戶端）
curl -X PUT http://localhost:8000/api/iframe-config \
  -H "Content-Type: application/json" \
  -d '{
    "target_client_id": "mobile",
    "layout": "grid",
    "gap": 12,
    "columns": 2,
    "panels": [
      {
        "id": "p1",
        "src": "/?img=offspring_20250929_114940_017.png",
        "label": "3D 景觀"
      },
      {
        "id": "p2",
        "src": "/?img=offspring_20250929_114940_017.png&slide_mode=true",
        "label": "幻燈片"
      }
    ]
  }'
```

---

## 🎬 使用 Playback Scripts（現成的配置腳本）

### 為什麼使用這些腳本？
它們提供**預設配置**，讓你快速設定多面板展示，無需手動構建 JSON。

### 可用的腳本

#### 1. 四面板預設佈局
```bash
# 基本用法
python backend/playback_scripts/set_default_four_panel_layout.py \
  --api-base http://localhost:8000 \
  --client default

# 自訂圖像
python backend/playback_scripts/set_default_four_panel_layout.py \
  --api-base http://localhost:8000 \
  --client mobile \
  --image offspring_20250929_114940_017.png \
  --image offspring_20250927_141336_787.png \
  --gap 16 \
  --columns 2
```
**效果**: 2×2 網格佈局，4 個面板各顯示 1 張圖像

---

#### 2. 10×10 混合模式佈局
```bash
# 為大型展示牆設定 40 個面板，每個面板用不同的視覺化模式
python backend/playback_scripts/set_mixed_grid_10x10_layout.py \
  --api-base http://localhost:8000 \
  --client display_wall \
  --gap 10
```
**效果**: 
- 10 列網格，40 個面板
- 混合視覺化模式（kinship, archive, fieldnotes, macrocosm, etc.）
- 支援自訂圖像列表

---

#### 3. 六模式演示
```bash
# 展示系統的所有 6 種視覺化模式
python backend/playback_scripts/set_global_six_modes.py \
  --api-base http://localhost:8000 \
  --image offspring_20251001_183316_858.png
```
**效果**: 3×2 網格，分別展示：
- 孵化室 (incubator)
- Iframe 模式 (iframe_mode)
- 幻燈片 (slide_mode)
- 有機房間 (organic_mode)
- 親緣圖 (phylogeny)
- 預設 3D 景觀 (kinship)

---

#### 4. 其他腳本
- `set_global_slide_mode_grid.py` - 所有面板都是幻燈片模式
- `set_left_panel_highlight_layout.py` - 左側大面板 + 右側小面板
- `set_mixed_grid_5x5_layout.py` - 5×5 網格（25 個面板）

### 如何修改這些腳本

編輯腳本內的常數來自訂預設值：

```python
# backend/playback_scripts/set_default_four_panel_layout.py
DEFAULT_IMAGES: List[str] = [
    "offspring_20250927_141336_787.png",  # 修改這些
    "offspring_20250927_141751_825.png",
    # ...
]

DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_CLIENT_ID = "default"
```

---

## 📱 前端客戶端 URL 參數速查表

### 基本形式
```
http://localhost:5173/?img=<filename>&<mode>&<options>&client=<id>&sound_player=true
```

### 常用參數組合

| 模式 | URL 範例 | 說明 |
|------|---------|------|
| **3D 景觀**（預設） | `/?img=xxx.png` | 花朵叢集佈局 |
| **2D 親緣圖** | `/?img=xxx.png&phylogeny=true` | 樹狀家族圖 |
| **孵化室** | `/?img=xxx.png&incubator=true` | 球形環形佈局 + 粒子效果 |
| **有機房間** | `/?img=xxx.png&organic_mode=true` | 立方體房間 + 自動巡航 |
| **幻燈片** | `/?img=xxx.png&slide_mode=true` | 全螢幕單圖輪播 |
| **搜尋模式** | `/?search_mode=true` | 以圖/文字搜尋 |
| **Iframe 組合** | `/?iframe_mode=true&iframe_panels=...` | 多面板展示 |

### 高級參數

```
// 禁用自動切換，保持場景穩定（適合截圖）
?img=xxx.png&continuous=true

// 啟用 SoundPlayer 面板（適合音效播放）
?img=xxx.png&sound_player=true

// 設定客戶端 ID（用於多客戶端協調）
?img=xxx.png&client=mobile

// 調整自動切換速度
?img=xxx.png&autoplay=1&step=20  // 20 秒切換一次

// 幻燈片：改用親緣關係而非向量搜尋
?img=xxx.png&slide_mode=true&slide_source=kinship
```

---

## 🔄 完整工作流示例

### 場景：展覽現場截圖 + 分析 + 音效

```bash
# 第 1 步: 打開 mobile 客戶端的頁面
URL="http://localhost:5173/?img=offspring_20250929_114940_017.png&client=mobile&continuous=true&sound_player=true"
# 告訴用戶在展覽現場的手機上打開這個 URL

# 第 2 步: 建立截圖請求（會自動推送給 mobile 客戶端）
REQUEST_ID=$(curl -s -X POST http://localhost:8000/api/screenshots/request \
  -H "Content-Type: application/json" \
  -d '{"client_id": "mobile", "label": "展場截圖"}' | jq -r '.id')

echo "截圖請求已發送 (ID: $REQUEST_ID)，等待 mobile 端回應..."
sleep 4

# 第 3 步: 查詢截圖是否完成
SCREENSHOT=$(curl -s "http://localhost:8000/api/screenshots/$REQUEST_ID")
STATUS=$(echo $SCREENSHOT | jq -r '.status')
IMAGE_PATH=$(echo $SCREENSHOT | jq -r '.result.absolute_path')

if [ "$STATUS" = "completed" ]; then
  echo "✅ 截圖已完成: $IMAGE_PATH"
  
  # 第 4 步: 分析 + 生成音效
  RESULT=$(curl -s -X POST http://localhost:8000/api/screenshot/bundle \
    -H "Content-Type: application/json" \
    -d "{
      \"image_path\": \"$IMAGE_PATH\",
      \"sound_duration_seconds\": 5.0
    }")
  
  SOUND_FILE=$(echo $RESULT | jq -r '.sound.filename')
  SUMMARY=$(echo $RESULT | jq -r '.analysis.summary')
  
  echo "📊 分析結果："
  echo "$SUMMARY"
  
  echo ""
  echo "🔊 音效已生成: $SOUND_FILE"
  
  # 第 5 步: 播放音效
  curl -s -X POST http://localhost:8000/api/sound-play \
    -H "Content-Type: application/json" \
    -d "{
      \"filename\": \"$SOUND_FILE\",
      \"target_client_id\": \"mobile\"
    }"
  
  echo "🎵 音效已推送給 mobile 端"
else
  echo "❌ 截圖失敗: $(echo $SCREENSHOT | jq -r '.error')"
fi
```

---

## 🔌 WebSocket 事件（實時通信）

### 前端如何收到後端推送？

```javascript
// 前端連接 WebSocket
const ws = new WebSocket("ws://localhost:8000/ws/screenshots");

ws.onopen = () => {
  // 首先註冊自己的 client_id
  ws.send(JSON.stringify({
    type: "hello",
    client_id: "mobile"
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  // 後端推送截圖請求 → 前端自動截圖
  if (message.type === "screenshot_request") {
    console.log("收到截圖請求:", message.request_id);
    captureAndUpload(message.request_id);
  }
  
  // 後端推送音效播放 → 前端自動播放
  if (message.type === "sound_play") {
    playAudio(message.filename, message.url);
  }
  
  // 後端推送 iframe 配置 → 前端即時更新
  if (message.type === "iframe_config") {
    updateIframeLayout(message.config);
  }
};
```

### 常見推送事件類型

| 事件類型 | 觸發方式 | 前端動作 |
|---------|--------|--------|
| `screenshot_request` | `POST /api/screenshots/request` | 自動截圖 + 上傳 |
| `screenshot_completed` | 截圖上傳成功 | 清除 pending 標記 |
| `screenshot_failed` | 截圖失敗 | 顯示錯誤信息 |
| `sound_play` | `POST /api/sound-play` | 播放音效 |
| `iframe_config` | `PUT /api/iframe-config` | 更新多面板配置 |

---

## 📊 關鍵數據結構速查

### 圖像搜尋結果
```json
{
  "results": [
    {
      "id": "offspring_20250929_114940_017.png",
      "distance": 0.234,
      "metadata": {
        "parents": ["img1.png", "img2.png"],
        "created_at": "2025-10-24T07:11:59Z",
        "prompt": "...",
        "strength": 0.6
      }
    }
  ]
}
// distance 越小 = 越相似（0 = 完全相同）
```

### 親緣關係圖
```json
{
  "original_image": "offspring_xxx.png",
  "parents": ["parent1.png", "parent2.png"],
  "children": ["child1.png"],
  "siblings": ["sibling1.png"],
  "ancestors": ["grandparent.png", ...],
  "lineage_graph": {
    "nodes": [
      {"name": "offspring_xxx.png", "kind": "original", "level": 0},
      {"name": "parent1.png", "kind": "parent", "level": -1}
    ],
    "edges": [
      {"source": "parent1.png", "target": "offspring_xxx.png"}
    ]
  }
}
```

### 截圖請求狀態
```json
{
  "id": "req_20251024...",
  "status": "pending|completed|failed",
  "target_client_id": "mobile",
  "result": {
    "filename": "scene_20251024T070747_a15e78bc.png",
    "absolute_path": "/abs/path/...",
    "relative_path": "screen_shots/..."
  },
  "error": null
}
```

---

## 🐛 常見問題速查

### Q: 系統說「場景尚未準備好」
**A**: 場景在自動轉換影像。解決方案：
- 在 URL 加 `&continuous=true` 禁用自動切換
- 或增加重試間隔 `sleep 5` 以上

### Q: 手機端沒有聲音
**A**: 瀏覽器自動播放限制。解決方案：
- 添加 URL 參數 `&sound_player=true` 顯示播放器
- 用戶點擊播放按鈕手動播放
- 或在用戶交互後播放

### Q: 圖像搜尋結果為空
**A**: 檢查：
- 圖像是否存在於 `backend/offspring_images/`
- 是否已索引？運行 `POST /api/index/offspring` 重新索引
- 搜尋模型是否啟用？檢查環境變數 `OPENAI_API_KEY`

### Q: Iframe 配置推送後前端沒有更新
**A**: 檢查：
- 前端是否連上 WebSocket？查看瀏覽器控制台
- `target_client_id` 是否與前端的 URL 參數匹配？
- 是否啟用了 `iframe_mode=true`？

---

## 📚 參考資源

- **系統完整規格**: `docs/system_architecture/後端架構概論.md`
- **前端架構**: `docs/system_architecture/前端架構概論.md`
- **Playback 腳本源碼**: `backend/playback_scripts/`
- **API 規格詳解**: `spec.md` (Section 5)

---

## ✅ 執行前檢查清單

在執行任何命令前，確認：

- [ ] 後端已啟動: `curl http://localhost:8000/health`
- [ ] 前端已啟動: `curl http://localhost:5173 -I`
- [ ] ChromaDB 已初始化: `ls backend/chroma_db/`
- [ ] 環境變數已設定: `echo $GEMINI_API_KEY`
- [ ] 生成的圖像存在: `ls backend/offspring_images/ | head`

---

**本指南版本**: v1.0 (2025-10-24)
