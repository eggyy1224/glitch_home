import { useCallback, useEffect, useRef, useState } from "react";
import { fetchKinship } from "../api";
import { useKinshipNavigation } from "./useKinshipNavigation";
import type { KinshipCluster, KinshipData } from "../types/kinship";

const DEFAULT_ANCHOR = { x: 0, y: 0, z: 0 };

export function useKinshipData({
  initialImg,
  shouldLoadKinshipData,
  incubatorMode,
  phylogenyMode,
  maxClusters = 3,
  navigationFactory = useKinshipNavigation,
  navigationOptions = {},
}: {
  initialImg: string | null;
  shouldLoadKinshipData: boolean;
  incubatorMode?: boolean;
  phylogenyMode?: boolean;
  maxClusters?: number;
  navigationFactory?: typeof useKinshipNavigation;
  navigationOptions?: Record<string, unknown>;
}) {
  const [imgId, setImgId] = useState<string | null>(initialImg);
  const [data, setData] = useState<KinshipData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [clusters, setClusters] = useState<KinshipCluster[]>([]);
  const kinshipCacheRef = useRef<Map<string, KinshipData>>(new Map());

  const {
    updateUrlParams,
    getAutoplayConfig,
    readVisitedImages,
    saveVisitedImages,
    scheduleNavigation,
  } = navigationFactory(navigationOptions);

  const navigateToImage = useCallback(
    (nextImg: string | number | null | undefined) => {
      if (!nextImg) return;
      const nextId = String(nextImg);
      updateUrlParams(nextId);
      setImgId(nextId);
    },
    [updateUrlParams],
  );

  useEffect(() => {
    if (!imgId || !shouldLoadKinshipData) return;
    const controller = new AbortController();
    setErr(null);

    const applyKinshipData = (res: KinshipData) => {
      setData(res);
      if (phylogenyMode || incubatorMode) {
        setClusters([]);
      } else {
        const originalImage = res?.original_image || imgId;
          const cluster: KinshipCluster = {
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

    const cached = imgId ? kinshipCacheRef.current.get(imgId) : null;
    if (cached) {
      applyKinshipData(cached);
      return () => {
        controller.abort();
      };
    }

    fetchKinship(imgId, -1, { signal: controller.signal })
      .then((res) => {
        const payload = res as KinshipData;
        if (imgId) kinshipCacheRef.current.set(imgId, payload);
        applyKinshipData(payload);
      })
      .catch((e) => {
        if ((e as { name?: string }).name === "AbortError") return;
        const message = e instanceof Error ? e.message : String(e);
        setErr(message);
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
    if (data.original_image) {
      visited.add(data.original_image);
    }

    const pickFirst = (arr?: string[] | null) => (arr || []).find((n) => n && !visited.has(n));
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
