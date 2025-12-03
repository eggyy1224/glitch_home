import React from "react";
import { boxStyle } from "../../AdminPanelStyles";
import type { ClientQueueItem } from "../../types/admin";

function formatTime(value: unknown) {
  if (value === null || value === undefined) return "--";
  if (value instanceof Date) return value.toLocaleTimeString();
  if (typeof value === "string" || typeof value === "number") {
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleTimeString();
    } catch (err) {
      return String(value);
    }
  }
  return String(value);
}

function QueueRow({
  item,
  onCancel,
  onMoveFront,
  onMoveBack,
  onDelay,
  onForceStop,
}: {
  item: ClientQueueItem;
  onCancel: (item: ClientQueueItem) => void;
  onMoveFront: (item: ClientQueueItem) => void;
  onMoveBack: (item: ClientQueueItem) => void;
  onDelay: (item: ClientQueueItem, seconds: number) => void;
  onForceStop: (item: ClientQueueItem) => void;
}) {
  const isStopSupported = item.type === "timeline" || item.type === "episode";
  return (
    <tr data-ai-item={`queue:${item.id}`}>
      <td>{item.type}</td>
      <td>{item.target_id}</td>
      <td>{item.status}</td>
      <td>{item.priority}</td>
      <td>{formatTime(item.eta)}</td>
      <td>{formatTime(item.updated_at)}</td>
      <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" onClick={() => onCancel(item)} style={{ padding: "4px 8px" }} data-ai-action="queue.cancel">
          取消
        </button>
        <button type="button" onClick={() => onMoveFront(item)} style={{ padding: "4px 8px" }} data-ai-action="queue.move-front">
          插隊
        </button>
        <button type="button" onClick={() => onMoveBack(item)} style={{ padding: "4px 8px" }} data-ai-action="queue.move-back">
          延後
        </button>
        <button type="button" onClick={() => onDelay(item, 30)} style={{ padding: "4px 8px" }} data-ai-action="queue.delay">
          +30s
        </button>
        {isStopSupported && (
          <button
            type="button"
            onClick={() => onForceStop(item)}
            style={{ padding: "4px 8px", background: "rgba(255, 107, 107, 0.16)" }}
            data-ai-action="queue.force-stop"
            data-ai-danger="true"
          >
            停止播放
          </button>
        )}
      </td>
    </tr>
  );
}

interface QueueTableSectionProps {
  queueItems: ClientQueueItem[];
  loadingQueue: boolean;
  selectedClient: string;
  clientOverride: string;
  onRefresh: () => void;
  onCancel: (item: ClientQueueItem) => void;
  onMoveFront: (item: ClientQueueItem) => void;
  onMoveBack: (item: ClientQueueItem) => void;
  onDelay: (item: ClientQueueItem, seconds: number) => void;
  onForceStop: (item: ClientQueueItem) => void;
}

export function QueueTableSection({
  queueItems,
  loadingQueue,
  selectedClient,
  clientOverride,
  onRefresh,
  onCancel,
  onMoveFront,
  onMoveBack,
  onDelay,
  onForceStop,
}: QueueTableSectionProps) {
  return (
    <div style={boxStyle} data-ai-role="state-queue.table-box">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>佇列列表 {loadingQueue && <span style={{ fontSize: 12 }}>(載入中)</span>}</h3>
        <button
          type="button"
          onClick={onRefresh}
          style={{ padding: "6px 10px" }}
          data-ai-action="queue.reload"
        >
          重新整理
        </button>
      </div>
      <div style={{ marginBottom: 6, fontSize: 12, color: "#82dca5" }} data-ai-status="queue.scope" role="status" aria-live="polite">
        正在查看的 queue client：{selectedClient || clientOverride || "(尚未指定)"}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
          data-ai-id="queue.table"
          data-ai-role="queue.table"
          aria-label="queue 操作表格"
        >
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>type</th>
              <th>target</th>
              <th>status</th>
              <th>priority</th>
              <th>eta</th>
              <th>updated</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {queueItems.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                onCancel={onCancel}
                onMoveFront={onMoveFront}
                onMoveBack={onMoveBack}
                onDelay={onDelay}
                onForceStop={onForceStop}
              />
            ))}
            {queueItems.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 8, color: "#82dca5" }} data-ai-state="empty">
                  尚無佇列項目
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
