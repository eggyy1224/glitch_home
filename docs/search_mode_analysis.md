# 前端 Search Mode 完整分析

## 🔍 總體架構

### 1. 核心流程

```
URL (?search_mode=true) 
  ↓
App.jsx 讀取參數
  ↓
searchMode = true
  ↓
渲染 SearchMode 元件
  ↓
隱藏 KinshipScene，顯示搜尋界面
```

### 2. App.jsx 中的觸發邏輯

```javascript
// 第 46 行
const searchMode = !incubatorMode && !phylogenyMode && 
  (readParams().get("search_mode") ?? "false") === "true";

// 第 469-471 行
if (searchMode) {
  return <SearchMode imagesBase={IMAGES_BASE} />;
}
```

**關鍵點：**
- searchMode 是三個互斥模式之一（incubator | phylogeny | search）
- 只需在 URL 添加 `?search_mode=true` 即可激活
- 會完全替換 KinshipScene，不顯示 3D 視景

---

## 🎨 SearchMode 元件詳解

### 1. 狀態管理

#### 搜尋模式切換
```javascript
const [searchType, setSearchType] = useState("image"); // "image" | "text"
```

#### 以圖搜圖狀態
```javascript
const [selectedFile, setSelectedFile] = useState(null);      // 選中的檔案
const [preview, setPreview] = useState(null);                // Base64 預覽
const fileInputRef = useRef(null);                           // Input 引用
```

#### 文字搜尋狀態
```javascript
const [textQuery, setTextQuery] = useState("");               // 搜尋詞
```

#### 共同狀態
```javascript
const [searching, setSearching] = useState(false);            // 搜尋中標誌
const [results, setResults] = useState([]);                   // 搜尋結果
const [error, setError] = useState(null);                     // 錯誤信息
```

### 2. 以圖搜圖流程

```
1️⃣  用戶上傳圖片
    ↓
    handleFileSelect()
    - 設置 selectedFile
    - 生成 Base64 preview（用於預覽）
    ↓

2️⃣  用戶點擊「搜尋」
    ↓
    handleImageSearch()
    - POST 圖片到 /api/screenshots
    - 後台返回 absolute_path
    - 調用 searchImagesByImage(path, topK=15)
    - 後台搜尋相似圖像
    ↓

3️⃣  結果顯示
    - results 列表更新
    - 網格顯示卡片
```

**關鍵代碼（第 49-79 行）：**
```javascript
const uploadRes = await fetch(`${apiBase}/api/screenshots`, {
  method: "POST",
  body: formData,
});
const uploadData = await uploadRes.json();
const uploadedPath = uploadData.absolute_path || uploadData.relative_path;

const searchResults = await searchImagesByImage(uploadedPath, 15);
```

### 3. 文字搜尋流程

```
1️⃣  用戶輸入文字
    ↓
    setTextQuery(value)
    ↓

2️⃣  用戶按「Enter」或點擊「搜尋」
    ↓
    handleTextSearch()
    - 驗證 textQuery 非空
    - 調用 searchImagesByText(query, topK=15)
    - 後台搜尋相關圖像
    ↓

3️⃣  結果顯示
    - results 列表更新
    - 網格顯示卡片
```

**關鍵代碼（第 107-119 行）：**
```javascript
const searchResults = await searchImagesByText(textQuery, 15);
const resultList = searchResults.results || [];
setResults(resultList);
```

### 4. UI 結構

```
┌─────────────────────────────────────────┐
│  🔍 相似度搜尋                          │
│  以圖片或文字搜尋相似的後代影像          │
└─────────────────────────────────────────┘

┌─ 模式切換 ──────────────────────────────┐
│  [📸 以圖搜圖]  [📝 文字搜尋]           │
└─────────────────────────────────────────┘

┌─ 搜尋區 ────────────────────────────────┐
│  (依模式動態顯示)                       │
│                                         │
│  以圖搜圖:                              │
│  ┌─────────────────────────────┐       │
│  │  📸 點擊上傳圖片或拖放      │       │
│  │  支援 PNG, JPG, JPEG        │       │
│  └─────────────────────────────┘       │
│  [🚀 搜尋] [清除]                      │
│                                         │
│  文字搜尋:                              │
│  ┌─────────────────────────────┐       │
│  │ 輸入搜尋詞... 例如：白馬     │ (可Enter)
│  └─────────────────────────────┘       │
│  [🚀 搜尋] [清除]                      │
└─────────────────────────────────────────┘

┌─ 錯誤區（條件顯示）─────────────────────┐
│  ❌ 錯誤信息                            │
└─────────────────────────────────────────┘

┌─ 結果區（條件顯示）─────────────────────┐
│  搜尋結果（N 張）                       │
│                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐         │
│  │ 圖1  │  │ 圖2  │  │ 圖3  │         │
│  │ 距離 │  │ 距離 │  │ 距離 │         │
│  │名稱  │  │名稱  │  │名稱  │         │
│  │相似度│  │相似度│  │相似度│         │
│  └──────┘  └──────┘  └──────┘         │
└─────────────────────────────────────────┘
```

---

## 📡 API 呼叫

### 相關 API 端點

| 操作 | 端點 | 方法 | 來源 |
|------|------|------|------|
| 上傳圖片 | `/api/screenshots` | POST | 後台 `/api/screenshots` |
| 以圖搜圖 | `/api/search/image` | POST | 後台 `/api/search/image` |
| 文字搜尋 | `/api/search/text` | POST | 後台 `/api/search/text` |

### 請求/回應格式

#### 上傳圖片
```javascript
POST /api/screenshots
Content-Type: multipart/form-data

Response:
{
  absolute_path: "/path/to/uploaded/file.png",
  relative_path: "uploaded/file.png"
}
```

#### 以圖搜圖
```javascript
POST /api/search/image
{
  image_path: "/path/to/image.png",
  top_k: 15
}

Response:
{
  results: [
    {
      id: "offspring_20250923_161624_066.png",
      distance: 0.4151,
      metadata: { ... }
    },
    ...
  ]
}
```

#### 文字搜尋
```javascript
POST /api/search/text
{
  query: "白馬",
  top_k: 15
}

Response:
{
  results: [
    {
      id: "offspring_20250923_161704_451.png",
      distance: 1.3147,
      metadata: { ... }
    },
    ...
  ]
}
```

---

## 🎯 相似度計算

### 距離 → 相似度百分比轉換

```javascript
// 第 294 行
const similarity = Math.max(0, ((1 - (distance / 2)) * 100)).toFixed(0);
```

**公式解釋：**
- `distance / 2` = 正規化距離（假設最大距離約為 2）
- `1 - (distance / 2)` = 相似度比例（0 到 1）
- `* 100` = 百分比
- `Math.max(0, ...)` = 防止負數

**距離對應的相似度：**
| 距離 | 相似度 |
|------|--------|
| 0 | 100% |
| 0.5 | 75% |
| 1.0 | 50% |
| 1.5 | 25% |
| 2.0+ | ≤0% (歸零) |

---

## 🔌 啟用方式

### 訪問 URL

```
基礎:
http://localhost:5173/?search_mode=true

帶自訂 API 基址:
http://localhost:5173/?search_mode=true&api=http://localhost:8000

帶自訂圖像基址:
http://localhost:5173/?search_mode=true&images=/api/generated/
```

### 環境變數

在 `.env` 或 `vite.config.js` 中設置：

```env
VITE_API_BASE=http://localhost:8000
VITE_IMAGES_BASE=/generated_images/
```

---

## ⚙️ 核心邏輯流程圖

```
SearchMode.jsx
│
├─ 初始化狀態
│  ├─ searchType: "image"
│  ├─ selectedFile: null
│  ├─ textQuery: ""
│  ├─ searching: false
│  ├─ results: []
│  └─ error: null
│
├─ 渲染 UI
│  ├─ header (標題)
│  ├─ modeSelector (切換按鈕)
│  ├─ 條件渲染搜尋區
│  │  ├─ IF searchType === "image"
│  │  │  ├─ uploadArea
│  │  │  │  ├─ 預覽（如果有檔案）
│  │  │  │  └─ 上傳提示（如果無檔案）
│  │  │  └─ controls (搜尋/清除按鈕)
│  │  └─ IF searchType === "text"
│  │     ├─ textSearchArea
│  │     │  └─ textInput (可 Enter)
│  │     └─ controls (搜尋/清除按鈕)
│  ├─ errorArea (條件顯示)
│  └─ resultsGrid (條件顯示)
│     └─ 卡片列表
│
└─ 事件處理
   ├─ 模式切換: setSearchType()
   ├─ 以圖搜圖
   │  ├─ handleFileSelect(): FileReader → preview
   │  ├─ handleImageSearch(): 上傳 → 搜尋
   │  └─ handleClear(): 清空狀態
   └─ 文字搜尋
      ├─ handleTextSearch(): 直接搜尋
      ├─ handleKeyPress(): Enter 觸發
      └─ handleTextClear(): 清空狀態
```

---

## 🐛 可能的改進

1. **拖放上傳** - 目前只支援點擊，可添加拖放事件
2. **批量搜尋** - 可支援多圖同時搜尋
3. **搜尋歷史** - 保存搜尋記錄
4. **結果篩選** - 按相似度、時間篩選
5. **全螢幕預覽** - 結果卡片可點擊放大

---

## 📝 文件位置參考

- **前端搜尋元件**: `frontend/src/SearchMode.jsx` (492 行)
- **主應用程式**: `frontend/src/App.jsx` (第 46, 469-471 行)
- **API 包裝**: `frontend/src/api.js`
- **後端搜尋 API**:
  - `backend/app/main.py` - 端點定義
  - `backend/app/services/vector_store.py` - 搜尋邏輯
  - `backend/app/utils/embeddings.py` - OpenAI 嵌入

