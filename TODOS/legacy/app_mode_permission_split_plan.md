# 模式與權限拆分 TODO（更新版）

## 核心目標
- 以單一環境變數 `APP_MODE`（STUDIO/CONSOLE/DISPLAY）推導權限：生成、metadata 寫入、資產寫入、重建索引、分析用 LLM。
- Clone 後只改 `.env` 的 `APP_MODE`（與必要 key）即可切換角色，從根阻斷不該有的能力。

## 模式與能力矩陣（定案）
| APP_MODE | enable_generation | enable_metadata_write | enable_asset_write | enable_index_rebuild | enable_analysis_llm |
| -------- | ----------------: | --------------------: | -----------------: | -------------------: | ------------------: |
| STUDIO   | ✅ | ✅ | ✅ | ✅ | ✅ |
| CONSOLE  | ❌ | ✅ | ✅ | ❌ | ✅ |
| DISPLAY  | ❌ | ❌ | ❌ | ❌ | ❌（暫定關） |

> 旗標由 `config.py` 自動推導，其他程式碼只看旗標、不直接 if APP_MODE。

## 現況問題（2025-02）
- 沒有 `APP_MODE`/權限旗標，所有機器可生成與寫檔。
- 生成與寫檔 API 無守門：`api/generation.py`、`api/collage.py`、`api/sound.py`(TTS)、`api/screenshot.py`(sound-effects/bundle) 等。
- metadata/設定寫入無保護：`api/storage.py`、`timeline.py`、`episode.py`、`indexing.py`、`kinship rebuild` 等。
- 前端只靠 query 開啟生成/Admin；無基於環境的限制。
- 金鑰未分離；DISPLAY/CONSOLE 放 key 即可生成；未有唯讀部署指南。

## 決策摘要
- CONSOLE：可做所有 Admin CRUD 與播放控制；不可生成圖像。允許 screenshot、sound-effect、TTS（視為管理）。
- Screenshot/sound-effect/TTS：歸類管理，需 `enable_asset_write=true`；DISPLAY 不需上傳 screenshot、不允許任何寫檔。
- Index/kinship rebuild：僅 STUDIO 可執行；CONSOLE/DISPLAY 只讀。
- Gateway 寫檔責任：生成端（現為 STUDIO backend）負責呼叫模型、寫檔、更新 metadata，caller 只收路徑/metadata；未來若獨立 gateway 也是 gateway 寫檔。
- 資產/metadata 拓撲（Phase 1）：Mac Studio 為唯一寫入點；CONSOLE/DISPLAY 以 git pull + rsync 取只讀副本；DISPLAY 目錄建議 OS 層唯讀。
- 金鑰策略：生成用 key 只在 STUDIO；CONSOLE 只放分析用 key；DISPLAY 不放任何 key。

## 待辦（設定/旗標）
- `backend/app/config.py`：新增 `APP_MODE` 推導 `enable_generation`、`enable_metadata_write`、`enable_asset_write`、`enable_index_rebuild`、`enable_analysis_llm`；非法值直接啟動失敗。
- 暴露 runtime caps：新增 `/api/runtime-caps`（或擴充 `/health`）回傳 `app_mode` 與各旗標，供前端/監控使用。

## 待辦（後端守門）
- 新增守門 dependency（如 `app/utils/permissions.py`）：`require_generation_enabled`、`require_metadata_write_enabled`、`require_asset_write_enabled`、`require_index_rebuild_enabled`，統一 403 payload（含 app_mode/feature），寫 audit log。
- 套用路由：
  - 生成：`api/generation.py`、`api/collage.py`、`api/sound.py` 的生成/TTS、`api/screenshot.py` 的 sound-effects/bundle → `require_generation_enabled`。
  - 資產寫入：`api/screenshots` 上傳、sound-effects/TTS 寫檔 → `require_asset_write_enabled`。
  - metadata/設定寫入：`api/storage.py`（iframe/collage config、snapshots、camera presets）、`api/timeline.py`、`api/episode.py`、snapshot/timeline CRUD → `require_metadata_write_enabled`。
  - 重建索引：`api/indexing.py` rebuild、`api/kinship.py:api_kinship_rebuild` → `require_index_rebuild_enabled`。
- 服務層二次防呆：`services/gemini_image.py`、`collage_version.py`、`tts_openai.py`、`sound_effects.py`、`screenshots.py`、`iframe_config.py`、`collage_config.py`、`iframe_timeline.py`、`episode.py`、`camera_presets.py` 寫檔前檢查旗標。
- 啟動檢查：若模式為 DISPLAY/CONSOLE 但 metadata/asset 目錄可寫，log 警告；缺必要 key 但模式需要時明確提示。

## 待辦（前端）
- 建立 `appMode/capabilities` context：讀 `VITE_APP_MODE` 或 `/api/runtime-caps`，提供 `canGenerate`、`canWriteMetadata`、`canWriteAssets`。
- UI 約束：
  - `canGenerate=false`：忽略 `?generate_mode=true`，隱藏/禁用 Generate/Collage Version 生成按鈕。
  - `canWriteMetadata=false`：Admin Panel 唯讀或隱藏；CRUD 按鈕禁用並提示。
  - Console：顯示完整 Admin 管理工具（含 screenshot/TTS/sound-effect），但不顯示生成圖像頁。
  - Display：只保留展示 UI，不顯示 Admin/Generate。
- 403 顯示：「目前 APP_MODE=... 禁止此操作」。

## 待辦（部署與樣板）
- `.env` 範例：
  - Mac Studio：`APP_MODE=STUDIO` + 生成/分析 key。
  - MacBook Pro：`APP_MODE=CONSOLE`，不放生成 key，可放分析 key。
  - Mac mini：`APP_MODE=DISPLAY`，不放任何 key，metadata/asset 目錄掛唯讀。
- 文件：更新 `backend/README.md`、`docs/API_QUICK_START_GUIDE.md`，新增模式表、旗標說明、403 範例；新增「部署模式與權限」指南（含 rsync/唯讀掛載）。

## 待辦（測試）
- backend：權限守門 pytest（各模式的 403/200）、服務層防呆（直接呼叫寫檔/生成依旗標拒絕）、缺 key/禁用模式時應 403 非 500。
- frontend：Vitest/RTL 驗證 capability 下的 UI 顯示/禁用；Playwright E2E 驗證 DISPLAY/CONSOLE 無法觸發生成。
- TDD 原則：先寫紅燈測試（各模式權限矩陣、403 payload、UI 隱藏/禁用），再逐步實作至綠燈；新增功能前先落測試案例。

## 實際機器對應
- Mac Studio → `APP_MODE=STUDIO`
- MacBook Pro → `APP_MODE=CONSOLE`
- Mac mini → `APP_MODE=DISPLAY`
