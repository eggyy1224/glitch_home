import { useCallback } from "react";

const VISITED_KEY = "visited_images";
const DEFAULT_CLOCK = {
  setTimeout: (fn, delay) => setTimeout(fn, delay),
  clearTimeout: (id) => clearTimeout(id),
};
const defaultGetSearch = () =>
  typeof window !== "undefined" ? window.location.search : "";
const defaultReplaceUrl = (url) => {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", url);
};

export function useKinshipNavigation({
  getSearch = defaultGetSearch,
  replaceUrl = defaultReplaceUrl,
  storage = typeof window !== "undefined" ? window.sessionStorage : undefined,
  clock = DEFAULT_CLOCK,
} = {}) {
  const updateUrlParams = useCallback(
    (nextImg) => {
      const params = new URLSearchParams(getSearch());
      params.set("img", nextImg);
      replaceUrl(`?${params.toString()}`);
    },
    [getSearch, replaceUrl],
  );

  const getAutoplayConfig = useCallback(() => {
    const params = new URLSearchParams(getSearch());
    const continuous = (params.get("continuous") ?? "false") === "true";
    const autoplay = (params.get("autoplay") ?? "1") !== "0";
    const rawStep = parseInt(params.get("step") || "30", 10);
    const stepSec = Math.max(2, Number.isFinite(rawStep) ? rawStep : 30);
    return { continuous, autoplay, stepSec };
  }, [getSearch]);

  const readVisitedImages = useCallback(() => {
    if (!storage?.getItem) return new Set();
    const raw = storage.getItem(VISITED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(parsed);
  }, [storage]);

  const saveVisitedImages = useCallback(
    (visited) => {
      if (!storage?.setItem) return;
      storage.setItem(VISITED_KEY, JSON.stringify(Array.from(visited)));
    },
    [storage],
  );

  const scheduleNavigation = useCallback(
    (nextImg, onNavigate, stepSec) => {
      const timerId = clock.setTimeout(() => onNavigate(nextImg), stepSec * 1000);
      return () => clock.clearTimeout(timerId);
    },
    [clock],
  );

  return {
    updateUrlParams,
    getAutoplayConfig,
    readVisitedImages,
    saveVisitedImages,
    scheduleNavigation,
  };
}
