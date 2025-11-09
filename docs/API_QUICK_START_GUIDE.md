# 圖像系譜學系統 - API 快速上手指南（For AI Agents）

> **版本**: 1.1  
> **最後更新**: 2025-11-04  
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
- 🗣️ 旁白 TTS（OpenAI gpt-4o-mini-tts）
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

### 任務 6.5: 產生旁白 TTS（OpenAI）

```bash
# 產生語音（預設 mp3, voice=alloy, model=gpt-4o-mini-tts）
curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "各位好，歡迎來到圖像系譜學現場展示。",
    "instructions": "zh-TW Mandarin, calm, low pitch, slower pace, intimate",
    "speed": 0.95,
    "auto_play": true,
    "target_client_id": "mobile"
  }' | jq .

# 回應範例
# {
#   "tts": {
#     "text": "...",
#     "model": "gpt-4o-mini-tts",
#     "voice": "alloy",
#     "format": "mp3",
#     "filename": "narration_20251101T123456_ab12cd34.mp3",
#     "absolute_path": ".../backend/generated_sounds/narration_...mp3",
#     "relative_path": "backend/generated_sounds/narration_...mp3"
#   },
#   "url": "http://localhost:8000/api/sound-files/narration_...mp3",
#   "playback": {"status": "queued", "target_client_id": "mobile"}
# }
```

> 必備環境變數：在 `backend/.env` 或專案根 `.env` 中設定 `OPENAI_API_KEY=...`。可選：`OPENAI_TTS_MODEL`, `OPENAI_TTS_VOICE`, `OPENAI_TTS_FORMAT`。

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

- ✅ **單張滿版（mobile）**
  ```bash
  curl -X PUT http://localhost:8000/api/iframe-config \
    -H "Content-Type: application/json" \
    -d '{
      "target_client_id": "mobile",
      "layout": "grid",
      "columns": 1,
      "gap": 0,
      "panels": [
        {
          "id": "p1",
          "image": "offspring_20250923_161624_066.png",
          "params": {}
        }
      ]
    }'
  ```
  > `params` 給空物件即可，避免殘留 `slide_mode` 或 `iframe_mode` 造成效果錯亂。

- ✅ **10×10 展示牆（任何客戶端）**
  ```bash
  python backend/playback_scripts/set_mixed_grid_10x10_layout.py \
    --api-base http://localhost:8000 \
    --client desktop2
  ```
  > Playback script 會自動填滿 40 張圖片並依預設 span 混搭。需要換圖時可改 `--images` 或重新執行腳本。

- ✅ **左右大圖 + 小圖混排（範例：desktop2）**
  ```bash
  curl -X PUT http://localhost:8000/api/iframe-config \
    -H "Content-Type: application/json" \
    -d '{
      "target_client_id": "desktop2",
      "layout": "grid",
      "columns": 12,
      "gap": 12,
      "panels": [
        {"id": "p1", "image": "offspring_A.png", "col_span": 2, "row_span": 2,
         "params": {"slide_mode": "true", "slide_source": "kinship"}},
        {"id": "p2", "image": "offspring_B.png",
         "params": {"slide_mode": "true", "slide_source": "kinship"}},
        {"id": "p3", "image": "offspring_C.png",
         "params": {"slide_mode": "true", "slide_source": "kinship"}},
        {"id": "p_right", "image": "offspring_big.png",
         "col_span": 4, "row_span": 8,
         "params": {"slide_mode": "true", "slide_source": "kinship"}}
      ]
    }'
  ```
  > 右側面板一次跨多欄多列即可營造「大圖 + 小圖」的視覺。記得所有面板 id 要唯一，並同步設定 `col_span` / `row_span`。

- ✅ **左右對照（Slide Mode vs Incubator）**
  ```bash
  curl -X PUT http://localhost:8000/api/iframe-config \
    -H "Content-Type: application/json" \
    -d '{
      "target_client_id": "desktop",
      "layout": "grid",
      "columns": 2,
      "gap": 16,
      "panels": [
        {"id": "p1", "image": "offspring_20251012_182916_746.png",
         "params": {"slide_mode": "true", "slide_source": "kinship"}},
        {"id": "p2", "image": "offspring_20251012_182916_746.png",
         "params": {"incubator": "true"}}
      ]
    }'
  ```
  > 同一張圖左右對照兩種場景，gap 依需求調整；這種模式很適合現場示範不同渲染模式的差異。

- ✅ **單張純靜態畫面（mobile 等裝置）**
  ```bash
  curl -X PUT http://localhost:8000/api/iframe-config \
    -H "Content-Type: application/json" \
    -d '{
      "target_client_id": "mobile",
      "layout": "grid",
      "columns": 1,
      "gap": 0,
      "panels": [
        {"id": "p1", "image": "offspring_20251006_203113_635.png", "params": {}}
      ]
    }'
  ```
  > 若曾經啟用過 Slide Mode / incubator，務必把 `params` 清空，避免殘留舊參數。

- 🚨 **常見錯誤**
  - 忘記在目標前端加上 `?iframe_mode=true&client=<id>`，配置更新將不會呈現。
  - 重複沿用舊 payload，未清空 `params` 導致意外套用 `slide_mode=false`、`incubator=true` 等。
  - 在 PUT 時提供了不存在的圖片名稱，後端會傳回 400；可先 `ls backend/offspring_images` 確認。

### 任務 8: 查詢目前在線客戶端

```bash
curl -X GET http://localhost:8000/api/clients | jq .
```

回傳格式：

```json
{
  "clients": [
    {"client_id": "desktop", "connections": 1},
    {"client_id": "mobile", "connections": 1},
    {"client_id": "default", "connections": 42}
  ]
}
```

> 以 WebSocket 連線數為準；可用來確認指定 client 是否在線、是否重複開啟頁面。

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
- `set_showcase_triple_layout.py` - 同步設定 `desktop`（slide/incubator 分割）、`desktop2`（15×15 collage）、`mobile`（單張靜態）。支援 `--seed` 與 `--dry-run`。

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

## 🧩 Collage 拼貼遠端配置 API

前端在 `/?collage_mode=true&client=<client_id>` 時，會從後端載入該 client 的 collage 設定。可以用下列 API 即時調整拼貼牆：

### 1. 取得目前設定
```
GET /api/collage-config
GET /api/collage-config?client=<client_id>        # 指定 client
```
- `client` 參數：可選。給 client id（例如 `client=desktop_wall`）就能讀取專屬設定；省略則回傳全域/default 配置。
- 回傳欄位：
  - `config`: 實際參數（images、image_count、rows、cols、mix、stage_width、stage_height、seed）
  - `source`: `client` 代表已載入 client 專屬檔案、`global` 代表沿用全域檔案、`default` 則表示目前尚未有任何保存檔案（使用程式內建預設值）
  - `target_client_id`: 如果是 client 專屬設定會帶出此欄位
  - `updated_at`: 後端檔案最後修改時間（ISO 字串）

### 2. 更新全域或指定 client
```
PUT /api/collage-config
Content-Type: application/json
```
JSON 負載可包含：
```jsonc
{
  "target_client_id": "<client_id>",          // 可選。指定 client，不填則更新全域
  "images": ["offspring_20250923_161624_066.png", "..."],
  "image_count": 20,
  "rows": 5,
  "cols": 8,
  "mix": true,
  "stage_width": 2048,
  "stage_height": 1152,
  "seed": 987123
}
```
- `images` 只需要檔名（不可含路徑）；後端會自動去重與驗證。
- `image_count`, `rows`, `cols`、stage 尺寸都有上下限，超出會被 clamp。
- `mix=true` 時 stage 尺寸＋ seed 會影響混排結果；調整 seed 可固定亂數。

PUT 成功後，若有指定 `target_client_id` 會寫入 `backend/metadata/collage_config__<client>.json`，否則寫入全域的 `backend/metadata/collage_config.json`。更新完成會透過 websocket 廣播 `type: "collage_config"`；前端的 `useCollageConfig` hook 會立即接收並套用。

### 3. cURL 範例
```bash
curl -s -X PUT http://localhost:8000/api/collage-config \
  -H 'Content-Type: application/json' \
  -d '{
        "target_client_id": "<client_id>",
        "images": [
          "offspring_20250923_161624_066.png",
          "offspring_20250923_161704_451.png",
          "offspring_20250923_161747_194.png"
        ],
        "image_count": 20,
        "rows": 5,
        "cols": 8,
        "mix": true,
        "stage_width": 2048,
        "stage_height": 1152,
        "seed": 987123
      }'
```
更新完畢後，只要前端網址含 `collage_mode=true` 並且 `client=<client_id>`，畫面就會自動切換到最新設定。

#### 調整畫布比例（直／橫幅）
`stage_width` 與 `stage_height` 控制拼貼畫布的實際比例。只要在 payload 裡修改這兩個值，就能把版面拉成橫向或直向：

```bash
# 直式拼貼（寬 1152 × 高 2048）
curl -s -X PUT http://localhost:8000/api/collage-config \
  -H 'Content-Type: application/json' \
  -d '{
        "target_client_id": "<client_id>",
        "images": ["offspring_20250923_161624_066.png", "..."],
        "image_count": 6,
        "rows": 12,
        "cols": 18,
        "mix": true,
        "stage_width": 1152,
        "stage_height": 2048,
        "seed": 555777
      }'
```

只要保持 `stage_width` 在 360–3840、`stage_height` 在 240–2160 內，前端會依據新比例重新計算盤面（mix=true 時特別明顯），可依展示需求快速切換橫幅或直幅。

---

### 任務 9: 生成拼貼版本 (Collage Version)

拼貼版本功能將多張圖像切片後重新組合，產生新的拼貼圖像。

```bash
# 步驟 1: 建立生成任務
TASK_ID=$(curl -X POST http://localhost:8000/api/generate-collage-version \
  -H "Content-Type: application/json" \
  -d '{
    "image_names": [
      "offspring_20250929_114940_017.png",
      "offspring_20250923_161624_066.png",
      "offspring_20250927_141336_787.png"
    ],
    "rows": 12,
    "cols": 16,
    "mode": "kinship",
    "seed": 123456,
    "resize_w": 2048,
    "format": "png"
  }' | jq -r '.task_id')

echo "任務已建立: $TASK_ID"

# 步驟 2: 查詢進度（輪詢）
while true; do
  PROGRESS=$(curl -s "http://localhost:8000/api/collage-version/$TASK_ID/progress")
  COMPLETED=$(echo $PROGRESS | jq -r '.completed')
  STAGE=$(echo $PROGRESS | jq -r '.stage')
  PERCENT=$(echo $PROGRESS | jq -r '.progress')
  
  echo "進度: $PERCENT% - $STAGE"
  
  if [ "$COMPLETED" = "true" ]; then
    if [ "$(echo $PROGRESS | jq -r '.error')" != "null" ]; then
      echo "❌ 生成失敗: $(echo $PROGRESS | jq -r '.error')"
    else
      OUTPUT=$(echo $PROGRESS | jq -r '.output_image')
      echo "✅ 生成完成: $OUTPUT"
    fi
    break
  fi
  
  sleep 2
done
```

**匹配 / 處理模式**:
- `kinship`: 以邊緣顏色距離匹配（局部縫合最佳）
- `luminance`: 最小化亮度差（產生明暗節律）
- `wave`: 由中心向外的 BFS 順序（形成方向性條帶）
- `source-cluster`: 以來源圖為單位聚塊（語義連續）
- `random`: 隨機排列（基準對照）
- `weave`: 不同來源圖交錯編織，形成條帶效果
- `rotate-90`: 單張圖像，對每個切片旋轉 90° 後原位重組

**參數說明（`GenerateCollageVersionRequest`）**:
- `image_names`: 圖像檔名列表。一般模式需 ≥2；`rotate-90` 或 `allow_self=true` 時可以只帶一張。
- `rows` / `cols`: 切片行、列數（1-300，預設 12×16）。
- `mode`: 匹配模式（見上表，預設 `kinship`）。
- `base`: 基準圖策略（`first` 或 `mean`，目前 `mean` 仍等價 `first`）。
- `allow_self`: 是否允許重用基準圖的 tiles（預設 `false`，`weave` 模式自動允許）。
- `seed`: 隨機種子（預設使用時間戳，便於重現）。
- `resize_w`: 輸出寬度 256-8192 px（預設 2048）。
- `pad_px`: 填充像素 0-100（預設 0）。
- `jitter_px`: 抖動像素 0-50（預設 0）。
- `rotate_deg`: 旋轉角度 0-45 度（預設 0）。
- `format`: 輸出格式 `png`/`jpg`/`webp`（預設 `png`）。
- `quality`: 1-100，僅 `jpg/webp` 會使用（預設 92）。
- `return_map`: 是否回傳 tile mapping（預設 `false`）。

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
| **拼貼模式** | `/?collage_mode=true&client=<id>` | 拼貼牆展示 |
| **拼貼版本生成** | `/?collage_version_mode=true` | 拼貼版本生成介面 |
| **圖像生成** | `/?generate_mode=true` | 圖像生成介面 |
| **說明文字** | `/?caption_mode=true` | 說明文字模式 |

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

// 拼貼模式：啟用拼貼牆
?collage_mode=true&client=desktop_wall

// 拼貼版本生成：啟用生成介面
?collage_version_mode=true
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
