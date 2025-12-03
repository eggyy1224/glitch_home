# 圖像系譜學：AI 圖像循環生成與視覺化系統 - 系統規格文件

> **版本**: 2.1  
> **最後更新**: 2025-11-04  
> **狀態**: 基於實際程式碼重新撰寫

---

## 目錄

1. [專案概述](#專案概述)
2. [系統架構](#系統架構)
3. [核心功能模組](#核心功能模組)
4. [前端視覺化模式](#前端視覺化模式)
5. [後端 API 規格](#後端-api-規格)
6. [資料結構與儲存](#資料結構與儲存)
7. [技術棧與依賴](#技術棧與依賴)
8. [環境配置](#環境配置)
9. [部署架構](#部署架構)

---

## 專案概述

### 專案名稱
**圖像系譜學（Image Lineage / Kinship Viewer）**

### 核心理念
本專案是一個基於 AI 圖像生成的循環演化系統，透過 Google Gemini 模型進行圖像融合與進化，建立圖像之間的親緣關係網絡，並提供多種 2D/3D 視覺化介面來探索這些關係。系統整合了向量語意搜尋、實時截圖管理、音效生成等多模態功能。

### 主要特色
- **圖像循環演化**: 自動從基因池抽取圖像，透過 AI 生成新後代
- **多維度親緣追溯**: 記錄並視覺化父母、子代、兄弟姊妹、祖先關係
- **向量語意搜尋**: 使用 OpenAI embeddings + ChromaDB 進行圖像相似度搜尋
- **多種視覺化模式**: 3D 景觀、2D 親緣圖、孵化室、有機房間、幻燈片、拼貼、拼貼版本等 10+ 種模式
- **實時截圖系統**: WebSocket 驅動的遠端截圖請求與管理
- **AI 音效生成**: 從圖像分析自動產生配樂（透過 ElevenLabs）
- **TTS 旁白系統**: 整合 OpenAI TTS 產生語音旁白
- **拼貼生成系統**: 支援多種拼貼模式（kinship、luminance、wave、source-cluster、random、weave、weave-vertical、rotate-90）
- **Iframe 組合模式**: 支援多視窗組合展示
- **多客戶端協調**: 支援多個前端客戶端同時連線與協調
- **字幕與說明文字**: 支援即時字幕與說明文字顯示

---

## 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React + Vite)                 │
│  ┌────────────┬────────────┬────────────┬──────────────┐    │
│  │ 3D Kinship │ Phylogeny  │ Incubator  │ Organic Room │    │
│  │   Scene    │    Mode    │    Mode    │     Mode     │    │
│  └────────────┴────────────┴────────────┴──────────────┘    │
│  ┌────────────┬────────────┬────────────┐                   │
│  │   Slide    │   Search   │   Iframe   │                   │
│  │    Mode    │    Mode    │    Mode    │                   │
│  └────────────┴────────────┴────────────┘                   │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP / WebSocket
                        ↓
┌─────────────────────────────────────────────────────────────┐
│               Backend (FastAPI + Python 3.13)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API Endpoints                                       │   │
│  │  • Image Generation  • Vector Search                │   │
│  │  • Kinship Tracking  • Screenshot Management        │   │
│  │  • Sound Generation  • TTS Narration                │   │
│  │  • Collage Generation • Camera Presets               │   │
│  │  • Iframe Config     • Multi-Client Coordination    │   │
│  │  • Subtitles/Captions • WebSocket Broadcast         │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ↓               ↓               ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Google      │ │  ChromaDB    │ │  ElevenLabs  │
│  Gemini API  │ │  (Embeddings)│ │  (Sounds)    │
│              │ │              │ │              │
│  OpenAI API  │ │  Filesystem  │ │              │
│  (Embeddings │ │  Storage     │ │              │
│   & TTS)     │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

### 資料流
1. **圖像生成流程**: genes_pool → Gemini API → offspring_images + metadata
2. **親緣查詢流程**: metadata JSON → 關係計算 → lineage_graph
3. **向量搜尋流程**: 圖像 → OpenAI Embedding → ChromaDB → 相似度排序
4. **截圖流程**: WebSocket 請求 → 前端截圖 → 上傳 → 分析/音效生成
5. **拼貼生成流程**: 多張圖像 → 切片與匹配算法 → 拼貼圖像 + metadata
6. **TTS 流程**: 文字 → OpenAI TTS API → 音訊檔案 → WebSocket 廣播播放
7. **多客戶端協調**: WebSocket 連線 → 客戶端註冊 → 定向訊息推送

---

## 核心功能模組

### 1. 圖像生成引擎 (gemini_image.py)

#### 1.1 基因池管理
- **多資料夾支援**: 可設定多個基因池路徑（逗號分隔）
- **隨機抽樣**: 從所有基因池中隨機選取父圖進行融合
- **支援格式**: PNG, JPG, JPEG

#### 1.2 圖像生成參數
- **模型**: `gemini-3-pro-image-preview`
- **輸入處理**: 自動 EXIF 校正、RGB 轉換、縮放至 1024px（可配置）
- **Prompt**: 可自訂，預設為大畫幅相機風格的真實感影像合成指令
- **輸出選項**:
  - 格式: PNG, JPEG
  - 尺寸: 支援指定寬高、最大邊長
  - Resize 模式: fit（保持比例）或 cover（裁切填滿）

#### 1.3 生成模式
- **Mode 1**: 自動隨機抽取 N 張父圖（count 參數）
- **Mode 2**: 明確指定父圖路徑/名稱（parents 參數）
- **Strength 提示**: 透過 prompt 加入強度提示（0-1）

#### 1.4 輸出命名規則
```
offspring_YYYYMMDD_HHMMSS_XXX.{png|jpeg}
例：offspring_20251023_143527_847.png
```

---

### 2. 親緣關係追溯系統

#### 2.1 Metadata 結構
每個生成影像對應一個 JSON 檔案：
```json
{
  "parents": ["offspring_20251020_120000_123.png", "offspring_20251021_150000_456.png"],
  "parents_full_paths": ["/absolute/path/to/parent1.png", "/absolute/path/to/parent2.png"],
  "model_name": "gemini-3-pro-image-preview",
  "prompt": "...",
  "strength": 0.6,
  "created_at": "2025-10-23T14:35:27Z",
  "output_image": "offspring_20251023_143527_847.png",
  "output_format": "png",
  "output_size": {"width": 1024, "height": 768}
}
```

#### 2.2 親緣關係類型
- **parents**: 直接父母（metadata 中記錄）
- **children**: 誰把我當作 parent（反向查找）
- **siblings**: 共享任一父母的圖像
- **ancestors**: 遞迴向上追溯所有祖先
- **ancestors_by_level**: 按世代層級分組的祖先
- **root_ancestors**: 最頂層祖先（無父母）

#### 2.3 親緣圖（Lineage Graph）
```json
{
  "nodes": [
    {"name": "offspring_xxx.png", "kind": "original", "level": 0},
    {"name": "offspring_yyy.png", "kind": "parent", "level": -1},
    {"name": "offspring_zzz.png", "kind": "child", "level": 1}
  ],
  "edges": [
    {"source": "offspring_yyy.png", "target": "offspring_xxx.png"}
  ]
}
```

**節點類型 (kind)**:
- `original`: 查詢的起點圖像
- `parent`: 直接父母
- `child`: 直接子代
- `sibling`: 兄弟姊妹
- `ancestor`: 更早世代的祖先

**層級 (level)**:
- 0: 原圖
- -1: 父母
- -2, -3...: 祖父母、曾祖父母...
- 1, 2...: 子代、孫代...

---

### 3. 向量搜尋系統 (vector_store.py)

#### 3.1 Embedding 策略
- **主要模型**: OpenAI `text-embedding-3-small` (1536 維)
- **圖像處理**: 
  1. 優先嘗試 Google `multimodalembedding`（需 Vertex AI）
  2. Fallback: 用 GPT-4o-mini 產生圖像描述 → 文字 embedding
- **雙語支援**: 可為每張圖像產生中英文兩種描述的 embedding（id 後綴 `:zh` 或 `:en`）

#### 3.2 ChromaDB Collections
- **offspring_images**: 後代圖像的向量庫
- **text_queries**: （可選）文字查詢快取

#### 3.3 索引流程
- **掃描模式**: 自動掃描 `offspring_images/` 資料夾
- **批次索引**: 支援指定 batch_size 和 offset
- **增量更新**: 預設跳過已索引的圖像（force=false）
- **Metadata 附加**: 自動附加 JSON metadata 到向量記錄

#### 3.4 搜尋優化
- **資料庫快取**: 若搜尋的圖像已在 ChromaDB，直接讀取向量（無需重新 embedding）
- **路徑解析**: 自動嘗試 absolute/relative/basename 多種路徑
- **回退機制**: 主要 embedding 失敗時，自動降級到 caption + text embedding

#### 3.5 API 端點
- **文字搜尋**: `POST /api/search/text` + `{"query": "白馬 夜晚", "top_k": 15}`
- **圖像搜尋**: `POST /api/search/image` + `{"image_path": "...", "top_k": 15}`

---

### 4. 截圖與音效系統

#### 4.1 截圖管理 (screenshots.py)
- **上傳端點**: `POST /api/screenshots` (multipart/form-data)
- **儲存位置**: `screen_shots/` 資料夾
- **命名規則**: `screenshot_YYYYMMDD_HHMMSS_XXX.{png|jpg}`
- **返回資訊**: `absolute_path`, `relative_path`, `filename`, `original_filename`

#### 4.2 截圖請求系統 (screenshot_requests.py)
- **WebSocket 端點**: `/ws/screenshots`
- **請求流程**:
  1. 後端建立請求 → 廣播給前端
  2. 前端截圖 → 上傳
  3. 後端標記完成 → 可選執行分析/音效生成
- **狀態管理**: `pending` → `completed` / `failed`
- **Client ID**: 支援多客戶端，可指定特定客戶端執行截圖

#### 4.3 圖像分析 (image_analysis.py)
- **模型**: OpenAI GPT-4o-mini (vision)
- **分析內容**:
  - `summary`: 整體場景描述
  - `segments`: 分段詳細描述（人物、環境、氛圍）
- **用途**: 為音效生成提供文字描述

#### 4.4 音效生成 (sound_effects.py)
- **服務**: ElevenLabs Text-to-Sound Effects API
- **模型**: `eleven_text_to_sound_v2`
- **參數**:
  - `prompt`: 音效描述文字
  - `duration_seconds`: 0.5-30 秒
  - `prompt_influence`: 0-1（預設 0.3）
  - `loop`: 是否循環
  - `output_format`: `mp3_44100_128` 等
- **自動 Prompt 生成**: 從圖像分析結果自動構建音效描述
- **儲存位置**: `backend/generated_sounds/`
- **命名規則**: 以截圖檔名為基礎，遇重複自動加後綴

#### 4.5 音效播放廣播
- **WebSocket 訊息**: `{"type": "sound_play", "filename": "...", "url": "..."}`
- **前端播放器**: `SoundPlayer` 元件自動接收並播放
- **API 觸發**: `POST /api/sound-play` + `{"filename": "...", "target_client_id": "..."}`

#### 4.6 TTS 旁白系統 (tts_openai.py)
- **服務**: OpenAI Audio Speech API
- **模型**: `gpt-4o-mini-tts`（預設，可配置）
- **語音選項**: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`（預設 `alloy`）
- **輸出格式**: `mp3`（預設）、`wav`、`opus`、`aac`、`flac`
- **參數**:
  - `text`: 要合成的文字（必要）
  - `instructions`: 語氣/口音/說話風格描述（可選）
  - `voice`: 語音選項（可選）
  - `model`: TTS 模型（可選）
  - `output_format`: 輸出格式（可選）
  - `speed`: 語速（0.25-4.0，預設 1.0）
  - `filename_base`: 自訂檔名前綴（可選）
  - `auto_play`: 是否自動播放（可選）
  - `target_client_id`: 指定播放目標客戶端（可選）
- **儲存位置**: `backend/generated_sounds/`
- **命名規則**: `narration_YYYYMMDDTHHMMSS_XXXX.{format}` 或自訂前綴
- **API 端點**: `POST /api/tts`
- **自動播放**: 若 `auto_play=true`，會透過 WebSocket 廣播 `sound_play` 訊息

---

### 5. 視角與場景管理

#### 5.1 相機預設 (camera_presets.py)
- **儲存位置**: `backend/metadata/camera_presets.json`
- **資料結構**:
```json
{
  "presets": [
    {
      "name": "center",
      "position": {"x": 0, "y": 5, "z": 20},
      "target": {"x": 0, "y": 0, "z": 0}
    }
  ]
}
```
- **API**:
  - `GET /api/camera-presets`: 列出所有預設
  - `POST /api/camera-presets`: 新增/更新預設
  - `DELETE /api/camera-presets/{name}`: 刪除預設

#### 5.2 Iframe 配置 (iframe_config.py)
- **用途**: 多視窗組合展示配置
- **參數**:
  - `layout`: `grid` | `horizontal` | `vertical`
  - `gap`: 面板間距（px）
  - `columns`: 網格模式的列數
  - `panels`: 面板陣列
    - `id`: 面板 ID
    - `src`: iframe URL
    - `ratio`: 尺寸比例（flex 用）
    - `label`: 顯示標籤（可選）
- **WebSocket 推送**: 支援即時更新前端 iframe 配置
- **Client 隔離**: 可為不同 client_id 設定不同配置

---

## 前端視覺化模式

### 模式切換機制
透過 URL 查詢參數啟用：
```
/?img=offspring_xxx.png                 → 預設 3D 景觀模式
/?img=xxx.png&phylogeny=true           → 2D 親緣圖模式
/?img=xxx.png&incubator=true           → 孵化室 3D 模式
/?img=xxx.png&organic_mode=true        → 有機房間模式
/?img=xxx.png&slide_mode=true          → 幻燈片模式
/?search_mode=true                     → 搜尋模式
/?iframe_mode=true                     → Iframe 組合模式
/?collage_mode=true                    → 拼貼模式
/?collage_version_mode=true            → 拼貼版本生成模式
/?generate_mode=true                   → 圖像生成模式
/?caption_mode=true                    → 說明文字模式
```

---

### 模式 1: 3D 景觀模式（預設）
**檔案**: `ThreeKinshipScene.jsx` (SceneContent)

**特色**:
- 花朵狀叢集布局（ClusterFlower）
- 中心圖像 + 環狀排列的父母/子代/兄弟姊妹/祖先
- 每個叢集可獨立旋轉、浮動
- 支援多叢集疊加（最多 3 個）
- 自動漸進顯示動畫（react-spring）

**參數**:
- `autoplay`: 自動切換到子代/兄弟/父母（預設開啟）
- `step`: 切換間隔秒數（預設 30）
- `continuous`: 若為 true，停用自動切換

**視角**:
- FOV: 55
- 初始位置: (0, 1.2, 15)
- OrbitControls: minDistance=4, maxDistance=60

---

### 模式 2: 2D 親緣圖模式 (Phylogeny)
**檔案**: `ThreeKinshipScene.jsx` (PhylogenySceneContent)

**特色**:
- 樹狀圖布局（hierarchical layout）
- 水平分層：父母在上方、子代在下方
- 每個層級的節點水平均勻分布
- Billboard 技術：節點始終面向相機
- 節點外框顏色標記類型（original/parent/child/sibling/ancestor）

**布局參數**:
- `PHYLO_LEVEL_GAP`: 7.5（層級間距）
- `PHYLO_NODE_SPACING`: 6.2（節點橫向間距）
- `PHYLO_NODE_BASE_SIZE`: 3.4（節點基礎尺寸）

**自動相機適配**:
- 根據節點數量和分布自動計算最佳距離
- 確保所有節點都在視野內

**視角**:
- FOV: 50
- 初始位置: (0, 0, 32)
- 動態調整距離

---

### 模式 3: 孵化室模式 (Incubator)
**檔案**: `ThreeKinshipScene.jsx` (IncubatorSceneContent)

**特色**:
- 球形/環形混合布局
- 節點按類型和層級分區：
  - Original: 中心
  - Parent: 上方環形
  - Child: 下方環形
  - Sibling/Ancestor: 外圍環形
- **量子場效果** (IncubatorMist):
  - 96 個浮動粒子形成霧氣
  - 隨整體進度和長週期波動調整強度
- **Flow Overlay**:
  - 每個節點有彩色流光疊加層
  - 顏色依類型區分（藍/橙/綠/紫/黃）
  - 隨時間漂移、脈動
- **漸進動畫**:
  - 每個節點有獨立的 `spawnDelay` 和 `growthDuration`
  - 按類型分組依序出現（original → parent → child → sibling → ancestor）
  - EaseOutCubic 緩動曲線

**布局參數**:
- 最多顯示 60 個節點
- `INCUBATOR_BASE_RADIUS`: 4.4
- `INCUBATOR_RADIUS_STEP`: 3.3（每層半徑遞增）
- `INCUBATOR_LEVEL_GAP`: 4.6（垂直間距）

**視角**:
- FOV: 52
- 初始位置: (0, 2.4, 24)
- OrbitControls: minDistance=6, maxDistance=48

---

### 模式 4: 有機房間模式 (Organic Room)
**檔案**: `OrganicRoomScene.jsx`

**特色**:
- 立方體房間，6 個面各顯示 1 張圖像
- 自動從錨點圖像搜尋 6 張最相似圖像填滿房間
- **有機巡航** (OrganicCruise):
  - 相機自動在房間內漂浮、轉向
  - 每 24 秒循環接近一個面
  - 接近時觸發切換到該面的圖像（成為新錨點）
- 立方體本身也會緩慢旋轉（可透過 `showInfo` 停用動畫）

**參數**:
- 房間大小: 12×12×12
- 相機初始: (0, 0, 4.6), FOV=58
- OrbitControls: minDistance=2.5, maxDistance=8, target=(0, -1.2, 0)

**適用場景**:
- 沉浸式圖像探索
- 自動導覽展示

---

### 模式 5: 幻燈片模式 (Slide Mode)
**檔案**: `SlideMode.jsx`

**特色**:
- 全螢幕單圖輪播
- 自動從當前圖像搜尋相似圖像（向量或親緣）
- 播放完所有圖像後，以最後一張為錨點再次搜尋（無限循環）
- 可調整播放速度（0.5x - 10x）
- 支援暫停/播放

**資料來源模式** (`slide_source` 參數):
- `vector`（預設）: 使用向量相似度搜尋 15 張
- `kinship`: 使用親緣關係（children → siblings → parents → ancestors）

**參數**:
- `intervalMs`: 預設 3000ms（3 秒）
- `playbackSpeed`: 可透過 UI 調整
- `BATCH_SIZE`: 每批載入 15 張

**顯示資訊**:
- 按 `Ctrl+R` 切換顯示檔名、進度、速度控制條

---

### 模式 6: 搜尋模式 (Search Mode)
**檔案**: `SearchMode.jsx`

**特色**:
- **以圖搜圖**: 上傳圖片，搜尋相似的後代圖像
- **文字搜尋**: 輸入關鍵字（中英文），語意搜尋
- 結果以網格顯示，顯示相似度百分比和距離
- 點擊結果可以該圖為查詢條件再次搜尋

**搜尋優化**:
- 上傳的圖像先存入 `screen_shots/`
- 優先嘗試用原始檔名在 `offspring_images` 中查找（快速路徑）
- 失敗則用上傳檔案路徑進行 embedding + 搜尋

**UI**:
- 雙模式切換按鈕（📸 以圖搜圖 / 📝 文字搜尋）
- 拖放上傳或點擊選擇檔案
- 結果卡片顯示縮圖、檔名、相似度、距離

---

### 模式 7: Iframe 組合模式
**檔案**: `IframeMode.jsx`

**特色**:
- 可在單一頁面組合多個 iframe（最多 12 個）
- 支援 3 種布局：
  - `grid`: 網格（可設定列數）
  - `horizontal`: 水平排列
  - `vertical`: 垂直排列
- 每個 iframe 可獨立設定：
  - `src`: URL
  - `label`: 顯示標籤
  - `ratio`: 尺寸比例（flex-based）
- 支援 URL 參數配置或 WebSocket 即時更新

**URL 參數範例**:
```
/?iframe_mode=true
  &iframe_layout=grid
  &iframe_gap=12
  &iframe_columns=2
  &iframe_panels=p1,p2,p3,p4
  &iframe_p1=/?img=xxx.png
  &iframe_p2=/?img=yyy.png&slide_mode=true
  &iframe_p3=/?search_mode=true
  &iframe_p4=/?img=zzz.png&organic_mode=true
  &iframe_p1_label=景觀
  &iframe_p2_label=幻燈片
```

**控制面板**:
- 按 `Ctrl+R` 切換控制面板（僅在本地配置模式）
- 可即時調整面板數量、URL
- 套用後更新 URL 參數

---

### 模式 8: 拼貼模式 (Collage Mode)
**檔案**: `CollageMode.jsx`

**特色**:
- 將多張圖像以網格方式拼貼成單一畫面
- 支援遠端配置（透過 `/api/collage-config`）
- 可設定網格行列數、圖像列表、混合模式
- 支援客戶端專屬配置
- 預設採 4 張圖、3×3 網格、960×540 畫布與 `mix=false`，並有明確上下限方便大螢幕調整

**配置參數**（與 `backend/app/models/collage.py` 的驗證一致）:
- `images`: 圖像檔名列表（會自動去重、移除路徑）
- `image_count`: 圖像數量（1-30，預設 4，若大於圖像數會自動壓回）
- `rows`: 行數（1-96，預設 3）
- `cols`: 列數（1-96，預設 3）
- `mix`: 是否混合排列（預設 `false`）
- `stage_width`: 畫布寬度（360-3840 px，預設 960）
- `stage_height`: 畫布高度（240-2160 px，預設 540）
- `seed`: 隨機種子（非必填，僅 `mix=true` 時影響結果）

**API**:
- `GET /api/collage-config?client=<id>`: 取得配置
- `PUT /api/collage-config`: 更新配置（會透過 WebSocket 推送）

---

### 模式 9: 拼貼版本生成模式 (Collage Version Mode)
**檔案**: `CollageVersionMode.jsx`

**特色**:
- 將多張圖像切片後重新組合，產生新的拼貼版本
- 支援多種匹配 / 排列模式：
  - `kinship`: 以邊緣顏色距離匹配（局部縫合最佳）
  - `luminance`: 最小化亮度差（產生明暗節律）
  - `wave`: 由中心向外的 BFS 順序（形成方向性條帶）
  - `source-cluster`: 以來源圖為單位聚塊（語義連續）
  - `random`: 隨機排列（基準對照）
  - `weave`: 交錯取樣不同來源圖，形成編織質感
  - `rotate-90`: 單張圖像，對每個切片旋轉 90° 後原位組回
- `allow_self=true` 或 `mode=rotate-90` 時可以只提供單一圖像，其他模式至少 2 張
- `base` 參數用來指定基準圖選擇策略（`first` 或 `mean`，目前等同 `first`）
- 支援進度追蹤（非同步生成）

**參數**（對齊 `GenerateCollageVersionRequest`）:
- `image_names`: 圖像檔名列表（一般模式需 ≥2；`rotate-90` 或 `allow_self=true` 可用 1 張）
- `rows`: 切片行數（1-300，預設 12）
- `cols`: 切片列數（1-300，預設 16）
- `mode`: 匹配模式（預設 `kinship`；可選 `kinship/luminance/wave/source-cluster/random/weave/rotate-90`）
- `base`: 基準圖策略（`first`、`mean`）
- `allow_self`: 是否允許重用基準圖的 tiles（預設 `false`，`weave` 模式不會排除）
- `seed`: 隨機種子（預設使用時間戳）
- `resize_w`: 輸出寬度（256-8192 px，預設 2048）
- `pad_px`: 填充像素（0-100，預設 0）
- `jitter_px`: 抖動像素（0-50，預設 0）
- `rotate_deg`: 旋轉角度（0-45°，預設 0）
- `format`: 輸出格式（`png`、`jpg`、`webp`，預設 `png`）
- `quality`: 輸出品質（1-100，僅 `jpg/webp` 時使用，預設 92）
- `return_map`: 是否返回 tile 對應關係（預設 `false`）

**API**:
- `POST /api/generate-collage-version`: 建立生成任務（返回 `task_id`）
- `GET /api/collage-version/{task_id}/progress`: 查詢進度與結果

---

### 模式 10: 圖像生成模式 (Generate Mode)
**檔案**: `GenerateMode.jsx`

**特色**:
- 提供圖形化介面進行圖像生成
- 可選擇父圖、設定參數
- 即時顯示生成結果

---

### 模式 11: 說明文字模式 (Caption Mode)
**檔案**: `CaptionMode.jsx`

**特色**:
- 顯示說明文字覆蓋層
- 支援多語言
- 可設定顯示時間
- 透過 WebSocket 即時更新

**API**:
- `GET /api/captions?client=<id>`: 取得說明文字
- `POST /api/captions`: 設定說明文字
- `DELETE /api/captions`: 清除說明文字

---

## 後端 API 規格

### 基礎資訊
- **框架**: FastAPI 0.115.0
- **伺服器**: Uvicorn 0.30.6
- **基礎 URL**: (預設 http://localhost:8000)

---

### API 端點總覽

#### 圖像生成
| 方法 | 端點 | 功能 | 狀態碼 |
|------|------|------|--------|
| POST | `/api/generate/mix-two` | 混合圖像生成後代 | 201 |

#### 親緣查詢
| 方法 | 端點 | 功能 | 狀態碼 |
|------|------|------|--------|
| GET | `/api/kinship?img=xxx.png&depth=N` | 查詢親緣關係 | 200 |

#### 向量搜尋
| 方法 | 端點 | 功能 | 狀態碼 |
|------|------|------|--------|
| POST | `/api/search/text` | 文字語意搜尋 | 200 |
| POST | `/api/search/image` | 圖像相似度搜尋 | 200 |
| POST | `/api/index/offspring` | 批次索引所有後代 | 200 |
| POST | `/api/index/image` | 索引單張圖像 | 200 |
| POST | `/api/index/batch` | 批次索引（分頁） | 200 |

#### 截圖管理
| 方法 | 端點 | 功能 | 狀態碼 |
|------|------|------|--------|
| POST | `/api/screenshots` | 上傳截圖 | 201 |
| POST | `/api/screenshots/request` | 建立截圖請求 | 202 |
| GET | `/api/screenshots/{request_id}` | 查詢請求狀態 | 200 |
| POST | `/api/screenshots/{request_id}/fail` | 標記請求失敗 | 200 |

#### 圖像分析與音效
| 方法 | 端點 | 功能 | 狀態碼 |
|------|------|------|--------|
| POST | `/api/analyze-screenshot` | 分析截圖內容 | 200 |
| POST | `/api/sound-effects` | 生成音效 | 200 |
| POST | `/api/screenshot/bundle` | 一次完成分析+音效 | 200 |
| GET | `/api/sound-files` | 列出所有音效檔案 | 200 |
| GET | `/api/sound-files/{filename}` | 下載音效檔案 | 200 |
| POST | `/api/sound-play` | 廣播音效播放請求 | 202 |
| POST | `/api/tts` | 產生 TTS 旁白 | 201 |

#### 拼貼生成
| 方法 | 端點 | 功能 | 狀態碼 |
|------|------|------|--------|
| POST | `/api/generate-collage-version` | 生成拼貼版本 | 202 |
| GET | `/api/collage-version/{task_id}/progress` | 查詢拼貼生成進度 | 200 |
| GET | `/api/collage-config` | 取得拼貼配置 | 200 |
| PUT | `/api/collage-config` | 更新拼貼配置 | 200 |

#### 字幕與說明文字
| 方法 | 端點 | 功能 | 狀態碼 |
|------|------|------|--------|
| GET | `/api/subtitles` | 取得字幕 | 200 |
| POST | `/api/subtitles` | 設定字幕 | 202 |
| DELETE | `/api/subtitles` | 清除字幕 | 204 |
| GET | `/api/captions` | 取得說明文字 | 200 |
| POST | `/api/captions` | 設定說明文字 | 202 |
| DELETE | `/api/captions` | 清除說明文字 | 204 |

#### 多客戶端管理
| 方法 | 端點 | 功能 | 狀態碼 |
|------|------|------|--------|
| GET | `/api/clients` | 列出在線客戶端 | 200 |

#### 相機與配置
| 方法 | 端點 | 功能 | 狀態碼 |
|------|------|------|--------|
| GET | `/api/camera-presets` | 列出相機預設 | 200 |
| POST | `/api/camera-presets` | 儲存相機預設 | 201 |
| DELETE | `/api/camera-presets/{name}` | 刪除相機預設 | 204 |
| GET | `/api/iframe-config?client=xxx` | 取得 iframe 配置 | 200 |
| PUT | `/api/iframe-config` | 更新 iframe 配置 | 200 |

#### WebSocket
| 協定 | 端點 | 功能 |
|------|------|------|
| WS | `/ws/screenshots` | 截圖請求/音效播放廣播 |

---

### API 詳細規格範例

#### POST /api/generate/mix-two
**請求 Body** (JSON, 可選):
```json
{
  "parents": ["offspring_20251020_100000_123.png", "parent2.jpg"],  // 可選，指定父圖
  "count": 2,                                                        // 或使用自動抽樣
  "prompt": "custom prompt...",                                      // 可選，覆蓋預設 prompt
  "strength": 0.6,                                                   // 可選，0-1
  "output_format": "png",                                            // 可選：png|jpeg
  "output_width": 1024,                                              // 可選
  "output_height": 768,                                              // 可選
  "output_max_side": 1024,                                           // 可選，最大邊長
  "resize_mode": "fit"                                               // 可選：fit|cover
}
```

**回應**:
```json
{
  "output_image_path": "/abs/path/to/offspring_xxx.png",
  "metadata_path": "/abs/path/to/metadata/offspring_xxx.json",
  "parents": ["offspring_20251020_100000_123.png", "parent2.jpg"],
  "model_name": "gemini-3-pro-image-preview",
  "output_format": "png",
  "width": 1024,
  "height": 768
}
```

---

#### GET /api/kinship
**查詢參數**:
- `img` (必要): 圖像檔名，如 `offspring_20251023_143527_847.png`
- `depth` (可選): 祖先追溯層數（預設 1，-1 代表窮盡）

**回應**:
```json
{
  "original_image": "offspring_xxx.png",
  "parents": ["offspring_yyy.png", "offspring_zzz.png"],
  "children": ["offspring_aaa.png"],
  "siblings": ["offspring_bbb.png", "offspring_ccc.png"],
  "ancestors": ["offspring_yyy.png", "offspring_ddd.png", ...],
  "ancestors_by_level": [
    ["offspring_yyy.png", "offspring_zzz.png"],  // level -1（父母）
    ["offspring_ddd.png"],                        // level -2（祖父母）
    ...
  ],
  "root_ancestors": ["offspring_eee.png"],        // 最頂層（無父母）
  "related_images": [...],                         // 父母+子代+兄弟姊妹總和（向下相容）
  "depth_used": 3,
  "lineage_graph": {
    "nodes": [
      {"name": "offspring_xxx.png", "kind": "original", "level": 0},
      {"name": "offspring_yyy.png", "kind": "parent", "level": -1},
      ...
    ],
    "edges": [
      {"source": "offspring_yyy.png", "target": "offspring_xxx.png"},
      ...
    ]
  }
}
```

---

#### POST /api/search/text
**請求 Body**:
```json
{
  "query": "白馬在夜晚的草原",
  "top_k": 15
}
```

**回應**:
```json
{
  "results": [
    {
      "id": "offspring_20251020_100000_123.png",
      "distance": 0.234,
      "metadata": {
        "parents": [...],
        "prompt": "...",
        "created_at": "2025-10-20T10:00:00Z",
        ...
      }
    },
    ...
  ]
}
```

**Note**: 
- `distance` 越小代表越相似
- `id` 可能有後綴 `:en` 或 `:zh`（雙語 embedding）

---

#### POST /api/search/image
**請求 Body**:
```json
{
  "image_path": "backend/offspring_images/offspring_xxx.png",  // 或 absolute path
  "top_k": 15
}
```

**回應**: 同 `/api/search/text`

---

#### POST /api/screenshots/request
**請求 Body** (可選 metadata):
```json
{
  "target_client_id": "display_01",  // 可選，指定哪個前端執行截圖
  "label": "主展示場景",
  "source": "curator_dashboard"
}
```

**回應**:
```json
{
  "request_id": "req_20251023_143527_xyz",
  "status": "pending",
  "target_client_id": "display_01",
  "created_at": "2025-10-23T14:35:27Z",
  "metadata": {"label": "主展示場景", "source": "curator_dashboard"}
}
```

**流程**:
1. 呼叫此 API 建立請求
2. 後端透過 WebSocket 廣播給符合條件的前端
3. 前端收到後自動截圖、上傳到 `/api/screenshots`
4. 上傳時附帶 `request_id`，後端自動標記完成

---

#### POST /api/screenshot/bundle
**請求 Body**:
```json
{
  "image_path": "/path/to/screenshot.png",                       // 或用 request_id
  "request_id": "req_xxx",                                        // 二選一
  "prompt": "Describe this image in detail for sound design",    // 可選，覆蓋預設分析 prompt
  "sound_duration_seconds": 5.0,                                  // 音效長度
  "sound_prompt_influence": 0.3,                                  // 可選
  "sound_loop": false,                                            // 可選
  "sound_model_id": "eleven_text_to_sound_v2",                   // 可選
  "sound_output_format": "mp3_44100_128",                        // 可選
  "sound_prompt_override": "custom sound description..."         // 可選，直接指定音效 prompt
}
```

**回應**:
```json
{
  "image_path": "/abs/path/to/screenshot.png",
  "analysis": {
    "summary": "整體場景描述...",
    "segments": ["分段描述1", "分段描述2", ...]
  },
  "sound": {
    "filename": "screenshot_xxx.mp3",
    "absolute_path": "/abs/path/to/sound.mp3",
    "relative_path": "backend/generated_sounds/screenshot_xxx.mp3",
    "prompt": "實際使用的音效描述...",
    "model_id": "eleven_text_to_sound_v2",
    "duration_seconds": 5.0,
    ...
  },
  "used_prompt": "自動生成或使用者指定的音效 prompt",
  "request_id": "req_xxx",
  "request_metadata": {
    "status": "completed",
    "sound_effect": {...},
    ...
  }
}
```

---

#### POST /api/tts
**請求 Body**:
```json
{
  "text": "各位好，歡迎來到圖像系譜學現場展示。",
  "instructions": "zh-TW Mandarin, calm, low pitch, slower pace, intimate",  // 可選
  "voice": "alloy",                                                              // 可選：alloy, echo, fable, onyx, nova, shimmer
  "model": "gpt-4o-mini-tts",                                                    // 可選
  "output_format": "mp3",                                                       // 可選：mp3, opus, aac, flac
  "filename_base": "narration",                                                 // 可選
  "speed": 0.95,                                                                 // 可選：0.25-4.0，預設 1.0
  "auto_play": true,                                                             // 可選：是否自動播放
  "target_client_id": "mobile"                                                   // 可選：指定播放目標
}
```

**回應**:
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

**流程**:
1. 呼叫此 API 產生 TTS 音訊檔案
2. 若 `auto_play=true`，會透過 WebSocket 廣播 `sound_play` 訊息給指定客戶端
3. 前端 `SoundPlayer` 元件自動接收並播放

---

#### POST /api/generate-collage-version
**請求 Body**:
```json
{
  "image_names": [
    "offspring_20250929_114940_017.png",
    "offspring_20250923_161624_066.png",
    "offspring_20250927_141336_787.png"
  ],
  "rows": 12,
  "cols": 16,
  "mode": "kinship",                    // kinship, luminance, wave, source-cluster, random, weave, weave-vertical, rotate-90
  "base": null,                         // 可選：基礎圖像檔名
  "allow_self": false,                  // 可選：是否允許單張圖像
  "resize_w": 2048,                     // 可選：輸出寬度
  "pad_px": 0,                          // 可選：填充像素
  "jitter_px": 0,                       // 可選：抖動像素
  "rotate_deg": 0,                      // 可選：旋轉角度
  "format": "png",                      // 可選：png, jpeg
  "quality": 92,                        // 可選：JPEG 品質（1-100）
  "seed": 123456,                       // 可選：隨機種子
  "return_map": false                   // 可選：是否返回 tile 對應關係
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

**流程**:
1. 呼叫此 API 建立非同步生成任務，立即返回 `task_id`
2. 使用 `GET /api/collage-version/{task_id}/progress` 查詢進度
3. 完成後從 progress API 取得結果

---

#### GET /api/collage-version/{task_id}/progress
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

---

#### GET /api/collage-config
**查詢參數**:
- `client` (可選): 客戶端 ID，取得專屬配置

**回應**:
```json
{
  "config": {
    "images": ["offspring_xxx.png", "offspring_yyy.png", ...],
    "image_count": 20,
    "rows": 5,
    "cols": 8,
    "mix": true,
    "stage_width": 2048,
    "stage_height": 1152,
    "seed": 987123
  },
  "source": "client",              // client, global, default
  "target_client_id": "desktop_wall",
  "updated_at": "2025-11-04T12:34:56Z"
}
```

---

#### PUT /api/collage-config
**請求 Body**:
```json
{
  "target_client_id": "desktop_wall",  // 可選：指定客戶端，不填則更新全域
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

**回應**: 同 `GET /api/collage-config`

**流程**:
1. 更新配置（客戶端專屬或全域）
2. 透過 WebSocket 廣播 `collage_config` 訊息
3. 前端自動接收並套用新配置

---

#### GET /api/clients
**回應**:
```json
{
  "clients": [
    {"client_id": "desktop", "connections": 1},
    {"client_id": "mobile", "connections": 1},
    {"client_id": "default", "connections": 42}
  ]
}
```

---

#### GET /api/subtitles
**查詢參數**:
- `client` (可選): 客戶端 ID

**回應**:
```json
{
  "subtitle": {
    "text": "歡迎來到圖像系譜學",
    "language": "zh-TW",
    "expires_at": "2025-11-04T12:40:00Z"
  }
}
```

---

#### POST /api/subtitles
**查詢參數**:
- `target_client_id` (可選): 目標客戶端 ID

**請求 Body**:
```json
{
  "text": "歡迎來到圖像系譜學",
  "language": "zh-TW",              // 可選
  "duration_seconds": 10           // 可選：顯示時間（秒）
}
```

**回應**: 同 `GET /api/subtitles`

**流程**:
1. 設定字幕
2. 透過 WebSocket 廣播 `subtitle_update` 訊息
3. 前端自動顯示字幕

---

#### POST /api/captions
**查詢參數**:
- `target_client_id` (可選): 目標客戶端 ID

**請求 Body**: 同 `POST /api/subtitles`

**回應**: 同 `GET /api/subtitles`（但欄位名為 `caption`）

**流程**: 同字幕，但透過 `caption_update` 訊息推送

---

### WebSocket 訊息格式

#### Client → Server
```json
// Hello（建立連線後）
{
  "type": "hello",
  "client_id": "display_01"
}
```

#### Server → Client
```json
// 截圖請求
{
  "type": "screenshot_request",
  "request_id": "req_20251023_143527_xyz",
  "target_client_id": "display_01",  // 可為 null（廣播給所有）
  "metadata": {
    "label": "主展示場景",
    "source": "curator_dashboard"
  }
}

// 截圖完成通知
{
  "type": "screenshot_completed",
  "request_id": "req_xxx",
  "result": {
    "filename": "screenshot_xxx.png",
    "absolute_path": "/abs/path/...",
    ...
  }
}

// 截圖失敗通知
{
  "type": "screenshot_failed",
  "request_id": "req_xxx",
  "error": "error message"
}

// 音效播放請求
{
  "type": "sound_play",
  "filename": "offspring_xxx.mp3",
  "url": "/api/sound-files/offspring_xxx.mp3"
}

// Collage 配置更新
{
  "type": "collage_config",
  "target_client_id": "desktop_wall",  // 可為 null（廣播給所有）
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

// 字幕更新
{
  "type": "subtitle_update",
  "target_client_id": "mobile",  // 可為 null（廣播給所有）
  "subtitle": {
    "text": "歡迎來到圖像系譜學",
    "language": "zh-TW",
    "expires_at": "2025-11-04T12:40:00Z"
  }
}

// 說明文字更新
{
  "type": "caption_update",
  "target_client_id": "mobile",  // 可為 null（廣播給所有）
  "caption": {
    "text": "這是一張由 AI 生成的圖像",
    "language": "zh-TW",
    "expires_at": "2025-11-04T12:40:00Z"
  }
}
```

---

## 資料結構與儲存

### 檔案系統結構（實際）
```
project_root/
├── backend/
│   ├── app/
│   │   ├── main.py                         # FastAPI 主程式
│   │   ├── config.py                       # 環境配置
│   │   ├── models/
│   │   │   ├── schemas.py                  # Pydantic 模型
│   │   │   └── iframe.py
│   │   ├── services/
│   │   │   ├── gemini_image.py             # 圖像生成
│   │   │   ├── vector_store.py             # 向量搜尋
│   │   │   ├── sound_effects.py            # 音效生成
│   │   │   ├── image_analysis.py           # 圖像分析
│   │   │   ├── screenshots.py              # 截圖管理
│   │   │   ├── screenshot_requests.py      # WebSocket 管理
│   │   │   ├── camera_presets.py           # 視角預設
│   │   │   └── iframe_config.py            # Iframe 配置
│   │   └── utils/
│   │       ├── embeddings.py               # Embedding 工具
│   │       ├── gemini_client.py            # Gemini 客戶端
│   │       ├── metadata.py                 # Metadata 讀寫
│   │       └── fs.py                       # 檔案系統工具
│   ├── offspring_images/                   # 生成的後代圖像
│   │   ├── offspring_20251023_143527_847.png
│   │   └── ...
│   ├── metadata/                           # 親緣 metadata
│   │   ├── offspring_20251023_143527_847.json
│   │   ├── camera_presets.json
│   │   └── ...
│   ├── generated_sounds/                   # 生成的音效
│   │   ├── offspring_20251023_143527_847.mp3
│   │   └── ...
│   ├── chroma_db/                          # ChromaDB 持久化
│   │   ├── chroma.sqlite3
│   │   └── ...
│   ├── requirements.txt
│   └── venv/
├── frontend/
│   ├── src/
│   │   ├── App.jsx                         # 主應用
│   │   ├── ThreeKinshipScene.jsx           # 3D 親緣場景
│   │   ├── OrganicRoomScene.jsx            # 有機房間
│   │   ├── SlideMode.jsx                   # 幻燈片
│   │   ├── SearchMode.jsx                  # 搜尋
│   │   ├── IframeMode.jsx                  # Iframe 組合
│   │   ├── CollageMode.jsx                 # 拼貼模式
│   │   ├── CollageVersionMode.jsx          # 拼貼版本生成
│   │   ├── GenerateMode.jsx                 # 圖像生成
│   │   ├── CaptionMode.jsx                 # 說明文字
│   │   ├── SoundPlayer.jsx                 # 音效播放器
│   │   ├── SubtitleOverlay.jsx             # 字幕覆蓋層
│   │   ├── api.js                          # API 封裝
│   │   └── styles.css
│   ├── dist/                               # Build 輸出
│   ├── package.json
│   └── vite.config.js
├── screen_shots/                           # 截圖儲存
├── embeddings/                             # (舊，已遷移到 backend/chroma_db)
├── 夜遊 - 毛刺/                           # 專案素材資料夾
│   ├── AI影像/
│   ├── AI生成靜態影像/
│   └── 攝影圖像/
├── spec.md                                 # 系統規格文件（本檔案）
└── ...
```

### 基因池配置
基因池可透過環境變數設定多個路徑：
```bash
GENES_POOL_DIRS="夜遊 - 毛刺/AI生成靜態影像,夜遊 - 毛刺/攝影圖像/橫式"
```
或單一路徑（向下相容）：
```bash
GENES_POOL_DIR="genes_pool"
```

系統會自動解析為絕對路徑，並從所有路徑中隨機抽樣。

---

## 技術棧與依賴

### 後端
- **Runtime**: Python 3.13
- **Web Framework**: FastAPI 0.115.0
- **ASGI Server**: Uvicorn 0.30.6 (with standard, includes WebSocket)
- **Image Processing**: Pillow 10.4.0
- **AI/ML**:
  - google-genai 0.3.0 (Gemini API)
  - openai >=1.0.0 (OpenAI API)
  - chromadb >=0.5.5 (向量資料庫)
- **HTTP Client**: httpx 0.27.2 (用於 ElevenLabs API)
- **Data Validation**: Pydantic 2.9.2
- **Config**: python-dotenv 1.0.1

### 前端
- **Runtime**: Node.js (任意版本，建議 18+)
- **Build Tool**: Vite 5.4.0
- **Framework**: React 18.3.1
- **3D Rendering**: 
  - Three.js 0.160.0
  - @react-three/fiber 8.15.19 (React-Three-Fiber)
  - @react-three/drei 9.105.6 (Three.js helpers)
- **Animation**: 
  - @react-spring/three 9.7.3
  - @react-spring/web 9.7.3

### 第三方服務
- **Google Gemini API**: 圖像生成
  - 模型: `gemini-3-pro-image-preview`
  - 需要: `GEMINI_API_KEY`
- **OpenAI API**: 
  - Embedding: `text-embedding-3-small`
  - Vision: `gpt-4o-mini`
  - 需要: `OPENAI_API_KEY`
- **ElevenLabs API**: 音效生成
  - 模型: `eleven_text_to_sound_v2`
  - 需要: `ELEVENLABS_API_KEY`
- **Google Vertex AI** (可選):
  - 若啟用 `GENAI_USE_VERTEX=true`
  - 可使用 Multimodal Embedding

---

## 環境配置

### 環境變數清單

#### 必要變數
```bash
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here  # 若使用音效功能
```

#### 可選變數
```bash
# 模型設定
MODEL_NAME=gemini-3-pro-image-preview
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_VISION_MODEL=gpt-4o-mini
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=alloy
OPENAI_TTS_FORMAT=mp3
GOOGLE_EMBEDDING_MODEL=text-embedding-004
GOOGLE_IMAGE_EMBEDDING_MODEL=multimodalembedding

# 路徑設定
GENES_POOL_DIR=genes_pool
GENES_POOL_DIRS="path1,path2,path3"
OFFSPRING_DIR=backend/offspring_images
METADATA_DIR=backend/metadata
SCREENSHOT_DIR=screen_shots
GENERATED_SOUNDS_DIR=backend/generated_sounds
CAMERA_PRESETS_FILE=backend/metadata/camera_presets.json
CHROMA_DB_PATH=backend/chroma_db
CHROMA_COLLECTION_IMAGES=offspring_images
CHROMA_COLLECTION_TEXT=text_queries
NIGHTWALK_ASSETS_DIR="夜遊 - 毛刺"                     # 掛載為 /nightwalk_assets，提供 StaticMode 額外圖庫

# 圖像處理
IMAGE_SIZE=1024                                     # 輸入圖像縮放尺寸
FIXED_PROMPT="your custom prompt..."                 # 生成 prompt

# Vertex AI（可選）
GENAI_USE_VERTEX=false
VERTEX_PROJECT=your_gcp_project_id
VERTEX_LOCATION=us-central1
ENABLE_IMAGE_EMBEDDING=false                        # 啟用直接圖像 embedding
```

### .env 檔案範例
```bash
# .env (放在專案根目錄或 backend/ 下)
GEMINI_API_KEY=AIzaSy...
OPENAI_API_KEY=sk-proj-...
ELEVENLABS_API_KEY=...

GENES_POOL_DIRS="夜遊 - 毛刺/AI生成靜態影像,夜遊 - 毛刺/攝影圖像/橫式"
IMAGE_SIZE=1024
```

---

## 部署架構

### 開發模式

#### 後端啟動
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 前端啟動
```bash
cd frontend
npm install
npm run dev
```

預設前端會在 `http://localhost:5173`，後端在 `http://localhost:8000`。

### CORS 設定
FastAPI 需設定 CORS 允許前端跨域請求（若前後端分離）。

### 生產部署建議

#### 後端
- 使用 Gunicorn + Uvicorn worker:
  ```bash
  gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
  ```
- 或使用 Docker:
  ```dockerfile
  FROM python:3.13-slim
  WORKDIR /app
  COPY backend/requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  COPY backend/ .
  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```

#### 前端
- Build 前端：
  ```bash
  cd frontend
  npm run build
  ```
- 產出在 `frontend/dist/`，可用任意靜態檔案伺服器（Nginx, Caddy, etc.）
- 或整合到 FastAPI，掛載靜態目錄：
  ```python
  app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
  ```

#### 反向代理範例 (Nginx)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 後端 API
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 生成的圖像
    location /generated_images {
        proxy_pass http://127.0.0.1:8000;
    }

    # 生成的音效
    location /generated_sounds {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

---

## 附錄

### 與原 spec.md 的主要差異

#### 新增功能（原 spec 未提及）
1. **截圖系統**: WebSocket 驅動的遠端截圖請求與管理
2. **音效生成**: 整合 ElevenLabs，從圖像分析自動產生配樂
3. **多種前端模式**: 原 spec 只提一種視覺化，實際有 7 種
4. **相機預設**: 視角儲存與套用
5. **Iframe 組合**: 多視窗組合展示
6. **搜尋模式**: 獨立的以圖搜圖/文字搜尋 UI
7. **有機房間**: 沉浸式立方體探索
8. **批次索引**: 分頁索引支援

#### 修正/明確化
1. **Embedding 模型**: 原 spec 說用 Google，實際主要用 OpenAI `text-embedding-3-small`
2. **資料夾結構**: 實際的 `backend/` 子目錄與原 spec 不同
3. **基因池**: 支援多路徑配置
4. **生成參數**: 原 spec 只提 strength 0.5-0.7，實際支援更多參數（尺寸、格式、resize mode 等）
5. **親緣圖結構**: 原 spec 未詳述 `lineage_graph` 結構，實際有明確的 nodes + edges

### 未來擴充方向
- ✅ 多模態整合（圖像 + 聲音）
- 🔲 語言模型整合（文字生成）
- 🔲 影片生成（從靜態圖像序列）
- 🔲 互動式演化（使用者可即時調整 prompt/參數）
- 🔲 社群分享功能（匯出親緣圖、生成影片）
- 🔲 資料庫支援（目前純 JSON + ChromaDB，可考慮 PostgreSQL）

---

## 參考資源

### 官方文件
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/)
- [Three.js](https://threejs.org/docs/)
- [ChromaDB](https://docs.trychroma.com/)
- [Google Gemini API](https://ai.google.dev/gemini-api/docs)
- [OpenAI API](https://platform.openai.com/docs/)
- [ElevenLabs API](https://elevenlabs.io/docs/)

### 專案相關
- [圖像系譜學.md](./圖像系譜學.md): 原始專案理念與論述
- [BILINGUAL_SEARCH_GUIDE.md](./BILINGUAL_SEARCH_GUIDE.md): 雙語搜尋指南
- [docs/](./docs/): 更多技術文件
- [spec_comparison.md](./spec_comparison.md): 新舊 spec 詳細對比

---

**文件結束**

*此規格文件基於 2025-10-23 的程式碼實際狀態撰寫，如有更新請同步修改此文件。*
