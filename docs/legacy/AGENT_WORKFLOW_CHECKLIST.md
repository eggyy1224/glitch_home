# AI Agent 工作流速查表

> 快速參考卡 - 常見操作 5 分鐘速成

---

## ⚡ 系統健康檢查

```bash
# 一鍵檢查系統狀態
curl http://localhost:8000/health && echo "✅ 後端正常"
curl http://localhost:5173 -I | grep 200 && echo "✅ 前端正常"
ls backend/chroma_db/chroma.sqlite3 && echo "✅ 向量庫正常"
```

---

## 🎬 快速操作清單

### [A] 生成圖像 (3 秒)
```bash
curl -X POST http://localhost:8000/api/generate/mix-two -H "Content-Type: application/json"
```
➜ 返回: `output_image_path`, `parents`, `model_name`

### [B] 搜尋圖像 (2 秒)
```bash
# 文字搜尋
curl -X POST http://localhost:8000/api/search/text -H "Content-Type: application/json" \
  -d '{"query":"白馬","top_k":15}'

# 圖像搜尋
curl -X POST http://localhost:8000/api/search/image -H "Content-Type: application/json" \
  -d '{"image_path":"backend/offspring_images/offspring_20250929_114940_017.png","top_k":15}'
```
➜ 返回: `results[]` 陣列，含 `id`, `distance`, `metadata`

### [C] 查親緣關係 (1 秒)
```bash
curl "http://localhost:8000/api/kinship?img=offspring_20250929_114940_017.png&depth=-1"
```
➜ 返回: `parents`, `children`, `siblings`, `ancestors`, `lineage_graph`

### [D] 遠端截圖 (5 秒)
```bash
# 1. 建立請求
REQUEST=$(curl -X POST http://localhost:8000/api/screenshots/request \
  -H "Content-Type: application/json" \
  -d '{"client_id":"mobile"}' | jq -r '.id')

# 2. 等待
sleep 3

# 3. 查詢
curl "http://localhost:8000/api/screenshots/$REQUEST" | jq '.result'
```
➜ 返回: `filename`, `absolute_path`, `relative_path`

### [E] 分析 + 音效 (8 秒)
```bash
curl -X POST http://localhost:8000/api/screenshot/bundle \
  -H "Content-Type: application/json" \
  -d '{"image_path":"screen_shots/scene_20251024T070747_a15e78bc.png","sound_duration_seconds":5.0}' | jq .
```
➜ 返回: `analysis`, `sound`, `used_prompt`

### [F] 播放音效 (即時)
```bash
curl -X POST http://localhost:8000/api/sound-play \
  -H "Content-Type: application/json" \
  -d '{"filename":"scene_20251014T053433_116e8efc.mp3","target_client_id":"mobile"}'
```
➜ WebSocket 推送給前端自動播放

### [G] 設定多面板 (2 秒)
```bash
curl -X PUT http://localhost:8000/api/iframe-config \
  -H "Content-Type: application/json" \
  -d '{
    "layout":"grid","gap":12,"columns":2,"panels":[
      {"id":"p1","src":"/?img=offspring_20250929_114940_017.png","label":"景觀"},
      {"id":"p2","src":"/?img=offspring_20250929_114940_017.png&slide_mode=true","label":"幻燈片"}
    ]}'
```
➜ WebSocket 推送給前端即時更新

---

## 🐚 完整工作流腳本

### 場景 1: 展覽現場（截圖 → 分析 → 音效）

```bash
#!/bin/bash

# 配置
MOBILE_URL="http://localhost:5173/?img=offspring_20250929_114940_017.png&client=mobile&continuous=true&sound_player=true"
API_BASE="http://localhost:8000"

echo "📱 步驟 1: 打開 mobile 客戶端"
echo "🔗 URL: $MOBILE_URL"
echo ""

# 建立截圖請求
echo "📸 步驟 2: 建立截圖請求"
REQUEST_ID=$(curl -s -X POST "$API_BASE/api/screenshots/request" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"mobile","label":"展場截圖"}' | jq -r '.id')
echo "✓ Request ID: $REQUEST_ID"
echo ""

# 等待完成
echo "⏳ 步驟 3: 等待 mobile 端回應..."
sleep 4

# 查詢結果
RESULT=$(curl -s "$API_BASE/api/screenshots/$REQUEST_ID")
STATUS=$(echo $RESULT | jq -r '.status')
IMAGE_PATH=$(echo $RESULT | jq -r '.result.absolute_path')

if [ "$STATUS" != "completed" ]; then
  echo "❌ 截圖失敗: $(echo $RESULT | jq -r '.error')"
  exit 1
fi

echo "✓ 截圖已完成: $IMAGE_PATH"
echo ""

# 分析 + 音效
echo "🎬 步驟 4: 分析圖像並生成音效..."
BUNDLE=$(curl -s -X POST "$API_BASE/api/screenshot/bundle" \
  -H "Content-Type: application/json" \
  -d "{\"image_path\":\"$IMAGE_PATH\",\"sound_duration_seconds\":5.0}")

SOUND_FILE=$(echo $BUNDLE | jq -r '.sound.filename')
SUMMARY=$(echo $BUNDLE | jq -r '.analysis.summary' | head -c 100)

echo "✓ 分析結果: $SUMMARY..."
echo "✓ 音效生成: $SOUND_FILE"
echo ""

# 播放音效
echo "🔊 步驟 5: 推送音效到 mobile..."
curl -s -X POST "$API_BASE/api/sound-play" \
  -H "Content-Type: application/json" \
  -d "{\"filename\":\"$SOUND_FILE\",\"target_client_id\":\"mobile\"}" > /dev/null

echo "✓ 完成！"
```

### 場景 2: 搜尋 → 生成 → 索引工作流

```bash
#!/bin/bash
API_BASE="http://localhost:8000"

# 1. 生成新圖像
echo "🎨 生成新圖像..."
GEN=$(curl -s -X POST "$API_BASE/api/generate/mix-two" \
  -H "Content-Type: application/json" | jq '.output_image_path')
echo "✓ 生成: $GEN"

# 2. 索引新圖像
echo "🗂️ 索引新圖像到向量庫..."
curl -s -X POST "$API_BASE/api/index/offspring" -H "Content-Type: application/json" > /dev/null
echo "✓ 索引完成"

# 3. 搜尋相似圖像
echo "🔍 搜尋相似圖像..."
SEARCH=$(curl -s -X POST "$API_BASE/api/search/image" \
  -H "Content-Type: application/json" \
  -d "{\"image_path\":\"$GEN\",\"top_k\":10}")

COUNT=$(echo $SEARCH | jq '.results | length')
echo "✓ 找到 $COUNT 張相似圖像"
```

---

## 📋 故障排查決策樹

```
系統異常
│
├─ 後端不響應 (curl http://localhost:8000/health 失敗)
│  └─ 檢查: uvicorn 是否在運行？
│     └─ 重啟: cd backend && uvicorn app.main:app --reload
│
├─ 前端無法加載 (http://localhost:5173 失敗)
│  └─ 檢查: npm run dev 是否在運行？
│     └─ 重啟: cd frontend && npm run dev
│
├─ 截圖失敗 ("場景尚未準備好")
│  └─ 在 URL 添加: &continuous=true 禁用自動切換
│     └─ 或增加等待: sleep 5
│
├─ 搜尋結果為空
│  └─ 檢查圖像是否已索引:
│     └─ curl -X POST http://localhost:8000/api/index/offspring
│
├─ 手機端沒有聲音
│  └─ 在 URL 添加: &sound_player=true
│     └─ 用戶點擊播放按鈕手動播放
│
└─ WebSocket 連接失敗
   └─ 檢查 target_client_id 是否與 URL 參數 client= 匹配
      └─ 檢查前端是否發送 hello 消息
```

---

## 🔑 環境變數快速驗證

```bash
# 檢查所有必要的 API Key
for key in GEMINI_API_KEY OPENAI_API_KEY ELEVENLABS_API_KEY; do
  if [ -z "${!key}" ]; then
    echo "❌ 缺少: $key"
  else
    echo "✅ $key 已設定"
  fi
done

# 檢查目錄結構
for dir in backend/offspring_images backend/metadata backend/generated_sounds backend/chroma_db screen_shots; do
  [ -d "$dir" ] && echo "✅ $dir" || echo "❌ $dir 不存在"
done
```

---

## 📊 API 響應時間預期

| 操作 | 預期時間 | 瓶頸 |
|------|---------|------|
| 生成圖像 | 5-30s | Gemini API 調用 |
| 文字搜尋 | 1-2s | OpenAI embedding |
| 圖像搜尋 | 0.1s (DB) / 3s (embedding) | 向量查詢 vs embedding |
| 查親緣 | 0.5s | JSON 掃描 |
| 截圖（含上傳） | 3-5s | WebSocket + 上傳 |
| 分析 + 音效 | 8-15s | Gemini + ElevenLabs |
| 播放音效 | 即時 | WebSocket 推送 |

---

## 🚀 常見一行命令

```bash
# 快速檢查系統
curl -s http://localhost:8000/health | jq .

# 列出所有生成的圖像
ls -lh backend/offspring_images/ | tail -10

# 查看最新的 5 個截圖
ls -lh screen_shots/ | tail -5

# 查看向量庫統計
echo "SELECT COUNT(*) FROM documents;" | sqlite3 backend/chroma_db/chroma.sqlite3

# 監聽 WebSocket 事件（需要 websocat 或 wscat）
wscat -c ws://localhost:8000/ws/screenshots

# 快速重啟後端
pkill -f "uvicorn app.main" && cd backend && uvicorn app.main:app --reload &
```

---

## 📚 快速查閱索引

| 主題 | 位置 |
|------|------|
| 完整 API 文檔 | `docs/API_QUICK_START_GUIDE.md` |
| 後端架構 | `docs/system_architecture/後端架構概論.md` |
| 前端架構 | `docs/system_architecture/前端架構概論.md` |
| 系統規格 | `spec.md` |
| Playback 腳本 | `backend/playback_scripts/` |
| 前端原始碼 | `frontend/src/` |
| 後端服務 | `backend/app/services/` |

---

**最後更新**: 2025-10-24  
**版本**: 1.0
