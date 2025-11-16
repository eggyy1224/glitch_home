# 專案願景與說明：  
## 「iframe_config 時間軸化」單一 Client 動態播放系統

---

## 一句話願景

在現有 iframe_config 與 snapshot/restore 能力之上，  
把每一個設定 JSON 視為「時間切片」，  
為單一前端 client 加上一條可播放、可重建的「版面時間軸」。

---

## 1. 背景：現有能力

目前系統已經具備：

- **iframe_config 驅動的前端 client**
  - 前端畫面可由後端提供的 `iframe_config` JSON 決定：有哪些 iframe、各自 URL、大小、位置、z-index 等。
  - `backend/metadata/iframe_config__*.json` 代表不同 client 或不同場景的當前配置。

- **snapshot / restore 機制**
  - 可以把當前的 iframe_config 存成 snapshot JSON，並在之後重新載入：
    - 例如：`backend/metadata/snapshots/iframe_config/experimental/...`
  - 這表示 **「某一時刻的畫面狀態」已經可以被檔案化、重現**。

- **周邊播放與控制腳本**
  - backend 有 `playback_scripts`、metadata snapshot、layout 測試腳本等，用來控制開場（opening）、桌面佈局、特定展覽場景。

目前這套設計非常適合「選一個配置 → 套上去 → 看結果」，  
但切換狀態多半是手動或腳本一次性執行，還沒有一條「隨時間推進」的正式時間軸。

---

## 2. 問題與機會

- **問題 1：缺少時間軸概念**
  - snapshot 只能代表「某一個時間點」，沒有描述「這個狀態之前/之後會發生什麼」。
  - 想要做一段 Opening（版面慢慢變化、iframe 一個一個出現），目前需要自己寫腳本或手動操作。

- **問題 2：無法在單一 client 上「連續播放」不同狀態**
  - 雖然有多個 iframe_config 檔案與 snapshot，但它們彼此之間沒有順序與時間關係。
  - 沒有一個「播放這一串 snapshot，每個停留 X 秒」的正式機制。

- **機會：以 snapshot 作為時間切片**
  - 既然 iframe_config snapshot 已經長得像「可重建的畫面狀態」，  
    很自然可以把它們視為時間軸上的「關鍵幀（key frame）」：
    - 每一個 JSON 檔 = 某秒數時的整體版面狀態。
    - 一條時間軸 = 一串有順序的 snapshot + 每個階段的停留時間、轉場方式。

---

## 3. 專案目標（這次要完成的事情）

1. **定義「iframe 時間軸（Iframe Timeline）」資料格式**
   - 用一個 JSON（或類似結構）描述：
     - 這條時間軸的 ID / 標題。
     - 由哪些 iframe_config snapshot 組成。
     - 各 snapshot 對應的顯示時間（秒數）或進場時刻。
     - 可選：每段之間的轉場參數（淡入、切換、延遲等）。

2. **在單一 client 上實作「Timeline Player」**
   - 能在前端讀取上述 Timeline 定義：
     - 依時間順序載入對應 snapshot，
     - 呼叫既有的「套用 iframe_config」機制，
     - 按照設定的停留時間自動往下播。
   - 提供基本控制：
     - play / pause / stop，
     - 從頭播放、從特定段落開始。

3. **與現有 snapshot 流程平滑銜接**
   - 讓現有的 snapshot 機制可以直接產生「可放進時間軸」的片段：
     - 例如：在現場試好一個版面 → 存成 snapshot → 在 Timeline JSON 裡引用這個 snapshot 的檔名。
   - 儘量不改變既有檔案結構，只是多了一層「如何串起這些檔案」的描述。

4. **先專注單一 client，未來可延伸到 Episode System**
   - 這個專案的結果，可以視為 Episode System 的「最小單機版」：
     - 把一台螢幕的 iframe 版面，在時間上編排好。
   - 之後若需要多螢幕同步，只要在 Episode System 中把「每個 client 的 iframe timeline」納入更大一層 orchestrator 即可。

---

## 4. 初步設計方向（高層）

### 4.1 Timeline 資料結構（草案）

概念上，一條 timeline 會長得像：

```jsonc
{
  "id": "iframe_timeline_opening_01",
  "title": "Opening: 圖像系譜學 iframe 版面序曲",
  "clientId": "desktop2",
  "steps": [
    {
      "at": 0.0,
      "snapshot": "experimental/step_01_intro.json",
      "duration": 5.0
    },
    {
      "at": 5.0,
      "snapshot": "experimental/step_02_more_windows.json",
      "duration": 7.0
    },
    {
      "at": 12.0,
      "snapshot": "experimental/step_03_density_peak.json",
      "duration": 10.0
    }
  ],
  "loop": false
}
```

- `snapshot`：指向既有的 iframe_config snapshot 檔案（例如 `backend/metadata/snapshots/iframe_config/experimental/...`）。
- `at`：相對起始秒（可選，亦可僅用 `duration` 逐段累積）。
- `duration`：該狀態維持多久，再進入下一個 snapshot。

### 4.2 Timeline Player（前端）

- 前端在啟動時可透過：
  - URL 參數：`?iframe_timeline=opening_01`，或
  - WebSocket / 控制端指令：告訴 client 要播放哪條 timeline。
- Timeline Player 負責：
  - 依序載入 snapshot（透過既有的 iframe_config API 或本地快取）。
  - 在正確時間點呼叫現有的「套用 iframe_config」邏輯。
  - 處理播放控制（暫停時停止切換、恢復時重新計算時間）。

### 4.3 開發策略

- 優先利用現有的：
  - snapshot 檔案格式、
  - 套用 iframe_config 的程式碼、
  - 既有 playback_scripts 的啟動流程。
- 把新邏輯盡量集中在：
  - 一個「timeline 定義」資料結構、
  - 一個「timeline player」模組，
 讓整體變動對既有系統是「加一層」而不是「重寫」。

---

## 5. 非目標（這一階段刻意不做的）

- 不處理多 client 精準同步（那留給完整 Episode System）。
- 不做複雜的 GUI timeline 編輯器：
  - Timeline 可以先由手寫 JSON 或簡單腳本產生。
- 不追求 frame-perfect 動畫過渡：
  - 目前目標是秒級、或 0.5 秒級的狀態切換即可。
- 不修改現有 snapshot 檔的內部結構：
  - 僅在外面加一層「時間軸」描述。

---

## 6. 預期里程碑（簡版 Roadmap）

1. **MVP：手寫 Timeline + 單機播放**
   - 定義 timeline JSON 格式 v0。
   - 實作一個最小的 Timeline Player，可以在單一 client 上：
     - 讀取 2～3 個 snapshot，
     - 按時間順序自動套用、
     - 播完一次 Opening。

2. **整合現有 playback_script / layout 腳本**
   - 思考如何從現有 playback_scripts 或 `layout.sh` 等流程中：
     - 自動產生 snapshot，
     - 或在這些腳本中觸發 timeline 播放。

3. **觀察與調整**
   - 實際在展覽情境中測試：
     - 是否需要更多轉場參數、
     - 是否需要在 timeline 裡加上簡單標記（如小節、章節）。

4. **為 Episode System 預留接口**
   - 在命名與結構上，預留「之後 Episode Player 可以把多條 iframe timeline 組合起來」的空間。

---

## 7. 附錄：範例時間軸

- `backend/metadata/timelines/iframe/desktop2_opening_with_media.json`
  - 使用 `desktop2/opening_stage*` snapshot。
  - 同步示範 `subtitle`、`caption`、`tts`（含 `sound_play`）三種動作欄位。
  - 可作為撰寫含語音/字幕的開場腳本模板。
