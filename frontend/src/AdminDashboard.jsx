import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearCaption,
  clearSubtitle,
  fetchCaptionState,
  fetchClients,
  fetchSubtitleState,
  pushCaption,
  pushContainerLayout,
  pushDisplayState,
  pushSubtitle,
} from "./api.js";
import "./AdminDashboard.css";

const POLL_INTERVAL_MS = 5000;

function keyForClient(clientId) {
  if (clientId == null || `${clientId}`.trim() === "") {
    return "__global__";
  }
  return `${clientId}`;
}

function toTargetId(clientId) {
  if (clientId == null) {
    return null;
  }
  const trimmed = `${clientId}`.trim();
  return trimmed || null;
}

function formatTimestamp(value) {
  if (!value) {
    return "—";
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  } catch (err) {
    return value;
  }
}

function summarizePanels(panels = []) {
  return panels.map((panel) => {
    const id = panel.id ?? panel.label ?? "panel";
    const source = panel.src || panel.url || panel.image || "";
    return { id, source, mode: panel.mode, ratio: panel.ratio, label: panel.label };
  });
}

export default function AdminDashboard() {
  const [clients, setClients] = useState([]);
  const [subtitleMap, setSubtitleMap] = useState({});
  const [captionMap, setCaptionMap] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [busyMap, setBusyMap] = useState({});
  const cancelRef = useRef(false);
  const subtitleRef = useRef({});
  const captionRef = useRef({});

  const setBusy = useCallback((key, value) => {
    setBusyMap((prev) => {
      const next = { ...prev };
      if (value) {
        next[key] = true;
      } else {
        delete next[key];
      }
      return next;
    });
  }, []);

  const isBusy = useCallback(
    (key) => {
      return Boolean(busyMap[key]);
    },
    [busyMap],
  );

  useEffect(() => {
    cancelRef.current = false;
    return () => {
      cancelRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadClients = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetchClients();
      if (cancelRef.current) return;
      const list = Array.isArray(response?.clients) ? response.clients : [];
      setClients(list);

      const uniqueKeys = new Set(list.map((item) => keyForClient(item.client_id)));
      uniqueKeys.add("__global__");
      const targets = Array.from(uniqueKeys);

      const subtitleEntries = await Promise.all(
        targets.map(async (key) => {
          const clientId = key === "__global__" ? null : key;
          try {
            const result = await fetchSubtitleState(clientId);
            if (cancelRef.current) return [key, subtitleRef.current[key] ?? null];
            return [key, result?.subtitle ?? null];
          } catch (err) {
            return [key, null];
          }
        }),
      );
      if (!cancelRef.current) {
        const next = Object.fromEntries(subtitleEntries);
        subtitleRef.current = next;
        setSubtitleMap(next);
      }

      const captionEntries = await Promise.all(
        targets.map(async (key) => {
          const clientId = key === "__global__" ? null : key;
          try {
            const result = await fetchCaptionState(clientId);
            if (cancelRef.current) return [key, captionRef.current[key] ?? null];
            return [key, result?.caption ?? null];
          } catch (err) {
            return [key, null];
          }
        }),
      );
      if (!cancelRef.current) {
        const next = Object.fromEntries(captionEntries);
        captionRef.current = next;
        setCaptionMap(next);
      }

      if (!cancelRef.current) {
        setError(null);
        setLastUpdated(new Date().toISOString());
      }
    } catch (err) {
      if (!cancelRef.current) {
        setError(err instanceof Error ? err.message : "載入失敗");
      }
    } finally {
      if (!cancelRef.current) {
        setIsRefreshing(false);
        setInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      await loadClients();
    };
    run();
    const interval = setInterval(() => {
      run();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadClients]);

  const handleAction = useCallback(
    async (clientKey, actionKey, task, successMessage) => {
      const busyKey = `${clientKey}:${actionKey}`;
      setBusy(busyKey, true);
      try {
        await task();
        setToast({ type: "success", message: successMessage });
        await loadClients();
      } catch (err) {
        const message = err instanceof Error ? err.message : "操作失敗";
        setToast({ type: "error", message });
      } finally {
        setBusy(busyKey, false);
      }
    },
    [loadClients, setBusy],
  );

  const clientCards = useMemo(() => {
    return clients.map((client) => {
      const clientKey = keyForClient(client.client_id);
      const targetId = toTargetId(client.client_id);
      const subtitle = subtitleMap[clientKey];
      const caption = captionMap[clientKey];
      const displayState = client.display_state;
      const containerLayout = client.container_layout;
      const panels = summarizePanels(containerLayout?.panels || []);
      const metadataSamples = Array.isArray(client.sample_metadata)
        ? client.sample_metadata
        : client.sample_metadata
        ? [client.sample_metadata]
        : [];

      return (
        <section key={clientKey} className="client-card">
          <header className="client-card__header">
            <div>
              <h2>
                {client.client_id ? <code>{client.client_id}</code> : <span>全域預設</span>}
              </h2>
              <p className="client-card__subtitle">
                連線 {client.connections ?? 0}、最後心跳 {formatTimestamp(client.last_heartbeat)}
              </p>
            </div>
            <div className="client-card__meta">
              {Array.isArray(client.capabilities) && client.capabilities.length > 0 ? (
                <span className="client-chip">{client.capabilities.join(" · ")}</span>
              ) : (
                <span className="client-chip muted">未回報能力</span>
              )}
            </div>
          </header>

          <div className="client-section">
            <h3>顯示模式</h3>
            {displayState ? (
              <div className="client-grid-row">
                <div className="client-grid-row__column">
                  <p>
                    模式：<strong>{displayState.mode}</strong>
                  </p>
                  <p className="muted">更新：{formatTimestamp(client.display_state?.updated_at)}</p>
                </div>
                <div className="client-grid-row__column">
                  <button
                    type="button"
                    className="client-button"
                    disabled={isBusy(`${clientKey}:display`) || !displayState}
                    onClick={() =>
                      handleAction(clientKey, "display", () => pushDisplayState(displayState, targetId), "已推送顯示模式")
                    }
                  >
                    推播顯示
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted">尚未設定顯示狀態</p>
            )}
            {displayState?.params && Object.keys(displayState.params).length > 0 ? (
              <details className="client-details">
                <summary>模式參數</summary>
                <pre>{JSON.stringify(displayState.params, null, 2)}</pre>
              </details>
            ) : null}
            {displayState?.frames && displayState.frames.length > 0 ? (
              <details className="client-details">
                <summary>Frame 設定</summary>
                <pre>{JSON.stringify(displayState.frames, null, 2)}</pre>
              </details>
            ) : null}
          </div>

          <div className="client-section">
            <h3>Iframe / Collage 配置</h3>
            {containerLayout ? (
              <>
                <div className="client-grid-row">
                  <div className="client-grid-row__column">
                    <p>
                      版型：<strong>{containerLayout.layout}</strong>，欄位 {containerLayout.columns ?? "—"}，間距 {containerLayout.gap ?? "—"}
                    </p>
                    <p className="muted">更新：{formatTimestamp(containerLayout.updated_at)}</p>
                  </div>
                  <div className="client-grid-row__column">
                    <button
                      type="button"
                      className="client-button"
                      disabled={isBusy(`${clientKey}:layout`) || !containerLayout?.raw}
                      onClick={() =>
                        handleAction(
                          clientKey,
                          "layout",
                          () => pushContainerLayout(containerLayout.raw, targetId),
                          "已推送 iframe 配置",
                        )
                      }
                    >
                      推播配置
                    </button>
                  </div>
                </div>
                {panels.length > 0 ? (
                  <details className="client-details">
                    <summary>面板列表（{panels.length}）</summary>
                    <ul className="panel-list">
                      {panels.map((panel) => (
                        <li key={panel.id}>
                          <code>{panel.id}</code>
                          {panel.label ? <span className="muted">（{panel.label}）</span> : null}
                          <div className="panel-source">{panel.source || "—"}</div>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </>
            ) : (
              <p className="muted">尚未儲存 iframe / container 配置</p>
            )}
          </div>

          <div className="client-section">
            <h3>字幕</h3>
            {subtitle ? (
              <div className="client-grid-row">
                <div className="client-grid-row__column">
                  <p className="client-text">{subtitle.text}</p>
                  <p className="muted">
                    {subtitle.language ? `語言：${subtitle.language}｜` : ""}
                    {subtitle.duration_seconds ? `持續 ${subtitle.duration_seconds}s｜` : ""}
                    {subtitle.expires_at ? `到期 ${formatTimestamp(subtitle.expires_at)}` : "無到期"}
                  </p>
                </div>
                <div className="client-grid-row__column client-grid-row__column--actions">
                  <button
                    type="button"
                    className="client-button"
                    disabled={isBusy(`${clientKey}:subtitle`) || !subtitle?.text}
                    onClick={() =>
                      handleAction(
                        clientKey,
                        "subtitle",
                        () => pushSubtitle(subtitle, targetId),
                        "已推播字幕",
                      )
                    }
                  >
                    重送字幕
                  </button>
                  <button
                    type="button"
                    className="client-button ghost"
                    disabled={isBusy(`${clientKey}:subtitle-clear`)}
                    onClick={() =>
                      handleAction(
                        clientKey,
                        "subtitle-clear",
                        () => clearSubtitle(targetId),
                        "已清除字幕",
                      )
                    }
                  >
                    清除字幕
                  </button>
                </div>
              </div>
            ) : (
              <div className="client-grid-row">
                <div className="client-grid-row__column">
                  <p className="muted">目前無字幕</p>
                </div>
                <div className="client-grid-row__column client-grid-row__column--actions">
                  <button
                    type="button"
                    className="client-button ghost"
                    disabled={isBusy(`${clientKey}:subtitle-clear`)}
                    onClick={() =>
                      handleAction(
                        clientKey,
                        "subtitle-clear",
                        () => clearSubtitle(targetId),
                        "已清除字幕",
                      )
                    }
                  >
                    清除字幕
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="client-section">
            <h3>字幕（Caption）</h3>
            {caption ? (
              <div className="client-grid-row">
                <div className="client-grid-row__column">
                  <p className="client-text">{caption.text}</p>
                  <p className="muted">
                    {caption.language ? `語言：${caption.language}｜` : ""}
                    {caption.duration_seconds ? `持續 ${caption.duration_seconds}s｜` : ""}
                    {caption.expires_at ? `到期 ${formatTimestamp(caption.expires_at)}` : "無到期"}
                  </p>
                </div>
                <div className="client-grid-row__column client-grid-row__column--actions">
                  <button
                    type="button"
                    className="client-button"
                    disabled={isBusy(`${clientKey}:caption`) || !caption?.text}
                    onClick={() =>
                      handleAction(
                        clientKey,
                        "caption",
                        () => pushCaption(caption, targetId),
                        "已推播 caption",
                      )
                    }
                  >
                    重送 caption
                  </button>
                  <button
                    type="button"
                    className="client-button ghost"
                    disabled={isBusy(`${clientKey}:caption-clear`)}
                    onClick={() =>
                      handleAction(
                        clientKey,
                        "caption-clear",
                        () => clearCaption(targetId),
                        "已清除 caption",
                      )
                    }
                  >
                    清除 caption
                  </button>
                </div>
              </div>
            ) : (
              <div className="client-grid-row">
                <div className="client-grid-row__column">
                  <p className="muted">目前無 caption</p>
                </div>
                <div className="client-grid-row__column client-grid-row__column--actions">
                  <button
                    type="button"
                    className="client-button ghost"
                    disabled={isBusy(`${clientKey}:caption-clear`)}
                    onClick={() =>
                      handleAction(
                        clientKey,
                        "caption-clear",
                        () => clearCaption(targetId),
                        "已清除 caption",
                      )
                    }
                  >
                    清除 caption
                  </button>
                </div>
              </div>
            )}
          </div>

          {metadataSamples.length > 0 ? (
            <div className="client-section">
              <h3>Metadata 樣本</h3>
              <details className="client-details">
                <summary>顯示 {metadataSamples.length} 筆樣本</summary>
                <pre>{JSON.stringify(metadataSamples, null, 2)}</pre>
              </details>
            </div>
          ) : null}
        </section>
      );
    });
  }, [captionMap, clients, handleAction, isBusy, subtitleMap]);

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div>
          <h1>集中式裝置管理面板</h1>
          <p className="muted">圖形化檢視 / 推播控制，依據 GET /api/clients 即時更新</p>
        </div>
        <div className="dashboard-actions">
          <button type="button" className="client-button" disabled={isRefreshing} onClick={() => loadClients()}>
            重新整理
          </button>
          <span className="muted">每 {Math.round(POLL_INTERVAL_MS / 1000)} 秒自動更新</span>
          {lastUpdated ? <span className="muted">最後更新：{formatTimestamp(lastUpdated)}</span> : null}
        </div>
      </header>
      {toast ? <div className={`dashboard-toast ${toast.type}`}>{toast.message}</div> : null}
      {error ? <div className="dashboard-error">{error}</div> : null}
      {initialLoading ? (
        <div className="dashboard-loading">載入中…</div>
      ) : clients.length === 0 ? (
        <div className="dashboard-empty">尚未連線任何 client</div>
      ) : (
        <div className="client-grid">{clientCards}</div>
      )}
    </div>
  );
}
