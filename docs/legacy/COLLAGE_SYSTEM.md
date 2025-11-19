# Collage 拼貼系統文檔

> **版本**: 1.0  
> **最後更新**: 2025-11-04

---

## 概述

Collage 系統提供兩種拼貼功能：
1. **Collage Mode（拼貼模式）**：將多張圖像以網格方式拼貼成單一畫面
2. **Collage Version（拼貼版本）**：將多張圖像切片後重新組合，產生新的拼貼版本

---

## Collage Mode（拼貼模式）

### 功能說明

Collage Mode 將多張圖像以網格方式排列，形成一個大型拼貼牆。支援遠端配置，可透過 API 即時更新顯示內容。

### 前端啟用

在 URL 中加入參數：
```
/?collage_mode=true&client=<client_id>
```

### 配置參數

| 參數 | 類型 | 說明 | 預設值 |
|------|------|------|--------|
| `images` | string[] | 圖像檔名列表（自動去除路徑、去重） | [] |
| `image_count` | number | 圖像數量（1-30，若超出會壓回） | 4 |
| `rows` | number | 網格行數（1-96） | 3 |
| `cols` | number | 網格列數（1-96） | 3 |
| `mix` | boolean | 是否混合排列（`true` 時會依 seed 打散） | false |
| `stage_width` | number | 畫布寬度（360-3840 px） | 960 |
| `stage_height` | number | 畫布高度（240-2160 px） | 540 |
| `seed` | number | 隨機種子（僅 `mix=true` 有效） | `null` |

### API 使用

#### 取得配置
```bash
GET /api/collage-config?client=<client_id>
```

#### 更新配置
```bash
PUT /api/collage-config
Content-Type: application/json

{
  "target_client_id": "desktop_wall",  // 可選
  "images": ["offspring_xxx.png", "offspring_yyy.png", ...],
  "image_count": 20,
  "rows": 5,
  "cols": 8,
  "mix": true,
  "stage_width": 2048,
  "stage_height": 1152,
  "seed": 987123
}
```

### 配置儲存

- **全域配置**: `backend/metadata/collage_config.json`
- **客戶端專屬**: `backend/metadata/collage_config__<client>.json`

### WebSocket 推送

更新配置後，會透過 WebSocket 廣播 `collage_config` 訊息：
```json
{
  "type": "collage_config",
  "target_client_id": "desktop_wall",
  "config": {
    "images": [...],
    "image_count": 20,
    "rows": 5,
    "cols": 8,
    "mix": true,
    "stage_width": 2048,
    "stage_height": 1152,
    "seed": 987123
  }
}
```

---

## Collage Version（拼貼版本生成）

### 功能說明

Collage Version 將多張圖像切片後，根據不同的匹配模式重新組合，產生新的拼貼圖像。這是一個非同步生成過程，支援進度追蹤，並在 `allow_self=true` 或 `rotate-90` 模式時允許單張圖像輸入。

### 匹配模式

#### 1. kinship（親緣匹配）
- **原理**: 以邊緣顏色距離匹配，偏好與已放置鄰居色彩接近者
- **效果**: 局部縫合最佳，產生自然的過渡
- **適用**: 希望圖像間有平滑過渡的場景

#### 2. luminance（亮度匹配）
- **原理**: 最小化亮度差（鄰居/基底）
- **效果**: 產生強烈的明暗節律，常見垂直柱狀結構
- **適用**: 希望產生強烈視覺節奏的場景

#### 3. wave（波浪匹配）
- **原理**: 由中心向外的 BFS 順序放置
- **效果**: 形成方向性條帶
- **適用**: 希望產生方向性流動感的場景

#### 4. source-cluster（來源聚塊）
- **原理**: 以來源圖為單位設置種子，對最近種子區域優先放同源 tile
- **效果**: 語義連續的大區塊，同源圖像會聚在一起
- **適用**: 希望保持圖像語義連續性的場景

#### 5. random（隨機）
- **原理**: 隨機排列，僅保證種子重現性
- **效果**: 基準對照，無特定模式
- **適用**: 測試或對照組

#### 6. weave（編織）
- **原理**: 依序從不同來源圖取用 tiles，形成交錯條帶；不會排除基準圖
- **效果**: 呈現織物般的節奏感，來源圖會平均分佈
- **適用**: 想強調多重來源並維持一致節奏時

#### 7. rotate-90（單圖旋轉）
- **原理**: 僅使用單張圖像，將每個切片獨立旋轉 90° 後放回原格
- **效果**: 保留原圖顏色但增加方向性紋理與節奏
- **適用**: 現場只有一張圖或想快速產生實驗性變化

### 前端啟用

在 URL 中加入參數：
```
/?collage_version_mode=true
```

### API 使用

#### 建立生成任務
```bash
POST /api/generate-collage-version
Content-Type: application/json

{
  "image_names": [
    "offspring_20250929_114940_017.png",
    "offspring_20250923_161624_066.png",
    "offspring_20250927_141336_787.png"
  ],
  "rows": 12,
  "cols": 16,
  "mode": "kinship",
  "base": "first",                // 可選：first 或 mean
  "allow_self": false,             // 可選：是否允許重用基準圖 tiles
  "resize_w": 2048,                // 可選：輸出寬度 (256-8192)
  "pad_px": 0,                     // 可選：填充像素 (0-100)
  "jitter_px": 0,                  // 可選：抖動像素 (0-50)
  "rotate_deg": 0,                 // 可選：旋轉角度 (0-45)
  "format": "png",                 // 可選：png, jpg, webp
  "quality": 92,                   // 可選：jpg/webp 品質（1-100）
  "seed": 123456,                  // 可選：隨機種子
  "return_map": false              // 可選：是否返回 tile 對應關係
}
```

**回應**:
```json
{
  "task_id": "uuid-task-id",
  "output_image_path": null,
  "metadata_path": null,
  "output_image": null,
  "parents": null,
  "output_format": null,
  "width": null,
  "height": null,
  "tile_mapping": null
}
```

#### 查詢進度
```bash
GET /api/collage-version/{task_id}/progress
```

**回應** (進行中):
```json
{
  "task_id": "uuid-task-id",
  "progress": 45,
  "stage": "matching",
  "message": "正在匹配切片...",
  "completed": false
}
```

**回應** (完成):
```json
{
  "task_id": "uuid-task-id",
  "progress": 100,
  "stage": "completed",
  "message": "生成完成",
  "completed": true,
  "output_image_path": "/abs/path/to/offspring_xxx.png",
  "metadata_path": "/abs/path/to/metadata/offspring_xxx.json",
  "output_image": "offspring_xxx.png",
  "parents": ["offspring_20250929_114940_017.png", ...],
  "output_format": "png",
  "width": 2048,
  "height": 1536,
  "tile_mapping": [...]  // 若 return_map=true
}
```

### 參數說明

| 參數 | 類型 | 說明 | 預設值 | 範圍 |
|------|------|------|--------|------|
| `image_names` | string[] | 圖像檔名列表（一般 ≥ 2；`rotate-90` 或 `allow_self=true` 可用單張） | - | - |
| `rows` | number | 切片行數 | 12 | 1-300 |
| `cols` | number | 切片列數 | 16 | 1-300 |
| `mode` | string | 匹配模式 | `kinship` | kinship, luminance, wave, source-cluster, random, weave, rotate-90 |
| `base` | string | 基準圖策略 | `first` | `first`, `mean` |
| `allow_self` | boolean | 是否允許重用基準圖 tiles | false | - |
| `resize_w` | number | 輸出寬度（px） | 2048 | 256-8192 |
| `pad_px` | number | 填充像素 | 0 | 0-100 |
| `jitter_px` | number | 抖動像素 | 0 | 0-50 |
| `rotate_deg` | number | 旋轉角度 | 0 | 0-45 |
| `format` | string | 輸出格式 | `png` | png, jpg, webp |
| `quality` | number | JPEG 品質 | 92 | 1-100 |
| `seed` | number | 隨機種子 | 隨機 | - |
| `return_map` | boolean | 是否返回 tile 對應關係 | false | - |

### 任務管理

- 任務在記憶體中管理（`CollageTaskManager`）
- 任務完成後會保留 5 分鐘，之後自動清理
- 重啟後任務會遺失（建議持久化或使用外部任務佇列）

### Metadata 結構

生成的拼貼版本會產生 metadata JSON，包含：
```json
{
  "parents": ["offspring_xxx.png", "offspring_yyy.png", ...],
  "model_name": "collage_version",
  "collage_params": {
    "mode": "kinship",
    "rows": 12,
    "cols": 16,
    "seed": 123456,
    "resize_w": 2048,
    "pad_px": 0,
    "jitter_px": 0,
    "rotate_deg": 0,
    "format": "png",
    "quality": 92
  },
  "created_at": "2025-11-04T12:34:56Z",
  "output_image": "offspring_xxx.png",
  "output_format": "png",
  "output_size": {"width": 2048, "height": 1536},
  "tile_mapping": [...]  // 若 return_map=true
}
```

---

## 使用範例

### 範例 1: 建立拼貼牆配置

```bash
curl -X PUT http://localhost:8000/api/collage-config \
  -H "Content-Type: application/json" \
  -d '{
    "target_client_id": "desktop_wall",
    "images": [
      "offspring_20250923_161624_066.png",
      "offspring_20250923_161704_451.png",
      "offspring_20250923_161747_194.png"
    ],
    "image_count": 20,
    "rows": 5,
    "cols": 8,
    "mix": true,
    "stage_width": 2048,
    "stage_height": 1152,
    "seed": 987123
  }'
```

### 範例 2: 生成拼貼版本（完整流程）

```bash
# 1. 建立任務
TASK_ID=$(curl -X POST http://localhost:8000/api/generate-collage-version \
  -H "Content-Type: application/json" \
  -d '{
    "image_names": [
      "offspring_20250929_114940_017.png",
      "offspring_20250923_161624_066.png",
      "offspring_20250927_141336_787.png"
    ],
    "rows": 12,
    "cols": 16,
    "mode": "kinship",
    "seed": 123456,
    "resize_w": 2048,
    "format": "png"
  }' | jq -r '.task_id')

# 2. 輪詢進度
while true; do
  PROGRESS=$(curl -s "http://localhost:8000/api/collage-version/$TASK_ID/progress")
  COMPLETED=$(echo $PROGRESS | jq -r '.completed')
  
  if [ "$COMPLETED" = "true" ]; then
    OUTPUT=$(echo $PROGRESS | jq -r '.output_image')
    echo "生成完成: $OUTPUT"
    break
  fi
  
  sleep 2
done
```

### 範例 3: 比較不同匹配模式

```bash
# 使用相同參數，只改變 mode
MODES=("kinship" "luminance" "wave" "source-cluster" "random")

for MODE in "${MODES[@]}"; do
  curl -X POST http://localhost:8000/api/generate-collage-version \
    -H "Content-Type: application/json" \
    -d "{
      \"image_names\": [\"offspring_xxx.png\", \"offspring_yyy.png\"],
      \"rows\": 12,
      \"cols\": 16,
      \"mode\": \"$MODE\",
      \"seed\": 123456
    }"
done
```

---

## 技術細節

### 實作位置

- **後端服務**: `backend/app/services/collage_version.py`
- **配置管理**: `backend/app/services/collage_config.py`
- **前端元件**: 
  - `frontend/src/CollageMode.jsx`
  - `frontend/src/CollageVersionMode.jsx`
- **API 路由**: `backend/app/api/media.py`、`backend/app/api/storage.py`

### 效能考量

- Collage Version 生成為 CPU 密集型任務，建議使用非同步處理
- 大型圖像（>2048px）可能需要較長處理時間
- 建議在生產環境使用外部任務佇列（如 Celery）

### 限制與注意事項

1. **任務持久化**: 目前任務僅存在記憶體中，重啟後會遺失
2. **圖像數量**: Collage Version 至少需要 2 張圖像（除非 `allow_self=true`）
3. **記憶體使用**: 大量圖像切片會消耗較多記憶體
4. **處理時間**: 複雜匹配模式（如 `source-cluster`）可能需要較長處理時間

---

## 參考資源

- [系統規格文件](../spec.md) - 完整的 API 規格
- [API 快速上手指南](./API_QUICK_START_GUIDE.md) - 快速開始範例
- [後端架構概論](./system_architecture/後端架構概論.md) - 技術實作細節

---

**文件結束**
