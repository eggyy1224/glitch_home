import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchSoundFiles } from "./api.js";

const styles = {
  container: {
    position: "fixed",
    right: "24px",
    bottom: "24px",
    width: "320px",
    maxWidth: "90vw",
    padding: "16px",
    borderRadius: "16px",
    background: "rgba(10, 10, 16, 0.86)",
    color: "#f0f3ff",
    boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
    backdropFilter: "blur(10px)",
    fontFamily: "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
    zIndex: 2000,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
  },
  title: {
    margin: 0,
    fontSize: "16px",
    letterSpacing: "0.05em",
  },
  button: {
    fontSize: "12px",
    padding: "6px 10px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.06)",
    color: "inherit",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  select: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(0,0,0,0.45)",
    color: "inherit",
    marginBottom: "12px",
    fontSize: "13px",
  },
  meta: {
    fontSize: "12px",
    color: "#bfc7ff",
    marginBottom: "10px",
    lineHeight: 1.4,
  },
  link: {
    color: "#dbe1ff",
    textDecoration: "underline",
  },
  empty: {
    fontSize: "13px",
    textAlign: "center",
    padding: "12px 0",
    color: "#cdd2f8",
  },
  audio: {
    width: "100%",
  },
};

function formatBytes(bytes) {
  if (!bytes || Number.isNaN(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)}${units[unit]}`;
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString();
  } catch (err) {
    return "";
  }
}

export default function SoundPlayer({ playRequest = null, onPlayHandled, visible = true }) {
  const [files, setFiles] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const filesRef = useRef([]);
  const [pendingAutoPlay, setPendingAutoPlay] = useState(null);
  const [needsUserAction, setNeedsUserAction] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    let list = [];
    try {
      const data = await fetchSoundFiles();
      list = Array.isArray(data?.files) ? data.files : [];
      setFiles(list);
      setSelectedIndex((prev) => {
        if (!list.length) return 0;
        return Math.min(prev, list.length - 1);
      });
      if (!list.length) {
        setError("目前沒有音效檔可播放。");
      }
      return list;
    } catch (err) {
      setError(err?.message || "音效清單載入失敗");
      setFiles([]);
      setSelectedIndex(0);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const selected = useMemo(() => {
    if (!files.length) return null;
    return files[selectedIndex] || files[0];
  }, [files, selectedIndex]);

  useEffect(() => {
    if (!playRequest || !playRequest.filename) return;

    const trigger = async () => {
      let list = filesRef.current;
      if (!list.length) {
        list = await loadFiles();
      }
      let target = list.find((item) => item.filename === playRequest.filename);
      if (!target) {
        const refreshed = await loadFiles();
        list = refreshed.length ? refreshed : list;
        target = list.find((item) => item.filename === playRequest.filename);
      }
      if (!target && playRequest.url) {
        target = {
          filename: playRequest.filename,
          cleanId: playRequest.filename,
          url: playRequest.url,
          size: null,
          modified_at: null,
        };
        setFiles((prev) => {
          if (prev.some((item) => item.filename === target.filename)) return prev;
          return [...prev, target];
        });
        list = [...list, target];
      }
      if (!target) {
        setError(`找不到音效檔：${playRequest.filename}`);
        onPlayHandled?.();
        return;
      }
      const idx = list.findIndex((item) => item.filename === target.filename);
      if (idx >= 0) {
        setSelectedIndex(idx);
        setPendingAutoPlay({ filename: target.filename });
      }
    };

    trigger().catch(() => {});
  }, [playRequest, loadFiles, onPlayHandled]);

  useEffect(() => {
    if (!pendingAutoPlay || !selected) return;
    if (selected.filename !== pendingAutoPlay.filename) return;
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Likely blocked by autoplay policy: require user gesture
          setNeedsUserAction(true);
        });
      }
    } catch (err) {
      // ignore playback errors (e.g., autoplay restrictions)
    }
    setPendingAutoPlay(null);
    onPlayHandled?.();
  }, [pendingAutoPlay, selected, onPlayHandled]);

  // When autoplay is blocked, listen for the next user click and retry once
  useEffect(() => {
    if (!needsUserAction) return undefined;
    const handler = () => {
      const audio = audioRef.current;
      if (audio) {
        audio.play().catch(() => {});
      }
      setNeedsUserAction(false);
    };
    document.addEventListener("click", handler, { once: true });
    return () => document.removeEventListener("click", handler);
  }, [needsUserAction]);

  const containerStyle = useMemo(() => {
    if (visible || needsUserAction) return styles.container;
    return {
      ...styles.container,
      opacity: 0,
      pointerEvents: "none",
      transform: "translateY(12px)",
      visibility: "hidden",
    };
  }, [visible, needsUserAction]);

  return (
    <div style={containerStyle}>
      <div style={styles.header}>
        <h3 style={styles.title}>Sound Player</h3>
        <button type="button" style={styles.button} onClick={loadFiles} disabled={loading}>
          {loading ? "更新中" : "重新整理"}
        </button>
      </div>

      {error && <div style={styles.empty}>{error}</div>}

      {files.length > 0 && (
        <>
          {needsUserAction && (
            <div style={{
              marginBottom: 8,
              padding: "6px 10px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.08)",
              fontSize: 12,
              color: "#ffdede",
            }}>
              自動播放被瀏覽器阻擋，請點擊任意處或按下方播放。
            </div>
          )}
          <select
            style={styles.select}
            value={selected?.filename || ""}
            onChange={(e) => {
              const idx = files.findIndex((item) => item.filename === e.target.value);
              setSelectedIndex(idx >= 0 ? idx : 0);
            }}
          >
            {files.map((file) => (
              <option key={file.filename} value={file.filename}>
                {file.filename}
              </option>
            ))}
          </select>

          {selected && (
            <div style={styles.meta}>
              {formatBytes(selected.size)}
              {selected.modified_at ? ` · ${formatDate(selected.modified_at)}` : ""}
            </div>
          )}

          {selected && (
            <audio
              key={selected.url}
              ref={audioRef}
              style={styles.audio}
              controls
              src={selected.url}
              preload="metadata"
              onError={() => {
                setError(`音檔載入失敗：${selected.url}`);
              }}
              onPlay={() => {
                setError(null);
                setNeedsUserAction(false);
              }}
            >
              您的瀏覽器不支援音訊播放。
            </audio>
          )}
        </>
      )}

      {!files.length && !error && <div style={styles.empty}>尚未產生任何音效檔案。</div>}
    </div>
  );
}
