# Backend (FastAPI) - Image Loop Synthesizer MVP

## 需求
- Python 3.10+
- 建議使用虛擬環境（venv）

## 安裝
```bash
cd /Volumes/2024data/glitch_home_project/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 環境變數
後端會讀取系統環境（或 `.env` 若你有放在專案根目錄/`backend/`）；需設定：
- `GEMINI_API_KEY` 或 `GOOGLE_API_KEY`
- `MODEL_NAME`（預設 `gemini-2.5-flash-image-preview`）
- `GENES_POOL_DIRS`（多資料夾，逗號分隔；若設定此值則優先於 `GENES_POOL_DIR`）
- `GENES_POOL_DIR`（單一資料夾，舊設定）
- `OFFSPRING_DIR`（預設 `backend/offspring_images`）
- `METADATA_DIR`（預設 `backend/metadata`）
- `FIXED_PROMPT`（可自訂融合風格）
- `IMAGE_SIZE`（預設 `1024`，送進模型前會把每張輸入圖等比例縮到最長邊不超過此值，降低因輸入過大導致的偶發失敗）

範例：
```bash
export GENES_POOL_DIRS="夜遊 - 毛刺/攝影圖像/橫式,夜遊 - 毛刺/攝影圖像/直式,夜遊 - 毛刺/AI生成靜態影像"
export OFFSPRING_DIR="backend/offspring_images"
export METADATA_DIR="backend/metadata"
export GEMINI_API_KEY="你的金鑰"
```

> 相對路徑會自動以專案根目錄 `/Volumes/2024data/glitch_home_project` 為基準解析。

## 啟動（本地）
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API
- `GET /health`
- `POST /api/generate/mix-two`
  - Query 參數：`count`（預設 2，需 ≥ 2）
  - 從 `GENES_POOL_DIRS`（或 `GENES_POOL_DIR`）隨機選 `count` 張，呼叫 Gemini 生成融合圖，結果存於 `OFFSPRING_DIR`，metadata 存於 `METADATA_DIR`。

回應範例：
```json
{
  "output_image_path": "backend/offspring_images/offspring_20250101_120000_123.png",
  "metadata_path": "backend/metadata/offspring_20250101_120000_123.json",
  "parents": ["a.png", "b.jpg", "c.jpg"],
  "model_name": "gemini-2.5-flash-image-preview"
}
```

文件參考：[`Gemini Image Generation`](https://ai.google.dev/gemini-api/docs/image-generation)
