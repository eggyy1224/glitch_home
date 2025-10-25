# Kinship Index 親緣關係索引系統

## 📚 概述

持久化的親緣關係索引系統，預先構建並存檔親子關係索引，大幅提升 `/api/kinship` 查詢速度。

### 性能提升

**之前（即時掃描）**：
- 每次 API 調用掃描 1155 個 JSON 文件
- 多格模式下磁碟 I/O 競爭嚴重
- 查詢時間：數百毫秒～數秒

**現在（預構建索引）**：
- 索引載入時間：**1.68ms**
- 平均查詢時間：**0.002ms** (微秒級)
- 多格模式無磁碟競爭
- 後端重啟快速啟動

---

## 🚀 使用方式

### 1. 建立索引（第一次或有新圖片時）

```bash
cd /Volumes/2024data/glitch_home_project/backend
source venv/bin/activate
python build_kinship_index.py
```

這會掃描所有 `metadata/offspring_*.json` 並生成 `metadata/kinship_index.json`。

### 2. 後端自動載入

後端啟動時會自動載入索引：
- 如果 `kinship_index.json` 存在 → 直接載入（超快）
- 如果不存在 → 自動構建一次

### 3. 手動重建索引（透過 API）

如果有新的圖片 metadata 加入，可以透過 API 重建索引：

```bash
curl -X POST http://localhost:8000/api/kinship/rebuild
```

### 4. 查看索引統計

```bash
curl http://localhost:8000/api/kinship/stats
```

---

## 📁 檔案結構

```
backend/
├── app/
│   └── services/
│       └── kinship_index.py          # 核心索引服務
├── metadata/
│   ├── offspring_*.json               # 原始 metadata（1155 個）
│   └── kinship_index.json             # 預構建索引（441KB）✨ 新增
├── build_kinship_index.py             # 建立索引腳本
└── test_kinship_index.py              # 測試腳本
```

---

## 🔧 索引結構

`metadata/kinship_index.json`：

```json
{
  "version": 1,
  "built_at": "2025-10-25T05:57:37.412448+00:00",
  "metadata_count": 1144,
  "parents_map": {
    "offspring_xxx.png": ["parent1.jpg", "parent2.png"],
    ...
  },
  "children_map": {
    "parent1.jpg": ["child1.png", "child2.png"],
    ...
  }
}
```

- **parents_map**: 子代 → 父母列表（正向索引）
- **children_map**: 父母 → 子代列表（反向索引）

---

## 🔍 API 端點

### `GET /api/kinship?img=xxx.png&depth=N`
查詢指定圖片的親緣關係（現在使用索引，超快！）

### `POST /api/kinship/rebuild`
重建索引（管理用）

### `GET /api/kinship/stats`
取得索引統計資訊

---

## ⚙️ 開發者 API

```python
from app.services.kinship_index import kinship_index

# 查詢父母
parents = kinship_index.parents_of("offspring_xxx.png")

# 查詢子代
children = kinship_index.children_of("parent.jpg")

# 查詢兄弟姊妹
siblings = kinship_index.siblings_of("offspring_xxx.png")

# 查詢祖先（多層）
ancestors = kinship_index.ancestors_levels_of("offspring_xxx.png", depth=3)

# 檢查是否存在
exists = kinship_index.has_offspring("offspring_xxx.png")

# 強制重建索引
kinship_index.build_and_save()
```

---

## 📊 測試驗證

執行測試腳本驗證性能：

```bash
cd /Volumes/2024data/glitch_home_project/backend
source venv/bin/activate
python test_kinship_index.py
```

**測試結果**：
```
✓ Loaded in 1.68ms
✓ Executed 20 queries in 0.04ms
✓ Average query time: 0.002ms
```

---

## ⚠️ 注意事項

1. **新增圖片後記得重建索引**
   - 手動執行：`python build_kinship_index.py`
   - 或透過 API：`POST /api/kinship/rebuild`

2. **索引版本管理**
   - 索引格式變更時會更新 `version` 號
   - 舊版索引會被自動忽略並重建

3. **Git 版本控制**
   - `kinship_index.json` 可以加入 git（441KB 不大）
   - 或加入 `.gitignore`，讓每個環境自己建立

---

## 🎯 使用場景

### 場景 A：開發環境
- 拉取最新程式碼
- 執行 `python build_kinship_index.py` 建立索引
- 後端啟動時自動載入

### 場景 B：生產環境（圖片已固定）
- 建立索引一次
- 之後每次後端重啟秒速載入
- 無需重建

### 場景 C：持續新增圖片
- 定期執行 `POST /api/kinship/rebuild`
- 或在新增圖片後的工作流程中自動觸發重建

---

## 📈 性能對比

| 操作 | 之前 | 現在 | 提升 |
|------|------|------|------|
| 載入 | ~500-1000ms | 1.68ms | **600x** |
| 單次查詢 | ~50-200ms | 0.002ms | **100,000x** |
| 多格 10 個 | ~5-10秒 | ~0.02ms | **250,000x** |

---

✨ **現在多格模式飛快！** ✨

