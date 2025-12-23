import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AdminPanelContext } from "../AdminPanelContext";
import { columnsStyle, columnStyle } from "../AdminPanelStyles";
import { useClientStateQueue } from "../hooks/useClientStateQueue";
import { listEpisodes, listIframeSnapshots, listIframeTimelines, listScenes, listScripts } from "../api";
import type { EpisodeEntry, IframeTimeline, SnapshotEntry } from "../types/admin";
import type { Scene, Script } from "../types/scene";
import { ClientListSection } from "./stateQueue/ClientListSection";
import { QueueControlForm } from "./stateQueue/QueueControlForm";
import { QueueTableSection } from "./stateQueue/QueueTableSection";
import ScheduleManager from "./ScheduleManager";

export default function ClientStateQueuePanel() {
  const { defaultClientId } = useContext(AdminPanelContext);
  const [type, setType] = useState("snapshot");
  const [targetId, setTargetId] = useState("");
  const [priority, setPriority] = useState("");
  const [retries, setRetries] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState("");
  const [clientOverride, setClientOverride] = useState(defaultClientId || "");
  const [targetOptions, setTargetOptions] = useState<Array<{ value?: string; label: string }>>([]);
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
        const list = Array.isArray(data?.snapshots) ? (data.snapshots as SnapshotEntry[]) : [];
        if (requestId === targetRequestRef.current) {
          setTargetOptions(list.map((item) => ({ value: item.name || "", label: `${item.client || resolvedClient || ""}/${item.name}` })));
          setTargetOptionsMessage(`已載入 ${list.length} 個 snapshot`);
        }
      } else if (resolvedType === "timeline") {
        const data = await listIframeTimelines(resolvedClient || null);
        const list = Array.isArray(data?.timelines) ? (data.timelines as IframeTimeline[]) : [];
        if (requestId === targetRequestRef.current) {
          setTargetOptions(
            list.map((item) => ({
              value: item.id,
              label: item.title ? `${item.id} · ${item.title}` : item.id,
            })),
          );
          setTargetOptionsMessage(`已載入 ${list.length} 個 timeline`);
        }
      } else if (resolvedType === "episode") {
        const data = await listEpisodes();
        const list = Array.isArray(data?.episodes) ? (data.episodes as EpisodeEntry[]) : [];
        if (requestId === targetRequestRef.current) {
          setTargetOptions(
            list.map((item) => ({
              value: item.id,
              label: item.title ? `${item.id} · ${item.title}` : item.id,
            })),
          );
          setTargetOptionsMessage(`已載入 ${list.length} 個 episode`);
        }
      } else if (resolvedType === "scene") {
        const data = await listScenes();
        const list = Array.isArray(data?.scenes) ? (data.scenes as Scene[]) : [];
        if (requestId === targetRequestRef.current) {
          setTargetOptions(
            list.map((item) => ({
              value: item.id,
              label: item.title ? `${item.id} · ${item.title}` : item.id,
            })),
          );
          setTargetOptionsMessage(`已載入 ${list.length} 個 scene`);
        }
      } else {
        const data = await listScripts();
        const list = Array.isArray(data?.scripts) ? (data.scripts as Script[]) : [];
        if (requestId === targetRequestRef.current) {
          setTargetOptions(
            list.map((item) => ({
              value: item.id,
              label: item.title ? `${item.id} · ${item.title}` : item.id,
            })),
          );
          setTargetOptionsMessage(`已載入 ${list.length} 個 script`);
        }
      }
    } catch (err) {
      if (requestId === targetRequestRef.current) {
        setTargetOptions([]);
        setTargetOptionsMessage((err as Error)?.message || "載入可選目標失敗");
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
      const payload: {
        client_id: string;
        type: string;
        target_id: string;
        retries: number;
        eta: number | null;
        priority?: number;
      } = {
        client_id: activeClient,
        type,
        target_id: targetId.trim(),
        retries: `${retries}` === "" ? 0 : Number(retries),
        eta,
      };
      if (priority !== "") {
        payload.priority = Number(priority);
      }
      await enqueueItem(payload);
      setTargetId("");
    } catch (err) {
      alert((err as Error)?.message || "新增佇列失敗");
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

  const handleRefreshClients = useCallback(() => {
    refreshStates();
    if (selectedClient) refreshQueue(selectedClient);
  }, [refreshStates, refreshQueue, selectedClient]);

  const handleClientChange = useCallback(
    (value: string) => {
      setClientOverride(value);
      setSelectedClient(value);
    },
    [setSelectedClient],
  );

  const handleRefreshQueue = useCallback(() => {
    refreshQueue(selectedClient || clientOverride);
  }, [selectedClient, clientOverride, refreshQueue]);

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

      <ScheduleManager />

      <ClientListSection
        clients={clients}
        filteredClients={filteredClients}
        selectedClient={selectedClient}
        activeClient={activeClient}
        loadingState={loadingState}
        showActiveOnly={showActiveOnly}
        message={message}
        onToggleActiveOnly={() => setShowActiveOnly((v) => !v)}
        onRefresh={handleRefreshClients}
        onSelectClient={(id) => setSelectedClient(id || "")}
      />

      <div style={{ ...columnStyle, minWidth: 520 }} data-ai-section="state-queue.controls">
        <QueueControlForm
          type={type}
          targetId={targetId}
          priority={priority}
          retries={retries}
          etaSeconds={etaSeconds}
          activeClient={activeClient}
          loadingTargets={loadingTargets}
          targetOptions={targetOptions}
          targetOptionsMessage={targetOptionsMessage}
          currentHeadline={currentHeadline}
          onClientChange={handleClientChange}
          onTypeChange={setType}
          onTargetIdChange={setTargetId}
          onPriorityChange={setPriority}
          onRetriesChange={setRetries}
          onEtaChange={setEtaSeconds}
          onLoadTargetOptions={loadTargetOptions}
          onEnqueue={handleEnqueue}
        />

        <QueueTableSection
          queueItems={queueItems}
          loadingQueue={loadingQueue}
          selectedClient={selectedClient}
          clientOverride={clientOverride}
          onRefresh={handleRefreshQueue}
          onCancel={(row) => cancelItems([row.id])}
          onMoveFront={(row) => moveItems([row.id], "front")}
          onMoveBack={(row) => moveItems([row.id], "back")}
          onDelay={(row, seconds) => delayItems([row.id], seconds)}
          onForceStop={(row) => forceStopItem(row)}
        />
      </div>
    </div>
  );
}
