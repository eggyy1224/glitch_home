# Slide Mode 播放順序分析報告

## 📊 核心機制概述

SlideMode 有 **兩種播放模式**，每種都有不同的排序邏輯：

```
┌─────────────────────────────────────────────┐
│           SlideMode 播放流程                  │
├─────────────────────────────────────────────┤
│ 1. 用戶輸入錨點圖像 (anchorImage)            │
│ 2. 讀取 URL 參數 slide_source                │
│ 3. 根據模式選擇搜尋方法                       │
│ 4. 按特定順序排列結果                         │
│ 5. 自動循環播放（每 3s 換圖）                 │
│ 6. 循環完成後 → 最後一張圖成為新錨點           │
└─────────────────────────────────────────────┘
```

---

## 🎯 模式 1：Vector Mode（向量搜尋）

### 播放順序流程圖
```
API 返回結果 (前15張)
     ↓
DISPLAY_ORDER 重排（固定順序）
  ↓    ↓    ↓    ↓    ↓
  0    1    2    3    4  ...  14
     ↓
缺失的追補
     ↓
去重処理
     ↓
加入錨點圖像（放在最前）
     ↓
最終播放列表（最多15張）
```

### 程式碼分析

**第1層：DISPLAY_ORDER 硬編碼**
```javascript
const DISPLAY_ORDER = Array.from({ length: 15 }, (_, i) => i);
// 結果：[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
```

**第2層：搜尋結果重排**
```javascript
// 從後端獲得 prepared[] 陣列（由相似度排序）
DISPLAY_ORDER.forEach((i) => {
  const entry = prepared[i];  // 按固定順序取值
  if (!entry || seen.has(entry.cleanId)) return;
  ordered.push(entry);        // 添加到播放列表
  seen.add(entry.cleanId);
});
```

**第3層：補充缺失的圖像**
```javascript
// 如果某些位置沒有結果，全部加入
prepared.forEach((entry) => {
  if (!seen.has(entry.cleanId)) {
    ordered.push(entry);
  }
});
```

**第4層：加入錨點**
```javascript
// 錨點圖像放在最前
if (!seen.has(imageId)) {
  ordered.unshift({ id: imageId, cleanId: imageId, distance: null });
}
```

### 範例演示

**API 返回（15 個相似圖像）：**
```
[
  {id: "offspring_A", distance: 0.05},
  {id: "offspring_B", distance: 0.08},
  {id: "offspring_C", distance: 0.12},
  ...
  {id: "offspring_O", distance: 0.95}
]
```

**DISPLAY_ORDER 重排後：**
```
DISPLAY_ORDER[0]  → prepared[0]  → offspring_A
DISPLAY_ORDER[1]  → prepared[1]  → offspring_B
DISPLAY_ORDER[2]  → prepared[2]  → offspring_C
...
DISPLAY_ORDER[14] → prepared[14] → offspring_O
```

**最終播放順序：**
```
[
  {id: "offspring_ANCHOR", distance: null},  ← 錨點在最前
  {id: "offspring_A", distance: 0.05},
  {id: "offspring_B", distance: 0.08},
  {id: "offspring_C", distance: 0.12},
  ...
]
```

---

## 👨‍👩‍👧‍👦 模式 2：Kinship Mode（親緣關係）

### 播放順序流程圖
```
API 返回親緣數據 (children, parents, siblings, etc.)
     ↓
按優先級合併
  1. 子代     (children)
  2. 兄妹     (siblings)
  3. 父母     (parents)
  4. 祖先層級  (ancestors_by_level)
  5. 所有祖先  (ancestors)
  6. 相關圖像  (related_images)
     ↓
去重処理 (使用 Set)
     ↓
加入原始圖像（放在最前）
     ↓
最終播放列表（最多15張）
```

### 程式碼分析

**親緣優先級：**
```javascript
pushList(children);           // 優先級 1：直接後代
pushList(siblings);           // 優先級 2：兄妹
pushList(parents);            // 優先級 3：父母
ancestorsLevels.forEach(...); // 優先級 4：按層級的祖先
pushList(ancestors);          // 優先級 5：所有祖先
pushList(related);            // 優先級 6：其他相關圖像
```

**去重邏輯：**
```javascript
const pushList = (arr) => {
  (arr || []).forEach((item) => {
    const clean = cleanId(item);
    if (!clean || seen.has(clean)) return;  // 跳過重複
    ordered.push({ id: clean, cleanId: clean, distance: null });
    seen.add(clean);
  });
};
```

### 範例演示

**假設親緣樹：**
```
         grandparent_A
              ↓
      parent_1  parent_2
         ↓    ↙
       ANCHOR (offspring_X)
         ↓
    child_1, child_2
         
    sibling_1, sibling_2 (同父母)
```

**API 返回：**
```javascript
{
  children: ["child_1.png", "child_2.png"],
  siblings: ["sibling_1.png", "sibling_2.png"],
  parents: ["parent_1.png", "parent_2.png"],
  ancestors_by_level: [
    ["parent_1.png", "parent_2.png"],  // level 1
    ["grandparent_A.png"]               // level 2
  ],
  ancestors: ["parent_1.png", "parent_2.png", "grandparent_A.png"],
  related_images: ["cousin.png", "distant.png"]
}
```

**最終播放順序：**
```
1. offspring_X (原始/錨點)
2. child_1.png
3. child_2.png
4. sibling_1.png
5. sibling_2.png
6. parent_1.png
7. parent_2.png
8. grandparent_A.png
9. cousin.png
10. distant.png
```

---

## 🔄 循環播放機制

### 自動循環邏輯
```javascript
useEffect(() => {
  if (items.length <= 1) return undefined;
  
  const timer = setInterval(() => {
    setIndex((prev) => {
      const next = prev + 1;
      
      if (next >= items.length) {
        // 循環完成！最後一張圖變成新錨點
        const last = items[items.length - 1];
        if (last?.cleanId) {
          setAnchor(last.cleanId);        // 更新錨點
          setGeneration((g) => g + 1);    // 觸發重新搜尋
        }
        return 0;  // 重置到開始
      }
      return next;
    });
  }, Math.max(1000, intervalMs));  // 預設 3000ms
  
  return () => clearInterval(timer);
}, [items, intervalMs]);
```

### 循環演示
```
初始錨點：offspring_X
  ↓
播放列表：[offspring_X, A, B, C, D, E]（6張圖）
  ↓
播放進度：
  0 → offspring_X  (0s)
  1 → A           (3s)
  2 → B           (6s)
  3 → C           (9s)
  4 → D          (12s)
  5 → E          (15s)
  ↓ 循環完成！
  新錨點 = E
  ↓
重新搜尋：以 E 為中心查找相關圖像
  ↓
播放列表：[E, F, G, H, I, J]（新列表）
  ↓
繼續播放...（無限循環）
```

---

## ⚙️ 關鍵配置

| 配置項 | 值 | 含義 |
|-------|-----|------|
| `BATCH_SIZE` | 15 | 最多加載 15 張圖像 |
| `DISPLAY_ORDER` | [0,1,...,14] | 向量模式的排序模板 |
| `intervalMs` | 3000 (ms) | 每張圖顯示 3 秒 |
| `sourceMode` | "vector" \| "kinship" | 搜尋模式選擇 |

---

## 🚀 URL 參數控制

### 完整 URL 範例
```
http://localhost:5173/?mode=slide&img=offspring_20250923_161624_066.png&slide_source=kinship&interval=4000
```

### 參數說明

| 參數 | 預設值 | 用途 |
|------|-------|------|
| `mode=slide` | N/A | 啟用 Slide Mode |
| `img=...` | 無 | 錨點圖像（必需） |
| `slide_source` | "vector" | "vector" 或 "kinship" |
| `interval` | 3000 | 播放間隔（毫秒） |

### 使用場景

**純向量搜尋（相似度）：**
```
?mode=slide&img=offspring_xxx.png&slide_source=vector
```

**親緣關係走訪：**
```
?mode=slide&img=offspring_xxx.png&slide_source=kinship
```

**慢速播放（5秒/張）：**
```
?mode=slide&img=offspring_xxx.png&interval=5000
```

---

## 🎨 UI 交互

### 快捷鍵
| 按鍵 | 功能 |
|------|------|
| `Ctrl + R` | 切換字幕顯示 |

### 字幕內容
```
顯示格式：{當前位置}/{總數} · {圖像名稱}

範例：2/15 · offspring_20250923_161624_066.png
```

---

## 🔍 潛在問題分析

### 問題 1：DISPLAY_ORDER 的意義不明確
**現況：** 硬編碼 [0,1,2,...,14]，實際上就是保持原序
**假設：** 可能原本想要實現某種重排邏輯（如距離排序）
**改進建議：** 
```javascript
// 可能的改進：按相似度排序
const ordered = prepared
  .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity))
  .slice(0, BATCH_SIZE);
```

### 問題 2：循環時最後一張變錨點
**現況：** 每次播放完整清單後，最後一張圖自動成為新錨點
**影響：** 會產生探索效應（不斷發現新圖），但也可能導致流浪
**使用場景：** 
- ✅ 適合發現/探索模式
- ❌ 不適合重複同一主題

### 問題 3：Kinship 模式的去重邏輯
**現況：** 親緣關係中，同一圖像可能出現在多個分類（如既是兄妹又是親戚）
**現有機制：** 使用 `Set` 確保只出現一次，但用的是優先級順序
**結果：** 子代 > 兄妹 > 父母 > 祖先 > 其他

---

## 💾 數據流向

```
User Input (URL params)
    ↓
SlideMode Component
    ↓
performSearch() 
    ↓
┌─────────────────┬──────────────────┐
│                 │                  │
Vector Mode       Kinship Mode
searchImagesByImage()  fetchKinship()
    ↓                     ↓
Backend: /api/search/image  /api/kinship
    ↓                     ↓
Chroma VectorDB    Metadata JSON
    ↓                     ↓
Results + Distance  Results + Relationships
    ↓                     ↓
Frontend: Reorder + Dedup
    ↓
items[] 播放列表
    ↓
setInterval() 自動循環
    ↓
到達終點 → 設置新錨點 → 重新搜尋
```

