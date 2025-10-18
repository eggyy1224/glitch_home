# 🌐 雙語搜尋系統實現指南

## 什麼發生了？

你的系統升級了！從之前只能英文搜尋，現在**同時支援中文和英文搜尋**。

## 🔬 問題診斷

### 原始問題
- 中文查詢「白馬」：相似度距離 1.1844（較差）
- 英文查詢「white horse」：相似度距離 0.7649（很好）

### 根本原因
```
舊流程：
  圖像 → Gemini 生成英文 Caption 
       → 嵌入到向量空間（英文）
       → 中文查詢被轉成中文向量
       → 中文向量 vs 英文嵌入 = 相似度差

新流程：
  圖像 → Gemini 同時生成英文和中文 Caption
       → 分別嵌入到向量空間
       → 中文查詢搜尋中文嵌入 ✓
       → 英文查詢搜尋英文嵌入 ✓
```

## 📝 主要改動

### 1. embeddings.py - 新增雙語 Caption 生成

```python
def caption_image_bilingual(image) -> tuple[str, str]:
    """回傳 (English_caption, Chinese_caption)"""
    # 分別調用 Gemini 生成英文和中文描述
    en_caption = ...  # 英文提示
    cn_caption = ...  # 中文提示（"用1-3個簡潔要點...")
    return en_caption, cn_caption
```

### 2. vector_store.py - 雙語嵌入索引

```python
def index_offspring_image(basename):
    # 生成中英雙語 caption
    en_caption, cn_caption = caption_image_bilingual(image_path)
    
    # 分別嵌入
    en_vec = embed_text(en_caption)  # → 向量空間
    cn_vec = embed_text(cn_caption)  # → 向量空間
    
    # 分別存儲（ID 帶語言標記）
    col.upsert(ids=[f"{basename}:en"], embeddings=[en_vec], ...)
    col.upsert(ids=[f"{basename}:zh"], embeddings=[cn_vec], ...)
```

### 3. 搜尋智能化

```python
def search_images_by_text(query):
    # 自動偵測語言
    has_chinese = any('\u4e00' <= c <= '\u9fff' for c in query)
    
    if has_chinese:
        # 搜尋中文版本優先
        results = col.query(where={"language": "zh"})
    else:
        # 搜尋英文版本優先
        results = col.query(where={"language": "en"})
```

## ⏳ 重新索引過程（正在進行中）

### 步驟
1. ✓ 備份舊索引到 `embeddings/chroma_backup_old`
2. ✓ 清除舊索引
3. 🔄 **進行中**：為所有 162 張圖像生成雙語嵌入

### 時間預估
- 每張圖像：~3-5 秒（需要調用 Gemini API 兩次）
- 總計 162 張：約 8-14 分鐘
- 取決於 API 回應速度

### 進度監控

```bash
# 在另一個終端查看 ChromaDB 進度
cd /Volumes/2024data/glitch_home_project
source backend/venv/bin/activate
python3 << 'PYEOF'
import chromadb
from pathlib import Path

db_path = Path("embeddings/chroma")
client = chromadb.PersistentClient(path=str(db_path))
try:
    col = client.get_collection(name="offspring_images")
    print(f"✓ 已索引：{col.count()} 個文檔（包含語言版本）")
except:
    print("⏳ 索引建構中...")
PYEOF
```

## 🧪 測試雙語搜尋

索引完成後，可以測試：

```bash
# 終端 1：啟動後端
cd /Volumes/2024data/glitch_home_project
source backend/venv/bin/activate
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000

# 終端 2：測試中文查詢
curl -X POST http://localhost:8000/api/search/text \
  -H 'Content-Type: application/json' \
  -d '{"query":"白馬", "top_k": 5}'

# 終端 3：測試英文查詢
curl -X POST http://localhost:8000/api/search/text \
  -H 'Content-Type: application/json' \
  -d '{"query":"white horse", "top_k": 5}'
```

## 📊 預期效果對比

### 重新索引前
```
查詢          最佳相似度距離    品質
─────────────────────────────────
"white horse"    0.7649        ⭐⭐⭐ 很好
"白馬"           1.1844        ⭐    不好
```

### 重新索引後（預期）
```
查詢          最佳相似度距離    品質
─────────────────────────────────
"white horse"    0.7-0.8       ⭐⭐⭐ 很好
"白馬"           0.7-0.8       ⭐⭐⭐ 很好（改善！）
```

## 💾 存儲結構

### ChromaDB 集合結構

```
offspring_images 集合
│
├─ 圖像 1
│  ├─ offspring_123.png:en
│  │  ├─ ID: "offspring_123.png:en"
│  │  ├─ embedding: [0.123, 0.456, ...] (1024D)
│  │  ├─ metadata:
│  │  │  ├─ language: "en"
│  │  │  ├─ caption_en: "A white horse rearing..."
│  │  │  ├─ caption_zh: "一匹白馬奔騰..."
│  │  │  └─ ...其他 metadata
│  │
│  └─ offspring_123.png:zh
│     ├─ ID: "offspring_123.png:zh"
│     ├─ embedding: [0.234, 0.567, ...] (1024D, 不同空間)
│     └─ metadata: (同上)
│
└─ 圖像 2, 3, ... (共 162 個原始圖像 = 324 個文檔)
```

## ⚙️ 配置文件

如無特殊需求，保持預設即可：

```python
# backend/app/config.py
GOOGLE_EMBEDDING_MODEL = "text-embedding-004"  # 支援多語言
CHROMA_DB_PATH = "embeddings/chroma"
CHROMA_COLLECTION_IMAGES = "offspring_images"
```

## 🚀 後續操作

### 索引完成後
1. 驗證搜尋效果
2. 提交代碼變更
3. 如需修改 Caption 提示詞，編輯 `embeddings.py` 中的 `_CAPTION_PROMPT_CN`

### 如要回退
```bash
# 恢復舊索引
rm -rf embeddings/chroma
mv embeddings/chroma_backup_old embeddings/chroma
```

## 📚 相關文件

- `/backend/app/utils/embeddings.py` - Caption 生成邏輯
- `/backend/app/services/vector_store.py` - 索引與搜尋邏輯
- `/backend/README.md` - API 文檔

---

**進度：** 🔄 重新索引中... 請耐心等待 ⏳
