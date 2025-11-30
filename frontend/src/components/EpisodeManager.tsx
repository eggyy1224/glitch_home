import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  cloneEpisode,
  createEpisode,
  deleteEpisode,
  fetchEpisode,
  listEpisodes,
  playEpisode,
  updateEpisode,
} from "../api.js";
import { AdminPanelContext } from "../AdminPanelContext";
import { boxStyle, labelStyle } from "../AdminPanelStyles";
import { defaultEpisodePayload, parseTargetMap, pretty } from "../adminPanelUtils.js";

export default function EpisodeManager() {
  const { defaultClientId } = useContext(AdminPanelContext);
  const [episodeList, setEpisodeList] = useState([]);
  const [episodeId, setEpisodeId] = useState("");
  const [episodeJson, setEpisodeJson] = useState(() => pretty(defaultEpisodePayload(defaultClientId)));
  const [episodeMessage, setEpisodeMessage] = useState("");
  const [episodeCloneId, setEpisodeCloneId] = useState("");
  const [episodePlayStatus, setEpisodePlayStatus] = useState("");
  const [episodeTargetMapText, setEpisodeTargetMapText] = useState("");
  const [episodeCommandPrefix, setEpisodeCommandPrefix] = useState("");

  const refreshEpisodes = useCallback(async () => {
    try {
      const data = await listEpisodes();
      setEpisodeList(Array.isArray(data.episodes) ? data.episodes : []);
      setEpisodeMessage(`已載入 ${data.episodes?.length ?? 0} 筆 episode`);
    } catch (err) {
      setEpisodeMessage(err.message || "載入 episode 失敗");
    }
  }, []);

  const handleLoadEpisode = useCallback(async (id) => {
    try {
      const data = await fetchEpisode(id, { resolve: false });
      setEpisodeId(id);
      setEpisodeJson(pretty(data.episode || data));
      setEpisodeMessage(`已載入 episode ${id}`);
    } catch (err) {
      setEpisodeMessage(err.message || "載入 episode 失敗");
    }
  }, []);

  const handleSaveEpisode = useCallback(
    async (mode) => {
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
        await refreshEpisodes();
      } catch (err) {
        setEpisodeMessage(err.message || "儲存失敗");
      }
    },
    [episodeId, episodeJson, refreshEpisodes],
  );

  const handleDeleteEpisode = useCallback(
    async (id) => {
      try {
        await deleteEpisode(id);
        setEpisodeMessage(`已刪除 episode ${id}`);
        await refreshEpisodes();
        if (episodeId === id) {
          setEpisodeId("");
        }
      } catch (err) {
        setEpisodeMessage(err.message || "刪除失敗");
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
      setEpisodeMessage(err.message || "複製失敗");
    }
  }, [episodeCloneId, episodeId, refreshEpisodes]);

  const handlePlayEpisode = useCallback(async () => {
    if (!episodeId) {
      setEpisodePlayStatus("請先載入或儲存 episode");
      return;
    }
    try {
      setEpisodePlayStatus("發送中...");
      const payload = {};
      const map = parseTargetMap(episodeTargetMapText);
      if (map && Object.keys(map).length > 0) {
        payload.target_client_map = map;
      }
      const prefix = episodeCommandPrefix.trim();
      if (prefix) {
        payload.command_id_prefix = prefix;
      }
      const data = await playEpisode(episodeId, payload);
      setEpisodePlayStatus(`已送出（${data?.tracks?.length ?? 0} 條 track）`);
    } catch (err) {
      setEpisodePlayStatus(err.message || "播放指令失敗");
    }
  }, [episodeCommandPrefix, episodeId, episodeTargetMapText]);

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
            {episodeList.map((item) => (
              <li
                key={item.id}
                role="listitem"
                data-ai-item={`episode:${item.id}`}
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
                  {item.id}
                  {item.title ? `（${item.title}）` : ""} · {item.track_count ?? item.trackCount ?? item.tracks?.length ?? 0} tracks
                </span>
                <button
                  type="button"
                  onClick={() => handleLoadEpisode(item.id)}
                  style={{ marginRight: 4 }}
                  data-ai-action="episode.load"
                  aria-label={`載入 episode ${item.id}`}
                >
                  載入
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteEpisode(item.id)}
                  data-ai-action="episode.delete"
                  aria-label={`刪除 episode ${item.id}`}
                  data-ai-danger="true"
                >
                  刪除
                </button>
              </li>
            ))}
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
