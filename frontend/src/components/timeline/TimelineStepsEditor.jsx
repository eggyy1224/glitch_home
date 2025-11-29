import React, { useMemo } from "react";

export default function TimelineStepsEditor({
  steps,
  selectedRows,
  onToggleRow,
  onMoveRow,
  onDuplicateRow,
  onRemoveRow,
  onAddStep,
  onCopy,
  onPaste,
  canPaste,
  batchDuration,
  onBatchDurationChange,
  onBatchApply,
  snapshotClient,
  snapshotKeyword,
  onSnapshotClientChange,
  onSnapshotKeywordChange,
  onRefreshSnapshots,
  snapshotMessage,
  snapshotOptions,
  onStepChange,
  getSnapshotValue,
}) {
  const totalDuration = useMemo(
    () => (steps || []).reduce((sum, step) => sum + Number(step.duration || 0), 0),
    [steps],
  );

  const handleStepDrag = (event, index) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-timeline-step", String(index));
    event.dataTransfer.setData("text/plain", `step:${index}`);
  };

  const handleStepDrop = (event, targetIndex) => {
    event.preventDefault();
    const raw =
      event.dataTransfer.getData("application/x-timeline-step") || event.dataTransfer.getData("text/plain") || "";
    if (!raw) return;
    const numericRaw = raw.startsWith("step:") ? raw.replace(/^step:/, "") : raw;
    const from = Number(numericRaw);
    if (Number.isNaN(from)) return;
    if (from === targetIndex) return;

    const rect = event.currentTarget?.getBoundingClientRect?.();
    const dropAfter =
      rect != null && Number.isFinite(event.clientY) && Number.isFinite(event.clientX)
        ? event.clientY - rect.top > rect.height / 2 || event.clientX - rect.left > rect.width / 2
        : targetIndex > from;

    let insertIndex = dropAfter ? targetIndex + 1 : targetIndex;
    if (insertIndex > from) insertIndex -= 1;
    if (insertIndex === from) return;

    onMoveRow(from, insertIndex - from);
  };

  return (
    <div data-ai-section="timeline.steps" data-ai-role="timeline.steps-editor">
      <div style={{ border: "1px solid #0f4", padding: 10, marginBottom: 12, background: "#010", borderRadius: 4 }}>
        <div style={{ color: "#82dca5", marginBottom: 6, display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
          <span>時間軸預覽（按比例呈現 duration，點擊 bar 開啟表單細節）</span>
          <span style={{ fontSize: 12 }}>總長度：{totalDuration || 0}s</span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            border: "1px dashed #0f4",
            padding: 6,
            overflowX: "auto",
            background: "#001100",
            minHeight: 60,
          }}
          data-ai-role="timeline.steps-preview"
        >
          {(steps || []).map((step, index) => {
            const percent = totalDuration ? (Number(step.duration || 0) / totalDuration) * 100 : 0;
            const snapshotLabel = getSnapshotValue(step) || step.label || "未命名 snapshot";
            const isActive = selectedRows.includes(index);
            return (
              <button
                data-testid={`timeline-preview-${index}`}
                key={`timeline-bar-${index}`}
                type="button"
                onClick={() => onToggleRow(index)}
                draggable
                onDragStart={(e) => handleStepDrag(e, index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleStepDrop(e, index)}
                style={{
                  flex: `0 0 ${Math.max(percent, 8)}%`,
                  minWidth: 120,
                  border: `2px solid ${isActive ? "#82dca5" : "#0f4"}`,
                  background: isActive ? "#0a280a" : "#021",
                  color: "#c8ffd2",
                  borderRadius: 6,
                  padding: 6,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 12 }}>{snapshotLabel}</div>
                <div style={{ fontSize: 11, color: "#82dca5" }}>duration：{step.duration ?? "?"}s</div>
                <div style={{ fontSize: 11, color: "#82dca5" }}>client：{step.clientId || step.client_id || "(timeline)"}</div>
              </button>
            );
          })}
          {(!steps || steps.length === 0) && (
            <div style={{ color: "#82dca5" }} data-ai-state="empty">
              尚未新增 steps，點擊「新增 step」即可建立
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
        <button type="button" onClick={onAddStep} data-ai-action="timeline.step.add">
          新增 step
        </button>
        <button type="button" onClick={onCopy} disabled={!selectedRows.length} data-ai-action="timeline.step.copy">
          複製選取
        </button>
        <button type="button" onClick={onPaste} disabled={!canPaste} data-ai-action="timeline.step.paste">
          貼上
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          批次 duration
          <input
            type="number"
            value={batchDuration}
            onChange={(e) => onBatchDurationChange(e.target.value)}
            style={{ width: 100 }}
            data-ai-field="timeline.batch.duration"
          />
          <button
            type="button"
            onClick={onBatchApply}
            disabled={!batchDuration || !selectedRows.length}
            data-ai-action="timeline.step.batch-duration"
          >
            套用
          </button>
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="snapshot client"
          value={snapshotClient || ""}
          onChange={(e) => onSnapshotClientChange(e.target.value)}
          style={{ width: 140 }}
          data-ai-field="timeline.snapshot-client"
        />
        <input
          type="text"
          placeholder="keyword"
          value={snapshotKeyword}
          onChange={(e) => onSnapshotKeywordChange(e.target.value)}
          style={{ width: 140 }}
          data-ai-field="timeline.snapshot-keyword"
        />
        <button type="button" onClick={onRefreshSnapshots} data-ai-action="timeline.snapshot.refresh">
          更新 snapshot 選項
        </button>
        {snapshotMessage && (
          <span style={{ color: "#82dca5" }} data-ai-status="timeline.snapshot.message">
            {snapshotMessage}
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(steps || []).map((step, index) => {
          const isSelected = selectedRows.includes(index);
          return (
            <div
              key={index}
              style={{
                border: "1px solid #0f4",
                borderRadius: 0,
                padding: 10,
                background: isSelected ? "#020" : "#000",
                boxShadow: "none",
              }}
              data-ai-item={`timeline.step:${index}`}
              data-ai-role="timeline.step-card"
              data-ai-state={isSelected ? "selected" : "idle"}
            >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleRow(index)}
                  aria-label={`選取 step ${index + 1}`}
                  data-ai-field={`timeline.step[${index}].selected`}
                />
                Step {index + 1}
              </label>
              <button type="button" onClick={() => onMoveRow(index, -1)} aria-label="上移" data-ai-action="timeline.step.move-up">
                ↑
              </button>
              <button type="button" onClick={() => onMoveRow(index, 1)} aria-label="下移" data-ai-action="timeline.step.move-down">
                ↓
              </button>
              <button type="button" onClick={() => onDuplicateRow(index)} aria-label="複製 step" data-ai-action="timeline.step.duplicate">
                複製
              </button>
              <button
                type="button"
                onClick={() => onRemoveRow(index)}
                aria-label="刪除 step"
                data-ai-action="timeline.step.delete"
                data-ai-danger="true"
              >
                刪除
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ display: "flex", flexDirection: "column" }}>
                snapshot
                <select
                  value={getSnapshotValue(step)}
                  onChange={(e) =>
                    onStepChange(index, {
                      snapshot: e.target.value,
                      clientId: e.target.value?.includes("/") ? e.target.value.split("/")[0] : step.clientId,
                    })
                  }
                  data-ai-field={`timeline.step[${index}].snapshot`}
                >
                  <option value="">-- 選擇 snapshot --</option>
                  {(snapshotOptions || []).map((opt) => (
                    <option key={`${opt.client}/${opt.id || opt.name}`} value={`${opt.client}/${opt.id || opt.name}`}>
                      {opt.client}/{opt.id || opt.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                duration（秒）
                <input
                  type="number"
                  value={step.duration ?? ""}
                  onChange={(e) => onStepChange(index, { duration: Number(e.target.value) })}
                  data-ai-field={`timeline.step[${index}].duration`}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                label
                <input
                  type="text"
                  value={step.label || ""}
                  onChange={(e) => onStepChange(index, { label: e.target.value })}
                  data-ai-field={`timeline.step[${index}].label`}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                client override
                <input
                  type="text"
                  value={step.clientId || step.client_id || ""}
                  onChange={(e) => onStepChange(index, { clientId: e.target.value })}
                  data-ai-field={`timeline.step[${index}].client`}
                />
              </label>
            </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
