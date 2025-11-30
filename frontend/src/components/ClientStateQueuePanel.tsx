import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AdminPanelContext } from "../AdminPanelContext";
import { boxStyle, columnsStyle, columnStyle, labelStyle } from "../AdminPanelStyles";
import { useClientStateQueue } from "../hooks/useClientStateQueue.js";
import { listEpisodes, listIframeSnapshots, listIframeTimelines } from "../api.js";

function formatTime(value) {
  if (!value) return "--";
  try {
    const date = new Date(value);
    return date.toLocaleTimeString();
  } catch (err) {
    return String(value);
  }
}

function StatusBadge({ status }) {
  const palette = {
    online: "#3aff85",
    busy: "#f4c15c",
    idle: "#7ad7ff",
    offline: "#5a6b5f",
  };
  const color = palette[status] || "#5a6b5f";
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

function ClientCard({ client, active, onSelect }) {
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

function QueueRow({ item, onCancel, onMoveFront, onMoveBack, onDelay, onForceStop }) {
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

export default function ClientStateQueuePanel() {
  const { defaultClientId } = useContext(AdminPanelContext);
  const [type, setType] = useState("snapshot");
  const [targetId, setTargetId] = useState("");
  const [priority, setPriority] = useState("");
  const [retries, setRetries] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState("");
  const [clientOverride, setClientOverride] = useState(defaultClientId || "");
  const [targetOptions, setTargetOptions] = useState([]);
  const [targetOptionsMessage, setTargetOptionsMessage] = useState("");
  const [loadingTargets, setLoadingTargets] = useState(false);
  const targetRequestRef = useRef(0);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const {
    clients,
    selectedClient,
    setSelectedClient,
    queueItems,
    loadingState,
    loadingQueue,
    message,
    enqueueItem,
    cancelItems,
    delayItems,
    moveItems,
    forceStopItem,
    refreshStates,
    refreshQueue,
    currentClientState,
  } = useClientStateQueue(defaultClientId);

  const activeClient = selectedClient || clientOverride || defaultClientId || "";

  const filteredClients = useMemo(() => {
    if (!showActiveOnly) return clients;
    return clients.filter((client) => client.status && client.status !== "offline");
  }, [clients, showActiveOnly]);

  const loadTargetOptions = useCallback(async () => {
    const requestId = targetRequestRef.current + 1;
    targetRequestRef.current = requestId;
    const resolvedType = type;
    const resolvedClient = activeClient;

    setTargetOptions([]);
    setLoadingTargets(true);
    try {
      if ((resolvedType === "snapshot" || resolvedType === "timeline") && !resolvedClient) {
        if (requestId === targetRequestRef.current) {
          setTargetOptionsMessage("請先選擇 client");
        }
        return;
      }

      if (resolvedType === "snapshot") {
        const data = await listIframeSnapshots(resolvedClient || null);
        const list = Array.isArray(data?.snapshots) ? data.snapshots : [];
        if (requestId === targetRequestRef.current) {
          setTargetOptions(list.map((item) => ({ value: item.name, label: `${item.name}` })));
          setTargetOptionsMessage(`已載入 ${list.length} 個 snapshot`);
        }
      } else if (resolvedType === "timeline") {
        const data = await listIframeTimelines(resolvedClient || null);
        const list = Array.isArray(data?.timelines) ? data.timelines : [];
        if (requestId === targetRequestRef.current) {
          setTargetOptions(
            list.map((item) => ({
              value: item.id,
              label: item.title ? `${item.id} · ${item.title}` : item.id,
            })),
          );
          setTargetOptionsMessage(`已載入 ${list.length} 個 timeline`);
        }
      } else {
        const data = await listEpisodes();
        const list = Array.isArray(data?.episodes) ? data.episodes : [];
        if (requestId === targetRequestRef.current) {
          setTargetOptions(
            list.map((item) => ({
              value: item.id,
              label: item.title ? `${item.id} · ${item.title}` : item.id,
            })),
          );
          setTargetOptionsMessage(`已載入 ${list.length} 個 episode`);
        }
      }
    } catch (err) {
      if (requestId === targetRequestRef.current) {
        setTargetOptions([]);
        setTargetOptionsMessage(err.message || "載入可選目標失敗");
      }
    } finally {
      if (requestId === targetRequestRef.current) {
        setLoadingTargets(false);
      }
    }
  }, [activeClient, type]);

  useEffect(() => {
    void loadTargetOptions();
  }, [loadTargetOptions]);

  const handleEnqueue = async () => {
    if (!targetId.trim()) {
      alert("請輸入 target id");
      return;
    }
    const eta = etaSeconds ? Number(etaSeconds) : null;
    try {
      await enqueueItem({
        client_id: activeClient,
        type,
        target_id: targetId.trim(),
        priority: priority === "" ? null : Number(priority),
        retries: retries === "" ? 0 : Number(retries),
        eta: eta,
      });
      setTargetId("");
    } catch (err) {
      alert(err.message || "新增佇列失敗");
    }
  };

  const currentHeadline = useMemo(() => {
    if (!currentClientState) return "未選取 client";
    const { current_item: currentItem } = currentClientState;
    if (currentItem) {
      return `執行中：${currentItem.type}/${currentItem.target_id || "-"}`;
    }
    return "目前沒有執行項目";
  }, [currentClientState]);

  return (
    <div style={columnsStyle} data-ai-id="admin.state-queue" data-ai-section="admin.state-queue" data-ai-role="state-queue.panel">
      <section
        aria-label="狀態/排程 操作順序"
        data-ai-role="state-queue.instructions"
        style={{ gridColumn: "1 / -1", marginBottom: 10, padding: "8px 10px", border: "1px solid #0f4", background: "#020" }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>操作順序</div>
        <ol style={{ margin: 0, paddingLeft: 18, color: "#82dca5", lineHeight: 1.5 }}>
          <li data-ai-role="state-queue.step-note.clients">步驟 1：選擇要監控/派送的 client（左側卡片可切換）。</li>
          <li data-ai-role="state-queue.step-note.targets">步驟 2：在右側表單選 type，再按「載入選單」挑 target。</li>
          <li data-ai-role="state-queue.step-note.enqueue">步驟 3：確認 priority/ETA 後按「派送到佇列」。</li>
          <li data-ai-role="state-queue.step-note.queue">步驟 4：在佇列表中可插隊、延後、停止播放等操作（危險操作標示紅色）。</li>
        </ol>
      </section>
      <div style={{ ...columnStyle, minWidth: 360 }} data-ai-section="state-queue.clients">
        <div style={boxStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Client 狀態</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowActiveOnly((v) => !v)}
                style={{ padding: "6px 10px" }}
                data-ai-action="state-queue.toggle-active-only"
                aria-pressed={showActiveOnly}
              >
                {showActiveOnly ? "顯示全部" : "只看線上/idle"}
              </button>
              <button
                type="button"
                onClick={() => {
                  refreshStates();
                  if (selectedClient) refreshQueue(selectedClient);
                }}
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
              <ClientCard key={client.client_id || Math.random()} client={client} active={client.client_id === selectedClient} onSelect={setSelectedClient} />
            ))}
            {filteredClients.length === 0 && (
              <div style={{ color: "#82dca5" }} data-ai-state="empty">
                尚無 client heartbeat
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ ...columnStyle, minWidth: 520 }} data-ai-section="state-queue.controls">
        <div style={boxStyle} data-ai-role="state-queue.form-box">
          <h3 style={{ marginTop: 0 }}>佇列控制</h3>
          <div style={{ marginBottom: 4, color: "#82dca5", letterSpacing: "0.02em", fontSize: 12 }}>
            先選 client 與 type，再載入 target 選單 → 填寫數值後派送。
          </div>
          <div
            style={{ marginBottom: 8, color: "#82dca5", letterSpacing: "0.02em" }}
            role="status"
            aria-live="polite"
            data-ai-status="state-queue.headline"
            data-ai-role="state-queue.headline"
          >
            {currentHeadline}
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }} data-ai-role="queue.form-fields-primary">
            <div>
              <label style={labelStyle} htmlFor="queue-client">
                Client
              </label>
              <input
                id="queue-client"
                type="text"
                value={activeClient}
                onChange={(e) => {
                  setClientOverride(e.target.value);
                  setSelectedClient(e.target.value);
                }}
                placeholder="client id"
                style={{ width: 180 }}
                data-ai-field="queue.client"
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="queue-type">
                類型
              </label>
              <select
                id="queue-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{ padding: 6 }}
                data-ai-field="queue.type"
              >
                <option value="snapshot">snapshot</option>
                <option value="timeline">timeline</option>
                <option value="episode">episode</option>
              </select>
            </div>
            <div style={{ flex: 1 }} data-ai-role="queue.target-selector">
              <label style={labelStyle} htmlFor="queue-target">
                Target ID
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  id="queue-target"
                  type="text"
                  list="queue-target-options"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="snapshot/timeline/episode id"
                  style={{ width: "100%" }}
                  data-ai-field="queue.target-id"
                  aria-describedby="queue-target-status"
                />
                <button
                  type="button"
                  onClick={loadTargetOptions}
                  disabled={loadingTargets}
                  style={{ padding: "6px 10px" }}
                  data-ai-action="queue.load-options"
                  data-testid="queue-load-options"
                >
                  {loadingTargets ? "載入中" : "載入選單"}
                </button>
              </div>
              <datalist id="queue-target-options">
                {targetOptions.map((item) => (
                  <option key={item.value} value={item.value} label={item.label} />
                ))}
              </datalist>
              <div
                id="queue-target-status"
                style={{ marginTop: 4, fontSize: 12, color: "#82dca5", letterSpacing: "0.02em" }}
                role="status"
                aria-live="polite"
                data-ai-status="queue.target-options-message"
              >
                {targetOptionsMessage || "尚未載入 target 選單"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }} data-ai-role="queue.form-fields-secondary">
            <div>
              <label style={labelStyle} htmlFor="queue-priority">
                Priority
              </label>
              <input
                id="queue-priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{ width: 120 }}
                placeholder="0"
                data-ai-field="queue.priority"
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="queue-retries">
                Retries
              </label>
              <input
                id="queue-retries"
                type="number"
                value={retries}
                onChange={(e) => setRetries(Number(e.target.value))}
                style={{ width: 120 }}
                data-ai-field="queue.retries"
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="queue-eta">
                ETA (秒後)
              </label>
              <input
                id="queue-eta"
                type="number"
                value={etaSeconds}
                onChange={(e) => setEtaSeconds(e.target.value)}
                style={{ width: 140 }}
                placeholder="立即"
                data-ai-field="queue.eta"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleEnqueue}
            style={{ padding: "8px 14px", fontWeight: 700 }}
            data-ai-action="queue.enqueue"
            data-testid="queue-enqueue"
          >
            派送到佇列
          </button>
        </div>

        <div style={boxStyle} data-ai-role="state-queue.table-box">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>佇列列表 {loadingQueue && <span style={{ fontSize: 12 }}>(載入中)</span>}</h3>
            <button
              type="button"
              onClick={() => refreshQueue(selectedClient || clientOverride)}
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
                    onCancel={(row) => cancelItems([row.id])}
                    onMoveFront={(row) => moveItems([row.id], "front")}
                    onMoveBack={(row) => moveItems([row.id], "back")}
                    onDelay={(row, seconds) => delayItems([row.id], seconds)}
                    onForceStop={(row) => forceStopItem(row)}
                  />
                ))}
                {queueItems.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ padding: 8, color: "#82dca5" }} data-ai-state="empty">
                      尚無佇列項目
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
