import React, { useEffect, useMemo, useState, useCallback } from "react";
import { searchImagesByImage, fetchKinship } from "./api.js";

const styles = {
  root: {
    width: "100vw",
    height: "100vh",
    backgroundColor: "#000",
    color: "#f5f5f5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
  },
  stage: {
    maxWidth: "90vw",
    maxHeight: "90vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
    borderRadius: "12px",
  },
  caption: {
    position: "absolute",
    bottom: "32px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "10px 16px",
    borderRadius: "20px",
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: "14px",
    letterSpacing: "0.05em",
  },
  status: {
    position: "absolute",
    top: "32px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "8px 16px",
    borderRadius: "16px",
    background: "rgba(20,20,20,0.75)",
    fontSize: "13px",
    letterSpacing: "0.04em",
  },
};

const cleanId = (value) => (value ? value.replace(/:(en|zh)$/, "") : value);

const DISPLAY_ORDER = Array.from({ length: 15 }, (_, i) => i);
const BATCH_SIZE = 15;

export default function SlideMode({ imagesBase, anchorImage, intervalMs = 3000 }) {
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [anchor, setAnchor] = useState(null);
  const [generation, setGeneration] = useState(0);
  const [showCaption, setShowCaption] = useState(false);
  const [sourceMode, setSourceMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = (params.get("slide_source") || "vector").toLowerCase();
    return mode === "kinship" ? "kinship" : "vector";
  });

  const anchorClean = cleanId(anchorImage);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = (params.get("slide_source") || "vector").toLowerCase();
    setSourceMode(mode === "kinship" ? "kinship" : "vector");
    setAnchor(anchorClean || null);
    setGeneration((prev) => prev + 1);
    setItems([]);
    setIndex(0);
    setShowCaption(false);
  }, [anchorClean]);

  useEffect(() => {
    const handler = (event) => {
      if (event.ctrlKey && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        setShowCaption((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler, { passive: false });
    return () => window.removeEventListener("keydown", handler, { passive: false });
  }, []);

  const performSearch = useCallback(
    (imageId, currentGeneration, mode) => {
      if (!imageId) {
        setItems([]);
        setError("請在網址加入 ?img=offspring_xxx.png 以決定播放內容。");
        setLoading(false);
        return;
      }

      let cancelled = false;
      setLoading(true);
      setError(null);

      const run = async () => {
        try {
          let finalList = [];

          if (mode === "kinship") {
            const data = await fetchKinship(imageId, -1);
            if (cancelled || currentGeneration !== generation) return;

            const ordered = [];
            const seen = new Set();

            const pushList = (arr) => {
              (arr || []).forEach((item) => {
                const clean = cleanId(item);
                if (!clean || seen.has(clean)) return;
                ordered.push({ id: clean, cleanId: clean, distance: null });
                seen.add(clean);
              });
            };

            const children = data?.children || [];
            const siblings = data?.siblings || [];
            const parents = data?.parents || [];
            const ancestorsLevels = data?.ancestors_by_level || [];
            const ancestors = data?.ancestors || [];
            const related = data?.related_images || [];

            pushList(children);
            pushList(siblings);
            pushList(parents);
            ancestorsLevels.forEach((lv) => pushList(lv));
            pushList(ancestors);
            pushList(related);

            const originalClean = cleanId(data?.original_image || imageId);
            if (originalClean && !seen.has(originalClean)) {
              ordered.unshift({ id: originalClean, cleanId: originalClean, distance: null });
              seen.add(originalClean);
            }

            finalList = ordered.slice(0, BATCH_SIZE);
            if (finalList.length === 0 && originalClean) {
              finalList.push({ id: originalClean, cleanId: originalClean, distance: null });
            }
          } else {
            const searchPath = `backend/offspring_images/${imageId}`;
            const data = await searchImagesByImage(searchPath, BATCH_SIZE);
            if (cancelled || currentGeneration !== generation) return;
            const list = Array.isArray(data?.results) ? data.results : [];
            const prepared = list
              .map((item) => ({
                id: item?.id || "",
                cleanId: cleanId(item?.id || ""),
                distance: typeof item?.distance === "number" ? item.distance : null,
              }))
              .filter((entry) => entry.cleanId);

            const ordered = [];
            const seen = new Set();

            DISPLAY_ORDER.forEach((i) => {
              const entry = prepared[i];
              if (!entry || seen.has(entry.cleanId)) return;
              ordered.push(entry);
              seen.add(entry.cleanId);
            });

            prepared.forEach((entry) => {
              if (!seen.has(entry.cleanId)) {
                ordered.push(entry);
                seen.add(entry.cleanId);
              }
            });

            if (!seen.has(imageId)) {
              const clean = cleanId(imageId);
              ordered.unshift({ id: clean, cleanId: clean, distance: null });
            }

            finalList = ordered.slice(0, BATCH_SIZE);
            if (finalList.length === 0) {
              finalList.push({ id: imageId, cleanId: imageId, distance: null });
            }
          }

          setItems(finalList);
          setIndex(0);
        } catch (err) {
          if (cancelled || currentGeneration !== generation) return;
          setError(err?.message || "搜尋失敗，請稍後再試。");
          setItems([{ id: imageId, cleanId: cleanId(imageId), distance: null }]);
          setIndex(0);
        } finally {
          if (!cancelled && currentGeneration === generation) {
            setLoading(false);
          }
        }
      };

      run();

      return () => {
        cancelled = true;
      };
    },
    [generation]
  );

  useEffect(() => {
    if (!anchor) {
      setItems([]);
      return () => {};
    }

    return performSearch(anchor, generation, sourceMode);
  }, [anchor, generation, sourceMode, performSearch]);

  useEffect(() => {
    if (items.length <= 1) return undefined;
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = prev + 1;
        if (next >= items.length) {
          const last = items[items.length - 1];
          if (last?.cleanId) {
            setAnchor(last.cleanId);
            setGeneration((g) => g + 1);
          }
          return 0;
        }
        return next;
      });
    }, Math.max(1000, intervalMs));
    return () => clearInterval(timer);
  }, [items, intervalMs]);

  const current = useMemo(() => {
    if (!items.length) return null;
    return items[index % items.length];
  }, [items, index]);

  const imageUrl = current ? `${imagesBase}${current.cleanId}` : null;

  return (
    <div style={styles.root}>
      {loading && <div style={styles.status}>正在載入相似影像...</div>}
      {error && <div style={styles.status}>{error}</div>}
      {current ? (
        <>
          <div style={styles.stage}>
            <img
              key={current.cleanId}
              src={imageUrl}
              alt={current.cleanId}
              style={styles.image}
            />
          </div>
          {showCaption && (
            <div style={styles.caption}>
              {items.length > 1 && `${index + 1}/${items.length}`} · {current.cleanId}
            </div>
          )}
        </>
      ) : (
        <div style={styles.status}>尚無可播放的圖片</div>
      )}
    </div>
  );
}
