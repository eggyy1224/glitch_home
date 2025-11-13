import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearCaption,
  clearSubtitle,
  fetchCaptionState,
  fetchClients,
  fetchCollageConfig,
  fetchIframeConfig,
  fetchSubtitleState,
  saveCollageConfig,
  saveIframeConfig,
  setCaption,
  setSubtitle,
} from "./api.js";
import "./ClientDashboard.css";

const MAX_LISTED_IMAGES = 6;
const MAX_LISTED_PANELS = 6;

const DEFAULT_PENDING_MESSAGES = {
  iframe: "推播中...",
  collage: "推播中...",
  subtitle: "推播中...",
  caption: "推播中...",
};

const DEFAULT_SUCCESS_MESSAGES = {
  iframe: "已推播 iframe 配置",
  collage: "已推播拼貼配置",
  subtitle: "已推播字幕",
  caption: "已推播跑馬燈",
};

const DEFAULT_MISSING_MESSAGES = {
  iframe: "尚未取得 iframe 設定",
  collage: "尚未取得拼貼設定",
  subtitle: "尚無字幕內容",
  caption: "尚無跑馬燈內容",
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
};

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const buildPanelSummary = (panel) => {
  if (!panel) return "—";
  const parts = [];
  if (panel.label) {
    parts.push(panel.label);
  }
  const source = panel.image || panel.url || panel.src;
  if (source) {
    parts.push(source);
  }
  if (panel.params && Object.keys(panel.params).length > 0) {
    parts.push(`params: ${JSON.stringify(panel.params)}`);
  }
  if (typeof panel.ratio === "number") {
    parts.push(`ratio: ${panel.ratio}`);
  }
  if (typeof panel.col_span === "number" || typeof panel.row_span === "number") {
    const spanParts = [];
    if (typeof panel.col_span === "number") spanParts.push(`col=${panel.col_span}`);
    if (typeof panel.row_span === "number") spanParts.push(`row=${panel.row_span}`);
    if (spanParts.length > 0) {
      parts.push(`span: ${spanParts.join(" ")}`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
};

const buildImagesSummary = (images) => {
  if (!Array.isArray(images) || images.length === 0) {
    return { listed: [], remaining: 0 };
  }
  const listed = images.slice(0, MAX_LISTED_IMAGES);
  const remaining = Math.max(0, images.length - listed.length);
  return { listed, remaining };
};

const renderActionStatus = (action) => {
  if (!action) return null;
  const className = `action-status action-${action.status || "info"}`;
  const timeText = action.timestamp ? ` · ${formatTime(action.timestamp)}` : "";
  const message = action.message || (action.status === "pending" ? "處理中..." : "");
  if (!message && !timeText) return null;
  return <div className={className}>{`${message}${timeText}`}</div>;
};

function OverlaySection({ title, overlay, onPush, onClear, action, disabled }) {
  const hasContent = overlay && typeof overlay.text === "string" && overlay.text.trim().length > 0;
  return (
    <div className="config-section">
      <div className="config-section__header">
        <h4>{title}</h4>
        <div className="config-section__actions">
          <button type="button" onClick={onPush} disabled={disabled || !hasContent}>
            推播
          </button>
          {onClear ? (
            <button type="button" onClick={onClear} disabled={disabled && !hasContent}>
              清除
            </button>
          ) : null}
        </div>
      </div>
      {hasContent ? (
        <div className="overlay-content">
          <p className="overlay-text">{overlay.text}</p>
          <div className="overlay-meta">
            <span>語言：{overlay.language || "—"}</span>
            <span>顯示秒數：{overlay.duration_seconds ?? "—"}</span>
            <span>更新時間：{formatDateTime(overlay.updated_at)}</span>
            <span>到期：{formatDateTime(overlay.expires_at)}</span>
          </div>
        </div>
      ) : (
        <p className="muted">目前沒有內容</p>
      )}
      {renderActionStatus(action)}
    </div>
  );
}

function ClientCard({
  label,
  description,
  detail,
  onRefresh,
  disablePush,
  onPushIframe,
  onPushCollage,
  onPushSubtitle,
  onClearSubtitle,
  onPushCaption,
  onClearCaption,
}) {
  const loading = detail?.loading;
  const error = detail?.error;
  const iframe = detail?.iframe;
  const collage = detail?.collage;
  const subtitle = detail?.subtitle;
  const caption = detail?.caption;
  const actions = detail?.actions || {};

  return (
    <div className="client-card">
      <div className="client-card__header">
        <div>
          <h3>{label}</h3>
          {description ? <div className="client-card__description">{description}</div> : null}
        </div>
        {onRefresh ? (
          <button type="button" onClick={onRefresh} disabled={loading}>
            重新整理
          </button>
        ) : null}
      </div>
      {loading ? <div className="muted">載入中...</div> : null}
      {!loading && error ? <div className="client-card__error">{error}</div> : null}
      {!loading && !error ? (
        <>
          <div className="config-section">
            <div className="config-section__header">
              <h4>Iframe 配置</h4>
              <div className="config-section__actions">
                <button type="button" onClick={onPushIframe} disabled={disablePush || !iframe?.raw}>
                  推播
                </button>
              </div>
            </div>
            {iframe ? (
              <>
                <div className="config-meta">
                  <span>佈局：{iframe.layout}</span>
                  <span>欄數：{iframe.columns}</span>
                  <span>間距：{iframe.gap}</span>
                  <span>更新時間：{formatDateTime(iframe.updated_at)}</span>
                </div>
                {Array.isArray(iframe.panels) && iframe.panels.length > 0 ? (
                  <ul className="config-list">
                    {iframe.panels.slice(0, MAX_LISTED_PANELS).map((panel) => (
                      <li key={panel.id || panel.src}>
                        <code>{panel.id || panel.src || "panel"}</code>
                        <span>{buildPanelSummary(panel)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">沒有面板資訊</p>
                )}
                {Array.isArray(iframe.panels) && iframe.panels.length > MAX_LISTED_PANELS ? (
                  <p className="muted">…其餘 {iframe.panels.length - MAX_LISTED_PANELS} 項</p>
                ) : null}
              </>
            ) : (
              <p className="muted">尚未載入 iframe 設定</p>
            )}
            {renderActionStatus(actions.iframe)}
          </div>

          <div className="config-section">
            <div className="config-section__header">
              <h4>Collage 配置</h4>
              <div className="config-section__actions">
                <button type="button" onClick={onPushCollage} disabled={disablePush || !collage?.config}>
                  推播
                </button>
              </div>
            </div>
            {collage?.config ? (
              <>
                <div className="config-meta">
                  <span>來源：{collage.source || "—"}</span>
                  <span>
                    網格：{collage.config.rows} × {collage.config.cols}
                  </span>
                  <span>圖片數：{collage.config.image_count}</span>
                  <span>混合：{collage.config.mix ? "是" : "否"}</span>
                  <span>更新時間：{formatDateTime(collage.updated_at)}</span>
                </div>
                {(() => {
                  const summary = buildImagesSummary(collage.config.images);
                  if (summary.listed.length === 0) {
                    return <p className="muted">未指定圖片清單</p>;
                  }
                  return (
                    <>
                      <ul className="config-list">
                        {summary.listed.map((image) => (
                          <li key={image}>
                            <code>{image}</code>
                          </li>
                        ))}
                      </ul>
                      {summary.remaining > 0 ? (
                        <p className="muted">…其餘 {summary.remaining} 張</p>
                      ) : null}
                    </>
                  );
                })()}
              </>
            ) : (
              <p className="muted">尚未載入拼貼設定</p>
            )}
            {renderActionStatus(actions.collage)}
          </div>

          <OverlaySection
            title="字幕"
            overlay={subtitle}
            onPush={onPushSubtitle}
            onClear={onClearSubtitle}
            action={actions.subtitle}
            disabled={disablePush}
          />

          <OverlaySection
            title="跑馬燈"
            overlay={caption}
            onPush={onPushCaption}
            onClear={onClearCaption}
            action={actions.caption}
            disabled={disablePush}
          />
        </>
      ) : null}
    </div>
  );
}


export default function ClientDashboard() {
  const [clients, setClients] = useState([]);
  const [details, setDetails] = useState({});
  const [globalState, setGlobalState] = useState({
    iframe: null,
    collage: null,
    subtitle: null,
    caption: null,
    loading: true,
    error: null,
    actions: {},
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const updateGlobalState = useCallback((updater) => {
    setGlobalState((prev) => {
      const next = updater(prev);
      return next || prev;
    });
  }, []);

  const setClientState = useCallback((clientId, updater) => {
    setDetails((prev) => {
      const current = prev[clientId];
      if (!current) {
        return prev;
      }
      const nextEntry = updater(current);
      if (!nextEntry) {
        return prev;
      }
      if (nextEntry === current) {
        return prev;
      }
      return {
        ...prev,
        [clientId]: nextEntry,
      };
    });
  }, []);

  const fetchClientSnapshot = useCallback(async (clientId) => {
    try {
      const [iframe, collage, subtitleRes, captionRes] = await Promise.all([
        fetchIframeConfig(clientId),
        fetchCollageConfig(clientId),
        fetchSubtitleState(clientId),
        fetchCaptionState(clientId),
      ]);
      return {
        iframe,
        collage,
        subtitle: subtitleRes?.subtitle ?? null,
        caption: captionRes?.caption ?? null,
        loading: false,
        error: null,
      };
    } catch (err) {
      return {
        iframe: null,
        collage: null,
        subtitle: null,
        caption: null,
        loading: false,
        error: err?.message || String(err),
      };
    }
  }, []);

  const fetchGlobalDetails = useCallback(async () => {
    try {
      const [iframe, collage, subtitleRes, captionRes] = await Promise.all([
        fetchIframeConfig(null),
        fetchCollageConfig(null),
        fetchSubtitleState(null),
        fetchCaptionState(null),
      ]);
      return {
        iframe,
        collage,
        subtitle: subtitleRes?.subtitle ?? null,
        caption: captionRes?.caption ?? null,
        loading: false,
        error: null,
      };
    } catch (err) {
      return {
        iframe: null,
        collage: null,
        subtitle: null,
        caption: null,
        loading: false,
        error: err?.message || String(err),
      };
    }
  }, []);

  const runClientAction = useCallback(
    async (clientId, kind, options) => {
      const {
        getPayload,
        validate,
        request,
        pendingMessage = DEFAULT_PENDING_MESSAGES[kind] || "處理中...",
        successMessage = DEFAULT_SUCCESS_MESSAGES[kind] || "已完成",
        missingMessage = DEFAULT_MISSING_MESSAGES[kind] || "缺少資料",
        onSuccess,
      } = options;
      if (!clientId || typeof request !== "function") return;
      let payload;
      let proceed = true;
      setClientState(clientId, (entry) => {
        payload = typeof getPayload === "function" ? getPayload(entry) : undefined;
        if (typeof getPayload === "function") {
          const validator = typeof validate === "function" ? validate : (value) => value != null;
          if (!validator(payload)) {
            proceed = false;
            return {
              ...entry,
              actions: {
                ...entry.actions,
                [kind]: {
                  status: "error",
                  message: missingMessage,
                  timestamp: new Date().toISOString(),
                },
              },
            };
          }
        }
        return {
          ...entry,
          actions: {
            ...entry.actions,
            [kind]: {
              status: "pending",
              message: pendingMessage,
            },
          },
        };
      });
      if (!proceed) return;
      try {
        const response = await request(payload);
        setClientState(clientId, (entry) => ({
          ...entry,
          ...(typeof onSuccess === "function" ? onSuccess(entry, response, payload) : {}),
          actions: {
            ...entry.actions,
            [kind]: {
              status: "success",
              message: successMessage,
              timestamp: new Date().toISOString(),
            },
          },
        }));
      } catch (err) {
        setClientState(clientId, (entry) => ({
          ...entry,
          actions: {
            ...entry.actions,
            [kind]: {
              status: "error",
              message: err?.message || String(err),
              timestamp: new Date().toISOString(),
            },
          },
        }));
      }
    },
    [setClientState],
  );

  const runGlobalAction = useCallback(
    async (kind, options) => {
      const {
        getPayload,
        validate,
        request,
        pendingMessage = DEFAULT_PENDING_MESSAGES[kind] || "處理中...",
        successMessage = DEFAULT_SUCCESS_MESSAGES[kind] || "已完成",
        missingMessage = DEFAULT_MISSING_MESSAGES[kind] || "缺少資料",
        onSuccess,
      } = options;
      if (typeof request !== "function") return;
      let payload;
      let proceed = true;
      updateGlobalState((entry) => {
        payload = typeof getPayload === "function" ? getPayload(entry) : undefined;
        if (typeof getPayload === "function") {
          const validator = typeof validate === "function" ? validate : (value) => value != null;
          if (!validator(payload)) {
            proceed = false;
            return {
              ...entry,
              actions: {
                ...entry.actions,
                [kind]: {
                  status: "error",
                  message: missingMessage,
                  timestamp: new Date().toISOString(),
                },
              },
            };
          }
        }
        return {
          ...entry,
          actions: {
            ...entry.actions,
            [kind]: {
              status: "pending",
              message: pendingMessage,
            },
          },
        };
      });
      if (!proceed) return;
      try {
        const response = await request(payload);
        updateGlobalState((entry) => ({
          ...entry,
          ...(typeof onSuccess === "function" ? onSuccess(entry, response, payload) : {}),
          actions: {
            ...entry.actions,
            [kind]: {
              status: "success",
              message: successMessage,
              timestamp: new Date().toISOString(),
            },
          },
        }));
      } catch (err) {
        updateGlobalState((entry) => ({
          ...entry,
          actions: {
            ...entry.actions,
            [kind]: {
              status: "error",
              message: err?.message || String(err),
              timestamp: new Date().toISOString(),
            },
          },
        }));
      }
    },
    [updateGlobalState],
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    updateGlobalState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchClients();
      const list = Array.isArray(data?.clients) ? data.clients : [];
      const sanitized = list.map((item) => {
        const clientId = typeof item?.client_id === "string" ? item.client_id.trim() : null;
        return {
          client_id: clientId || null,
          connections: Number.isFinite(Number(item?.connections)) ? Number(item.connections) : 0,
        };
      });
      setClients(sanitized);
      const namedClients = sanitized.filter((client) => Boolean(client.client_id));
      const snapshots = await Promise.all(
        namedClients.map(async (client) => {
          const snapshot = await fetchClientSnapshot(client.client_id);
          return [client.client_id, snapshot];
        }),
      );
      setDetails((prev) => {
        const next = {};
        for (const [clientId, snapshot] of snapshots) {
          const prevEntry = prev[clientId];
          next[clientId] = {
            ...(prevEntry || {}),
            ...snapshot,
            actions: prevEntry?.actions ?? {},
          };
        }
        return next;
      });
      const globalSnapshot = await fetchGlobalDetails();
      setGlobalState((prev) => ({
        ...prev,
        ...globalSnapshot,
        actions: prev?.actions ?? {},
      }));
      setLastUpdated(new Date());
    } catch (err) {
      setClients([]);
      setDetails({});
      setError(err?.message || String(err));
      updateGlobalState((prev) => ({ ...prev, loading: false }));
    } finally {
      setLoading(false);
    }
  }, [fetchClientSnapshot, fetchGlobalDetails, updateGlobalState]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const clientsWithId = useMemo(() => clients.filter((client) => client.client_id), [clients]);
  const unnamedClients = useMemo(() => clients.filter((client) => !client.client_id), [clients]);
  const totalConnections = useMemo(
    () => clients.reduce((sum, client) => sum + (client.connections || 0), 0),
    [clients],
  );

  const handleRefreshClient = useCallback(
    async (clientId) => {
      if (!clientId) return;
      setClientState(clientId, (entry) => ({ ...entry, loading: true, error: null }));
      const snapshot = await fetchClientSnapshot(clientId);
      setDetails((prev) => ({
        ...prev,
        [clientId]: {
          ...(prev[clientId] || {}),
          ...snapshot,
          actions: prev[clientId]?.actions ?? {},
        },
      }));
    },
    [fetchClientSnapshot, setClientState],
  );

  const handleRefreshGlobal = useCallback(async () => {
    updateGlobalState((prev) => ({ ...prev, loading: true, error: null }));
    const snapshot = await fetchGlobalDetails();
    setGlobalState((prev) => ({
      ...prev,
      ...snapshot,
      actions: prev.actions ?? {},
    }));
  }, [fetchGlobalDetails, updateGlobalState]);

  const handlePushIframe = useCallback(
    (clientId) =>
      runClientAction(clientId, "iframe", {
        getPayload: (entry) => entry?.iframe?.raw,
        request: (payload) => saveIframeConfig(payload, clientId),
        onSuccess: (_, response) => ({ iframe: response }),
      }),
    [runClientAction],
  );

  const handlePushCollage = useCallback(
    (clientId) =>
      runClientAction(clientId, "collage", {
        getPayload: (entry) => entry?.collage?.config,
        request: (payload) => saveCollageConfig(payload, clientId),
        onSuccess: (_, response) => ({ collage: response }),
      }),
    [runClientAction],
  );

  const handlePushSubtitle = useCallback(
    (clientId) =>
      runClientAction(clientId, "subtitle", {
        getPayload: (entry) => entry?.subtitle,
        validate: (payload) => Boolean(payload && typeof payload.text === "string" && payload.text.trim()),
        request: (payload) => setSubtitle(payload, clientId),
        onSuccess: (_, response) => ({ subtitle: response?.subtitle ?? null }),
      }),
    [runClientAction],
  );

  const handleClearSubtitle = useCallback(
    (clientId) =>
      runClientAction(clientId, "subtitle", {
        pendingMessage: "清除中...",
        successMessage: "已清除字幕",
        request: () => clearSubtitle(clientId),
        onSuccess: () => ({ subtitle: null }),
      }),
    [runClientAction],
  );

  const handlePushCaption = useCallback(
    (clientId) =>
      runClientAction(clientId, "caption", {
        getPayload: (entry) => entry?.caption,
        validate: (payload) => Boolean(payload && typeof payload.text === "string" && payload.text.trim()),
        request: (payload) => setCaption(payload, clientId),
        onSuccess: (_, response) => ({ caption: response?.caption ?? null }),
      }),
    [runClientAction],
  );

  const handleClearCaption = useCallback(
    (clientId) =>
      runClientAction(clientId, "caption", {
        pendingMessage: "清除中...",
        successMessage: "已清除跑馬燈",
        request: () => clearCaption(clientId),
        onSuccess: () => ({ caption: null }),
      }),
    [runClientAction],
  );

  const handlePushGlobalIframe = useCallback(
    () =>
      runGlobalAction("iframe", {
        getPayload: (entry) => entry?.iframe?.raw,
        request: (payload) => saveIframeConfig(payload, null),
        onSuccess: (_, response) => ({ iframe: response }),
      }),
    [runGlobalAction],
  );

  const handlePushGlobalCollage = useCallback(
    () =>
      runGlobalAction("collage", {
        getPayload: (entry) => entry?.collage?.config,
        request: (payload) => saveCollageConfig(payload, null),
        onSuccess: (_, response) => ({ collage: response }),
      }),
    [runGlobalAction],
  );

  const handlePushGlobalSubtitle = useCallback(
    () =>
      runGlobalAction("subtitle", {
        getPayload: (entry) => entry?.subtitle,
        validate: (payload) => Boolean(payload && typeof payload.text === "string" && payload.text.trim()),
        request: (payload) => setSubtitle(payload, null),
        onSuccess: (_, response) => ({ subtitle: response?.subtitle ?? null }),
      }),
    [runGlobalAction],
  );

  const handleClearGlobalSubtitle = useCallback(
    () =>
      runGlobalAction("subtitle", {
        pendingMessage: "清除中...",
        successMessage: "已清除字幕",
        request: () => clearSubtitle(null),
        onSuccess: () => ({ subtitle: null }),
      }),
    [runGlobalAction],
  );

  const handlePushGlobalCaption = useCallback(
    () =>
      runGlobalAction("caption", {
        getPayload: (entry) => entry?.caption,
        validate: (payload) => Boolean(payload && typeof payload.text === "string" && payload.text.trim()),
        request: (payload) => setCaption(payload, null),
        onSuccess: (_, response) => ({ caption: response?.caption ?? null }),
      }),
    [runGlobalAction],
  );

  const handleClearGlobalCaption = useCallback(
    () =>
      runGlobalAction("caption", {
        pendingMessage: "清除中...",
        successMessage: "已清除跑馬燈",
        request: () => clearCaption(null),
        onSuccess: () => ({ caption: null }),
      }),
    [runGlobalAction],
  );

  return (
    <div className="client-dashboard">
      <header className="dashboard-header">
        <div>
          <h1>集中式裝置管理面板</h1>
          <p className="dashboard-subtitle">
            監控 WebSocket 客戶端、檢視目前配置並以一鍵推播同步畫面。
          </p>
        </div>
        <div className="dashboard-controls">
          <button type="button" onClick={refreshAll} disabled={loading}>
            全部重新整理
          </button>
          <button type="button" onClick={handleRefreshGlobal} disabled={globalState.loading}>
            更新全域預設
          </button>
          {loading ? <span className="dashboard-status">載入中…</span> : null}
          {lastUpdated ? (
            <span className="dashboard-status">上次更新：{formatDateTime(lastUpdated)}</span>
          ) : null}
        </div>
        {error ? <div className="dashboard-error">{error}</div> : null}
      </header>

      <section className="dashboard-section">
        <h2>在線裝置概覽</h2>
        <div className="summary-row">
          <span>總連線數：{totalConnections}</span>
          <span>具名裝置：{clientsWithId.length}</span>
          <span>未命名裝置：{unnamedClients.length}</span>
        </div>
        <table className="client-table">
          <thead>
            <tr>
              <th>Client ID</th>
              <th>連線數</th>
              <th>狀態</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  目前沒有活躍的 WebSocket 連線。
                </td>
              </tr>
            ) : (
              clients.map((client, index) => (
                <tr key={client.client_id || `anon-${index}`}>
                  <td>{client.client_id || <em>未宣告 ID</em>}</td>
                  <td>{client.connections}</td>
                  <td>{client.client_id ? "可推播" : "僅監看"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="dashboard-section">
        <h2>全域預設</h2>
        <ClientCard
          label="全域預設"
          description="未指定 client_id 時使用，推播會廣播到所有連線裝置。"
          detail={globalState}
          onRefresh={handleRefreshGlobal}
          disablePush={false}
          onPushIframe={handlePushGlobalIframe}
          onPushCollage={handlePushGlobalCollage}
          onPushSubtitle={handlePushGlobalSubtitle}
          onClearSubtitle={handleClearGlobalSubtitle}
          onPushCaption={handlePushGlobalCaption}
          onClearCaption={handleClearGlobalCaption}
        />
      </section>

      <section className="dashboard-section">
        <h2>個別裝置狀態</h2>
        {clientsWithId.length === 0 ? (
          <p className="muted">尚未有具名 client 連線。</p>
        ) : (
          <div className="client-grid">
            {clientsWithId.map((client) => (
              <ClientCard
                key={client.client_id}
                label={client.client_id}
                description={`連線數：${client.connections}`}
                detail={details[client.client_id]}
                onRefresh={() => handleRefreshClient(client.client_id)}
                disablePush={false}
                onPushIframe={() => handlePushIframe(client.client_id)}
                onPushCollage={() => handlePushCollage(client.client_id)}
                onPushSubtitle={() => handlePushSubtitle(client.client_id)}
                onClearSubtitle={() => handleClearSubtitle(client.client_id)}
                onPushCaption={() => handlePushCaption(client.client_id)}
                onClearCaption={() => handleClearCaption(client.client_id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

