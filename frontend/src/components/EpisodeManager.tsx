import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  cloneEpisode,
  createEpisode,
  deleteEpisode,
  fetchEpisode,
  listEpisodeVersions,
  listEpisodes,
  publishEpisode,
  playEpisode,
  rollbackEpisode,
  updateEpisode,
} from "../api";
import { AdminPanelContext } from "../AdminPanelContext";
import { boxStyle, labelStyle } from "../AdminPanelStyles";
import { defaultEpisodePayload, parseTargetMap, pretty } from "../adminPanelUtils";
import type { EpisodeEntry } from "../types/timeline";

export default function EpisodeManager() {
  const { defaultClientId } = useContext(AdminPanelContext);
  const [episodeList, setEpisodeList] = useState<EpisodeEntry[]>([]);
  const [episodeId, setEpisodeId] = useState("");
  const [episodeJson, setEpisodeJson] = useState(() => pretty(defaultEpisodePayload(defaultClientId)));
  const [episodeMessage, setEpisodeMessage] = useState("");
  const [episodeCloneId, setEpisodeCloneId] = useState("");
  const [episodePlayStatus, setEpisodePlayStatus] = useState("");
  const [episodeTargetMapText, setEpisodeTargetMapText] = useState("");
  const [episodeCommandPrefix, setEpisodeCommandPrefix] = useState("");
  const [loadEpisodeVersion, setLoadEpisodeVersion] = useState("");
  const [rollbackVersion, setRollbackVersion] = useState("");
  const [episodeVersions, setEpisodeVersions] = useState<
    Array<{ version?: number; status?: string; updated_at?: string; published_at?: string; published_by?: string }>
  >([]);
  const parsedEpisode = useMemo(() => {
    try {
      return JSON.parse(episodeJson) as Partial<EpisodeEntry>;
    } catch {
      return null;
    }
  }, [episodeJson]);

  const refreshEpisodes = useCallback(async () => {
    try {
      const data = await listEpisodes();
      setEpisodeList(Array.isArray(data.episodes) ? (data.episodes as EpisodeEntry[]) : []);
      setEpisodeMessage(`已載入 ${data.episodes?.length ?? 0} 筆 episode`);
    } catch (err) {
      setEpisodeMessage((err as Error)?.message || "載入 episode 失敗");
    }
  }, []);

  const fetchEpisodeVersions = useCallback(async (id: string) => {
    try {
      const data = await listEpisodeVersions(id);
      const versions = Array.isArray((data as { versions?: unknown }).versions)
        ? ((data as { versions?: unknown[] }).versions as Array<{
            version?: number;
            status?: string;
            updated_at?: string;
            published_at?: string;
            published_by?: string;
          }>)
        : [];
      setEpisodeVersions(versions);
    } catch (err) {
      setEpisodeMessage((err as Error)?.message || "載入版本列表失敗");
    }
  }, []);

  const handleLoadEpisode = useCallback(async (id: string, opts?: { ignoreVersion?: boolean }) => {
    try {
      const parsedVersion = parseInt(loadEpisodeVersion, 10);
      const versionOpt = opts?.ignoreVersion
        ? {}
        : Number.isFinite(parsedVersion)
          ? { version: parsedVersion }
          : {};
      if (opts?.ignoreVersion) {
        setLoadEpisodeVersion("");
      }
      const data = await fetchEpisode(id, { resolve: false, ...versionOpt });
      setEpisodeId(id);
      setEpisodeJson(pretty(data.episode || data));
      setEpisodeMessage(`已載入 episode ${id}${versionOpt.version ? ` (v${versionOpt.version})` : ""}`);
      await fetchEpisodeVersions(id);
    } catch (err) {
      setEpisodeMessage((err as Error)?.message || "載入 episode 失敗");
    }
  }, [fetchEpisodeVersions, loadEpisodeVersion]);

  const handleSaveEpisode = useCallback(
    async (mode: "update" | "create") => {
      try {
        const parsed = JSON.parse(episodeJson);
        const inputId = (episodeId || "").trim();
        const targetId = (mode === "update" ? inputId || parsed.id : parsed.id || inputId) || parsed.id;
        if (!targetId) {
          throw new Error("episode id 必須提供在 JSON 內或輸入框");
        }
        const payload = { ...parsed, id: targetId };
        if (mode === "update") {
          await updateEpisode(targetId, payload, { resolve: false });
        } else {
          await createEpisode(payload, { resolve: false });
        }
        setEpisodeId(targetId);
        setEpisodeMessage(`${mode === "update" ? "已更新" : "已建立"} episode ${targetId}`);
        await fetchEpisodeVersions(targetId);
        await refreshEpisodes();
      } catch (err) {
        setEpisodeMessage((err as Error)?.message || "儲存失敗");
      }
    },
    [episodeId, episodeJson, fetchEpisodeVersions, refreshEpisodes],
  );

  const handleDeleteEpisode = useCallback(
    async (id: string) => {
      try {
        await deleteEpisode(id);
        setEpisodeMessage(`已刪除 episode ${id}`);
        await refreshEpisodes();
        if (episodeId === id) {
          setEpisodeId("");
        }
      } catch (err) {
        setEpisodeMessage((err as Error)?.message || "刪除失敗");
      }
    },
    [episodeId, refreshEpisodes],
  );

  const handleCloneEpisode = useCallback(async () => {
    if (!episodeId || !episodeCloneId) {
      setEpisodeMessage("請先載入 source episode 並填入 new id");
      return;
    }
    try {
      await cloneEpisode(episodeId, { new_id: episodeCloneId }, { resolve: false });
      setEpisodeMessage(`已複製 episode 為 ${episodeCloneId}`);
      await refreshEpisodes();
    } catch (err) {
      setEpisodeMessage((err as Error)?.message || "複製失敗");
    }
  }, [episodeCloneId, episodeId, refreshEpisodes]);

  const currentEpisodeVersion = useCallback((): number | null => {
    try {
      const parsed = JSON.parse(episodeJson);
      const v = (parsed as { version?: unknown }).version;
      return typeof v === "number" ? v : null;
    } catch {
      return null;
    }
  }, [episodeJson]);

  const handlePublishEpisode = useCallback(async () => {
    if (!episodeId) {
      setEpisodeMessage("請先載入 episode");
      return;
    }
    const expected = currentEpisodeVersion();
    try {
      await publishEpisode(episodeId, {}, { expectedVersion: expected ?? undefined });
      setEpisodeMessage("已發布 episode");
      await handleLoadEpisode(episodeId, { ignoreVersion: true });
      await refreshEpisodes();
      await fetchEpisodeVersions(episodeId);
    } catch (err) {
      setEpisodeMessage((err as Error)?.message || "發布失敗");
    }
  }, [currentEpisodeVersion, episodeId, fetchEpisodeVersions, handleLoadEpisode, refreshEpisodes]);

  const handleRollbackEpisode = useCallback(async () => {
    if (!episodeId) {
      setEpisodeMessage("請先載入 episode");
      return;
    }
    const target = parseInt(rollbackVersion, 10);
    if (!Number.isFinite(target)) {
      setEpisodeMessage("請輸入要回滾的版本號");
      return;
    }
    const expected = currentEpisodeVersion();
    try {
      await rollbackEpisode(episodeId, { version: target }, { expectedVersion: expected ?? undefined });
      setEpisodeMessage(`已回滾到版本 ${target}`);
      setRollbackVersion("");
      setLoadEpisodeVersion("");
      await handleLoadEpisode(episodeId, { ignoreVersion: true });
      await refreshEpisodes();
      await fetchEpisodeVersions(episodeId);
    } catch (err) {
      setEpisodeMessage((err as Error)?.message || "回滾失敗");
    }
  }, [currentEpisodeVersion, episodeId, fetchEpisodeVersions, handleLoadEpisode, refreshEpisodes, rollbackVersion]);

  const handlePlayEpisode = useCallback(async () => {
    if (!episodeId) {
      setEpisodePlayStatus("請先載入或儲存 episode");
      return;
    }
    try {
      setEpisodePlayStatus("發送中...");
      const payload: Record<string, unknown> = {};
      const map = parseTargetMap(episodeTargetMapText);
      if (map && Object.keys(map).length > 0) {
        payload.target_client_map = map;
      }
      const prefix = episodeCommandPrefix.trim();
      if (prefix) {
        payload.command_id_prefix = prefix;
      }
      const versionFromInput = parseInt(loadEpisodeVersion, 10);
      const versionFromJson =
        parsedEpisode && typeof (parsedEpisode as { version?: unknown }).version === "number"
          ? (parsedEpisode as { version?: number }).version
          : undefined;
      const pickedVersion = Number.isFinite(versionFromInput) ? versionFromInput : versionFromJson;
      const versionOpt = Number.isFinite(pickedVersion || NaN) ? { version: pickedVersion } : {};
      const data = await playEpisode(episodeId, payload, versionOpt);
      const trackCount = (data as { tracks?: unknown[] })?.tracks?.length ?? 0;
      setEpisodePlayStatus(`已送出（${trackCount} 條 track）`);
    } catch (err) {
      setEpisodePlayStatus((err as Error)?.message || "播放指令失敗");
    }
  }, [episodeCommandPrefix, episodeId, episodeTargetMapText, loadEpisodeVersion, parsedEpisode]);

  useEffect(() => {
    refreshEpisodes();
  }, [refreshEpisodes]);

  return (
    <div style={boxStyle} data-ai-id="admin.episode.section">
      <div style={{ marginBottom: 8 }}>
        <button type="button" onClick={refreshEpisodes} data-ai-action="episode.reload-list" aria-label="重新載入 episode 列表">
          重新載入列表
        </button>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 6 }}>Episode 列表：</div>
          <ul
            role="list"
            data-ai-id="episode.list"
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
            {episodeList.length === 0 && <li data-ai-state="empty">尚無 episode</li>}
            {episodeList.map((item) => {
              const itemId = item.id || "";
              const trackCount = (item as { track_count?: number; trackCount?: number; tracks?: unknown[] }).track_count ??
                (item as { trackCount?: number }).trackCount ??
                (Array.isArray(item.tracks) ? item.tracks.length : 0);
              return (
              <li
                key={itemId || Math.random()}
                role="listitem"
                data-ai-item={`episode:${itemId}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 6,
                  padding: "4px 4px",
                  borderRadius: 0,
                  background: "#000",
                  border: "1px solid #0f4",
                }}
              >
                <span style={{ flex: 1 }}>
                  {itemId}
                  {item.title ? `（${item.title}）` : ""} · {trackCount} tracks
                </span>
                <button
                  type="button"
                  onClick={() => handleLoadEpisode(itemId)}
                  style={{ marginRight: 4 }}
                  data-ai-action="episode.load"
                  aria-label={`載入 episode ${itemId}`}
                >
                  載入
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteEpisode(itemId)}
                  data-ai-action="episode.delete"
                  aria-label={`刪除 episode ${itemId}`}
                  data-ai-danger="true"
                >
                  刪除
                </button>
              </li>
            );
            })}
          </ul>
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 4 }}>複製：</div>
            <input
              type="text"
              placeholder="new id"
              value={episodeCloneId}
              onChange={(e) => setEpisodeCloneId(e.target.value)}
              style={{ width: "160px", marginRight: 6 }}
              data-ai-field="episode.clone.new-id"
              aria-label="複製的新 episode id"
            />
            <button type="button" onClick={handleCloneEpisode} data-ai-action="episode.clone" aria-label="複製 episode">
              複製 episode
            </button>
          </div>
        </div>
        <div style={{ flex: 1.2 }}>
          <label style={labelStyle} htmlFor="episode-id">
            當前 episode id
          </label>
          <input
            id="episode-id"
            name="episode-id"
            type="text"
            value={episodeId}
            onChange={(e) => setEpisodeId(e.target.value)}
            placeholder="新建請輸入 id 或在 JSON 設定"
            style={{ width: "100%", marginBottom: 8 }}
            data-ai-field="episode.id"
          />
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="版本號（可選）"
              value={loadEpisodeVersion}
              onChange={(e) => setLoadEpisodeVersion(e.target.value)}
              style={{ width: 140 }}
              data-ai-field="episode.load-version"
            />
            <button
              type="button"
              onClick={() => {
                if (episodeId) {
                  void handleLoadEpisode(episodeId);
                } else {
                  setEpisodeMessage("請輸入 episode id 後再載入");
                }
              }}
              data-ai-action="episode.load-version"
            >
              載入指定版
            </button>
            <select
              value={loadEpisodeVersion}
              onChange={(e) => setLoadEpisodeVersion(e.target.value)}
              data-ai-field="episode.version-select"
              style={{ minWidth: 140 }}
            >
              <option value="">最新</option>
              {episodeVersions
                .filter((v) => typeof v.version === "number")
                .map((v) => (
                  <option key={`v-${v.version}`} value={String(v.version ?? "")}>{`v${v.version} ${v.status ? `(${v.status})` : ""}`}</option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (episodeId) {
                  void fetchEpisodeVersions(episodeId);
                }
              }}
              data-ai-action="episode.reload-versions"
            >
              重新載入版本列表
            </button>
          </div>
          <div style={{ marginBottom: 8, fontSize: 12, color: "#9be7ff" }}>
            目前版本：{parsedEpisode?.version ?? "?"} / 狀態：{parsedEpisode?.status ?? "?"} / published_at：
            {(parsedEpisode as { published_at?: string; publishedAt?: string })?.published_at ||
              (parsedEpisode as { publishedAt?: string })?.publishedAt ||
              "n/a"}
            {" / published_by："}
            {(parsedEpisode as { published_by?: string; publishedBy?: string })?.published_by ||
              (parsedEpisode as { publishedBy?: string })?.publishedBy ||
              "n/a"}
          </div>
          <label style={labelStyle} htmlFor="episode-json">
            JSON
          </label>
          <textarea
            id="episode-json"
            name="episode-json"
            style={{ width: "100%", height: 240, fontFamily: "monospace" }}
            value={episodeJson}
            onChange={(e) => setEpisodeJson(e.target.value)}
            data-ai-field="episode.json"
            aria-label="episode JSON"
          />
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => handleSaveEpisode("create")} data-ai-action="episode.create">
              新增
            </button>
            <button type="button" onClick={() => handleSaveEpisode("update")} data-ai-action="episode.update">
              覆寫
            </button>
            <button
              type="button"
              onClick={() => setEpisodeJson(pretty(defaultEpisodePayload(defaultClientId)))}
              data-ai-action="episode.fill-default"
            >
              填入預設
            </button>
            <button type="button" onClick={handlePublishEpisode} data-ai-action="episode.publish">
              發布
            </button>
            <input
              type="text"
              placeholder="回滾版本號"
              value={rollbackVersion}
              onChange={(e) => setRollbackVersion(e.target.value)}
              style={{ width: 120 }}
              data-ai-field="episode.rollback-version"
            />
            <button type="button" onClick={handleRollbackEpisode} data-ai-action="episode.rollback">
              回滾
            </button>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontWeight: 600 }} htmlFor="episode-target-map">
              覆寫 target map
            </label>
            <input
              id="episode-target-map"
              name="episode-target-map"
              type="text"
              value={episodeTargetMapText}
              onChange={(e) => setEpisodeTargetMapText(e.target.value)}
              placeholder="timelineA:clientX,timelineB:clientY"
              style={{ width: 280 }}
              data-ai-field="episode.target-map"
            />
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontWeight: 600 }} htmlFor="episode-command-prefix">
              command 前綴
            </label>
            <input
              id="episode-command-prefix"
              name="episode-command-prefix"
              type="text"
              value={episodeCommandPrefix}
              onChange={(e) => setEpisodeCommandPrefix(e.target.value)}
              placeholder="可選，用於去重"
              style={{ width: 200 }}
              data-ai-field="episode.command-prefix"
            />
            <button type="button" onClick={handlePlayEpisode} data-ai-action="episode.play">
              播放 Episode
            </button>
            {episodePlayStatus && (
              <span style={{ color: "#82dca5", letterSpacing: "0.03em" }} role="status" aria-live="polite" data-ai-status="episode.play">
                {episodePlayStatus}
              </span>
            )}
          </div>
        </div>
      </div>

      {episodeMessage && (
        <div
          style={{ marginTop: 8, color: "#82dca5", letterSpacing: "0.03em" }}
          role="status"
          aria-live="polite"
          data-ai-status="episode.message"
        >
          {episodeMessage}
        </div>
      )}
    </div>
  );
}
