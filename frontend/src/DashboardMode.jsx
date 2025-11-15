import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchClients,
  fetchIframeConfigSnapshot,
  fetchCollageConfig,
  fetchSubtitleState,
  fetchCaptionState,
  pushIframeConfig,
  pushCollageConfig,
  pushSubtitleState,
  pushCaptionState,
} from "./api.js";
import "./DashboardMode.css";

const REFRESH_INTERVAL_MS = 15000;

const clientKey = (clientId) => (clientId ? clientId : "__unregistered__");
const actionKey = (clientId, type) => `${clientKey(clientId)}::${type}`;

export default function DashboardMode() {
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientsRaw, setClientsRaw] = useState(null);
  const [clientDetails, setClientDetails] = useState({});
  const [globalDetails, setGlobalDetails] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [actionStates, setActionStates] = useState({});

  const formatTimestamp = useCallback((value) => {
    if (!value) return "—";
    try {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) {
        return String(value);
      }
      return date.toLocaleString();
    } catch (err) {
      return String(value);
    }
  }, []);

  const loadDetailForClient = useCallback(async (clientId, { allowAnonymous = false } = {}) => {
    const baseDetail = {
      iframe: { data: null, error: null },
      collage: { data: null, error: null },
      subtitle: { data: null, error: null },
      caption: { data: null, error: null },
    };

    if (!clientId && !allowAnonymous) {
      const message = "此連線尚未註冊 client_id";
      baseDetail.iframe.error = message;
      baseDetail.collage.error = message;
      return baseDetail;
    }

    const [iframeRes, collageRes, subtitleRes, captionRes] = await Promise.allSettled([
      fetchIframeConfigSnapshot(clientId || undefined),
      fetchCollageConfig(clientId || undefined),
      fetchSubtitleState(clientId || undefined),
      fetchCaptionState(clientId || undefined),
    ]);

    if (iframeRes.status === "fulfilled") {
      baseDetail.iframe.data = iframeRes.value;
    } else {
      baseDetail.iframe.error = iframeRes.reason?.message || String(iframeRes.reason);
    }

    if (collageRes.status === "fulfilled") {
      baseDetail.collage.data = collageRes.value;
    } else {
      baseDetail.collage.error = collageRes.reason?.message || String(collageRes.reason);
    }

    if (subtitleRes.status === "fulfilled") {
      baseDetail.subtitle.data = subtitleRes.value?.subtitle ?? null;
    } else {
      baseDetail.subtitle.error = subtitleRes.reason?.message || String(subtitleRes.reason);
    }

    if (captionRes.status === "fulfilled") {
      baseDetail.caption.data = captionRes.value?.caption ?? null;
    } else {
      baseDetail.caption.error = captionRes.reason?.message || String(captionRes.reason);
    }

    return baseDetail;
  }, []);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await fetchClients();
      setClientsRaw(response);
      const list = Array.isArray(response?.clients) ? response.clients : [];
      setClients(list);

      const detailEntries = await Promise.all(
        list.map(async (client) => {
          const key = clientKey(client.client_id);
          const detail = await loadDetailForClient(client.client_id);
          return [key, detail];
        }),
      );
      const detailsMap = {};
      detailEntries.forEach(([key, detail]) => {
        detailsMap[key] = detail;
      });
      setClientDetails(detailsMap);

      const globalDetail = await loadDetailForClient(null, { allowAnonymous: true });
      setGlobalDetails(globalDetail);

      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [loadDetailForClient]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadData();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadData]);

  const updateActionState = useCallback((key, state) => {
    setActionStates((prev) => ({ ...prev, [key]: state }));
  }, []);

  const clearActionStateLater = useCallback((key) => {
    setTimeout(() => {
      setActionStates((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 3200);
  }, []);

  const handlePushIframe = useCallback(
    async (clientId, detail) => {
      if (!detail?.iframe?.data?.raw || !clientId) return;
      const key = actionKey(clientId, "iframe");
      updateActionState(key, { status: "loading", message: "推播 iframe 配置中…" });
      try {
        await pushIframeConfig(detail.iframe.data.raw, clientId);
        updateActionState(key, { status: "success", message: "已推播最新 iframe 配置" });
        await loadData();
      } catch (err) {
        updateActionState(key, { status: "error", message: err.message || String(err) });
      } finally {
        clearActionStateLater(key);
      }
    },
    [clearActionStateLater, loadData, updateActionState],
  );

  const handlePushCollage = useCallback(
    async (clientId, detail) => {
      const config = detail?.collage?.data?.config;
      if (!config || !clientId) return;
      const key = actionKey(clientId, "collage");
      updateActionState(key, { status: "loading", message: "推播拼貼配置中…" });
      try {
        await pushCollageConfig(config, clientId);
        updateActionState(key, { status: "success", message: "已推播最新拼貼配置" });
        await loadData();
      } catch (err) {
        updateActionState(key, { status: "error", message: err.message || String(err) });
      } finally {
        clearActionStateLater(key);
      }
    },
    [clearActionStateLater, loadData, updateActionState],
  );

  const handlePushSubtitle = useCallback(
    async (clientId, detail) => {
      const subtitle = detail?.subtitle?.data;
      if (!subtitle || !subtitle.text || !clientId) return;
      const key = actionKey(clientId, "subtitle");
      updateActionState(key, { status: "loading", message: "推播字幕中…" });
      try {
        await pushSubtitleState(subtitle, clientId);
        updateActionState(key, { status: "success", message: "已重新推播字幕" });
        await loadData();
      } catch (err) {
        updateActionState(key, { status: "error", message: err.message || String(err) });
      } finally {
        clearActionStateLater(key);
      }
    },
    [clearActionStateLater, loadData, updateActionState],
  );

  const handlePushCaption = useCallback(
    async (clientId, detail) => {
      const caption = detail?.caption?.data;
      if (!caption || !caption.text || !clientId) return;
      const key = actionKey(clientId, "caption");
      updateActionState(key, { status: "loading", message: "推播字幕標題中…" });
      try {
        await pushCaptionState(caption, clientId);
        updateActionState(key, { status: "success", message: "已重新推播字幕標題" });
        await loadData();
      } catch (err) {
        updateActionState(key, { status: "error", message: err.message || String(err) });
      } finally {
        clearActionStateLater(key);
      }
    },
    [clearActionStateLater, loadData, updateActionState],
  );

  const renderActionStatus = useCallback(
    (clientId, type) => {
      const state = actionStates[actionKey(clientId, type)];
      if (!state) return null;
      return <div className={`dashboard-action-status ${state.status}`}>{state.message}</div>;
    },
    [actionStates],
  );

  const clientCards = useMemo(() => {
    const entries = [];
    if (globalDetails) {
      entries.push({
        clientId: null,
        label: "全域預設",
        connections: null,
        detail: globalDetails,
      });
    }
    clients.forEach((client) => {
      entries.push({
        clientId: client.client_id,
        label: client.client_id || "(未註冊)",
        connections: client.connections ?? 0,
        detail: clientDetails[clientKey(client.client_id)] ?? null,
      });
    });
    return entries;
  }, [clients, clientDetails, globalDetails]);

  return (
    <div className="dashboard-root">
      <header className="dashboard-topbar">
        <div>
          <h1>集中式裝置管理面板</h1>
          <p className="dashboard-subtitle-text">
            快速檢視客戶端連線狀態、即時配置與字幕播送，並一鍵推播同步。
          </p>
        </div>
        <div className="dashboard-topbar-actions">
          <button type="button" onClick={loadData} disabled={isRefreshing}>
            {isRefreshing ? "更新中…" : "重新整理"}
          </button>
          <span className="dashboard-timestamp">
            上次更新：{lastUpdated ? formatTimestamp(lastUpdated) : "尚未載入"}
          </span>
        </div>
      </header>

      {error ? <div className="dashboard-error">載入失敗：{error}</div> : null}

      <section className="dashboard-section">
        <h2>即時連線列表（GET /api/clients）</h2>
        {loading ? (
          <div className="dashboard-empty">載入中…</div>
        ) : clients.length === 0 ? (
          <div className="dashboard-empty">目前沒有前端客戶端連線。</div>
        ) : (
          <div className="dashboard-table-wrapper">
            <table className="dashboard-table" cellSpacing="0">
              <thead>
                <tr>
                  <th>Client ID</th>
                  <th>連線數</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={clientKey(client.client_id)}>
                    <td>{client.client_id || <span className="dashboard-muted">(未註冊)</span>}</td>
                    <td>{client.connections ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {clientsRaw ? (
          <details className="dashboard-raw">
            <summary>檢視原始 JSON</summary>
            <pre>{JSON.stringify(clientsRaw, null, 2)}</pre>
          </details>
        ) : null}
      </section>

      <section className="dashboard-section">
        <h2>客戶端配置與字幕狀態</h2>
        {loading ? (
          <div className="dashboard-empty">載入中…</div>
        ) : (
          <div className="dashboard-card-grid">
            {clientCards.map((entry) => {
              const detail = entry.detail;
              return (
                <article className="dashboard-card" key={`${entry.label}-${entry.clientId ?? "global"}`}>
                  <header className="dashboard-card-header">
                    <div>
                      <h3>{entry.label}</h3>
                      <div className="dashboard-meta">
                        {entry.connections != null ? `連線數：${entry.connections}` : "適用所有客戶端"}
                      </div>
                    </div>
                    {entry.clientId ? (
                      <div className="dashboard-card-actions">
                        <button
                          type="button"
                          onClick={() => handlePushIframe(entry.clientId, detail)}
                          disabled={!detail?.iframe?.data?.raw || isRefreshing}
                        >
                          推播 iframe
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePushCollage(entry.clientId, detail)}
                          disabled={!detail?.collage?.data?.config || isRefreshing}
                        >
                          推播拼貼
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePushSubtitle(entry.clientId, detail)}
                          disabled={!detail?.subtitle?.data?.text || isRefreshing}
                        >
                          推播字幕
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePushCaption(entry.clientId, detail)}
                          disabled={!detail?.caption?.data?.text || isRefreshing}
                        >
                          推播字幕標題
                        </button>
                      </div>
                    ) : null}
                  </header>

                  <div className="dashboard-section-block">
                    <h4>Iframe 配置</h4>
                    {detail?.iframe?.error ? (
                      <div className="dashboard-error-text">{detail.iframe.error}</div>
                    ) : detail?.iframe?.data ? (
                      <div className="dashboard-field-set">
                        <div className="dashboard-field-row">
                          <span>佈局</span>
                          <strong>{detail.iframe.data.layout}</strong>
                        </div>
                        <div className="dashboard-field-row">
                          <span>欄數</span>
                          <strong>{detail.iframe.data.columns}</strong>
                        </div>
                        <div className="dashboard-field-row">
                          <span>更新時間</span>
                          <strong>{formatTimestamp(detail.iframe.data.updated_at)}</strong>
                        </div>
                        <ul className="dashboard-panel-list">
                          {(detail.iframe.data.panels || []).map((panel) => (
                            <li key={panel.id}>
                              <div className="dashboard-panel-title">{panel.label || panel.id}</div>
                              {panel.image ? (
                                <div className="dashboard-panel-line">
                                  <span>圖像</span>
                                  <code>{panel.image}</code>
                                </div>
                              ) : null}
                              {panel.url ? (
                                <div className="dashboard-panel-line">
                                  <span>URL</span>
                                  <code>{panel.url}</code>
                                </div>
                              ) : null}
                              {panel.params && Object.keys(panel.params).length ? (
                                <div className="dashboard-panel-line">
                                  <span>模式</span>
                                  <code>
                                    {Object.entries(panel.params)
                                      .map(([key, value]) => `${key}=${value}`)
                                      .join(", ")}
                                  </code>
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="dashboard-empty">尚無 iframe 配置資料。</div>
                    )}
                    {renderActionStatus(entry.clientId, "iframe")}
                  </div>

                  <div className="dashboard-section-block">
                    <h4>拼貼牆配置</h4>
                    {detail?.collage?.error ? (
                      <div className="dashboard-error-text">{detail.collage.error}</div>
                    ) : detail?.collage?.data ? (
                      <div className="dashboard-field-set">
                        <div className="dashboard-field-row">
                          <span>來源</span>
                          <strong>{detail.collage.data.source}</strong>
                        </div>
                        <div className="dashboard-field-row">
                          <span>更新時間</span>
                          <strong>{formatTimestamp(detail.collage.data.updated_at)}</strong>
                        </div>
                        {detail.collage.data.config ? (
                          <>
                            <div className="dashboard-field-row">
                              <span>圖像數</span>
                              <strong>
                                {(detail.collage.data.config.images || []).length}/
                                {detail.collage.data.config.image_count}
                              </strong>
                            </div>
                            <div className="dashboard-field-row">
                              <span>格線</span>
                              <strong>
                                {detail.collage.data.config.rows} × {detail.collage.data.config.cols}
                              </strong>
                            </div>
                            <div className="dashboard-field-row">
                              <span>混合</span>
                              <strong>{detail.collage.data.config.mix ? "開啟" : "關閉"}</strong>
                            </div>
                            <div className="dashboard-field-row">
                              <span>舞台尺寸</span>
                              <strong>
                                {detail.collage.data.config.stage_width} × {detail.collage.data.config.stage_height}
                              </strong>
                            </div>
                            <div className="dashboard-field-row">
                              <span>種子值</span>
                              <strong>{detail.collage.data.config.seed ?? "—"}</strong>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : (
                      <div className="dashboard-empty">尚無拼貼配置資料。</div>
                    )}
                    {renderActionStatus(entry.clientId, "collage")}
                  </div>

                  <div className="dashboard-section-block">
                    <h4>字幕狀態</h4>
                    {detail?.subtitle?.error ? (
                      <div className="dashboard-error-text">{detail.subtitle.error}</div>
                    ) : detail?.subtitle?.data ? (
                      <div className="dashboard-field-set">
                        <div className="dashboard-subtitle-preview">{detail.subtitle.data.text}</div>
                        <div className="dashboard-field-row">
                          <span>語言</span>
                          <strong>{detail.subtitle.data.language || "—"}</strong>
                        </div>
                        <div className="dashboard-field-row">
                          <span>秒數</span>
                          <strong>{detail.subtitle.data.duration_seconds ?? "—"}</strong>
                        </div>
                        <div className="dashboard-field-row">
                          <span>到期</span>
                          <strong>{formatTimestamp(detail.subtitle.data.expires_at)}</strong>
                        </div>
                        <div className="dashboard-field-row">
                          <span>更新時間</span>
                          <strong>{formatTimestamp(detail.subtitle.data.updated_at)}</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="dashboard-empty">目前沒有字幕。</div>
                    )}
                    {renderActionStatus(entry.clientId, "subtitle")}
                  </div>

                  <div className="dashboard-section-block">
                    <h4>字幕標題</h4>
                    {detail?.caption?.error ? (
                      <div className="dashboard-error-text">{detail.caption.error}</div>
                    ) : detail?.caption?.data ? (
                      <div className="dashboard-field-set">
                        <div className="dashboard-subtitle-preview">{detail.caption.data.text}</div>
                        <div className="dashboard-field-row">
                          <span>語言</span>
                          <strong>{detail.caption.data.language || "—"}</strong>
                        </div>
                        <div className="dashboard-field-row">
                          <span>秒數</span>
                          <strong>{detail.caption.data.duration_seconds ?? "—"}</strong>
                        </div>
                        <div className="dashboard-field-row">
                          <span>到期</span>
                          <strong>{formatTimestamp(detail.caption.data.expires_at)}</strong>
                        </div>
                        <div className="dashboard-field-row">
                          <span>更新時間</span>
                          <strong>{formatTimestamp(detail.caption.data.updated_at)}</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="dashboard-empty">目前沒有字幕標題。</div>
                    )}
                    {renderActionStatus(entry.clientId, "caption")}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
