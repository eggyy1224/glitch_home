# Admin Mode Frontend AI Map

## Snapshot 管理
- 流程 selector：`data-ai-role="snapshot.instructions"`（步驟 1–4 說明）。
- Step1：`data-ai-role="snapshot.step.client"`，client 輸入 `data-ai-field="snapshot.client"`，重新載入 `data-ai-role="snapshot.action.reload"`.
- Step2（列表）：`data-ai-role="snapshot.step.pick"`；列表 `data-ai-role="snapshot.list"`，行 `data-ai-role="snapshot.row"` + `data-ai-state="selected"`；按鈕 `data-testid="snapshot-load|snapshot-select|snapshot-play|snapshot-delete"`.
- Step3（表單）：`data-ai-role="snapshot.step.edit"`；名稱/JSON 欄位 `data-ai-field="snapshot.name|snapshot.json"`；儲存/填入預設按鈕 `data-ai-action="snapshot.save|snapshot.fill-default"`.
- 預覽：`data-ai-role="snapshot.preview"`；iframe `data-testid="snapshot-preview-iframe"`；預覽空狀態 `data-ai-role="snapshot.preview-empty"`；狀態訊息 `data-ai-role="snapshot.status"`.

## Timeline 管理
- 流程 selector：`data-ai-role="timeline.instructions"`（步驟 1–4）。
- Step1 篩選：`data-ai-role="timeline.step.filter"`；輸入 `data-ai-field="timeline.filter-client"`；重載 `data-ai-role="timeline.action.reload"`.
- Step2 列表：`data-ai-role="timeline.step.pick"`；列表 `data-ai-role="timeline.list"`；行 `data-ai-role="timeline.row"` + `data-ai-state`；按鈕 `data-testid="timeline-load|timeline-delete"`；當前表單 ID `data-ai-status="timeline.current-selection"`.
- 複製：`data-ai-role="timeline.clone"`，欄位 `data-ai-field="timeline.clone.*"`.
- Step3 編輯：`data-ai-role="timeline.step.edit"`；id/JSON 欄位 `data-ai-field="timeline.id|timeline.json"`；操作 `data-testid="timeline-create|timeline-update|timeline-fill-default"`.
- Step4 播放：`data-ai-role="timeline.step.play"`；目標 `data-ai-field="timeline.play-target"`；按鈕 `data-testid="timeline-play"`；狀態 `data-ai-role="timeline.play-status"`.
- 預覽：容器 `data-ai-role="timeline.preview"`；第一段預覽 `data-ai-role="timeline.preview.first"`，iframe `data-testid="timeline-preview-iframe"`；整段預覽 `data-ai-role="timeline.preview.full"`，iframe `data-testid="timeline-play-preview-iframe"`；錯誤 `data-ai-status="timeline.preview-error"`。

## 狀態 / 排程
- 流程 selector：`data-ai-role="state-queue.instructions"`。
- Client 列表：容器 `data-ai-role="state-queue.client-list"`；摘要 `data-ai-role="state-queue.clients-summary"`；目前操作 client `data-ai-status="state-queue.current-client"`；切換僅線上 `data-ai-action="state-queue.toggle-active-only"`。
- 佇列表單：`data-ai-role="state-queue.form-box"`；headline `data-ai-role="state-queue.headline"`；client 欄位 `data-ai-field="queue.client"`；type `data-ai-field="queue.type"`；target 區 `data-ai-role="queue.target-selector"`（狀態 `data-ai-status="queue.target-options-message"`，載入按鈕 `data-testid="queue-load-options"`）；priority/retries/ETA 分組 `data-ai-role="queue.form-fields-secondary"`；派送按鈕 `data-testid="queue-enqueue"`.
- 佇列表格：容器 `data-ai-role="state-queue.table-box"`；範圍提示 `data-ai-status="queue.scope"`；表格 `data-ai-role="queue.table"`；行/操作按鈕保持既有 `data-ai-action="queue.cancel|queue.move-front|queue.move-back|queue.delay|queue.force-stop"`（force-stop 含 `data-ai-danger="true"`）。
