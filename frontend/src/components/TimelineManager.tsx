import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  cloneIframeTimeline,
  createIframeTimeline,
  deleteIframeTimeline,
  fetchIframeTimeline,
  listIframeTimelineVersions,
  listIframeTimelines,
  publishIframeTimeline,
  playIframeTimeline,
  rollbackIframeTimeline,
  updateIframeTimeline,
} from "../api";
import { AdminPanelContext } from "../AdminPanelContext";
import {
  boxStyle,
  labelStyle,
  previewContainerStyle,
  previewTitleStyle,
  resizerHandleStyle,
  resizerHitboxStyle,
  timelinePreviewGridStyle,
  timelinePreviewIframeStyle,
} from "../AdminPanelStyles";
import { defaultTimelinePayload, firstSnapshotRef, previewSrcFromConfig, pretty, timelinePlaybackSrc } from "../adminPanelUtils";
import { getIframeSnapshot } from "../api";
import type { IframeTimeline } from "../types/timeline";
import type { SnapshotConfig } from "../types/admin";

export default function TimelineManager() {
  const { defaultClientId } = useContext(AdminPanelContext);
  const defaultPreviewWidth = useMemo(() => {
    if (typeof window === "undefined") return 960;
    return Math.max(Math.min(window.innerWidth - 100, 1200), 720);
  }, []);

  const [timelineList, setTimelineList] = useState<IframeTimeline[]>([]);
  const [timelineClientFilter, setTimelineClientFilter] = useState("");
  const [timelineId, setTimelineId] = useState("");
  const [timelineJson, setTimelineJson] = useState(() => pretty(defaultTimelinePayload(defaultClientId)));
  const [timelineMessage, setTimelineMessage] = useState("");
  const [timelineCloneId, setTimelineCloneId] = useState("");
  const [timelineCloneTarget, setTimelineCloneTarget] = useState(() => {
    const base = defaultClientId && defaultClientId !== "admin" ? defaultClientId : "desktop";
    return base === "desktop" ? "desktop2" : base;
  });
  const [timelinePreviewSrc, setTimelinePreviewSrc] = useState<string | null>(null);
  const [timelinePreviewError, setTimelinePreviewError] = useState<string | null>(null);
  const [timelinePlaySrc, setTimelinePlaySrc] = useState<string | null>(null);
  const [timelinePlayError, setTimelinePlayError] = useState<string | null>(null);
  const [timelinePlayTarget, setTimelinePlayTarget] = useState(defaultClientId);
  const [timelinePlayStatus, setTimelinePlayStatus] = useState("");
  const [timelinePreviewWidth, setTimelinePreviewWidth] = useState<number>(defaultPreviewWidth);
  const [timelineVersions, setTimelineVersions] = useState<
    Array<{ version?: number; status?: string; updated_at?: string; published_at?: string; published_by?: string }>
  >([]);
  const [loadTimelineVersion, setLoadTimelineVersion] = useState("");
  const [rollbackVersion, setRollbackVersion] = useState("");
  const parsedTimeline = useMemo(() => {
    try {
      return JSON.parse(timelineJson) as Partial<IframeTimeline>;
    } catch {
      return null;
    }
  }, [timelineJson]);

  const timelineFrameHeight = useMemo(() => {
    const colWidth = (timelinePreviewWidth - 12) / 2;
    const width = colWidth > 0 ? colWidth : timelinePreviewWidth / 2;
    return Math.max(320, Math.round((width * 9) / 16));
  }, [timelinePreviewWidth]);

  const clampPreviewWidth = useCallback((width: number) => {
    const max = typeof window !== "undefined" ? Math.max(window.innerWidth - 60, 640) : 1400;
    return Math.min(Math.max(width, 560), Math.min(max, 1800));
  }, []);

  const startResize = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = timelinePreviewWidth;
      const onMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        setTimelinePreviewWidth(clampPreviewWidth(startWidth + delta));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [clampPreviewWidth, timelinePreviewWidth],
  );

  const refreshTimelines = useCallback(async () => {
    try {
      const data = await listIframeTimelines(timelineClientFilter || null);
      setTimelineList(Array.isArray(data.timelines) ? (data.timelines as IframeTimeline[]) : []);
      setTimelineMessage(`已載入 ${data.timelines?.length ?? 0} 筆 timeline`);
    } catch (err) {
      setTimelineMessage((err as Error)?.message || "載入 timeline 失敗");
    }
  }, [timelineClientFilter]);

  const fetchTimelineVersions = useCallback(async (id: string) => {
    try {
      const data = await listIframeTimelineVersions(id);
      const versions = Array.isArray((data as { versions?: unknown }).versions)
        ? ((data as { versions?: unknown[] }).versions as Array<{
            version?: number;
            status?: string;
            updated_at?: string;
            published_at?: string;
            published_by?: string;
          }>)
        : [];
      setTimelineVersions(versions);
    } catch (err) {
      setTimelineMessage((err as Error)?.message || "載入版本列表失敗");
    }
  }, []);

  const handleLoadTimeline = useCallback(async (id: string, opts?: { ignoreVersion?: boolean }) => {
    try {
      const parsedVersion = parseInt(loadTimelineVersion, 10);
      const versionOpt = opts?.ignoreVersion
        ? {}
        : Number.isFinite(parsedVersion)
          ? { version: parsedVersion }
          : {};
      if (opts?.ignoreVersion) {
        setLoadTimelineVersion("");
      }
      const data = await fetchIframeTimeline(id, { resolve: false, ...versionOpt });
      const timelinePayload = (data as { timeline?: unknown }).timeline ?? data;
      setTimelineId(id);
      setTimelineJson(pretty(timelinePayload));
      const resolvedTarget =
        (timelinePayload as { clientId?: string; client_id?: string })?.clientId ||
        (timelinePayload as { client_id?: string })?.client_id ||
        timelinePlayTarget;
      if (resolvedTarget) {
        setTimelinePlayTarget(resolvedTarget);
      }
      setTimelineMessage(`已載入 timeline ${id}${versionOpt.version ? ` (v${versionOpt.version})` : ""}`);
      setTimelinePlaySrc(null);
      setTimelinePlayError(null);
      await fetchTimelineVersions(id);
    } catch (err) {
      setTimelineMessage(((err as Error)?.message) || "載入 timeline 失敗");
    }
  }, [fetchTimelineVersions, loadTimelineVersion, timelinePlayTarget]);

  const handleSaveTimeline = useCallback(
    async (mode: "update" | "create") => {
      try {
        const parsed = JSON.parse(timelineJson);
        const inputId = (timelineId || "").trim();
        const targetId = (mode === "update" ? inputId || parsed.id : parsed.id || inputId) || parsed.id;
        if (!targetId) {
          throw new Error("timeline id 必須提供在 JSON 內或輸入框");
        }
        const payload = { ...parsed, id: targetId };
        if (mode === "update") {
          await updateIframeTimeline(targetId, payload, { resolve: false });
        } else {
          await createIframeTimeline(payload, { resolve: false });
        }
        setTimelineId(targetId);
        if (payload.clientId || payload.client_id) {
          setTimelinePlayTarget(payload.clientId || payload.client_id);
        }
        setTimelineMessage(`${mode === "update" ? "已更新" : "已建立"} timeline ${targetId}`);
        setTimelinePlaySrc(null);
        setTimelinePlayError(null);
        await fetchTimelineVersions(targetId);
        await refreshTimelines();
      } catch (err) {
        setTimelineMessage((err as Error)?.message || "儲存失敗");
      }
    },
    [fetchTimelineVersions, refreshTimelines, timelineId, timelineJson],
  );

  const handleDeleteTimeline = useCallback(
    async (id: string) => {
      try {
        await deleteIframeTimeline(id);
        setTimelineMessage(`已刪除 timeline ${id}`);
        await refreshTimelines();
        if (timelineId === id) {
          setTimelineId("");
        }
        setTimelinePlaySrc(null);
        setTimelinePlayError(null);
        setTimelinePlayStatus("");
      } catch (err) {
        setTimelineMessage((err as Error)?.message || "刪除失敗");
      }
    },
    [refreshTimelines, timelineId],
  );

  const handleCloneTimeline = useCallback(async () => {
    if (!timelineId || !timelineCloneId) {
      setTimelineMessage("請先載入 source timeline 並填入 new id");
      return;
    }
    try {
      await cloneIframeTimeline(
        timelineId,
        {
          new_id: timelineCloneId,
          target_client_id: timelineCloneTarget || undefined,
        },
        { resolve: false },
      );
      setTimelineMessage(`已複製 timeline 為 ${timelineCloneId}`);
      await refreshTimelines();
    } catch (err) {
      setTimelineMessage(((err as Error)?.message) || "複製失敗");
    }
  }, [refreshTimelines, timelineCloneId, timelineCloneTarget, timelineId]);

  const currentTimelineVersion = useCallback((): number | null => {
    try {
      const parsed = JSON.parse(timelineJson);
      const v = (parsed as { version?: unknown }).version;
      return typeof v === "number" ? v : null;
    } catch {
      return null;
    }
  }, [timelineJson]);

  const handlePublishTimeline = useCallback(async () => {
    if (!timelineId) {
      setTimelineMessage("請先載入 timeline");
      return;
    }
    const expected = currentTimelineVersion();
    try {
      await publishIframeTimeline(timelineId, {}, { expectedVersion: expected ?? undefined });
      setTimelineMessage("已發布 timeline");
      await handleLoadTimeline(timelineId, { ignoreVersion: true });
      await refreshTimelines();
      await fetchTimelineVersions(timelineId);
    } catch (err) {
      setTimelineMessage((err as Error)?.message || "發布失敗");
    }
  }, [currentTimelineVersion, fetchTimelineVersions, handleLoadTimeline, refreshTimelines, timelineId]);

  const handleRollbackTimeline = useCallback(async () => {
    if (!timelineId) {
      setTimelineMessage("請先載入 timeline");
      return;
    }
    const target = parseInt(rollbackVersion, 10);
    if (!Number.isFinite(target)) {
      setTimelineMessage("請輸入要回滾的版本號");
      return;
    }
    const expected = currentTimelineVersion();
    try {
      await rollbackIframeTimeline(timelineId, { version: target }, { expectedVersion: expected ?? undefined });
      setTimelineMessage(`已回滾到版本 ${target}`);
      setRollbackVersion("");
      setLoadTimelineVersion("");
      await handleLoadTimeline(timelineId, { ignoreVersion: true });
      await refreshTimelines();
      await fetchTimelineVersions(timelineId);
    } catch (err) {
      setTimelineMessage((err as Error)?.message || "回滾失敗");
    }
  }, [currentTimelineVersion, fetchTimelineVersions, handleLoadTimeline, refreshTimelines, rollbackVersion, timelineId]);

  const handlePlayTimelinePreview = useCallback(() => {
    try {
      const parsed = JSON.parse(timelineJson);
      const id = (timelineId || parsed.id || "").trim();
      if (!id) {
        setTimelinePlayError("請先設定 timeline id，並儲存後再播放");
        return;
      }
      setTimelinePlayError(null);
      setTimelinePlaySrc(timelinePlaybackSrc(id));
    } catch (err) {
      setTimelinePlayError("JSON 解析失敗，無法播放");
    }
  }, [timelineId, timelineJson]);

  const handlePlayToClient = useCallback(async () => {
    if (!timelineId) {
      setTimelinePlayStatus("請先載入或儲存 timeline");
      return;
    }
    if (!timelinePlayTarget.trim()) {
      setTimelinePlayStatus("請輸入 target client");
      return;
    }
    try {
      setTimelinePlayStatus("發送中...");
      const versionFromInput = parseInt(loadTimelineVersion, 10);
      const versionFromJson =
        parsedTimeline && typeof (parsedTimeline as { version?: unknown }).version === "number"
          ? (parsedTimeline as { version?: number }).version
          : undefined;
      const pickedVersion = Number.isFinite(versionFromInput) ? versionFromInput : versionFromJson;
      const versionOpt = Number.isFinite(pickedVersion || NaN) ? { version: pickedVersion } : {};
      await playIframeTimeline(timelineId, {}, { targetClientId: timelinePlayTarget.trim(), ...versionOpt });
      setTimelinePlayStatus(`已送出播放到 ${timelinePlayTarget.trim()}`);
    } catch (err) {
      setTimelinePlayStatus(((err as Error)?.message) || "播放指令失敗");
    }
  }, [loadTimelineVersion, parsedTimeline, timelineId, timelinePlayTarget]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const updatePreview = async () => {
      try {
        const parsed = JSON.parse(timelineJson);
        const firstRef = firstSnapshotRef(parsed);
        if (!firstRef) {
          setTimelinePreviewSrc(null);
          setTimelinePreviewError(null);
          return;
        }
        setTimelinePreviewError(null);
        const snapshot = await getIframeSnapshot(firstRef.client, firstRef.name, { signal: controller.signal });
        if (cancelled) return;
        const snapshotData = snapshot as { raw?: unknown; snapshot?: unknown; name?: string };
        const raw = snapshotData.raw || snapshotData.snapshot || snapshot;
        setTimelinePreviewSrc(previewSrcFromConfig(raw as Partial<SnapshotConfig>));
      } catch (err) {
        if (cancelled || (err as { name?: string })?.name === "AbortError") return;
        setTimelinePreviewSrc(null);
        setTimelinePreviewError(((err as Error)?.message) || "預覽取得失敗");
      }
    };
    void updatePreview();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [timelineJson]);

  useEffect(() => {
    setTimelinePlaySrc(null);
    setTimelinePlayError(null);
    setTimelinePlayStatus("");
  }, [timelineJson, timelineId]);

  useEffect(() => {
    refreshTimelines();
  }, [refreshTimelines]);

  return (
    <div style={boxStyle} data-ai-id="admin.timeline.section" data-ai-role="timeline.panel">
      <section
        aria-label="Timeline 控制流程"
        data-ai-role="timeline.instructions"
        style={{ marginBottom: 10, padding: "8px 10px", border: "1px solid #0f4", background: "#020" }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>操作順序（Timeline）</div>
        <ol style={{ margin: 0, paddingLeft: 18, color: "#82dca5", lineHeight: 1.5 }}>
          <li data-ai-role="timeline.step-note.filter">步驟 1：選擇/輸入 client filter 後重載列表。</li>
          <li data-ai-role="timeline.step-note.pick">步驟 2：在列表按「載入到表單」確認內容，可用「複製」產生新 ID。</li>
          <li data-ai-role="timeline.step-note.preview">步驟 3：右側 JSON 編輯後，檢查下方「第一段預覽」與「整段播放預覽」。</li>
          <li data-ai-role="timeline.step-note.play">步驟 4：設定播放 target client，再按「播放 timeline」送出。</li>
        </ol>
      </section>

      <section aria-labelledby="timeline-step-filter" data-ai-role="timeline.step.filter" style={{ marginBottom: 8 }}>
        <div id="timeline-step-filter" style={{ fontWeight: 700, marginBottom: 4 }}>
          步驟 1：篩選 client
        </div>
        <label style={labelStyle} htmlFor="timeline-client-filter">
          篩選 client
        </label>
        <input
          id="timeline-client-filter"
          name="timeline-client-filter"
          type="text"
          value={timelineClientFilter}
          onChange={(e) => setTimelineClientFilter(e.target.value)}
          placeholder="空白=全部"
          style={{ width: "200px", marginRight: 6 }}
          data-ai-field="timeline.filter-client"
        />
        <button
          type="button"
          onClick={refreshTimelines}
          data-ai-action="timeline.reload-list"
          data-ai-role="timeline.action.reload"
          aria-label="重新載入 timeline 列表"
        >
          重新載入列表
        </button>
        <div style={{ marginTop: 4, fontSize: 12, color: "#82dca5" }} data-ai-status="timeline.filter-hint">
          列表與預覽都會依據此 client 取得資料，空白代表全部。
        </div>
      </section>

      <div style={{ display: "flex", gap: 12 }}>
        <section style={{ flex: 1 }} aria-labelledby="timeline-step-pick" data-ai-role="timeline.step.pick">
          <div id="timeline-step-pick" style={{ marginBottom: 4, fontWeight: 700 }}>
            步驟 2：選擇 / 複製 timeline
          </div>
          <div style={{ marginBottom: 6, color: "#82dca5", fontSize: 12 }}>
            「載入到表單」會更新右側 JSON 與預覽；播放與複製都依照右上方 ID/Client。
          </div>
          <ul
            role="list"
            aria-label="timeline 選擇列表"
            data-ai-id="timeline.list"
            data-ai-role="timeline.list"
            style={{
              maxHeight: 220,
              overflowY: "auto",
              border: "1px solid #0f4",
              padding: 8,
              listStyle: "none",
              margin: 0,
              background: "#000",
            }}
          >
            {timelineList.length === 0 && <li data-ai-state="empty">尚無 timeline</li>}
            {timelineList.map((item) => {
              const isSelected = timelineId === item.id;
              return (
                <li
                  key={item.id}
                  role="listitem"
                  data-ai-item={`timeline:${item.id}`}
                  data-ai-role="timeline.row"
                  data-ai-state={isSelected ? "selected" : "idle"}
                  aria-selected={isSelected}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 6,
                    padding: "6px 6px",
                    borderRadius: 4,
                    background: isSelected ? "#011a0f" : "#000",
                    border: `1px solid ${isSelected ? "#3aff85" : "#0f4"}`,
                    boxShadow: isSelected ? "0 0 0 1px rgba(58, 255, 133, 0.4)" : "none",
                  }}
                >
                  <span style={{ flex: 1, fontWeight: isSelected ? 700 : 600 }}>
                    {item.id} ({item.client_id || "n/a"})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLoadTimeline(item.id)}
                    style={{ marginRight: 4 }}
                    data-ai-action="timeline.load"
                    data-testid="timeline-load"
                    aria-label={`載入 timeline ${item.id} 到表單並預覽`}
                  >
                    載入到表單
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTimeline(item.id)}
                    data-ai-action="timeline.delete"
                    data-testid="timeline-delete"
                    aria-label={`刪除 timeline ${item.id}`}
                    data-ai-danger="true"
                  >
                    刪除
                  </button>
                </li>
              );
            })}
          </ul>
          <div style={{ marginTop: 6, fontSize: 12, color: "#82dca5" }} data-ai-status="timeline.current-selection">
            目前表單 ID：{timelineId || "（尚未選擇）"}
          </div>
          <div style={{ marginTop: 8 }} data-ai-role="timeline.clone">
            <div style={{ marginBottom: 4 }}>複製（以目前表單為來源）：</div>
            <input
              type="text"
              placeholder="new id"
              value={timelineCloneId}
              onChange={(e) => setTimelineCloneId(e.target.value)}
              style={{ width: "140px", marginRight: 4 }}
              data-ai-field="timeline.clone.new-id"
              aria-label="複製的新 timeline id"
            />
            <input
              type="text"
              placeholder="target client (可空)"
              value={timelineCloneTarget}
              onChange={(e) => setTimelineCloneTarget(e.target.value)}
              style={{ width: "160px", marginRight: 4 }}
              data-ai-field="timeline.clone.target-client"
              aria-label="複製目標 client"
            />
            <button type="button" onClick={handleCloneTimeline} data-ai-action="timeline.clone" aria-label="複製 timeline">
              複製 timeline
            </button>
          </div>
        </section>
        <section style={{ flex: 1.2 }} aria-labelledby="timeline-step-edit" data-ai-role="timeline.step.edit">
          <div id="timeline-step-edit" style={{ marginBottom: 4, fontWeight: 700 }}>
            步驟 3：編輯 / 儲存
          </div>
          <div style={{ marginBottom: 6, color: "#82dca5", fontSize: 12 }}>
            載入後可直接修改 ID/JSON；下方預覽會用第一段 snapshot 自動更新。
          </div>
          <label style={labelStyle} htmlFor="timeline-id">
            當前 timeline id
          </label>
          <input
            id="timeline-id"
            name="timeline-id"
            type="text"
            value={timelineId}
            onChange={(e) => setTimelineId(e.target.value)}
            placeholder="新建請輸入 id 或在 JSON 設定"
            style={{ width: "100%", marginBottom: 8 }}
            data-ai-field="timeline.id"
          />
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="版本號（可選）"
              value={loadTimelineVersion}
              onChange={(e) => setLoadTimelineVersion(e.target.value)}
              style={{ width: 140 }}
              data-ai-field="timeline.load-version"
            />
            <button
              type="button"
              onClick={() => {
                if (timelineId) {
                  void handleLoadTimeline(timelineId);
                } else {
                  setTimelineMessage("請輸入 timeline id 後再載入");
                }
              }}
              data-ai-action="timeline.load-version"
            >
              載入指定版
            </button>
            <select
              value={loadTimelineVersion}
              onChange={(e) => setLoadTimelineVersion(e.target.value)}
              data-ai-field="timeline.version-select"
              style={{ minWidth: 140 }}
            >
              <option value="">最新</option>
              {timelineVersions
                .filter((v) => typeof v.version === "number")
                .map((v) => (
                  <option key={`v-${v.version}`} value={String(v.version ?? "")}>{`v${v.version} ${v.status ? `(${v.status})` : ""}`}</option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (timelineId) {
                  void fetchTimelineVersions(timelineId);
                }
              }}
              data-ai-action="timeline.reload-versions"
            >
              重新載入版本列表
            </button>
          </div>
          <div style={{ marginBottom: 8, fontSize: 12, color: "#9be7ff" }}>
            目前版本：{parsedTimeline?.version ?? "?"} / 狀態：{parsedTimeline?.status ?? "?"} / published_at：
            {(parsedTimeline as { published_at?: string; publishedAt?: string })?.published_at ||
              (parsedTimeline as { publishedAt?: string })?.publishedAt ||
              "n/a"}
            {" / published_by："}
            {(parsedTimeline as { published_by?: string; publishedBy?: string })?.published_by ||
              (parsedTimeline as { publishedBy?: string })?.publishedBy ||
              "n/a"}
          </div>
          <label style={labelStyle} htmlFor="timeline-json">
            JSON
          </label>
          <textarea
            id="timeline-json"
            name="timeline-json"
            style={{ width: "100%", height: 260, fontFamily: "monospace" }}
            value={timelineJson}
            onChange={(e) => setTimelineJson(e.target.value)}
            data-ai-field="timeline.json"
            aria-label="timeline JSON"
          />
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => handleSaveTimeline("create")} data-ai-action="timeline.create" data-testid="timeline-create">
              新增
            </button>
            <button type="button" onClick={() => handleSaveTimeline("update")} data-ai-action="timeline.update" data-testid="timeline-update">
              覆寫
            </button>
            <button
              type="button"
              onClick={() => setTimelineJson(pretty(defaultTimelinePayload(defaultClientId)))}
              data-ai-action="timeline.fill-default"
              data-testid="timeline-fill-default"
            >
              填入預設
            </button>
            <button type="button" onClick={handlePublishTimeline} data-ai-action="timeline.publish">
              發布
            </button>
            <input
              type="text"
              placeholder="回滾版本號"
              value={rollbackVersion}
              onChange={(e) => setRollbackVersion(e.target.value)}
              style={{ width: 120 }}
              data-ai-field="timeline.rollback-version"
            />
            <button type="button" onClick={handleRollbackTimeline} data-ai-action="timeline.rollback">
              回滾
            </button>
          </div>

          <section
            style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
            aria-labelledby="timeline-step-play"
            data-ai-role="timeline.step.play"
          >
            <label id="timeline-step-play" htmlFor="timeline-play-target" style={{ fontWeight: 700 }}>
              步驟 4：播放到 client
            </label>
            <input
              id="timeline-play-target"
              name="timeline-play-target"
              type="text"
              value={timelinePlayTarget}
              onChange={(e) => setTimelinePlayTarget(e.target.value)}
              placeholder="client id"
              style={{ width: 150 }}
              data-ai-field="timeline.play-target"
            />
            <button type="button" onClick={handlePlayToClient} data-ai-action="timeline.play" data-testid="timeline-play">
              播放 timeline
            </button>
            <span
              style={{ color: "#82dca5", letterSpacing: "0.03em" }}
              role="status"
              aria-live="polite"
              data-ai-status="timeline.play"
              data-ai-role="timeline.play-status"
            >
              {timelinePlayStatus || "（待送出）"}
            </span>
          </section>
        </section>
      </div>

      <section
        style={{ ...previewContainerStyle, width: timelinePreviewWidth, maxWidth: "100%" }}
        data-ai-section="timeline.preview"
        data-ai-role="timeline.preview"
        aria-label="Timeline 預覽區塊"
      >
        <div style={{ ...previewTitleStyle, marginBottom: 10 }}>Timeline 預覽</div>
        <div style={timelinePreviewGridStyle}>
          <div data-ai-section="timeline.preview.first-snapshot" data-ai-role="timeline.preview.first">
            <div style={{ ...previewTitleStyle, marginBottom: 6 }}>取第一段 snapshot</div>
            {timelinePreviewSrc ? (
              <iframe
                title="timeline-preview"
                src={timelinePreviewSrc}
                style={{ ...timelinePreviewIframeStyle, height: timelineFrameHeight }}
                sandbox="allow-scripts allow-same-origin"
                data-ai-id="timeline.preview.iframe"
                data-testid="timeline-preview-iframe"
              />
            ) : (
              <div style={{ color: "#82dca5" }} data-ai-state="empty" data-ai-role="timeline.preview-empty" data-ai-status="timeline.preview-error">
                {timelinePreviewError || "無法產生預覽，請確認 steps 有 snapshot，且對應 snapshot 有 panel.url 或 image"}
              </div>
            )}
          </div>
          <div data-ai-section="timeline.preview.playback" data-ai-role="timeline.preview.full">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={previewTitleStyle}>播放預覽（整段 timeline）</div>
              <button type="button" onClick={handlePlayTimelinePreview} data-ai-action="timeline.preview-play" data-testid="timeline-preview-play">
                播放
              </button>
              {timelinePlayError && (
                <span style={{ color: "#ff6b6b" }} role="status" aria-live="polite" data-ai-status="timeline.preview-error">
                  {timelinePlayError}
                </span>
              )}
            </div>
            {timelinePlaySrc ? (
              <iframe
                key={timelinePlaySrc}
                title="timeline-play-preview"
                src={timelinePlaySrc}
                style={{ ...timelinePreviewIframeStyle, height: timelineFrameHeight }}
                sandbox="allow-scripts allow-same-origin"
                data-ai-id="timeline.preview.play-iframe"
                data-testid="timeline-play-preview-iframe"
              />
            ) : (
              <div style={{ color: "#82dca5" }} data-ai-state="empty" data-ai-role="timeline.preview-full-empty">
                點擊「播放」會以 iframe_mode 在下方預覽完整 timeline（需先儲存服務端資料）
              </div>
            )}
          </div>
        </div>

        <div style={resizerHitboxStyle} onMouseDown={startResize} aria-hidden="true" data-ai-role="timeline.preview-resizer">
          <div style={resizerHandleStyle} />
        </div>
      </section>

      {timelineMessage && (
        <div
          style={{ marginTop: 8, color: "#82dca5", letterSpacing: "0.03em" }}
          role="status"
          aria-live="polite"
          data-ai-status="timeline.message"
          data-ai-role="timeline.status"
        >
          {timelineMessage}
        </div>
      )}
    </div>
  );
}
