# 預生成 Tile 資料庫計畫

## 目標與動機
1. **脫鉤切片與生成**：先離線裁切、加工並標記 tile，生成時只需挑選與拼裝，降低 CPU 峰值與等待時間。
2. **擴充素材語法**：每個 tile 可帶顏色、紋理、情緒、向量、動態序列等 metadata，未來拼貼模式只需換「索引策略」即可解鎖更多玩法（多階層、語境、動畫）。
3. **可觀測性與快取**：預先產生使得版本可控，可建立指紋、cache 命中率，方便在展場快速回覆需求。

## 系統藍圖
```
╭──────────╮      ╭──────────────╮      ╭─────────────╮      ╭────────────────╮
│ 原始圖像 │───► │ Tile Builder  │───► │ Tile Storage │───► │ Feature Indexer │
╰──────────╯      │ (批次/CLI)    │      │ (FS/雲端)   │      │ (向量/標籤 DB) │
                  ╰──────────────╯      ╰─────────────╯      ╰────────────────╯
                                                    │
                                                    ▼
                                          ╭────────────────────╮
                                          │ Collage Generator  │
                                          │（新模式：引用庫） │
                                          ╰────────────────────╯
```

- **Tile Builder**：負責裁切＋特效（旋轉、濾鏡、形狀遮罩）＋導出多種格式；支援 pipeline 配方。
- **Tile Storage**：以 `{pack_id}/{variant}/{row}_{col}.{ext}` 命名，並寫出 JSON/Parquet metadata，附 hash 與 parent info。
- **Feature Indexer**：為每塊 tile 計算 color histogram、FFT、CLIP embedding、語義標籤，寫入向量庫（FAISS/LiteDB）或 SQLite。
- **Collage Generator**：新增「tile_library」模式，先 query metadata（ex: `情緒=calm & freq_band=high`），拿到 tile 檔案後進入現有 `reassemble_collage` 流程。

## 分階段計畫
### Phase 0：需求對齊與規格
- 定義 tile 類型：`classic_rect`、`hex_patch`、`animated_strip`… 及尺寸級距 (32, 64, 128, 256)。
- 與展示團隊確認必要 metadata 欄位（顏色、亮度、語句、情緒、節奏），並列出未來模式藍圖以確保資料可覆蓋。
- 決定儲存位置（本地 `backend/tile_library/` 或 NFS/S3），並預估容量→帶入監控指標。

### Phase 1：Tile Builder Pipeline
- 新增 `scripts/build_tiles.py`（或 backend management command）：
  - 輸入：來源圖路徑、裁切規則（rows/cols/shapes）、特效 preset。
  - 輸出：tile 影像檔、`tiles_{batch_id}.json`（紀錄 parent → tile 列表）。
  - 支援批次、增量（可依 parent hash 跳過已生成的）。
- 建立 `tile_presets/` 目錄，描述濾鏡與 shape（如 pattern mask、noise overlay），未來 UI 只需點 preset。
- Pipeline 結束後觸發 metadata 器撰寫（Phase 2）。

### Phase 2：Metadata & Feature Index
- 設計 `tile_metadata.schema`：
  ```json5
  {
    "tile_id": "packA_r12_c03_v0",
    "source_parent": "offspring_20241010_...",
    "shape": "rect",
    "size": 128,
    "color_mean": [120, 100, 80],
    "edge_stats": { "top": [...], "right": [...] },
    "luminance": 132.4,
    "fft_bands": [0.12, 0.32, ...],
    "semantic_tags": ["rain", "horse"],
    "clip_embedding": "vec://...",
    "variant": "weave_filter01",
    "created_at": "...",
    "hash": "sha1..."
  }
  ```
- 以 SQLite/Parquet 儲存標量欄位，向量欄位可用 FAISS/Annoy 文件夾。提供簡易查詢 API（Python 函式 + FastAPI endpoint）。
- 加入背景 worker（Celery/RQ/簡易 cron）定期同步 metadata，並輸出狀態報表（總 tiles、語義覆蓋度）。

### Phase 3：Backend API 整合
- `generate_collage_version()` 新增 `tile_source` 參數：
  - `live`（現有流程） / `library`（只從庫裡抓） / `hybrid`（不足時 fallback）。
- 實作 `fetch_tiles_from_library(query, needed_count)`：
  - 依模式構造 query；例如 wave 模式取 `center_bias=high`、source-cluster 模式取 `tag=parentA`。
  - 回傳 `(Image, metadata)` 列表供 `reassemble_collage` 使用。
- Metadata 需寫入 parent 信息外，還要記錄使用的 tile_id，以利後續分析/重現。
- 規劃 Cache：若 query 結果固定，可把 tile 清單寫到 `backend/cache/tile_query/*.json`，加速重複生成。

### Phase 4：前端 & 控制介面
- **Admin/Agent UI**：在 `CollageVersionMode` 增加 `tile_source` 切換與 query builder（情緒、顏色範圍、tile pack）。
- 提供預設模板（ex: `時間漣漪`, `語法拼貼`），實際上對應後端 query preset。
- 顯示庫存：讓使用者知道當前條件有多少 tile 可用，避免生成時才報錯。
- 若搭配 Iframe mode，可顯示 tile 預覽，或用 heatmap 呈現 tile 佔比。

### Phase 5：營運 & 觀測
- 排程：每日/每週觸發 tile builder 更新新增的 parent 圖；需要版本管理（pack_id + version）。
- 監控：寫入 Prometheus/Grafana 指標（tile 數量、metadata 延遲、query cache 命中、磁碟用量）。
- 備援：保留原 live pipeline 以防庫毀損；可在 config 切換 fallback。
- 文檔：更新 `docs/COLLAGE_SYSTEM.md` 與 API 指南，教學如何新增 preset / 生成新 tile batch。

## 風險與待解決項目
1. **磁碟爆炸**：大量 tile（含多尺寸多特效）可能破 TB，需要壓縮/裁減策略；可考慮 WebP + shared dedup（hash-based）。
2. **索引一致性**：影像檔與 metadata 需保持同版本，建議引入 manifest（類似 `tile-pack.json`）並在 deploy 時鎖定版本。
3. **查詢複雜度**：語義 + 向量 + 顏色多條件查詢要有合理 latency，可能需把常見組合預先 materialize。
4. **前端操作複雜**：需提供預設模板與預覽，避免現場操作過度繁瑣。
5. **權限/授權**：若 tile 庫含第三方素材，要有使用條款與敏感內容標記。

## 下一步
- 召集 backend + 算法 + 展場操作團隊確認 Phase 0 規格。
- 評估 Tile Builder 所需 GPU/CPU（若要跑 CLIP/特效）與執行頻率。
- 原型化 Phase 1 + Phase 2：先挑 100 張 parent，生成 64×64 rect tile，測試 metadata 流程與查詢 API。
