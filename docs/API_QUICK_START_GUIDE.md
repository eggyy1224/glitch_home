# 圖像系譜學系統 - API 快速上手指南（For AI Agents）

> **版本**: 1.2
> **最後更新**: 2025-12-02
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
# 🧭 APP_MODE（STUDIO/CONSOLE/DISPLAY）決定生成/寫入權限；/api/runtime-caps 可檢查當前旗標，403 會回傳 {message, feature, app_mode}
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

#### Snapshot / Restore Iframe 配置

需要保存特定 client 的 iframe 排版時，可使用 snapshot API 保存 JSON 並在需要時恢復：

```bash
# 儲存 snapshot（client=function_test），snapshot_name 可寫成場景描述
curl -X POST http://localhost:8000/api/iframe-config/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "function_test",
    "snapshot_name": "before_demo"
  }'

# 列出某 client 所有 snapshot（新到舊排序）
curl -X GET "http://localhost:8000/api/iframe-config/snapshots?client=function_test"

# 從 snapshot 還原
curl -X POST http://localhost:8000/api/iframe-config/restore \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "function_test",
    "snapshot_name": "function_test_before_demo_20251114135700"
  }'
```

> `snapshot_name` 是可選的「場景描述」，系統會自動產生實際檔名：`{client_id}_{snapshot_name}_{YYYYMMDDHHmmss}`，若沒帶 `snapshot_name` 則為 `{client_id}_{YYYYMMDDHHmmss}`，client 不存在時會以 `global` 取代。建立成功時的 response 會回傳最終檔名，或可透過 list API 取得。若同 1 秒內重複建立 snapshot，系統會自動加上 `_1`、`_2` 後綴避免衝突。`snapshot_name`/`client_id` 仍僅允許字母、數字、底線、連字號。

### 任務 7.1: 遠端觸發指定元素點擊

用於在展場遠端「代點擊」特定播放器或 UI 控制（例如切換播放、彈出對話框）：

```bash
curl -X POST http://localhost:8000/api/remote-click \
  -H "Content-Type: application/json" \
  -d '{
    "selector": ".video-mode-container",
    "target": "video",
    "client_id": "display-main"
  }'
```

- `selector`: 必填之一。主體容器的 CSS 選擇器（預設 `.video-mode-container` 即可鎖定整個播放器）。
- `target`: 可選。會在 selector 範圍內再次 query，例如 `video`、`.play-button`。
- `x` / `y`: 若沒有 selector，可用視窗座標（需同時提供 x 與 y）。
- `client_id`: 輸入 body 也可以在 query 用 `?target_client_id=xxx`，後者優先。

API 會整理 payload 後透過 WebSocket 廣播 `type: "remote_click"`，前端 `useRealtimeSocket` 會在收到訊息時嘗試匹配元素並執行 `.click()` 或模擬滑鼠事件。常見用法：遠端切換影片播放/暫停、觸發畫面模式切換、打開某個 overlay。

### 任務 7.2: 遠端解除音訊鎖 (Autoplay Unlock)

部分瀏覽器會鎖定自動播放，需要使用者互動後才能播放音訊。可透過 `/api/unlock-audio` 讓前端所有音訊播放器執行一次「無聲互動」：

```bash
curl -X POST "http://localhost:8000/api/unlock-audio?target_client_id=mobile"
```

- 不帶 `target_client_id` 會廣播給所有 client。
- 前端會收到 `type: "unlock_audio"`，並在背景播放極短的靜音片段，之後主控端即可推播聲音（例如 `/api/sound-play` 或 `/api/tts` 自動播放）。

### 任務 7.3: 遠端控制 Video 播放/音量

新的 `/api/video-control` API 讓後端可以直接指揮特定 `video_mode` 面板，免去模擬點擊：

```bash
curl -X POST "http://localhost:8000/api/video-control?target_client_id=desktop2-birds" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "set_volume",
    "volume": 0.4
  }'
```

- `action`（必填）目前支援：`play`、`pause`、`mute`、`unmute`、`set_volume`、`set_muted`、`seek`。
- `volume`: `set_volume` 或 `unmute` 時可附帶（0~1）。
- `muted`: `set_muted` 時必填布林值；也可搭配 `unmute` 控制。
- `time`: `seek` 動作需要指定跳轉秒數（>=0）。
- `set_speed`: 影片倍速；參數 `speed` 為 0.25~4.0（預設 1.0）。
- `target_client_id`: 可在 query 或 body 指定；若省略會依照 timeline step/timeline 的 `client_id` 推斷。

前端會透過 WebSocket 收到 `type: "video_control"`，藉由 `VideoMode` 暴露的控制介面直接執行 `play/pause/volume/seek`，不再透過 `remote_click` 模擬按鈕。為避免瀏覽器阻擋音訊，仍建議在進入步驟前透過 `unlock_audio_targets` 解鎖。

> 影片也接受網址參數：`video_volume=0.5`、`video_speed=0.8`、`auto_unmute=false`、`loop=false`。

### 任務 7.4: 取得 video_mode 可用影片清單

管理者介面中的 Snapshot 編輯器會自動載入影片清單供 `video_mode` 選擇。後端也提供 API 可直接查詢 mp4 資產：

```bash
# 目錄來源可透過環境變數覆蓋，預設指向 frontend/public/videos/圖像系譜學Video
export VIDEO_ASSETS_DIR="/data/videos"
export VIDEO_ASSETS_PUBLIC_BASE="/videos"  # 回應中的 URL 前綴

curl -X GET http://localhost:8000/api/video-assets | jq .
# => { "videos": [ { "filename": "demo.mp4", "url": "/videos/demo.mp4" } ] }
```

- 只列出 `.mp4`，依檔名排序。
- `VIDEO_ASSETS_PUBLIC_BASE` 會直接拼入回傳的 `url`，請確保前端能存取對應靜態路徑。

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

### 任務 9: 監控 client 狀態與播放佇列

> 新的「狀態 / 排程」能力：每個 client 都有心跳、執行中項目與播放佇列（支援 snapshot / timeline / episode）。狀態與佇列會透過 WebSocket `type: "client_state"` 推播，也可用 REST 查詢/操作。

1) 查詢所有 client 狀態（含心跳、排程數量、當前/上一個項目）：

```bash
curl -s http://localhost:8000/api/clients/state | jq '.clients[]'
```

回傳範例：

```json
{
  "client_id": "desktop",
  "status": "busy",
  "last_heartbeat": "2025-11-26T06:18:10.123Z",
  "current_item": {"type": "timeline", "target_id": "demo_tl", "status": "running"},
  "queue_size": 2,
  "errors": []
}
```

2) 取得/管理佇列（分 client）：

```bash
# 取佇列（預設 50 筆，支援 status=running,pending,done,failed,canceled）
curl -s "http://localhost:8000/api/clients/queue?client=desktop&limit=20" | jq '.items[] | {id,type,target_id,status,eta,priority}'

# 派送新的排程項目（eta 可用秒數或 ISO 時間；priority 整數越高越前）
curl -X POST http://localhost:8000/api/clients/queue \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "desktop",
    "type": "timeline",
    "target_id": "night_tour",
    "eta": 0,
    "priority": 5,
    "retries": 1,
    "payload": {"start_step": 0, "force_iframe_mode": true}
  }'

# 取消 / 延後 / 插隊：皆支援一次處理多個 id
curl -X POST http://localhost:8000/api/clients/queue/<ID>/cancel -H "Content-Type: application/json" -d '{"ids":["<ID>","<ID2>"]}'
curl -X POST http://localhost:8000/api/clients/queue/<ID>/delay -H "Content-Type: application/json" -d '{"delta_seconds":30}'
curl -X POST http://localhost:8000/api/clients/queue/<ID>/move -H "Content-Type: application/json" -d '{"position":"front"}'
```

3) 前端 Admin Panel：新增「狀態 / 排程」分頁，支援：
- 觀看所有 client 心跳/佇列摘要（WS 即時更新 + 8s 輪詢）。
- 右側表單快速派送 snapshot / timeline / episode，含優先權、重試與 ETA。
- 佇列表格可取消、插隊（front/back）、延後、強制停止（timeline/episode）。

> 佇列執行器為每個 client 啟動一條 worker，會依 `priority`（高先）與 `eta` 排序；完成/失敗/取消都會回報到 `client_state`。

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
- `weave`: 不同來源圖交錯編織，形成橫向條帶效果
- `weave-vertical`: 以欄為單位交錯，形成直向編織條帶
- `rotate-90`: 單張圖像，對每個切片旋轉 90° 後原位重組

**參數說明（`GenerateCollageVersionRequest`）**:
- `image_names`: 圖像檔名列表。一般模式需 ≥2；`rotate-90` 或 `allow_self=true` 時可以只帶一張。
- `rows` / `cols`: 切片行、列數（1-300，預設 12×16）。
- `mode`: 匹配模式（見上表，預設 `kinship`）。
- `base`: 基準圖策略（`first` 或 `mean`，目前 `mean` 仍等價 `first`）。
- `allow_self`: 是否允許重用基準圖的 tiles（預設 `false`；單張圖時需手動設為 `true`，`weave`/`weave-vertical` 仍建議提供多張圖以產生編織效果）。
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

> 拼貼版本生成 / 圖像生成頁的搜尋欄：若輸入的文字能匹配現有檔名（完整或部分、大小寫不敏感），會用該檔案跑「以圖搜圖」；找不到檔名時會改用文字語意搜尋。

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

## 🕒 Iframe Timeline API（時間軸播放）

> 讓既有的 `iframe_config` snapshot 串成時間軸，單一 client 就能自動播放多個場景。

1. **列出所有 timeline**

```bash
curl http://localhost:8000/api/iframe-timelines
# 可加上 ?client=desktop2 僅列出指定 client
```

回傳欄位包含 `id`, `title`, `step_count`, `estimated_duration`, `loop` 等資訊。

2. **取得 timeline 詳細內容**

```bash
curl http://localhost:8000/api/iframe-timelines/desktop2_opening_demo | jq .
```

每個 `steps[]` 會附帶 snapshot 來源、停留秒數與 `config`（等同 `GET /api/iframe-config` 的 payload，可直接套用）。

3. **前端啟動播放**

- 在網址加上 `?iframe_mode=true&iframe_timeline=desktop2_opening_demo`
- 進入 iframe mode 後左上角會出現控制面板，可播放 / 暫停 / 跳段 / 重新載入
- 若 timeline 播放完畢或停止，會自動釋放遠端鎖定，方便改回本地控制

### 遠端播放控制 API

若不想手動在前端切換網址，可用以下 API 直接指揮指定 client 播放或停止 timeline：

- `POST /api/iframe-timelines/{timeline_id}/play`

  ```bash
  curl -X POST \
    http://localhost:8000/api/iframe-timelines/desktop2_opening_demo/play \
    -H "Content-Type: application/json" \
    -d '{
      "target_client_id": "desktop2",
      "force_iframe_mode": true,
      "start_step": 0,
      "loop_override": false,
      "command_id": "desktop2_opening_demo_run1"
    }'
  ```

  主要欄位：
  - `target_client_id`：必填，指定要播放的 client。留空時會 fallback 到 timeline 定義的 `clientId`。
  - `force_iframe_mode`：預設 `true`，會通知前端切換到 iframe mode。
  - `start_step`：可選，從第幾段開始（0-based）。
  - `loop_override`：可選，覆寫 timeline 的 loop 設定。
  - `command_id`：可選，同一輪播放/停止建議共用同一 ID，方便客戶端去重。
  - `version`：可選 query 參數，播放指定歷史版；未帶時會使用最新版本並在 WS options/回應中附帶 `version`，方便除錯。

- `POST /api/iframe-timelines/stop`

  ```bash
  curl -X POST http://localhost:8000/api/iframe-timelines/stop \
    -H "Content-Type: application/json" \
    -d '{
      "target_client_id": "desktop2",
      "timeline_id": "desktop2_opening_demo",
      "release_control": true,
      "command_id": "desktop2_opening_demo_run1"
    }'
  ```

  - `timeline_id` 可選，若提供僅會停止對應 timeline，避免誤傷其他本地播放。
  - `release_control`（預設 `true`）決定停止後是否要解除遠端鎖定並恢復 client 原本的 `iframe_config`。

> 提醒：API 只會觸發 WebSocket 指令，實際畫面變化要等目標 client 在線、且以 `?client=<id>` 連上後端控制通道。

## 🧭 Episode/Show 編排（多 timeline × 多 client）

> 在 timeline 之上新增 Episode/Show 抽象，一次封裝多條 timeline 與目標 client，並以同一組 commandId 前綴廣播播放指令。

- metadata 位置：`backend/metadata/episodes/{id}.json`（與 timeline/snapshot 分開存放）
- 基本結構：

```jsonc
{
  "id": "ep_opening",
  "title": "開場雙螢幕",
  "tracks": [
    { "timelineId": "desktop_opening", "targetClientId": "desktop" },
    { "timelineId": "wall_intro", "targetClientId": "desktop2", "loopOverride": true }
  ],
  "tags": ["live", "opening"]
}
```

### API

- `GET /api/episodes`：列出 Episode（id/title/track_count/clients/tags）
- `GET /api/episodes/{id}`：取回詳細內容；加 `?resolve=false` 可拿未解析的原始 JSON
- `POST /api/episodes`：建立（寫檔前會先 resolve 所有 timeline 引用，找不到會回 404/400 並不會寫檔案）；`PUT /api/episodes/{id}`：覆寫；`DELETE /api/episodes/{id}`：刪除；`POST /api/episodes/{id}/clone`：複製為新 id
- `POST /api/episodes/{id}/play`：依 tracks 逐一廣播 timeline play，預設沿用 track 的 targetClientId/autoPlay/loopOverride；可帶 `?version=` 播放歷史版，回傳與 WS options 會附帶各 track 的 timeline `version`

播放範例（覆寫特定 timeline 的 client，並指定共用 commandId 前綴）：

```bash
curl -X POST http://localhost:8000/api/episodes/ep_opening/play \
  -H "Content-Type: application/json" \
  -d '{
    "target_client_map": { "wall_intro": "desktop_wall" },
    "command_id_prefix": "run_ep_opening"
  }' | jq .
```

回傳的 `tracks[]` 會列出實際發送的 target_client_id 與 options（autoPlay/loop/forceIframeMode/startStep/startAt/commandId），以便調試。
options 也會帶上 timeline `version`，對應目前播放的定義。

### Scene：一次廣播多個 snapshot 到指定 client

Scene 是 client → snapshotRef 的映射，內建版本歷史，可快速把多台機器切換到指定畫面：

```bash
# 建立或覆寫 scene（resolve=false 可略過引用展開）
curl -X POST http://localhost:8000/api/scenes?resolve=false \
  -H "Content-Type: application/json" \
  -d '{
    "id": "dual_screen_demo",
    "title": "雙螢幕開場",
    "targets": {
      "desktop": "desktop/opening_stage1",
      "mobile": "mobile/opening_stage1"
    },
    "audio_mix": {"left": 0.8, "right": 0.2}
  }'

# 播放指定版本（未發布需帶 allow_draft=true）
curl -X POST "http://localhost:8000/api/scenes/dual_screen_demo/play?version=2" \
  -H "Content-Type: application/json"

# 發布 / 回滾
curl -X POST "http://localhost:8000/api/scenes/dual_screen_demo/publish"
curl -X POST "http://localhost:8000/api/scenes/dual_screen_demo/rollback" \
  -H "Content-Type: application/json" -d '{"version":1}'
```

檔案會寫在 `backend/metadata/scenes/*.json`，同時保留 `backend/metadata/history/scenes/<id>/version-xxxx.json` 便於回滾。【F:backend/app/services/scene.py†L28-L192】

### Script：排程 snapshot / timeline / episode / scene

Script 允許把多種事件串成腳本並可隨時停止：

```bash
curl -X POST http://localhost:8000/api/scripts?resolve=false \
  -H "Content-Type: application/json" \
  -d '{
    "id": "floor_show",
    "entries": [
      {"type": "snapshot", "target_id": "desktop/opening", "target_client_id": "desktop"},
      {"type": "timeline", "target_id": "desktop2_opening_demo"},
      {"type": "scene", "target_id": "dual_screen_demo", "delay": 10}
    ]
  }'

# 播放 / 停止（可指定版本、帶 allow_draft）
curl -X POST "http://localhost:8000/api/scripts/floor_show/play?allow_draft=true"
curl -X POST "http://localhost:8000/api/scripts/floor_show/stop"

# 發布 / 回滾
curl -X POST "http://localhost:8000/api/scripts/floor_show/publish"
curl -X POST "http://localhost:8000/api/scripts/floor_show/rollback" \
  -H "Content-Type: application/json" -d '{"version":2}'
```

Script 也有版本歷史（`backend/metadata/history/scripts/`），播放 API 會先解析引用並回報排入 queue 的 entry 數。【F:backend/app/api/script.py†L52-L192】

### Admin Panel：Timeline/Episode Editor

- 位置：前端 Admin Panel 新分頁「Timeline/Episode Editor」，支援同時編輯 timeline 與 episode。
- 清單：左側可載入現有 timeline/episode（以 `resolve=false` 拿原始 JSON），並可用 id 或 client 篩選。
- 表單與 JSON：表單與 JSON 互相同步，可鎖定 JSON；內建驗證會標示缺少 id/steps/tracks 等錯誤。
- 快捷：steps/tracks 支援複選複製/貼上、批次 duration 或 targetClientId、上下移動與複製；snapshot 選單會跟著載入的 timeline 自動切換 client 並可重新抓取清單。
- 播放預覽：按「以 iframe 預覽 timeline」會在 dirty 時自動先儲存，再顯示首段 snapshot 預覽與整段播放 iframe；可直接播到 client，Episode 也支援輸入 target map 覆寫後送出 play。
- 範例檔：`backend/metadata/timelines/iframe/new_timeline_test.json` 可直接載入測試，也可複製後調整步驟與 snapshot。

### Step 動作欄位：subtitle / caption / tts

每個 `steps[]` 可以同時指定多媒體動作，Timeline Player 會根據順序自動呼叫對應 API：

```jsonc
{
  "snapshot": "desktop2/opening_stage2",
  "duration": 12,
  "subtitle": {
    "text": "多面板同步展示",
    "language": "zh-TW",
    "duration_seconds": 8
  },
  "caption": {
    "clear": true
  },
  "tts": {
    "mode": "speak_with_subtitle",      // tts | speak_with_subtitle | sound_play
    "text": "第二段展示混合視覺模式",
    "subtitle_language": "zh-TW",
    "auto_play": true
  }
}
```

- `subtitle` / `caption`：共用欄位，若 `clear=true` 則會呼叫 `DELETE /api/(subtitles|captions)`；否則使用 `text`、`language`、`duration_seconds` 送到 POST API。
- `tts.mode`：
  - `tts` → `POST /api/tts`
  - `speak_with_subtitle` → `POST /api/speak-with-subtitle`（若未提供 `subtitle_text` 會沿用 `text`）
  - `sound_play` → `POST /api/sound-play`，需提供 `sound_filename`
- `target_client_id` 預設順序：action > step.clientId > timeline.clientId。可在 JSON 中覆寫（`targetClientId`）。

### Step 動作欄位：remote_clicks

若需要分段控制 iframe 面板內的播放器（例如在 0 秒時解除大馬靜音、5 秒後再靜音小馬），可在 step 補上 `remote_clicks`：

```jsonc
{
  "snapshot": "desktop/horse_wall",
  "duration": 10,
  "remote_clicks": [
    {
      "selector": ".video-mode-container",
      "targetClientId": "desktop-horse-large",
      "offset_seconds": 0
    },
    {
      "selector": ".video-mode-container",
      "targetClientId": "desktop-horse-small",
      "offset_seconds": 5
    }
  ]
}
```

- `selector` / `target` / `x,y`：與 `/api/remote-click` 相同，至少要提供一種定位方式。
- `offset_seconds`：延遲幾秒後才觸發，可為 0。允許 `offsetSeconds` 大小寫差異。
- `targetClientId`：同樣遵循 action > step.clientId > timeline.clientId 的優先順序。
- Timeline Player 會在對應時間呼叫 `/api/remote-click`，前端 `handleRemoteClickMessage` 會代為執行 `.click()`，適合遠端切換影片聲音或播放狀態。

### Step 動作欄位：unlock_audio_targets

瀏覽器若尚未有互動會擋下自動播放，可透過 `unlock_audio_targets` 讓 Timeline 在段落開始前依序呼叫 `/api/unlock-audio`：

```jsonc
{
  "snapshot": "desktop2/opening_stage1",
  "duration": 8,
  "unlock_audio_targets": [
    "desktop2",
    "desktop2-birdman",
    "desktop2-birds"
  ]
}
```

每個 client 會播放極短靜音，解除 autoplay 限制，後續的 `remote_clicks`/`tts`/`sound_play` 才能順利出聲。

範例檔案：`backend/metadata/timelines/iframe/desktop2_opening_with_media.json`，展示如何同時套用 snapshot、字幕、標題、語音與音效。

### Step 動作欄位：video_controls

若要直接控制 `video_mode` 面板（播放/暫停/調音量/seek），可在 step 加入 `video_controls`：

```jsonc
{
  "snapshot": "desktop2/opening_stage2",
  "duration": 8,
  "video_controls": [
    {
      "action": "play",
      "targetClientId": "desktop2-birdman",
      "offset_seconds": 0
    },
    {
      "action": "set_volume",
      "volume": 0.35,
      "targetClientId": "desktop2-birds",
      "offset_seconds": 2
    },
    {
      "action": "seek",
      "time": 45,
      "targetClientId": "desktop2-drivein"
    }
  ]
}
```

- `action`: 同 `/api/video-control`；`set_volume` 需搭配 `volume`，`set_muted` 需搭配 `muted`，`seek` 需搭配 `time`。
- `set_speed`: 搭配 `speed`（0.25~4.0）控制影片倍速。
- `offset_seconds`：延遲執行秒數，預設 0，支援 `offsetSeconds`。
- `targetClientId`: 若未指定，沿用 step/timeline `client_id`。

Timeline player 會依序排程這些動作，呼叫新的 `/api/video-control`。相較於 `remote_clicks`，此方式可穩定控制多面板的播放與音量。

> 提醒：前端需以 `?iframe_mode=true&client=<id>&iframe_timeline=<timeline_id>` 啟動，並確保該 client 正在 WebSocket 上線，Timeline Player 才能同步收到字幕/Caption/TTS 廣播。

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

**本指南版本**: v1.2 (2025-02-10)
