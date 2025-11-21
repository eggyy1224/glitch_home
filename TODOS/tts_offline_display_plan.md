# 展場離線播放／TTS 資料治理方案（草案）

## 情境
- 展場採「離線展示、凍結版本」（`SERVER_MODE=display`），不允許現場生成影像或新 TTS。
- 既有音檔 `backend/generated_sounds/` 未納入 git，但會打包到展場發佈包。
- 旁白/字幕/時間軸會引用既有音檔；缺檔會造成播放中斷或 500。

## 核心策略
- **模式旗標**：環境變數 `SERVER_MODE=display|generate`（預設 generate）。display 時阻擋所有生成（影像、TTS）、所有寫檔動作（可視需求保留字幕/標題更新白名單）。
- **TTS 快取鍵**：`hash = sha256(text|instructions|voice|speed|model|format)`；檔名 `tts_<hash>.mp3`，metadata `backend/metadata/naration/tts_<hash>.json`（可入 git），音檔 `backend/generated_sounds/tts_<hash>.mp3`（不入 git，但要打包）。
- **命中不重算**：TTS API 先查 manifest/檔案；命中回本地 URL；未命中且 `SERVER_MODE=display` → 403/404 + 明確訊息「展場模式不支援生成，需事先烘焙」。
- **缺檔防呆**：展示模式下，若 timeline/字幕引用的音檔不存在，API 回報缺檔（或回傳靜音占位），前端顯示警示，避免整條流程炸掉。

## 發佈前流程（生成機執行）
1) 掃描所有會播音的來源：`backend/metadata/timelines/iframe/*.json`、`backend/metadata/naration/*.json`、其他字幕/旁白設定，提取 (text, voice, speed, model, format, instructions)。
2) 計算 TTS key 並比對 `generated_sounds/`：命中跳過，缺檔就生成並寫入音檔＋metadata。
3) 產生檢查報告：列出缺檔數（應為 0 才可出貨）、總檔案數、總大小。可選擇輸出 checksum 清單供展場開機自檢。
4) 打包展場版：特定 tag（例如 `exhibit-YYYYMMDD`），包含程式碼、`backend/metadata/`、`backend/offspring_images/`、`backend/generated_sounds/`、`embeddings/`、必要素材；`.env` 設 `SERVER_MODE=display`。

## 展場開機檢查
- 檢查 `SERVER_MODE` 是否 display。
- 校驗檔案數/校驗碼（可對 `generated_sounds/`、`offspring_images/`、`metadata/` 做快速統計或 hash）。
- 若缺檔：記錄 log + 在健康檢查/前端顯示警示。

## 待辦（實作順序建議）
1) 加 `SERVER_MODE` 設定＋`/health` 回報；生成路由（影像/TTS）與寫檔路由守門（可白名單字幕/標題）。
2) 實作 TTS 快取鍵 + manifest/檔案命中邏輯；未命中時 display 模式拒絕。
3) 建立「發佈前補齊音檔」腳本：掃描來源 → 生成缺檔 → 檢查報告。
4) 缺檔防呆：展示模式下缺音檔回靜音占位或錯誤提示，避免整條流程中斷。
