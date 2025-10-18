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
  - 向下相容：可不帶 Body，改用 Query 參數 `count`（預設 2，需 ≥ 2），舊行為不變。
  - 擴充（建議）：以 JSON Body 指定更完整的控制：
    ```json
    {
      "parents": ["攝影圖像/直式/a.jpg", "AI生成靜態影像/b.png"],
      "count": 3,
      "prompt": "custom prompt here",
      "strength": 0.6,
      "output_format": "png",
      "output_width": 1024,
      "output_height": 768,
      "output_max_side": 1200,
      "resize_mode": "cover"
    }
    ```
    - `parents`：可用絕對路徑、相對於 `GENES_POOL_DIRS` 的相對路徑，或檔名 basename；若未提供則會隨機抽樣 `count` 張（預設 2）。
    - `prompt`：自訂 prompt；未提供則用 `FIXED_PROMPT`。
    - `strength`：0..1 的融合強度提示；目前以 prompt 訊息傳遞（未使用模型原生參數）。
    - `output_format`：`png` 或 `jpeg`（`jpg` 同義）。
    - `output_width`/`output_height`：輸出尺寸；若只給其中一個，會等比計算另一邊；若兩者皆無但給 `output_max_side`，會將最長邊等比縮至該值；若都未給則保留模型輸出尺寸。
    - `resize_mode`：當同時提供寬與高時的行為：`cover`（預設，等比放大填滿後置中裁切，無黑邊）或 `fit`（等比縮放塞入框內，必要時補邊，PNG 透明 / JPEG 黑色）。
  - 流程：從 `GENES_POOL_DIRS`（或 `GENES_POOL_DIR`）取父圖（指定或隨機），呼叫 Gemini 生成融合圖，結果存於 `OFFSPRING_DIR`，metadata 存於 `METADATA_DIR`。

  回應範例：
  ```json
  {
    "output_image_path": "backend/offspring_images/offspring_20250101_120000_123.png",
    "metadata_path": "backend/metadata/offspring_20250101_120000_123.json",
    "parents": ["a.png", "b.jpg", "c.jpg"],
    "model_name": "gemini-2.5-flash-image-preview",
    "output_format": "png",
    "width": 1024,
    "height": 768
  }
  ```
- `GET /api/camera-presets`：列出目前儲存的視角列表。
- `POST /api/camera-presets`：儲存 / 覆寫視角。Body 需要包含 `name`、`position{x,y,z}`、`target{x,y,z}`。
- `DELETE /api/camera-presets/{name}`：刪除指定名稱的視角。

### 向量嵌入與 ChromaDB

環境變數（可用 .env 設定）：
- `CHROMA_DB_PATH`（預設 `backend/chroma_db`）
- `GOOGLE_EMBEDDING_MODEL`（預設 `text-embedding-004`）
- `GOOGLE_IMAGE_EMBEDDING_MODEL`（預設 `multimodalembedding`，需 Vertex 支援才可直接嵌入影像）
- `CHROMA_COLLECTION_IMAGES`（預設 `offspring_images`）
- `CHROMA_COLLECTION_TEXT`（預設 `text_queries`）
- `GENAI_USE_VERTEX`（預設 `false`）：啟用 Vertex AI 路徑（需專案與位置）
- `VERTEX_PROJECT`、`VERTEX_LOCATION`：Vertex 專案與地區，例如 `my-gcp-project`、`us-central1`
- `ENABLE_IMAGE_EMBEDDING`（預設 `false`）：直接嘗試影像嵌入；若模型/權限不支援會自動回退至「描述→文字嵌入」

端點：
- `POST /api/index/offspring`
  - Body（可省略）：`{ "limit": number|null, "force": boolean }`
  - 將 `backend/offspring_images` 下所有影像計算 embedding 並寫入 ChromaDB；會自動合併對應的 metadata JSON。
- `POST /api/index/image`
  - Body：`{ "basename": "offspring_...png", "force": false }`
  - 只索引單一影像（檔名為 `offspring_images/` 下的檔名）。
- `POST /api/search/text`
  - Body：`{ "query": "...", "top_k": 10 }`
  - 使用文字在影像集合中搜尋（需 `GOOGLE_IMAGE_EMBEDDING_MODEL` 為 multimodal 才支援跨模態）。
- `POST /api/search/image`
  - Body：`{ "image_path": "/abs/or/relative/path.png", "top_k": 10 }`
  - 以圖搜圖。

安裝與初始化：
```bash
pip install -r requirements.txt  # 需要 chromadb
uvicorn app.main:app --host 0.0.0.0 --port 8000
# 初次索引
curl -X POST http://localhost:8000/api/index/offspring
# 文字搜尋（若為 multimodal 模型）
curl -X POST http://localhost:8000/api/search/text -H 'Content-Type: application/json' \
  -d '{"query":"foggy night umbrellas with green rims", "top_k": 8}'

# 啟用 Vertex 直接影像嵌入（選用）
export GENAI_USE_VERTEX=true
export VERTEX_PROJECT=<your_project>
export VERTEX_LOCATION=<your_location>
export ENABLE_IMAGE_EMBEDDING=true
# 需先設定 ADC（服務帳戶或本機 gcloud auth），否則請改用預設的「描述→文字嵌入」路徑
```

文件參考：[`Gemini Image Generation`](https://ai.google.dev/gemini-api/docs/image-generation)
