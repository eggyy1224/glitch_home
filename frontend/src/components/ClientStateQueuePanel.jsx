import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AdminPanelContext } from "../AdminPanelContext";
import { boxStyle, columnsStyle, columnStyle, labelStyle } from "../AdminPanelStyles.js";
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
    online: "#2f9e44",
    busy: "#d9480f",
    idle: "#1971c2",
    offline: "#6b7280",
  };
  const color = palette[status] || "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: color,
        color: "#fff",
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
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
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 10,
        border: active ? "2px solid #111" : "1px solid #ccc",
        padding: 12,
        background: active ? "#fff" : "#f3f4f6",
        cursor: "pointer",
        boxShadow: active ? "0 2px 10px rgba(0,0,0,0.08)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{id || "(未命名 client)"}</div>
        <StatusBadge status={status} />
      </div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Heartbeat: {formatTime(heartbeat)}</div>
      <div style={{ fontSize: 13, marginBottom: 4 }}>
        佇列：<strong>{queueSize}</strong>
      </div>
      <div style={{ fontSize: 13, minHeight: 18 }}>
        {currentItem ? (
          <span>
            執行中：{currentItem.type}/{currentItem.target_id || "-"} {currentItem.status === "running" ? "..." : ""}
          </span>
        ) : (
          <span style={{ color: "#666" }}>目前無執行項目</span>
        )}
      </div>
      {errors && errors.length > 0 && (
        <div style={{ marginTop: 6, color: "#c92a2a", fontSize: 12, lineHeight: 1.4 }}>
          錯誤：{errors.slice(-2).join(" / ")}
        </div>
      )}
    </button>
  );
}

function QueueRow({ item, onCancel, onMoveFront, onMoveBack, onDelay, onForceStop }) {
  const isStopSupported = item.type === "timeline" || item.type === "episode";
  return (
    <tr>
      <td>{item.type}</td>
      <td>{item.target_id}</td>
      <td>{item.status}</td>
      <td>{item.priority}</td>
      <td>{formatTime(item.eta)}</td>
      <td>{formatTime(item.updated_at)}</td>
      <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" onClick={() => onCancel(item)} style={{ padding: "4px 8px" }}>
          取消
        </button>
        <button type="button" onClick={() => onMoveFront(item)} style={{ padding: "4px 8px" }}>
          插隊
        </button>
        <button type="button" onClick={() => onMoveBack(item)} style={{ padding: "4px 8px" }}>
          延後
        </button>
        <button type="button" onClick={() => onDelay(item, 30)} style={{ padding: "4px 8px" }}>
          +30s
        </button>
        {isStopSupported && (
          <button type="button" onClick={() => onForceStop(item)} style={{ padding: "4px 8px", background: "#fee2e2" }}>
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
    <div style={columnsStyle}>
      <div style={{ ...columnStyle, minWidth: 360 }}>
        <div style={boxStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Client 狀態</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowActiveOnly((v) => !v)}
                style={{ padding: "6px 10px" }}
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
              >
                重新整理
              </button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>
            {loadingState
              ? "載入中..."
              : showActiveOnly
                ? `顯示 ${filteredClients.length}/${clients.length} 台 (線上/idle)`
                : `共 ${clients.length} 台`}
            {message && <span style={{ marginLeft: 8, color: "#111" }}>{message}</span>}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {filteredClients.map((client) => (
              <ClientCard key={client.client_id || Math.random()} client={client} active={client.client_id === selectedClient} onSelect={setSelectedClient} />
            ))}
            {filteredClients.length === 0 && <div style={{ color: "#777" }}>尚無 client heartbeat</div>}
          </div>
        </div>
      </div>

      <div style={{ ...columnStyle, minWidth: 520 }}>
        <div style={boxStyle}>
          <h3 style={{ marginTop: 0 }}>佇列控制</h3>
          <div style={{ marginBottom: 8, color: "#333" }}>{currentHeadline}</div>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
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
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="queue-type">
                類型
              </label>
              <select id="queue-type" value={type} onChange={(e) => setType(e.target.value)} style={{ padding: 6 }}>
                <option value="snapshot">snapshot</option>
                <option value="timeline">timeline</option>
                <option value="episode">episode</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
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
                />
                <button type="button" onClick={loadTargetOptions} disabled={loadingTargets} style={{ padding: "6px 10px" }}>
                  {loadingTargets ? "載入中" : "載入選單"}
                </button>
              </div>
              <datalist id="queue-target-options">
                {targetOptions.map((item) => (
                  <option key={item.value} value={item.value} label={item.label} />
                ))}
              </datalist>
              <div style={{ marginTop: 4, fontSize: 12, color: "#555" }}>{targetOptionsMessage}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
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
              />
            </div>
          </div>
          <button type="button" onClick={handleEnqueue} style={{ padding: "8px 14px", fontWeight: 700 }}>
            派送到佇列
          </button>
        </div>

        <div style={boxStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>佇列列表 {loadingQueue && <span style={{ fontSize: 12 }}>(載入中)</span>}</h3>
            <button type="button" onClick={() => refreshQueue(selectedClient || clientOverride)} style={{ padding: "6px 10px" }}>
              重新整理
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
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
                    <td colSpan="7" style={{ padding: 8, color: "#777" }}>
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
