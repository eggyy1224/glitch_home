# Slide Mode 兩種播放模式的詳細對比與問題分析

## 🔬 深度代碼追蹤

### Vector Mode 的實際執行步驟

```
步驟 1: 取得搜尋結果
————————————————————
searchImagesByImage("backend/offspring_images/offspring_X.png", 15)
  ↓
[Backend: vector_store.search_images_by_image]
  1. 計算 offspring_X 的向量 embedding
  2. Chroma VectorDB 查詢 (cosine distance)
  3. 返回前 15 個最相似的圖像 (按 distance 遞增)
  
範例返回：
{
  results: [
    {id: "offspring_A.png", distance: 0.0523},
    {id: "offspring_B.png", distance: 0.0687},
    {id: "offspring_C.png", distance: 0.0891},
    {id: "offspring_D.png", distance: 0.1204},
    {id: "offspring_E.png", distance: 0.1456},
    ...
    {id: "offspring_O.png", distance: 0.9876}
  ]
}

步驟 2: 前端接收並提取
————————————————————
prepared[] = [
  {id: "offspring_A.png", cleanId: "offspring_A.png", distance: 0.0523},
  {id: "offspring_B.png", cleanId: "offspring_B.png", distance: 0.0687},
  {id: "offspring_C.png", cleanId: "offspring_C.png", distance: 0.0891},
  ...
]

步驟 3: 應用 DISPLAY_ORDER 重排
————————————————————
DISPLAY_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

ordered[] = []
seen = new Set()

forEach i in [0, 1, 2, 3, ...]:
  entry = prepared[i]
  if entry exists and not in seen:
    ordered.push(entry)
    seen.add(entry.cleanId)

結果: ordered = [prepared[0], prepared[1], prepared[2], ...]
      （等同於原序，沒有變化！）

步驟 4: 補充缺失
————————————————————
prepared.forEach(entry => {
  if (!seen.has(entry.cleanId)):
    ordered.push(entry)
    seen.add(entry.cleanId)
})

結果: 由於步驟 3 已全部加入，此步驟通常無作用

步驟 5: 加入錨點
————————————————————
if (!seen.has(imageId)):
  ordered.unshift({id: imageId, cleanId: imageId, distance: null})

最終: [
  {id: "offspring_X.png", cleanId: "offspring_X.png", distance: null},  ← 新加入
  {id: "offspring_A.png", cleanId: "offspring_A.png", distance: 0.0523},
  {id: "offspring_B.png", cleanId: "offspring_B.png", distance: 0.0687},
  ...
]

播放順序: X → A → B → C → D → E → ... → O（15張）
```

---

## 👨‍👩‍👧‍👦 Kinship Mode 的實際執行步驟

```
步驟 1: 取得親緣數據
————————————————————
fetchKinship("offspring_X.png", -1)  // -1 表示深度無限
  ↓
[Backend: api_kinship]
  1. 載入所有 metadata JSON 文件
  2. 找出 offspring_X 的父母
  3. 遞歸找出所有祖先、兄妹、子代、相關圖像
  
返回結構：
{
  original_image: "offspring_X.png",
  children: ["offspring_CHILD1.png", "offspring_CHILD2.png"],
  siblings: ["offspring_SIB1.png", "offspring_SIB2.png"],
  parents: ["photo_PARENT1.jpg", "photo_PARENT2.jpg"],
  ancestors_by_level: [
    ["photo_PARENT1.jpg", "photo_PARENT2.jpg"],  // level 1
    ["photo_GRANDPA.jpg", "photo_GRANDMA.jpg"]   // level 2
  ],
  ancestors: ["photo_PARENT1.jpg", ..., "photo_GRANDPA.jpg", ...],
  related_images: ["offspring_COUSIN.png", ...]
}

步驟 2: 優先級合併
————————————————————
ordered[] = []
seen = new Set()

pushList = (arr) => {
  arr.forEach(item => {
    clean = cleanId(item)
    if clean and not in seen:
      ordered.push({id: clean, cleanId: clean, distance: null})
      seen.add(clean)
  })
}

pushList(children)          // 優先級 1
pushList(siblings)          // 優先級 2
pushList(parents)           // 優先級 3
ancestorsLevels.forEach(pushList)  // 優先級 4
pushList(ancestors)         // 優先級 5
pushList(related)           // 優先級 6

結果: ordered = [
  offspring_CHILD1,
  offspring_CHILD2,
  offspring_SIB1,
  offspring_SIB2,
  photo_PARENT1,
  photo_PARENT2,
  photo_GRANDPA,
  photo_GRANDMA,
  offspring_COUSIN,
  ...
]

步驟 3: 加入原始圖像
————————————————————
originalClean = "offspring_X.png"
if not in seen:
  ordered.unshift(originalClean)

最終: [
  offspring_X,          ← 錨點在最前
  offspring_CHILD1,
  offspring_CHILD2,
  offspring_SIB1,
  offspring_SIB2,
  photo_PARENT1,
  photo_PARENT2,
  photo_GRANDPA,
  photo_GRANDMA,
  offspring_COUSIN
]
```

---

## ⚡ 性能與邏輯對比

### 向量搜尋 (Vector Mode)

| 面向 | 詳情 |
|------|------|
| **速度** | 快（直接查 VectorDB） |
| **順序依據** | 向量相似度距離（cosine distance） |
| **重排邏輯** | `DISPLAY_ORDER` (實際無效) |
| **結果穩定性** | 高（同一圖像搜尋結果一致） |
| **視覺邏輯** | 基於視覺/風格相似性 |
| **循環特性** | 最後一張 → 新錨點 → 新搜尋 |

**範例流程：**
```
X (查詢)
↓
找到相似度最近的 15 張
↓
返回: [A(0.05), B(0.07), C(0.09), ...]
↓
保持原序播放
↓
到 O 後 → 以 O 為新中心搜尋 → 可能找到 P, Q, R ...
↓
發散探索（可能越來越遠）
```

---

### 親緣關係 (Kinship Mode)

| 面向 | 詳情 |
|------|------|
| **速度** | 中等（JSON 遍歷 + 遞歸） |
| **順序依據** | 親緣關係層級（語義相關性） |
| **優先級** | 子代 > 兄妹 > 父母 > 祖先 > 其他 |
| **結果變異性** | 中等（取決於 metadata 完整性） |
| **視覺邏輯** | 基於血緣/生成歷史 |
| **循環特性** | 最後一張 → 新錨點 → 可能跳出族譜 |

**範例流程：**
```
X (查詢，假設 X 有多代親屬)
↓
找出所有親緣關係
↓
優先順序排列：
  1. X 的孩子
  2. X 的兄妹
  3. X 的父母
  4. 祖先層級
  5. 相關圖像
↓
返回: [X, CHILD1, CHILD2, SIB1, PARENT, GRANDPA, ...]
↓
播放序列講述親族故事
↓
到 GRANDPA 後 → 以 GRANDPA 為錨點 → 找其他親屬
↓
可能回到同宗的其他分支或上溯更高祖先
```

---

## 🚨 發現的問題與邊界情況

### 問題 A：DISPLAY_ORDER 的真正用途不明

**代碼：**
```javascript
const DISPLAY_ORDER = Array.from({ length: 15 }, (_, i) => i);
// → [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

DISPLAY_ORDER.forEach((i) => {
  const entry = prepared[i];
  if (!entry || seen.has(entry.cleanId)) return;
  ordered.push(entry);
  seen.add(entry.cleanId);
});
```

**分析：**
- 這個邏輯等同於直接迴圈 `prepared` 本身
- 沒有實現任何重新排序
- 可能原意是想隨機化或按某種特殊順序排列？

**假設猜測：**
1. **隨機排序版本？**
   ```javascript
   const DISPLAY_ORDER = [3, 1, 14, 7, 2, 9, ...];
   // 打亂順序以增加多樣性
   ```

2. **距離優先排序？**
   ```javascript
   // 先播放最近的，後播放較遠的
   const ordered = prepared.sort((a, b) => 
    (a.distance - b.distance)
   );
   ```

---

### 問題 B：循環播放的"漂流"現象

**現象：**
```
初始: X (選定的圖像)
第一輪: X → A → B → C → D → E (最相似的 5 張)
循環完成, E 成為新錨點
第二輪: E → F → G → H → I → J (與 E 相似的 5 張)
...
第 N 輪: (可能已經離 X 很遠)
```

**潛在風險：**
- ✅ 適合探索和發現
- ⚠️ 可能偏離原始主題
- ❌ 無法回溯到起點

**解決方案：**
```javascript
// 選項 1：固定回到原始錨點
if (next >= items.length) {
  setIndex(0);  // 簡單循環，不改變錨點
  return;
}

// 選項 2：每 N 次循環後回到起點
if (cycleCount % 3 === 0) {
  setAnchor(originalAnchor);  // 重置
  cycleCount = 0;
}
```

---

### 問題 C：Kinship 模式的"卡死"情況

**情景：**
```
某圖像沒有父母（是根圖像）
↓
siblings, parents, ancestors 都為空
↓
只有 related_images
↓
可能陷入單一分支死循環
```

**程式碼片段：**
```javascript
const children = data?.children || [];
const siblings = data?.siblings || [];
const parents = data?.parents || [];
// ...

if (finalList.length === 0 && originalClean) {
  finalList.push({...});  // 退而求其次
}
```

**改進建議：**
```javascript
// 確保至少返回有意義的播放列表
if (finalList.length < 3) {
  // 補充相關圖像或其他父母的後代
  const backup = data?.related_images || [];
  backup.forEach(img => {
    if (finalList.length >= 5) return;
    finalList.push({id: cleanId(img), ...});
  });
}
```

---

### 問題 D：向量搜尋的"相似陷阱"

**情景：**
```
搜尋風格相似的圖像 (如都是"紅色系")
↓
結果可能全是紅色系圖像
↓
視覺單調，缺乏多樣性
```

**解決方案：**
```javascript
// 方案 1：結果多樣化
const diverse = [];
const seen_hues = new Set();
prepared.forEach(item => {
  if (diverse.length >= 5) return;
  const hue = item.metadata?.dominant_hue;
  if (!seen_hues.has(hue)) {
    diverse.push(item);
    seen_hues.add(hue);
  }
});

// 方案 2：結果混淆
const shuffled = prepared
  .slice(0, 10)
  .sort(() => Math.random() - 0.5)
  .concat(prepared.slice(10, 15));
```

---

## 📈 建議的改進方案

### 改進 1：讓 DISPLAY_ORDER 有實際用處

```javascript
// 當前（無用）
const DISPLAY_ORDER = [0, 1, 2, ..., 14];

// 改進1：隨機訪問
function generateRandomOrder(max = 15) {
  return Array.from({length: max}, (_, i) => i)
    .sort(() => Math.random() - 0.5);
}

// 改進2：打散相似結果
function generateDiverseOrder(results, diversity = 'medium') {
  if (diversity === 'high') {
    return [0, 7, 2, 12, 4, 14, 1, 9, 3, 11, 5, 13, 6, 8, 10];
  }
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
}

// 改進3：質量優先
function generateQualityOrder(results) {
  // 優先顯示距離 < 0.1 的結果
  const high = results.filter(r => r.distance < 0.1);
  const mid = results.filter(r => 0.1 <= r.distance < 0.3);
  return [...high, ...mid];
}
```

### 改進 2：可配置的循環行為

```javascript
const SlideMode = ({
  loopBehavior = 'continuous',  // 'continuous' | 'reset' | 'manual'
  maxCycles = null,             // null = 無限
  resetToAnchor = false         // 每 N 輪重置
}) => {
  
  const [cycleCount, setCycleCount] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => {
        const next = prev + 1;
        if (next >= items.length) {
          // 循環完成邏輯
          if (loopBehavior === 'reset') {
            return 0;  // 重置到開始，但不改變錨點
          } else if (loopBehavior === 'continuous') {
            // 原始邏輯：最後一張變新錨點
            const last = items[items.length - 1];
            setAnchor(last.cleanId);
            return 0;
          }
          return 0;
        }
        return next;
      });
      
      if ((next % items.length) === 0) {
        setCycleCount(prev => prev + 1);
      }
    }, intervalMs);
    
    return () => clearInterval(timer);
  }, [items, loopBehavior]);
};
```

### 改進 3：更好的 Kinship 備選方案

```javascript
function buildKinshipPlaylist(data, maxLength = 15) {
  const ordered = [];
  const seen = new Set();
  
  // 核心親族
  pushUnique(ordered, seen, data.children);
  pushUnique(ordered, seen, data.siblings);
  pushUnique(ordered, seen, data.parents);
  
  // 如果仍然不足，加入祖先
  if (ordered.length < 5) {
    data.ancestors_by_level?.forEach(level => {
      pushUnique(ordered, seen, level);
    });
  }
  
  // 最後才用 related
  if (ordered.length < maxLength) {
    pushUnique(ordered, seen, data.related_images);
  }
  
  return ordered.slice(0, maxLength);
}

function pushUnique(arr, seen, items) {
  (items || []).forEach(item => {
    const clean = cleanId(item);
    if (clean && !seen.has(clean)) {
      arr.push({id: clean, cleanId: clean, distance: null});
      seen.add(clean);
    }
  });
}
```

---

## 📊 模式選擇建議

### 何時用 Vector Mode
- 🎨 探索視覺風格相近的圖像
- 📸 尋找構圖相似的作品
- 🌈 色彩主題探索
- 💡 發現視覺靈感

### 何時用 Kinship Mode
- 📖 理解圖像的生成歷史
- 👨‍👩‍👧‍👦 追蹤血緣關係和演化
- 🧬 觀察遺傳特徵傳遞
- 🔍 回溯親代或探索後代

---

## 🎯 總結

| 維度 | Vector | Kinship |
|------|--------|---------|
| **性能** | ⭐⭐⭐⭐ 快 | ⭐⭐⭐ 中等 |
| **邏輯清晰度** | ⭐⭐ 低（DISPLAY_ORDER 困惑） | ⭐⭐⭐⭐ 高 |
| **結果可預測性** | ⭐⭐⭐ 中 | ⭐⭐⭐⭐ 高 |
| **探索多樣性** | ⭐⭐⭐⭐ 高 | ⭐⭐⭐ 中 |
| **適合交互藝術** | ⭐⭐⭐⭐⭐ 非常好 | ⭐⭐⭐⭐ 好 |

