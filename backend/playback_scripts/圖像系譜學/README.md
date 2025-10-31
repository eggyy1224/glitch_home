# 圖像系譜學 Playback Scripts

本目錄包含兩個互補的演化敘事展示腳本。

## 快速開始

### 環境檢查
```bash
# 確認後端運行
curl http://localhost:8000/health
# 應返回 {"status": "ok"}

# 確認 metadata 存在
ls backend/metadata/offspring_*.json | head
```

---

## 腳本 1: `opening.py` — 原始系譜演化

**概念**: 以網格大小的漸進擴張展現系譜的物理生長。

**5 個 Stages**:
- **Stage 1**: 4×4 祖先種子（核心圖像）
- **Stage 2**: 8×8 第一世代（親代回授的擴張）
- **Stage 3**: 12×12 多代交織（混合 span 展現複雜關係）
- **Stage 4**: 15×15 系譜網絡（完整的視覺生態）

**特色**:
- 使用預設的 `DEFAULT_ANCESTORS` 或自訂圖像集
- 可配置每階段的 gap（間距）、hold（停留時間）、字幕
- 支援 `--dry-run` 預覽 payload

**使用範例**:
```bash
# 基本執行（使用預設祖先）
python backend/playback_scripts/圖像系譜學/opening.py \
  --api-base http://localhost:8000 \
  --client desktop

# 自訂圖像與時序
python backend/playback_scripts/圖像系譜學/opening.py \
  --api-base http://localhost:8000 \
  --client mobile \
  --images offspring_A.png offspring_B.png offspring_C.png \
  --gap-seeds 12 \
  --hold-seeds 30 \
  --dry-run  # 預覽

# 禁用概念敘述，只展示視覺
python backend/playback_scripts/圖像系譜學/opening.py \
  --client desktop \
  --no-concept \
  --hold-seeds 15 \
  --hold-gen1 20
```

---

## 腳本 2: `daily_genealogy_stages.py` — 時間軸敘事演化

**概念**: 以「創始事件」為敘事樞紐，展現 2.5 個月的演化歷程。

**4 個 Stages**（按真實日期分層）:
- **Stage 1** (9/23): 4×4 祖先種子（8.76% 回授率 → 新種子優先）
- **Stage 2** (9/24): 8×8 初次擴張（27.12% 回授率 → 緩速回授）
- **Stage 3** (10/04): 12×12 創始事件（10.96% 回授率 → 大量新種子注入）
- **Stage 4** (10/05-13): 15×15 凝聚網絡（含彩色熱圖，快速回授凝聚）

**特色**:
- 自動從 metadata 讀取 `created_at` 時間戳，無需手動指定圖像
- 計算每日的 offspring parent ratio，顯示創始/回授週期
- Stage 4 支援彩色熱圖（紅 → 藍 漸變，表示序號位置）
- 完整的演化敘事字幕

**使用範例**:
```bash
# 預覽所有階段的統計與結構
python backend/playback_scripts/圖像系譜學/daily_genealogy_stages.py --dry-run

# 完整演出（帶所有字幕與停頓）
python backend/playback_scripts/圖像系譜學/daily_genealogy_stages.py \
  --api-base http://localhost:8000 \
  --client desktop \
  --enable-heatmap

# 快速版（減少停留時間）
python backend/playback_scripts/圖像系譜學/daily_genealogy_stages.py \
  --api-base http://localhost:8000 \
  --client mobile \
  --hold-seeds 5 \
  --hold-gen1 8 \
  --hold-founder 10 \
  --hold-coalesce 15

# 無字幕版本
python backend/playback_scripts/圖像系譜學/daily_genealogy_stages.py \
  --client desktop \
  --no-concept \
  --caption-dur 3
```

---

## 參數對比

| 參數 | opening.py | daily_genealogy_stages.py |
|------|-----------|--------------------------|
| **圖像來源** | 手動指定或預設常數 | 自動從 metadata 按日期讀取 |
| **敘事結構** | 物理擴張（4→8→12→15） | 時間軸敘事（創始→擴張→穩定→凝聚） |
| **適用場景** | 快速展示、藝術化呈現 | 演化科學、數據視覺化 |
| **熱圖支援** | 無（但可通過自訂 span） | 有（Stage 4 自動彩色） |
| **執行時間** | 10-50 秒（含停頓） | 5-50 秒（含停頓） |

---

## 常用命令速記

### 一行快速預覽
```bash
# 查看 opening 結構
python backend/playback_scripts/圖像系譜學/opening.py --dry-run

# 查看日期分層統計
python backend/playback_scripts/圖像系譜學/daily_genealogy_stages.py --dry-run
```

### 展覽現場使用
```bash
# 大屏展示（desktop，無停頓，直接推送）
python backend/playback_scripts/圖像系譜學/daily_genealogy_stages.py \
  --api-base http://localhost:8000 \
  --client display_wall \
  --hold-seeds 0 --hold-gen1 0 --hold-founder 0 --hold-coalesce 0

# 手機界面（mobile，縮短時間）
python backend/playback_scripts/圖像系譜學/daily_genealogy_stages.py \
  --api-base http://localhost:8000 \
  --client mobile \
  --hold-seeds 8 --hold-coalesce 12 \
  --caption-dur 5
```

### 調試與开發
```bash
# 查看 payload 細節
python backend/playback_scripts/圖像系譜學/daily_genealogy_stages.py \
  --dry-run \
  --metadata-dir backend/metadata

# 保存 payload 至檔案（稍後編輯）
python backend/playback_scripts/圖像系譜學/daily_genealogy_stages.py \
  --dry-run > genealogy_payload_dump.txt
```

---

## 字幕自訂

### opening.py
```bash
python backend/playback_scripts/圖像系譜學/opening.py \
  --client desktop \
  --caption-text "自訂標題文字" \
  --sub-seeds "自訂祖先字幕" \
  --sub-gen1 "自訂第一世代字幕" \
  --sub-intertwined "自訂多代字幕" \
  --sub-network "自訂網絡字幕"
```

### daily_genealogy_stages.py
```bash
python backend/playback_scripts/圖像系譜學/daily_genealogy_stages.py \
  --client desktop \
  --caption-text "圖像時間軸：從種子到森林" \
  --sub-seeds "祖先時代：2025-09-23" \
  --sub-gen1 "初次回授：2025-09-24" \
  --sub-founder "創始注入：2025-10-04" \
  --sub-coalesce "風格凝聚：2025-10-05-13"
```

---

## 疑難排解

### Q: 連線錯誤 / HTTP 400
```
❌ HTTP error: 400 Bad Request
無法連線到 http://localhost:8000/api/iframe-config
```

**解決方案**:
1. 確認後端已啟動: `curl http://localhost:8000/health`
2. 確認前端有打開 iframe_mode: `?iframe_mode=true&client=desktop`
3. 檢查圖像是否存在: `ls backend/offspring_images/ | grep offspring_20250923`

### Q: 執行時間太長
```
⏳ 凝視祖先種子 20.0 秒…
```

**解決方案**:
- 使用 `--hold-seeds 0` 等參數移除等待時間
- 或在腳本中修改 `DEFAULT_HOLD_*` 常數

### Q: 看不到字幕
```
❌ 已推送字幕
{"status": "error", "message": "no client connected"}
```

**解決方案**:
- 確認 `--client` 參數與前端 URL 中的 `?client=` 相符
- 確認 WebSocket 已連接（檢查瀏覽器開發者工具）
- 用 `--no-concept` 移除字幕測試

---

## 進階用法

### 組合多個腳本的順序演出
```bash
#!/bin/bash

# 第 1 幕：原始系譜擴張
echo "🎬 第 1 幕：物理擴張…"
python backend/playback_scripts/圖像系譜學/opening.py \
  --client desktop \
  --hold-seeds 15 --hold-gen1 20 \
  --no-concept

echo "⏸️ 第 1 幕結束，等待…"
sleep 5

# 第 2 幕：時間軸敘事
echo "🎬 第 2 幕：時間軸演化…"
python backend/playback_scripts/圖像系譜學/daily_genealogy_stages.py \
  --client desktop \
  --hold-seeds 10 --hold-coalesce 15
```

### 與外部工具串接
```bash
# 在推送之前，先分析 payload
python backend/playback_scripts/圖像系譜學/daily_genealogy_stages.py --dry-run \
  | jq '.panels | length'  # 計算面板數

# 動態改變圖像集（使用 sed）
# 未來可通過 API 或 CLI 參數支援
```

---

## 文件結構

```
backend/playback_scripts/圖像系譜學/
├── opening.py                    # 原始腳本：物理擴張敘事
├── daily_genealogy_stages.py     # 新腳本：時間軸敘事
└── README.md                     # 本檔案
```

## 下一步

- [ ] 實現**提案 A**（系譜樹視覺化）：`visualize_genealogical_tree.py`
- [ ] 實現**提案 C**（雙線並行）：`compare_parallel_lineages.py`
- [ ] 為熱圖著色添加真實深度計算（優化後）
- [ ] 支援從 kinship_index.json 直接讀取親緣樹

---

**版本**: 2.0  
**最後更新**: 2025-10-31  
**維護者**: AI Assistant
