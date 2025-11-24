import { useCallback, useEffect, useRef, useState } from "react";
import { fetchKinship } from "../api.js";
import { useKinshipNavigation } from "./useKinshipNavigation.js";

const DEFAULT_ANCHOR = { x: 0, y: 0, z: 0 };

export function useKinshipData({
  initialImg,
  shouldLoadKinshipData,
  incubatorMode,
  phylogenyMode,
  maxClusters = 3,
  navigationFactory = useKinshipNavigation,
  navigationOptions = {},
}) {
  const [imgId, setImgId] = useState(initialImg);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [clusters, setClusters] = useState([]);
  const kinshipCacheRef = useRef(new Map());

  const {
    updateUrlParams,
    getAutoplayConfig,
    readVisitedImages,
    saveVisitedImages,
    scheduleNavigation,
  } = navigationFactory(navigationOptions);

  const navigateToImage = useCallback(
    (nextImg) => {
      if (!nextImg) return;
      updateUrlParams(nextImg);
      setImgId(nextImg);
    },
    [updateUrlParams],
  );

  useEffect(() => {
    if (!imgId || !shouldLoadKinshipData) return;
    const controller = new AbortController();
    setErr(null);

    const applyKinshipData = (res) => {
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
    };

    const cached = kinshipCacheRef.current.get(imgId);
    if (cached) {
      applyKinshipData(cached);
      return () => {
        controller.abort();
      };
    }

    fetchKinship(imgId, -1, { signal: controller.signal })
      .then((res) => {
        kinshipCacheRef.current.set(imgId, res);
        applyKinshipData(res);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setErr(e.message);
      });

    return () => {
      controller.abort();
    };
  }, [imgId, incubatorMode, phylogenyMode, shouldLoadKinshipData, maxClusters]);

  useEffect(() => {
    if (!data || !shouldLoadKinshipData) return;
    const { continuous, autoplay, stepSec } = getAutoplayConfig();
    if (continuous || !autoplay) return;

    const visited = readVisitedImages();
    visited.add(data.original_image);

    const pickFirst = (arr) => arr.find((n) => n && !visited.has(n));
    let next = pickFirst(data.children || []);
    if (!next) next = pickFirst(data.siblings || []);
    if (!next) next = pickFirst(data.parents || []);
    if (!next) next = (data.children || [])[0] || (data.siblings || [])[0] || (data.parents || [])[0];

    saveVisitedImages(visited);

    if (!next) return;
    return scheduleNavigation(next, navigateToImage, stepSec);
  }, [
    data,
    shouldLoadKinshipData,
    navigateToImage,
    getAutoplayConfig,
    readVisitedImages,
    saveVisitedImages,
    scheduleNavigation,
  ]);

  return {
    imgId,
    setImgId,
    data,
    err,
    clusters,
    navigateToImage,
  };
}
