# 統一資產庫管理與感知計畫 (Unified Asset Library & Perception Plan)

## 背景與動機
- **資產爆炸**：系統已累積大量 Snapshot、Timeline、Scene 與 Script JSON 檔，且分佈在多個 Client 資料夾下 (`desktop`, `desktop2` 等)。
- **認知斷裂**：目前的自動化排程器 (Director) 無法感知這些資產的「視覺風格」或「聽覺屬性」，只能盲目隨機播放，導致風格不連貫或聲音衝突。
- **管理困難**：缺乏統一的介面來查詢「哪些 Snapshot 適合在早上播放？」或「哪些 Scene 是高能量的？」。

## 核心目標
1.  **統一資產介面**：將 Snapshot、Timeline、Scene、Script 視為同等的「展演資產 (Exhibition Assets)」，建立統一的 Metadata 模型。
2.  **自動化感知 (Auto-Perception)**：不依賴純人工 Tagging，而是透過解析 JSON 內容 + 查詢 ChromaDB 向量，自動計算出資產的「風格指紋 (Style Fingerprint)」。
3.  **容器化管理**：**僅針對已封裝的 Snapshot/Scene 進行向量化與管理**，避開原始素材（mp4/jpg）的複雜相容性問題。
4.  **Director 賦能**：提供高效的搜尋 API，讓 Director 能基於「語義」與「能量等級」進行排程決策。

## 1. 資料模型 (Asset Metadata Model)

需在 `backend/app/models/asset.py` 定義統一模型，套用到所有 JSON 資產。建議採用 Sidecar 模式 (`*.meta.json`) 或由 Indexer 動態維護的 SQLite/Cache。

```python
class AssetMetadata(BaseModel):
    id: str                  # unique path id (e.g., "desktop3/night_stroll_3")
    type: str                # snapshot, timeline, scene, script
    client_id: Optional[str] # 綁定的 client (如 desktop3)，若為 global 則 null
    
    # 人工/規則標籤
    tags: List[str]          # [ritual, ambient, glitch, high-energy]
    mood: str                # calm, chaos, neutral
    audio_level: str         # high, mid, low, mute
    
    # 自動感知特徵 (Computed Features)
    visual_embedding_id: Optional[str] # 關聯到 ChromaDB 的 ID
    energy_score: float      # 0.0 ~ 1.0 (基於色彩、對比、聲音有無)
    content_fingerprint: Dict # { "dominant_color": "#FF0000", "has_video": true }
    
    last_indexed_at: datetime
```

## 2. 自動感知與索引服務 (Asset Indexer Service)

建立一個背景服務 `backend/app/services/asset_indexer.py`，負責：

1.  **掃描與監聽**：遍歷 `backend/metadata/**` 下的所有 JSON。
2.  **內容解析 (Parsing)**：
    *   讀取 JSON，找出裡面引用的 `image` 或 `video` 路徑。
    *   若是影片，檢查是否存在同名 `thumbnail.jpg`，若無則標記需生成。
3.  **向量關聯 (Vector Linking)**：
    *   查詢引用圖片在 ChromaDB 的 Embedding。
    *   若有多張圖（如 Grid 佈局），計算其 **平均向量 (Centroid)** 作為此 Asset 的代表向量。
4.  **規則推論 (Inference)**：
    *   若引用了 `*.mp4` 或 `video_mode=true` -> 標記 `has_audio=true`, `energy_score += 0.3`。
    *   若檔名包含 `flash`, `strobe` -> 標記 `audio_level=high`。
5.  **寫入索引**：將計算出的 Metadata 存入索引庫（記憶體 Cache 或 SQLite）。

## 3. 搜尋與查詢 API (Backend)

提供 Director 與 Admin Panel 使用的統一查詢接口。

- `GET /api/assets/search`
  - `q`: 關鍵字 (檔名)
  - `type`: snapshot | scene | script
  - `client`: desktop | desktop2 | ...
  - `tags`: ritual, ambient
  - `energy_level`: high | mid | low
  - `vector_near`: [float, float, ...] (支援以圖搜圖式的風格查找)
  - `limit`: 筆數限制

## 4. 前端需求 (Admin Panel)

- **統一資產瀏覽器**：取代分散的 Snapshot/Timeline 列表，改為一個整合的 Asset Browser。
- **視覺化標籤**：在列表中顯示自動計算出的 `Energy` 與 `Mood` 標記。
- **相似度推薦**：在編輯 Scene 時，能推薦「風格相近」的 Snapshot（基於向量距離）。
- **手動覆寫 (Override)**：允許人工修正自動判斷錯誤的 Tag 或 Audio Level。

## 5. 執行步驟 (Roadmap)

1.  **Phase 1: 基礎建設**
    - 定義 `AssetMetadata` 模型。
    - 實作 `AssetIndexer` 的掃描與解析邏輯（暫不含向量）。
    - 實作基礎 Search API。

2.  **Phase 2: 感知層接入**
    - 實作 Snapshot -> Image -> ChromaDB 的向量查詢鏈路。
    - 實作 Grid/Multi-panel 的向量聚合算法（平均值或加權）。
    - 處理影片縮圖的生成與索引。

3.  **Phase 3: Director 整合**
    - 修改 `DirectorService`，使其透過 Search API 尋找素材，而非隨機撈檔。
    - 實作「能量流動」邏輯（例如：先播 Low Energy -> 再播 High Energy）。

## 風險與緩解
- **影片無縮圖**：初期索引時若遇影片無縮圖，先用「檔名關鍵字」做備援判斷，並產生 log 提示需補圖。
- **向量計算效能**：索引應為非同步（Async）執行，且只在檔案變更時重算 (Incremental Update)，避免啟動時卡頓。
- **標籤衝突**：人工 Tag 的優先權應高於自動推論 Tag。