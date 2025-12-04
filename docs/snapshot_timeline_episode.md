# Snapshot / Timeline / Episode 關係圖解

> 簡化心智模型：**Snapshot → Timeline → Episode**。Snapshot 是單一畫面配置；Timeline 是一串 Snapshot + 時間軸；Episode 是多條 Timeline 的協同播放。

## 1. Snapshot（iframe 設定快照）
- 內容：`layout/gap/columns/panels[]`，每個 panel 有 `image` 或 `url`、`ratio`、`label`、可選 `col_span/row_span/params`。
- 儲存：`backend/metadata/snapshots/iframe_config/<client>/<name>.json`。
- 主要 API：  
  - 列表：`GET /api/iframe-config/snapshots?client={client}`  
  - 讀取：`GET /api/iframe-config/snapshots/{client}/{name}`（`resolve=true` 會補足完整 URL 與 metadata）  
  - 建立/覆寫：`POST /api/iframe-config/snapshot`  
  - 刪除：`DELETE /api/iframe-config/snapshots/{client}/{name}`  
  - 複製：`POST /api/iframe-config/snapshots/{client}/{name}/clone`
- 用途：作為 Timeline step 的畫面來源。前端播放器在收到 timeline 控制指令時會套用對應的 Snapshot 配置。
- Admin Snapshot Editor 小抄：拖曳資產（含數字檔名）到畫布即可套用；影片拖曳會切到 `video_mode`，圖片會保留既有的 image 模式（含 `slide_mode`），初次選圖片預設會用 `static_mode` 生成預覽 URL。

## 2. Timeline（多 Snapshot 的時間序列）
- 內容：`id`、`title`、`clientId`（步驟預設的 client）、`loop`、`steps[]`。
  - Step：`snapshot`（格式 `client/name` 或 name，若缺 client 會用 step.clientId → timeline.clientId）、`duration`、可選 `at`（起始秒）、`label`、`clientId` 覆寫。
  - 進階動作：`subtitle`/`caption`、`tts`、`remote_clicks[]`、`video_controls[]`、`unlock_audio_targets[]`。
- 儲存：`backend/metadata/timelines/iframe/<id>.json`。
- 主要 API：
  - 列表：`GET /api/iframe-timelines?client={client?}`
  - 讀取：`GET /api/iframe-timelines/{id}`（`resolve=false` 拿原始檔；預設會幫你載入 step.snapshot 對應的 Snapshot 並補完；可帶 `version` 指定歷史版）
  - 建立：`POST /api/iframe-timelines`（支援 `expected_version`，並寫入 `metadata/history/timelines/iframe/{id}`）
  - 覆寫：`PUT /api/iframe-timelines/{id}`（支援 `expected_version`）
  - 複製：`POST /api/iframe-timelines/{id}/clone`
  - 版本：`GET /api/iframe-timelines/{id}/versions`、`POST /api/iframe-timelines/{id}/publish`、`POST /api/iframe-timelines/{id}/rollback`
  - 播放：`POST /api/iframe-timelines/{id}/play`（透過 WebSocket 廣播 `timeline_control` 指令給 target client，可帶 `version`；草稿需先發布或開啟 `allow_draft`）
- 用途：定義單一 client 的播放腳本，或在 Episode 中被多條 track 引用。
- 常見欄位／限制：  
  - `steps` 至少 1 筆；`duration` > 0；`snapshot` 必填且經過 validator 去除空白。  
  - `clientId` 可放在 step 或 timeline；若 step.snapshot 沒帶 client，播放器會 fallback 到 step.clientId → timeline.clientId。  
  - 進階動作欄位（subtitle/caption/tts/remote_clicks/video_controls/unlock_audio_targets）僅在該 step 觸發；unlock_audio_targets 會在 step 前推播解鎖。  
  - `loop` 為 timeline 預設，`loopOverride`/`startStep` 可在 Episode track 覆寫。

## 3. Episode（多 Timeline 的協同編排）
- 內容：`id`、`title`、`description?`、`tags[]`、`tracks[]`。
  - Track：`timelineId`、`targetClientId`、`offset/delay`（欄位 `start_at`）、`autoPlay`、`loopOverride`、`startStep`、`forceIframeMode`。
  - 播放時可再傳「目標 map 覆寫」：`timeline_id:client_id` 逗號分隔，覆寫單次播放的 target。
- 儲存：`backend/metadata/episodes/<id>.json`。
- 主要 API：
  - 列表：`GET /api/episodes`
  - 讀取：`GET /api/episodes/{id}`（`resolve=false` 拿原始檔；預設會連帶 resolve timeline；可帶 `version` 指定歷史版）
  - 建立：`POST /api/episodes`（支援 `expected_version`，並寫入 `metadata/history/episodes/{id}`）
  - 覆寫：`PUT /api/episodes/{id}`（支援 `expected_version`）
  - 複製：`POST /api/episodes/{id}/clone`
  - 版本：`GET /api/episodes/{id}/versions`、`POST /api/episodes/{id}/publish`、`POST /api/episodes/{id}/rollback`
  - 播放：`POST /api/episodes/{id}/play`（會為每個 track 發出一條 `timeline_control`，可附 target map / command_id_prefix，可帶 `version`；草稿需 allow_draft）
- 用途：同時驅動多 client，每條 track 播自己的 Timeline，可設定延遲與覆寫 client。

## 4. 組合關係與播放流程
1) **編輯與儲存**  
   - 先建立 Snapshot（每個 client 各自的畫面配置）。  
   - 用 Snapshot 名稱組成 Timeline steps，必要時覆寫 step 的 `clientId`。  
   - 用多條 Timeline + `targetClientId` 做成 Episode tracks。  
2) **解析（resolve）**  
   - Timeline 讀取時預設 `resolve=true`：會把 step.snapshot 指向的 Snapshot 讀進來並驗證 client；`resolve=false` 只回原始 JSON。  
   - Episode 讀取時預設也會 resolve：替每個 track 把 timeline 解析進來，方便前端檢查。  
3) **播放**  
   - 播放 Timeline：後端廣播 `timeline_control` WS 事件給目標 client，前端 `useIframeTimelinePlayer` 依 step.duration 依序套用 Snapshot。  
   - 播放 Episode：後端對每條 track 各發一條 `timeline_control`，client 依自己的指令播放；若提供 target map，會在這次播放改送指定 client。  
4) **停止與佇列**
   - `POST /api/iframe-timelines/stop` 可結束 client 端 timeline 播放。
   - 也可用 `/api/clients/queue` 把 snapshot/timeline/episode 任務排進特定 client 的 queue（在 `client_queue` 服務裡執行）。
5) **Scene / Script 補充**
   - Scene：更簡化的「client → snapshot」映射，儲存在 `metadata/scenes/` 並保留歷史版本；播放時逐 client 廣播還原 snapshot，可選擇 `audio_mix` 控制左右聲道。【F:backend/app/services/scene.py†L28-L192】【F:backend/app/services/scene.py†L286-L315】
   - Script：以 entries 串接 snapshot/timeline/episode/scene，並可停止執行中的腳本；版本檔與歷史保存在 `metadata/scripts/` 下。【F:backend/app/api/script.py†L52-L192】
6) **校驗與除錯小抄**
   - `resolve=true` 回傳會補上 Snapshot 內容，若找不到檔案或 client 對不上會得到 404 / 驗證錯；Admin Editor 右側會同步顯示驗證錯誤。
   - 首段 Snapshot 預覽：前端會抓 timeline 的第一個有 snapshot 的 step，呼叫 `/api/iframe-config/snapshots/{client}/{name}`；失敗訊息會顯示在預覽區。
   - 播放沒反應：確認 WS 是否連線、client queue 是否被佔用、指令是否被去重（可在 Episode 播放時提供 command_id_prefix）。

## 5. 小抄：常見欄位與預設
- Snapshot panel 必填 `image` 或 `url`，`ratio` > 0。  
- Timeline 必須有 `id` + 至少一個 step；step.duration > 0；`snapshot` 支援 `client/name` 或 name（會 fallback 到 step.clientId → timeline.clientId）。  
- Episode 必須有 `id` + 至少一條 track；track.timelineId 不可空，`targetClientId` 若沒填會沿用 timeline 預設 client。  
- Admin 面板的「以表單覆寫 JSON」與「鎖定 JSON」只影響前端編輯行為，不會改變後端 API 邏輯。

## 6. 範例（縮寫版）
```json
// snapshot: snapshots/iframe_config/desktop/opening.json
{
  "layout": "grid",
  "columns": 1,
  "panels": [{ "id": "p1", "url": "/?scene=opening", "ratio": 1 }]
}

// timeline: timelines/iframe/desktop_opening_demo.json
{
  "id": "desktop_opening_demo",
  "clientId": "desktop",
  "steps": [
    { "snapshot": "desktop/opening", "duration": 5, "label": "開場" },
    { "snapshot": "desktop/hero", "duration": 8 }
  ]
}

// episode: episodes/dual_opening.json
{
  "id": "dual_opening",
  "tracks": [
    { "timelineId": "desktop_opening_demo", "targetClientId": "desktop" },
    { "timelineId": "desktop2_opening_demo", "targetClientId": "desktop2", "startAt": 2 }
  ]
}
```
