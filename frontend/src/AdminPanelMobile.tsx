import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import "./AdminPanelMobile.css";
import { AdminPanelContext } from "./AdminPanelContext";
import {
  fetchClientStates,
  listEpisodes,
  listIframeSnapshots,
  listIframeTimelines,
  listScenes,
  listScripts,
  playEpisode,
  playIframeTimeline,
  playScene,
  playScript,
  restoreIframeSnapshot,
  stopIframeTimeline,
} from "./api";
import type { ClientState, EpisodeEntry, IframeTimeline, SnapshotEntry } from "./types/admin";
import type { Scene, Script } from "./types/scene";

type QuickActionType = "snapshot" | "timeline" | "episode" | "scene" | "script";

const ACTION_LABEL: Record<QuickActionType, string> = {
  snapshot: "Snapshot",
  timeline: "Timeline",
  episode: "Episode",
  scene: "Scene",
  script: "Script",
};

const buildOptionLabel = (value: { id?: string; name?: string; title?: string; client?: string | null; clientId?: string | null }) => {
  const id = (value as { id?: string }).id || (value as { name?: string }).name || "";
  const title = (value as { title?: string }).title;
  const client = (value as { client?: string }).client || (value as { clientId?: string }).clientId;
  const parts = [id];
  if (client) parts.push(`@${client}`);
  if (title) parts.push(`· ${title}`);
  return parts.join(" ");
};

export default function AdminPanelMobile() {
  const { defaultClientId, appMode, canWriteMetadata, canAnalyze, canRebuildIndex, forbidMessage } =
    useContext(AdminPanelContext);
  const [clientId, setClientId] = useState(defaultClientId || "desktop");
  const [clientStates, setClientStates] = useState<ClientState[]>([]);
  const [clientMessage, setClientMessage] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);
  const [quickType, setQuickType] = useState<QuickActionType>("snapshot");
  const [targetId, setTargetId] = useState("");
  const [allowDraft, setAllowDraft] = useState(false);
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [optionsMessage, setOptionsMessage] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);
  const optionsRequestRef = useRef(0);

  const resolvedClient = useMemo(() => (clientId || defaultClientId || "").trim(), [clientId, defaultClientId]);

  const selectedState = useMemo(
    () => clientStates.find((item) => item.client_id === resolvedClient || item.id === resolvedClient),
    [clientStates, resolvedClient],
  );

  const onlineClients = useMemo(
    () => clientStates.filter((item) => item.status && item.status !== "offline"),
    [clientStates],
  );

  useEffect(() => {
    setClientId(defaultClientId || "desktop");
  }, [defaultClientId]);

  const refreshClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const states = await fetchClientStates();
      setClientStates(states);
      const online = states.filter((item) => item.status && item.status !== "offline").length;
      setClientMessage(`已載入 ${states.length} 個 client（在線 ${online}）`);
    } catch (err) {
      setClientMessage((err as Error)?.message || "載入 client 狀態失敗");
    } finally {
      setLoadingClients(false);
    }
  }, []);

  const refreshOptions = useCallback(async () => {
    const requestId = optionsRequestRef.current + 1;
    optionsRequestRef.current = requestId;
    setLoadingOptions(true);
    try {
      if ((quickType === "snapshot" || quickType === "timeline") && !resolvedClient) {
        setOptions([]);
        setOptionsMessage("請先填入 client");
        return;
      }
      if (quickType === "snapshot") {
        const data = await listIframeSnapshots(resolvedClient || null);
        const list = Array.isArray(data?.snapshots) ? (data.snapshots as SnapshotEntry[]) : [];
        if (optionsRequestRef.current === requestId) {
          setOptions(list.map((item) => ({ value: item.name || "", label: buildOptionLabel(item) })));
          setOptionsMessage(`已載入 ${list.length} 個 snapshot`);
        }
        return;
      }
      if (quickType === "timeline") {
        const data = await listIframeTimelines(resolvedClient || null);
        const list = Array.isArray(data?.timelines) ? (data.timelines as IframeTimeline[]) : [];
        if (optionsRequestRef.current === requestId) {
          setOptions(list.map((item) => ({ value: item.id || "", label: buildOptionLabel(item) })));
          setOptionsMessage(`已載入 ${list.length} 個 timeline`);
        }
        return;
      }
      if (quickType === "episode") {
        const data = await listEpisodes();
        const list = Array.isArray(data?.episodes) ? (data.episodes as EpisodeEntry[]) : [];
        if (optionsRequestRef.current === requestId) {
          setOptions(list.map((item) => ({ value: item.id || "", label: buildOptionLabel(item) })));
          setOptionsMessage(`已載入 ${list.length} 個 episode`);
        }
        return;
      }
      if (quickType === "scene") {
        const data = await listScenes();
        const list = Array.isArray(data?.scenes) ? (data.scenes as Scene[]) : [];
        if (optionsRequestRef.current === requestId) {
          setOptions(list.map((item) => ({ value: item.id || "", label: buildOptionLabel(item) })));
          setOptionsMessage(`已載入 ${list.length} 個 scene`);
        }
        return;
      }
      const data = await listScripts();
      const list = Array.isArray(data?.scripts) ? (data.scripts as Script[]) : [];
      if (optionsRequestRef.current === requestId) {
        setOptions(list.map((item) => ({ value: item.id || "", label: buildOptionLabel(item) })));
        setOptionsMessage(`已載入 ${list.length} 個 script`);
      }
    } catch (err) {
      if (optionsRequestRef.current === requestId) {
        setOptions([]);
        setOptionsMessage((err as Error)?.message || "載入列表失敗");
      }
    } finally {
      if (optionsRequestRef.current === requestId) {
        setLoadingOptions(false);
      }
    }
  }, [quickType, resolvedClient]);

  useEffect(() => {
    void refreshClients();
  }, [refreshClients]);

  useEffect(() => {
    void refreshOptions();
  }, [quickType, refreshOptions]);

  const handlePlay = useCallback(async () => {
    const trimmedId = targetId.trim();
    const targetClient = resolvedClient;
    if (!trimmedId) {
      setActionMessage(`請先選擇要播放的 ${ACTION_LABEL[quickType]}`);
      return;
    }
    if ((quickType === "snapshot" || quickType === "timeline") && !targetClient) {
      setActionMessage("請先填入 client");
      return;
    }
    setLoadingAction(true);
    setActionMessage("送出中…");
    try {
      if (quickType === "snapshot") {
        await restoreIframeSnapshot(targetClient, trimmedId);
        setActionMessage(`已送出 snapshot ${trimmedId} → ${targetClient}`);
      } else if (quickType === "timeline") {
        await playIframeTimeline(trimmedId, {}, { targetClientId: targetClient });
        setActionMessage(`已送出 timeline ${trimmedId} → ${targetClient}`);
      } else if (quickType === "episode") {
        await playEpisode(trimmedId);
        setActionMessage(`已送出 episode ${trimmedId}`);
      } else if (quickType === "scene") {
        await playScene(trimmedId, null, { allowDraft });
        setActionMessage(`已送出 scene ${trimmedId}${allowDraft ? "（允許草稿）" : ""}`);
      } else {
        await playScript(trimmedId, null, { allowDraft });
        setActionMessage(`已送出 script ${trimmedId}${allowDraft ? "（允許草稿）" : ""}`);
      }
    } catch (err) {
      setActionMessage((err as Error)?.message || "播放失敗");
    } finally {
      setLoadingAction(false);
    }
  }, [allowDraft, quickType, resolvedClient, targetId]);

  const handleStopTimeline = useCallback(async () => {
    if (!resolvedClient) {
      setActionMessage("請先選擇 client");
      return;
    }
    setLoadingAction(true);
    setActionMessage("停止指令送出中…");
    try {
      await stopIframeTimeline(resolvedClient, null, { releaseControl: true });
      setActionMessage(`已送出停止指令給 ${resolvedClient}`);
    } catch (err) {
      setActionMessage((err as Error)?.message || "停止指令失敗");
    } finally {
      setLoadingAction(false);
    }
  }, [resolvedClient]);

  return (
    <div className="admin-mobile" data-ai-id="admin.mobile">
      <h1>Admin Mobile</h1>
      <p className="subtitle">行動版控制面板（自動偵測手機螢幕）。</p>

      {!canWriteMetadata && (
        <div className="card" role="alert">
          <div className="card-title">唯讀模式</div>
          <div className="status">{forbidMessage || `目前 APP_MODE=${appMode} 禁止寫入/播放`}</div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title">控制目標</div>
          <span className="tag">APP_MODE: {appMode}</span>
        </div>
        <div className="field">
          <label htmlFor="mobile-client-id">Client ID（snapshot / timeline 會使用）</label>
          <input
            id="mobile-client-id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="例如 desktop / mobile01"
            inputMode="text"
          />
        </div>
        <div className="inline-actions">
          <button type="button" onClick={() => void refreshClients()} className="ghost" disabled={loadingClients}>
            {loadingClients ? "刷新中…" : "刷新 client 狀態"}
          </button>
          <button type="button" onClick={handleStopTimeline} className="danger" disabled={loadingAction || !canWriteMetadata}>
            緊急停止 timeline
          </button>
        </div>
        <div className="status">{clientMessage}</div>
        {onlineClients.length > 0 && (
          <>
            <div style={{ marginTop: 10, marginBottom: 6 }}>快速選擇在線 client：</div>
            <div className="chips">
              {onlineClients.map((item) => {
                const id = item.client_id || item.id || "";
                if (!id) return null;
                const active = id === resolvedClient;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`chip ${active ? "active" : ""}`}
                    onClick={() => setClientId(id)}
                  >
                    {id}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">快速播放</div>
          <span className="tag">載入列表後可直接送出</span>
        </div>
        <div className="segmented" role="tablist" aria-label="行動版播放類型">
          {(Object.keys(ACTION_LABEL) as QuickActionType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={quickType === type ? "active" : ""}
              onClick={() => {
                setQuickType(type);
                setTargetId("");
                setAllowDraft(false);
              }}
              aria-pressed={quickType === type}
            >
              {ACTION_LABEL[type]}
            </button>
          ))}
        </div>

        <div className="field">
          <label htmlFor="mobile-quick-select">從列表選擇</label>
          <select
            id="mobile-quick-select"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            disabled={loadingOptions}
          >
            <option value="">{loadingOptions ? "載入中…" : "請選擇或手動輸入"}</option>
            {options.map((opt) => (
              <option key={`${opt.value}-${opt.label}`} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="inline-actions">
            <button type="button" onClick={() => void refreshOptions()} className="ghost" disabled={loadingOptions}>
              {loadingOptions ? "重新整理中…" : "重新整理列表"}
            </button>
            {(quickType === "scene" || quickType === "script") && (
              <button
                type="button"
                className="ghost"
                onClick={() => setAllowDraft((v) => !v)}
                aria-pressed={allowDraft}
              >
                {allowDraft ? "允許草稿：開" : "允許草稿：關"}
              </button>
            )}
          </div>
          <div className="status">{optionsMessage}</div>
        </div>

        <div className="field">
          <label htmlFor="mobile-target-id">手動輸入 ID</label>
          <input
            id="mobile-target-id"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder={`${ACTION_LABEL[quickType]} id / 名稱`}
          />
        </div>

        <button type="button" onClick={() => void handlePlay()} disabled={loadingAction || !canWriteMetadata}>
          {loadingAction ? "送出中…" : `播放 ${ACTION_LABEL[quickType]}`}
        </button>
        <div className="status">{actionMessage}</div>
        <div className="note">Snapshot / Timeline 會使用上方 Client；其他類型沿用預設配置。</div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Client 狀態</div>
          <span className="tag">可用能力：{canAnalyze ? "Analyze" : "無"}, {canRebuildIndex ? "Rebuild" : "No Rebuild"}</span>
        </div>
        {selectedState ? (
          <div className="list">
            <div className="list-item">
              <div>
                <div>狀態：{selectedState.status || "未知"}</div>
                <div className="meta">Queue size: {selectedState.queue_size ?? "-"}</div>
              </div>
              <div className="pill">心跳：{selectedState.last_heartbeat || "無"}</div>
            </div>
            {selectedState.current_item && (
              <div className="list-item">
                <div>
                  <div>執行中：{selectedState.current_item.type || "-"} / {selectedState.current_item.target_id || "-"}</div>
                  <div className="meta">ID: {selectedState.current_item.id}</div>
                </div>
                <div className="pill">優先權：{selectedState.current_item.priority ?? "-"}</div>
              </div>
            )}
            {selectedState.last_completed_item && (
              <div className="list-item">
                <div>
                  <div>最近完成：{selectedState.last_completed_item.type || "-"} / {selectedState.last_completed_item.target_id || "-"}</div>
                  <div className="meta">ID: {selectedState.last_completed_item.id}</div>
                </div>
                <div className="pill">完成</div>
              </div>
            )}
          </div>
        ) : (
          <div className="status">尚未找到 client 狀態，請刷新並確認上方 Client ID。</div>
        )}
      </div>
    </div>
  );
}
