import React from "react";
import { boxStyle, columnStyle } from "../../AdminPanelStyles";
import type { ClientState } from "../../types/admin";

function StatusBadge({ status }: { status?: string | null | undefined }) {
  const palette: Record<"online" | "busy" | "idle" | "offline", string> = {
    online: "#3aff85",
    busy: "#f4c15c",
    idle: "#7ad7ff",
    offline: "#5a6b5f",
  };
  const color = status && status in palette ? palette[status as keyof typeof palette] : "#5a6b5f";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: color,
        color: "#041408",
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        boxShadow: "0 0 0 1px rgba(27, 75, 46, 0.4), 0 8px 16px rgba(0, 0, 0, 0.35)",
      }}
    >
      {status || "unknown"}
    </span>
  );
}

function ClientCard({
  client,
  active,
  onSelect,
}: {
  client: ClientState;
  active: boolean;
  onSelect: (id?: string | null) => void;
}) {
  const { client_id: id, status, last_heartbeat: heartbeat, queue_size: queueSize, current_item: currentItem, errors } = client;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      data-ai-item={`client:${id || "unknown"}`}
      data-ai-action="state-queue.select-client"
      aria-pressed={active}
      aria-label={`client ${id || "未命名"} 狀態 ${status || "unknown"}`}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 10,
        border: `1px solid ${active ? "#0f4" : "#0f4"}`,
        padding: 12,
        background: active ? "#020" : "#000",
        cursor: "pointer",
        color: "#e1ffe9",
        boxShadow: "none",
        transition: "border-color 0.1s ease, background 0.1s ease",
        transform: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{id || "(未命名 client)"}</div>
        <StatusBadge status={status} />
      </div>
      <div style={{ fontSize: 12, color: "#82dca5", marginBottom: 4, letterSpacing: "0.02em" }}>
        Heartbeat: {formatTime(heartbeat)}
      </div>
      <div style={{ fontSize: 13, marginBottom: 4 }}>
        佇列：<strong>{queueSize}</strong>
      </div>
      <div style={{ fontSize: 13, minHeight: 18 }}>
        {currentItem ? (
          <span>
            執行中：{currentItem.type}/{currentItem.target_id || "-"} {currentItem.status === "running" ? "..." : ""}
          </span>
        ) : (
          <span style={{ color: "#82dca5" }}>目前無執行項目</span>
        )}
      </div>
      {errors && errors.length > 0 && (
        <div style={{ marginTop: 6, color: "#ff6b6b", fontSize: 12, lineHeight: 1.4 }}>
          錯誤：{errors.slice(-2).join(" / ")}
        </div>
      )}
    </button>
  );
}

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

interface ClientListSectionProps {
  clients: ClientState[];
  filteredClients: ClientState[];
  selectedClient: string;
  activeClient: string;
  loadingState: boolean;
  showActiveOnly: boolean;
  message: string;
  onToggleActiveOnly: () => void;
  onRefresh: () => void;
  onSelectClient: (id: string) => void;
}

export function ClientListSection({
  clients,
  filteredClients,
  selectedClient,
  activeClient,
  loadingState,
  showActiveOnly,
  message,
  onToggleActiveOnly,
  onRefresh,
  onSelectClient,
}: ClientListSectionProps) {
  return (
    <div style={{ ...columnStyle, minWidth: 360 }} data-ai-section="state-queue.clients">
      <div style={boxStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Client 狀態</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onToggleActiveOnly}
              style={{ padding: "6px 10px" }}
              data-ai-action="state-queue.toggle-active-only"
              aria-pressed={showActiveOnly}
            >
              {showActiveOnly ? "顯示全部" : "只看線上/idle"}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              style={{ padding: "6px 10px" }}
              data-ai-action="state-queue.refresh"
            >
              重新整理
            </button>
          </div>
        </div>
        <div
          style={{ fontSize: 12, color: "#82dca5", marginBottom: 8, letterSpacing: "0.02em" }}
          role="status"
          aria-live="polite"
          data-ai-role="state-queue.clients-summary"
        >
          {loadingState
            ? "載入中..."
            : showActiveOnly
              ? `顯示 ${filteredClients.length}/${clients.length} 台 (線上/idle)`
              : `共 ${clients.length} 台`}
          {message && (
            <span style={{ marginLeft: 8, color: "#3aff85" }} data-ai-status="state-queue.clients-message">
              {message}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#82dca5", marginBottom: 6 }} data-ai-status="state-queue.current-client">
          目前操作 client：{activeClient || "(尚未指定)"}
        </div>
        <div style={{ display: "grid", gap: 10 }} role="list" aria-label="client 狀態列表" data-ai-id="state-queue.client-list" data-ai-role="state-queue.client-list">
          {filteredClients.map((client) => (
            <ClientCard
              key={client.client_id || Math.random()}
              client={client}
              active={client.client_id === selectedClient}
              onSelect={(id) => onSelectClient(id || "")}
            />
          ))}
          {filteredClients.length === 0 && (
            <div style={{ color: "#82dca5" }} data-ai-state="empty">
              尚無 client heartbeat
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
