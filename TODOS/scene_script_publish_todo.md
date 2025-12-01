# 場景／腳本版本化與發布流程 TODO

- 目標：為 Scene/Script 建立版本、草稿與發布流程，並用嚴格型別與測試防護。

## 後端
- 模型（已完成）：Scene/Script 加欄位 version(int)、status(draft/published/deprecated)、created_at/updated_at、published_at、published_by、notes；讀舊檔時預設 version=1、status=published、時間可用檔案 mtime 或 now。
- 儲存策略：`metadata/{scenes,scripts}/{id}.json` 覆寫最新，同步追加 `metadata/history/{scenes,scripts}/{id}/version-XXXX.json`；缺目錄自動建立，設計歷程上限（例保留 N 版或 TTL）與清理函式。
- 競態：所有寫入（PUT/publish/rollback）需帶 expected_version；不符回 409，首次寫入補 version=1/status=published。
- API：新增 `GET /api/{scenes,scripts}/{id}/versions`（列 version/status/時間戳）、`POST /api/{scenes,scripts}/{id}/publish`（可帶 version_note/publish_as）、`POST /api/{scenes,scripts}/{id}/rollback`（指定 version）；`GET /api/.../{id}?version=x` 讀特定版。
- 播放：預設只允許 published；若 `allow_draft=true` 需 metadata_write；播放 payload 帶 version，service 依 version 找歷史檔。publish/rollback 前必做 resolve 驗證 snapshot/scene/audio 引用。
- 權限：publish/rollback 標記 metadata_write，錯誤訊息需區分草稿/發布/回滾。

## 前端 Admin Panel
- ScenesManager/ScriptsManager：列表加 version/status/updated_at；可載入指定版；新增草稿標記、發布、回滾按鈕；表單顯示 version/status/published_at。
- 草稿播放：播放草稿時彈提示，允許選擇只推送 defaultClientId。
- 預覽/比較：提供與最新 published 的 diff/preview（若未實作 diff 先放按鈕占位與 TODO）。
- 權限提示：發布/回滾按鈕標示需 metadata_write，訊息區分草稿/發布/回滾。
- 型別與 API：`types/scene`/`types/script`/api client 回傳型別加 version/status 等欄位；表單 state 改用新型別；api.ts 加 versions/publish/rollback 呼叫。

## 型別與 CI
- 新增 `tsconfig.strict.all.json` 與 `npm run typecheck:all`（前端），納入 CI；清理 any/寬鬆斷言。
- 後端可加入 mypy 設定並覆蓋新模組。

## 測試
- 後端 pytest：CRUD + publish/rollback/versions 列表、草稿播放阻擋、引用驗證失敗、歷程寫入與回滾、版本衝突 409。
- 前端 Vitest/RTL：Admin Panel 版本列表、載入版、發布、回滾、草稿播放警告；mock API 回應含版本欄位。
- E2E（Playwright）：完整「建立草稿 → 發布 → 播放 → 回滾 → 播放」，並驗證型別檢查通過。

## 實作順序
1) 後端模型＋儲存/歷史策略＋競態檢查。  
2) 後端 API/播放邏輯與權限檢查。  
3) 前端型別與 API client 更新，再補 Admin Panel UI/流程。  
4) 加入 typecheck:all / mypy（若要）與 CI。  
5) 撰寫並跑 pytest/Vitest/Playwright。  
