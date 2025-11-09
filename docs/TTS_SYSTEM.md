# TTS 旁白系統文檔

> **版本**: 1.0  
> **最後更新**: 2025-11-04

---

## 概述

TTS（Text-to-Speech）旁白系統整合 OpenAI Audio Speech API，可將文字轉換為語音，並透過 WebSocket 廣播給前端客戶端播放。支援多種語音選項、語速控制、語氣描述等功能。

---

## 功能特色

- **多種語音選項**: 6 種預設語音（alloy, echo, fable, onyx, nova, shimmer）
- **語速控制**: 0.25-4.0 倍速調整
- **語氣描述**: 透過 `instructions` 參數指定語氣、口音、說話風格
- **自動播放**: 可選擇自動透過 WebSocket 推送播放
- **多客戶端支援**: 可指定目標客戶端或廣播給所有客戶端

---

## API 使用

### 端點

```
POST /api/tts
```

### 請求參數

| 參數 | 類型 | 必填 | 說明 | 預設值 |
|------|------|------|------|--------|
| `text` | string | ✅ | 要合成的文字 | - |
| `instructions` | string | ❌ | 語氣/口音/說話風格描述 | null |
| `voice` | string | ❌ | 語音選項 | `alloy` |
| `model` | string | ❌ | TTS 模型 | `gpt-4o-mini-tts` |
| `output_format` | string | ❌ | 輸出格式 | `mp3` |
| `filename_base` | string | ❌ | 自訂檔名前綴 | `narration` |
| `speed` | number | ❌ | 語速（0.25-4.0） | 1.0 |
| `auto_play` | boolean | ❌ | 是否自動播放 | false |
| `target_client_id` | string | ❌ | 指定播放目標客戶端 | null |

### 語音選項

- `alloy`: 中性語音（預設）
- `echo`: 較低沉的語音
- `fable`: 較明亮的語音
- `onyx`: 較深沉的語音
- `nova`: 較年輕的語音
- `shimmer`: 較柔和的語音

### 輸出格式

- `mp3`: MP3 格式（預設）
- `wav`: WAV/PCM 格式
- `opus`: Opus 格式
- `aac`: AAC 格式
- `flac`: FLAC 格式

### 請求範例

```bash
curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "各位好，歡迎來到圖像系譜學現場展示。",
    "instructions": "zh-TW Mandarin, calm, low pitch, slower pace, intimate",
    "voice": "alloy",
    "speed": 0.95,
    "auto_play": true,
    "target_client_id": "mobile"
  }'
```

### 回應格式

```json
{
  "tts": {
    "text": "各位好，歡迎來到圖像系譜學現場展示。",
    "model": "gpt-4o-mini-tts",
    "voice": "alloy",
    "format": "mp3",
    "filename": "narration_20251104_123456_ab12cd34.mp3",
    "absolute_path": "/abs/path/to/backend/generated_sounds/narration_...mp3",
    "relative_path": "backend/generated_sounds/narration_...mp3"
  },
  "url": "http://localhost:8000/api/sound-files/narration_...mp3",
  "playback": {
    "status": "queued",
    "target_client_id": "mobile"
  }
}
```

---

## 自動播放流程

當 `auto_play=true` 時，系統會：

1. 產生 TTS 音訊檔案
2. 透過 WebSocket 廣播 `sound_play` 訊息給指定客戶端（或所有客戶端）
3. 前端 `SoundPlayer` 元件自動接收並播放

### WebSocket 訊息格式

```json
{
  "type": "sound_play",
  "filename": "narration_20251104_123456_ab12cd34.mp3",
  "url": "http://localhost:8000/api/sound-files/narration_...mp3"
}
```

---

## 檔案管理

### 儲存位置

所有 TTS 音訊檔案儲存在：
```
backend/generated_sounds/
```

### 命名規則

預設命名格式：
```
narration_YYYYMMDDTHHMMSS_XXXX.{format}
```

範例：
```
narration_20251104_123456_ab12cd34.mp3
```

若指定 `filename_base`，則使用：
```
{filename_base}_YYYYMMDDTHHMMSS_XXXX.{format}
```

### 檔案存取

透過 API 存取：
```
GET /api/sound-files/{filename}
```

---

## 環境變數配置

在 `backend/.env` 或專案根目錄 `.env` 中設定：

```bash
# 必要
OPENAI_API_KEY=your_openai_api_key_here

# 可選（TTS 相關）
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=alloy
OPENAI_TTS_FORMAT=mp3
```

---

## 使用範例

### 範例 1: 基本 TTS 生成

```bash
curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "這是一段測試語音。"
  }'
```

### 範例 2: 帶語氣描述的 TTS

```bash
curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "歡迎來到圖像系譜學展覽。",
    "instructions": "zh-TW Mandarin, calm, low pitch, slower pace, intimate",
    "voice": "nova",
    "speed": 0.9
  }'
```

### 範例 3: 自動播放到特定客戶端

```bash
curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "展覽即將開始，請各位觀眾就座。",
    "auto_play": true,
    "target_client_id": "mobile",
    "voice": "shimmer",
    "speed": 1.0
  }'
```

### 範例 4: 整合到工作流程

```bash
# 1. 產生 TTS
TTS_RESULT=$(curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "這張圖像展示了親緣關係的視覺化。",
    "instructions": "zh-TW Mandarin, calm, informative",
    "auto_play": true,
    "target_client_id": "desktop"
  }')

FILENAME=$(echo $TTS_RESULT | jq -r '.tts.filename')
echo "TTS 已生成並推送播放: $FILENAME"
```

---

## 前端整合

### SoundPlayer 元件

前端使用 `SoundPlayer` 元件顯示清單並播放音訊，本身只透過 `playRequest` prop 觸發播放。要做到「自動接收 WebSocket 訊息 → 播放」，需搭配 `useControlSocket` hook 或其他邏輯，先在父層監聽 `sound_play` 訊息再把 `playRequest` 傳給 `SoundPlayer`：

```jsx
import SoundPlayer from "./SoundPlayer.jsx";

// 在 URL 參數中加入 sound_player=true
// ?sound_player=true

// 父層需在收到 sound_play 後呼叫 setPlayRequest
// SoundPlayer 只負責根據 props 播放
```

### WebSocket 連線

前端需要連接到 WebSocket：
```javascript
const ws = new WebSocket("ws://localhost:8000/ws/screenshots");

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "hello",
    client_id: "mobile"
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === "sound_play") {
    // SoundPlayer 會自動處理
  }
};
```

---

## 技術細節

### 實作位置

- **後端服務**: `backend/app/services/tts_openai.py`
- **API 路由**: `backend/app/api/media.py`
- **前端元件**: `frontend/src/SoundPlayer.jsx`

### 依賴服務

- **OpenAI Audio Speech API**: 用於語音合成
- **WebSocket**: 用於即時播放推送

### 限制與注意事項

1. **API 配額**: 受 OpenAI API 配額限制
2. **文字長度**: 建議單次不超過 4096 字元
3. **檔案大小**: 生成的音訊檔案會佔用儲存空間
4. **網路延遲**: WebSocket 推送可能受網路狀況影響

---

## 常見問題

### Q: 如何選擇適合的語音？

A: 根據使用場景選擇：
- **alloy**: 通用場景（預設）
- **nova**: 較年輕、活潑的場景
- **shimmer**: 較柔和、親切的場景
- **onyx**: 較深沉、專業的場景

### Q: 如何控制語速？

A: 使用 `speed` 參數：
- `0.5`: 慢速
- `1.0`: 正常速度（預設）
- `1.5`: 快速
- `2.0`: 極快

### Q: 如何指定語氣？

A: 使用 `instructions` 參數，例如：
- `"zh-TW Mandarin, calm, low pitch"`
- `"English, enthusiastic, higher pitch"`
- `"Japanese, formal, slower pace"`

### Q: 音訊檔案會自動清理嗎？

A: 目前不會自動清理，需要手動管理。建議定期清理舊檔案。

---

## 參考資源

- [系統規格文件](../spec.md) - 完整的 API 規格
- [API 快速上手指南](./API_QUICK_START_GUIDE.md) - 快速開始範例
- [後端架構概論](./system_architecture/後端架構概論.md) - 技術實作細節
- [OpenAI Audio Speech API 文檔](https://platform.openai.com/docs/guides/text-to-speech)

---

**文件結束**
