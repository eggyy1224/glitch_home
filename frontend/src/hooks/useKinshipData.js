import { useCallback, useEffect, useState } from "react";
import { fetchKinship } from "../api.js";

const DEFAULT_ANCHOR = { x: 0, y: 0, z: 0 };

export function useKinshipData({
  initialImg,
  shouldLoadKinshipData,
  incubatorMode,
  phylogenyMode,
  maxClusters = 3,
}) {
  const [imgId, setImgId] = useState(initialImg);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [clusters, setClusters] = useState([]);

  const navigateToImage = useCallback((nextImg) => {
    if (!nextImg) return;
    const params = new URLSearchParams(window.location.search);
    params.set("img", nextImg);
    const qs = params.toString();
    window.history.replaceState(null, "", `?${qs}`);
    setImgId(nextImg);
  }, []);

  useEffect(() => {
    if (!imgId || !shouldLoadKinshipData) return;
    let cancelled = false;
    setErr(null);
    fetchKinship(imgId, -1)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        if (phylogenyMode || incubatorMode) {
          setClusters([]);
        } else {
          const originalImage = res?.original_image || imgId;
          const cluster = {
            id: `${originalImage}-${Date.now()}`,
            original: originalImage,
            anchor: { ...DEFAULT_ANCHOR },
            data: res,
          };
          setClusters((prev) => {
            const next = [...prev, cluster];
            if (next.length > maxClusters) next.splice(0, next.length - maxClusters);
            return next;
          });
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [imgId, incubatorMode, phylogenyMode, shouldLoadKinshipData, maxClusters]);

  useEffect(() => {
    if (!data || !shouldLoadKinshipData) return;
    const params = new URLSearchParams(window.location.search);
    const continuous = (params.get("continuous") ?? "false") === "true";
    if (continuous) return;
    const autoplay = (params.get("autoplay") ?? "1") !== "0";
    if (!autoplay) return;
    const stepSec = Math.max(2, parseInt(params.get("step") || "30"));

    const key = "visited_images";
    const visited = new Set(JSON.parse(sessionStorage.getItem(key) || "[]"));
    visited.add(data.original_image);

    const pickFirst = (arr) => arr.find((n) => n && !visited.has(n));
    let next = pickFirst(data.children || []);
    if (!next) next = pickFirst(data.siblings || []);
    if (!next) next = pickFirst(data.parents || []);
    if (!next) next = (data.children || [])[0] || (data.siblings || [])[0] || (data.parents || [])[0];

    sessionStorage.setItem(key, JSON.stringify(Array.from(visited)));

    if (!next) return;
    const t = setTimeout(() => {
      navigateToImage(next);
    }, stepSec * 1000);
    return () => clearTimeout(t);
  }, [data, shouldLoadKinshipData, navigateToImage]);

  return {
    imgId,
    setImgId,
    data,
    err,
    clusters,
    navigateToImage,
  };
}
