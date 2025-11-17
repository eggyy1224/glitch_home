# 圖像系譜學「紀錄片模式」實作計劃書

## 1. 目標與敘事核心
- 建立即時「紀錄片模式」，由 AI 自主探索並解說圖像系譜學的生成流程、親緣關係與展演應用。
- 流程需支持感知 → 推理 → 執行 → 感知的閉環，並可將思考過程透過旁白 (TTS) 廣播給觀眾。
- 產出可在多個展示端 (desktop、desktop2、mobile 等) 之間切換鏡頭，整合圖像、向量搜尋、親緣資料與聲音敘事。

## 2. 現有資產
- **後端服務**
  - 圖像生成、親緣 API (`/api/generate/mix-two`, `fetchKinship`)。
  - Iframe 佈局儲存與推播 (`save_iframe_config`, `broadcast_iframe_config`)。
  - 截圖請求/回報與音效播放 (`screenshot_requests_manager`, `POST /api/sound-play`)。
  - 多個 playback script，可設定大型拼貼、多螢幕佈局 (10×10, triple layout 等)。
- **前端能力**
  - 3D Kinship Scene、Slide Mode、Search Mode、Iframe Mode、有機房間等多種視覺化模組。
  - URL 參數與 WebSocket 控制可即時切換模式、播放向量結果。
- **資料與分析**
  - 1,060+ offspring 影像與 1,144 metadata，具系譜追蹤。
  - `圖像系譜學.md`、`PROJECT_DIRECTION_ANALYSIS.md` 提供豐富背景與敘事素材。
- **腳本與自動化**
  - 多個 Python playback 腳本，可批次設定佈局、驅動多客戶端。
  - 向量搜尋、親緣分析、視覺特徵萃取腳本可復用。

## 3. 欠缺與待建功能
- **整合感知 API**：尚無集中式 `console/state` 聚合每個頻道的即時狀態 (佈局、截圖、Slide 參數)。
- **推理/計畫 API**：缺乏 `console/reasoning` 與行動佇列 (`console/actions`) 的核心框架。
- **旁白/TTS**：目前沒有 TTS 基礎設施與自動旁白播放流程。
- **Documentary overlay**：前端缺少展示章節、字幕與 narration 的 UI。
- **Audit / 日誌**：需要紀錄 reasoning → action → narration 的軌跡，供回放與除錯。
- **Agent 執行腳本**：需建立 script/agent 流程把「感知 → 推理 → 執行」串起來。

## 4. 系統架構藍圖
```
感知層 (Perception)
  ├─ GET /api/console/state (client 狀態 / 佈局 / 截圖)
  ├─ 截圖/分析工具 (向量搜尋、親緣查詢、視覺特徵)
  └─ 感知結果存入 channels[].analysis

推理層 (Reasoning)
  ├─ POST /api/console/reasoning (把狀態 + 章節藍圖送入 LLM)
  └─ 回傳 thought/plan/confidence

執行層 (Action)
  ├─ POST /api/console/actions (設定佈局 / Slide / 觸發 Macro / 請求截圖)
  ├─ 任務佇列與狀態機 (queued → running → done)
  └─ WebSocket 推播 console.action_update

敘事層 (Narration)
  ├─ POST /api/console/narrate (生成旁白腳本 → TTS)
  └─ 旁白檔案透過 POST /api/sound-play 播放 + 字幕同步

前端呈現
  ├─ Documentary Overlay (章節、字幕、進度條)
  └─ 多頻道鏡頭切換 (Iframe/Slide/Search 等)
```

## 5. 開發階段與工作項目
### Phase 0：需求定義與 Blueprint
- 撰寫 Documentary Blueprint Schema (JSON/YAML)，定義章節、核心問題、推薦素材來源。
- 在 `docs/` 加入敘事指南，方便人類/AI 撰寫腳本。

### Phase 1：感知系統
- 實作 `GET /api/console/state`，聚合：
  - 客戶端列表與狀態。
  - Iframe 佈局 (raw + resolved)。
  - SlideMode 參數、目前 anchor 圖像。
  - 最新截圖檔案與快速分析 (若無則可標記需更新)。
- 補齊視覺分析工具：向量搜尋封裝、親緣摘要、色彩/亮度統計 API。

### Phase 2：推理與行動框架
- 新增 `POST /api/console/reasoning`，串聯本地或外部 LLM，輸出 thought/plan/confidence。
- 設計 `POST /api/console/actions` 與任務佇列：
  - 支援 `dry_run`、timeout、取消。
  - 動作種類：`set_layout`、`set_slide_mode`、`trigger_macro`、`request_screenshot` 等。
  - 任務日誌與版本檢查 (ETag) 防止佈局衝突。
- WebSocket 擴充 `console.action_update` 事件。

### Phase 3：旁白/TTS 與解說管線
- 選擇 TTS 方案（自建 VS 外部服務），建立 `POST /api/console/narrate`。
- 產生音檔後寫入 `generated_sounds`，復用 `POST /api/sound-play` 播放。
- 建立字幕/旁白同步：儲存文字腳本，供前端顯示。

### Phase 4：前端 Documentary Overlay
- 在 iframe/主視角頁面新增 Documentary overlay：
  - 顯示章節標題、旁白字幕、目前鏡頭說明。
  - 可視化 timeline，指示正處在哪個章節與段落。
- 支援 narration channel：接收 `console.narration` 事件自動播放/顯示。

### Phase 5：自動化腳本與 Agent 執行
- 寫「紀錄片代理」腳本 (Python)：
  1. 讀取 Documentary Blueprint。
  2. 呼叫 `console/state` 感知 → `console/reasoning` 推理 → `console/actions` 執行 → `console/narrate` 廣播。
  3. 迴圈直到章節完成。
- 建立回放/測試腳本確保代理可在無人干預下完成一輪敘事。
- 擴充 audit log，串連 reasoning/action/narration，供後續檢討與剪輯。

## 6. 工具與 Agent 運作模式
- **感知→執行迴圈**：代理每次執行動作前必須先刷新 `console/state`，並紀錄「狀態快照 → 計畫 → 驗證結果」。
- **工具目錄**：提供 `GET /api/console/tools` 描述可用操作與成本，供代理合理選擇。
- **錯誤復原**：若 action 失敗或結果不符合預期，代理需記錄在 audit log 並透過 narration 說明（可選擇重試或跳章）。
- **MCP 介面整合**：外掛 Agent 透過 MCP 協定呼叫控制 API。需提供：
  - Action schema 對映（例如 `set_layout`, `request_screenshot`）供 MCP tool 宣告。
  - 觀察工具（如 `console/state`）對映為 MCP read-only tool，支援參數化查詢。
  - 安全機制：在 MCP 層檢查 scope/權限，避免非授權 action。
  - 回應結構標準化：以 JSON schema 定義，讓 Agent 可解析結果與錯誤訊息。

## 7. 風險與待決策
- TTS 供應商選擇（成本、延遲、線上/離線）。
- 推理模型的部署方式（本地 GPU vs API）與安全性。
- 佈局切換頻繁時對前端穩定性的影響，需要節流與版本控制。
- 旁白與音效混音需求：是否需要背景音樂 ducking、延遲補償。
- 資料隱私：旁白是否會引用敏感 metadata，需有過濾機制。

## 8. 近期優先任務 (建議)
1. Phase 1 感知 API：開發 `console/state` + 視覺分析封裝。
2. Phase 2 行動佇列：建立 `console/actions` 與 audit log。
3. 選擇 TTS 解決方案並定義 `console/narrate` 介面。
4. 草擬 Documentary Blueprint，挑選 2–3 條示範章節進行內部測試。

---
**備註**：整體計劃可由腳本驅動（純後端工作流）或透過外掛 Agent 執行。建議先完成 API 基礎，再組合成自動化代理與完整紀錄片體驗。***
