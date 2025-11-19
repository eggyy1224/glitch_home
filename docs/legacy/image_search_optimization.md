# 以圖搜圖優化分析

## 🔍 發現的問題

### 檔案名稱流程

```
前端上傳檔案流程：
┌─────────────────────────────────────┐
│ 用戶選擇檔案                        │
│ 例如: cat.jpg, photo.png 等         │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ 前端發送到 /api/screenshots         │
│ FormData: { file: 原始檔案 }        │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ 後台 save_screenshot()              │
│ 生成新檔案名稱：                    │
│ scene_20251019T123456_a1b2c3d4.jpg  │
│ ❌ 原始名稱被丟棄                   │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ 後台返回:                           │
│ {                                   │
│   "absolute_path": "...scene_...jpg"│
│   "filename": "scene_...jpg"        │
│ }                                   │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ 前端調用 /api/search/image          │
│ 使用: scene_...jpg                  │
│ ❌ 永遠找不到相同名稱的索引圖像    │
└─────────────────────────────────────┘
```

### ⚠️ 為什麼這是問題？

我們的優化邏輯是：
```python
if 圖像已在資料庫中（按檔案名稱查找）:
    直接從資料庫取向量  ✓ 快速
else:
    調用 API embedding  ✓ 完整但慢
```

**但問題是：**
- 用戶上傳的檔案被重新命名為 `scene_...jpg`
- 資料庫中存的是 `offspring_...png` 或其他名稱
- 名稱永遠無法匹配 → 永遠會調用 API embedding
- **優化完全失效！**

---

## ✅ 解決方案

### 方案 1：保留原始檔案名稱（推薦）

**後台修改：**在上傳時，可選地保留原始檔案名稱用於資料庫查找

```python
def save_screenshot(upload: UploadFile) -> dict[str, str]:
    # ... 現有邏輯 ...
    return {
        "filename": filename,  # 實際存的名稱
        "original_filename": upload.filename,  # 新增：原始名稱
        "absolute_path": str(full_path),
        "relative_path": relative_path,
    }
```

**前端修改：**發送原始檔案名稱給搜尋 API

```javascript
// 前端上傳後，如果原始檔案名稱在 offspring_images 中存在
// 就使用原始名稱進行搜尋
const searchPath = uploadData.original_filename 
  ? `backend/offspring_images/${uploadData.original_filename}`
  : uploadedPath;

const searchResults = await searchImagesByImage(searchPath, 15);
```

### 方案 2：內容比對（更聰明但複雜）

計算上傳檔案的 hash 值，與資料庫中所有圖像的 hash 比對：

```python
import hashlib

def get_file_hash(file_path):
    """計算檔案的 SHA256 hash"""
    h = hashlib.sha256()
    with open(file_path, 'rb') as f:
        h.update(f.read())
    return h.hexdigest()

# 在索引時存儲每張圖像的 hash
# 搜尋時，比對上傳檔案和已索引檔案的 hash
```

### 方案 3：向量相似度（最可靠但最慢）

使用上傳檔案的向量，與資料庫中所有向量進行相似度計算，找到最相似的索引圖像。

**缺點：** 需要計算上傳檔案的 embedding，失去優化效果。

---

## 📝 建議實施流程

### 步驟 1：修改後台 save_screenshot()

```python
# backend/app/services/screenshots.py

def save_screenshot(upload: UploadFile) -> dict[str, str]:
    # ... 現有程式碼 ...
    return {
        "filename": filename,
        "original_filename": upload.filename,  # 新增
        "absolute_path": str(full_path),
        "relative_path": relative_path,
    }
```

### 步驟 2：修改後台 /api/screenshots 端點

```python
# backend/app/main.py

@app.post("/api/screenshots", status_code=201)
async def api_upload_screenshot(...) -> dict:
    # ... 現有邏輯 ...
    return {
        "filename": saved["filename"],
        "original_filename": saved["original_filename"],  # 新增
        "absolute_path": saved["absolute_path"],
        "relative_path": saved.get("relative_path"),
        # ...
    }
```

### 步驟 3：修改前端 SearchMode.jsx

```javascript
const handleImageSearch = async () => {
    // ... 上傳邏輯 ...
    const uploadData = await uploadRes.json();
    
    // 💡 優化：如果原始檔案名稱在 offspring_images 中存在
    // 就用它進行搜尋，這樣能利用資料庫快速查詢
    let searchPath = uploadData.absolute_path;
    
    if (uploadData.original_filename) {
        const possiblePath = `backend/offspring_images/${uploadData.original_filename}`;
        // 注：前端無法驗證檔案是否存在，
        // 後台會檢查並決定是用資料庫查詢還是 API embedding
        searchPath = possiblePath;
        console.log("嘗試使用原始檔案名稱:", searchPath);
    }
    
    const searchResults = await searchImagesByImage(searchPath, 15);
};
```

### 步驟 4：改進後台 search_images_by_image()

```python
def search_images_by_image(image_path: str, top_k: int = 10) -> Dict[str, Any]:
    """搜尋類似圖像。
    
    優化邏輯：
    1. 如果搜尋的圖像在 offspring_images 中存在 → 使用資料庫向量 (快速)
    2. 否則，使用上傳的圖像進行 embedding (完整功能)
    """
    # ... 路徑解析邏輯 ...
    
    basename = os.path.basename(path)
    col = get_images_collection()
    
    # 先嘗試在資料庫中查找
    existing = col.get(ids=[basename], include=["embeddings"])
    
    if existing and len(existing.get("ids", [])) > 0:
        # ✓ 在資料庫中找到 → 使用預計算向量
        print(f"✓ 使用已索引的向量: {basename}")
        vec = existing.get("embeddings", [[]])[0]
        if hasattr(vec, 'tolist'):
            vec = vec.tolist()
    else:
        # ✗ 未在資料庫中 → 進行 embedding
        print(f"📤 {basename} 未在資料庫中，進行 embedding...")
        vec = _embed_image_for_search(path)
    
    # ... 查詢邏輯 ...
```

---

## 🎯 優化效果

### 最佳情況（檔案在 offspring_images 中）
```
耗時: 0.08 秒
API 呼叫: 0
成本: 無
```

### 次優情況（新上傳的檔案）
```
耗時: 2.0 秒
API 呼叫: 1
成本: 正常
```

### 當前情況（未經優化）
```
耗時: 2.0 秒
API 呼叫: 1（永遠會調用）
成本: 正常但浪費
```

---

## 💡 為什麼這很重要？

### 使用場景 1：尋找類似的生成圖像
用戶想找與已生成圖像相似的圖像。
- **期望:** 使用優化路徑 (0.08s)
- **實際:** 無法使用優化 (2.0s)
- **損失:** 2.0s 延遲，1 次 API 呼叫

### 使用場景 2：批量搜尋
用戶連續搜尋 10 張圖像
- **期望:** 10 × 0.08 = 0.8s
- **實際:** 10 × 2.0 = 20s
- **損失:** 19.2s 延遲，10 次 API 呼叫

---

## 📋 實施檢查清單

- [ ] 修改 `backend/app/services/screenshots.py` 保存 `original_filename`
- [ ] 修改 `backend/app/main.py` `/api/screenshots` 端點返回 `original_filename`
- [ ] 修改 `frontend/src/SearchMode.jsx` 使用原始檔案名稱進行搜尋
- [ ] 改進 `backend/app/services/vector_store.py` 的資料庫查詢邏輯
- [ ] 測試場景 1：搜尋已生成的圖像 (應該使用資料庫快速路徑)
- [ ] 測試場景 2：搜尋新上傳的圖像 (應該調用 API embedding)
- [ ] 驗證效能改進 (對比耗時)

