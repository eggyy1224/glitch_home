# 資料治理現況（2025-11-21）

## 盤點狀態
- `backend/metadata` 目前 1342 筆（已將缺圖的 4 筆移到 `backend/metadata/deprecated/`）。約 8MB，已入 git。
- 生成輸出未追蹤：`backend/offspring_images` 約 3.9GB / 1344 張；`backend/generated_sounds` 29MB；`backend/metadata/naration` 1.2MB；`夜遊 - 毛刺` 3.4GB；`embeddings/` 34MB。
- 缺圖的 metadata（已移動）：`offspring_20250930_135849_878.json`、`offspring_20250930_140108_266.json`、`offspring_20250930_213851_542.json`、`offspring_20251013_143452_586.json`。
- 缺 metadata 的圖片（仍在 `backend/offspring_images/`）：`offspring_20251012_181758_851拷貝.png`、`offspring_20251120_184649_562.png`。
- 預設 `iframe_config` 引用特定圖片（如 `offspring_20250929_114732_835.png`）；`_validate_images` 在寫入/還原時會檢查檔案存在，缺檔時會 400。
- 生成流程會自動建立 `offspring_dir`/`metadata_dir`，尚無 `GENERATION_ENABLED` 之類的唯讀開關；`GENES_POOL_DIRS` 缺失時會直接 400。

## 風險
- git 內的 metadata 含絕對路徑（`/Volumes/2024data/...`），換機後路徑不同會失效。
- 已出現圖文不同步（缺圖 0，缺 meta 2），若繼續累積會影響索引/搜尋/展示。
- 預設配置依賴未隨 repo 分發的圖片，換機 PUT/RESTORE snapshot 易報錯。
- 筆電若誤觸生成會落地圖片與 metadata；因 metadata 在 git，可能汙染跨機提交。

## 建議下一步
- 決定單一真相來源：將 `offspring_images`/`metadata` 搬到共享儲存（S3/MinIO/NAS）或維持 git metadata + 同步腳本（rsync/雲端盤）與 hash 校驗。
- 加 `GENERATION_ENABLED` 及 API 守門（`/api/generate/*`），筆電設 `false` 進唯讀；`/health` 檢查 `GENES_POOL_DIRS`、`offspring_dir` 是否存在。
- 加一致性檢查腳本：列出缺圖/缺 meta，提供刪除/標記；缺圖但要保留時在 git 標註「缺檔」。
- 調整預設 `iframe`/`collage` 設定：改用 repo 內存在的示例圖，或缺檔時降級為占位圖，避免換機就 400。
