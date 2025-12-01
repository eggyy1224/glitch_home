import { useCallback } from "react";

const VISITED_KEY = "visited_images";
const DEFAULT_CLOCK = {
  setTimeout: (fn: () => void, delay: number) => setTimeout(fn, delay),
  clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
};
const defaultGetSearch = () =>
  typeof window !== "undefined" ? window.location.search : "";
const defaultReplaceUrl = (url: string) => {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", url);
};

interface KinshipNavigationOptions {
  getSearch?: () => string;
  replaceUrl?: (url: string) => void;
  storage?: Pick<Storage, "getItem" | "setItem"> | undefined;
  clock?: {
    setTimeout: (fn: () => void, delay: number) => ReturnType<typeof setTimeout>;
    clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
  };
}

export function useKinshipNavigation({
  getSearch = defaultGetSearch,
  replaceUrl = defaultReplaceUrl,
  storage = typeof window !== "undefined" ? window.sessionStorage : undefined,
  clock = DEFAULT_CLOCK,
}: KinshipNavigationOptions = {}) {
  const updateUrlParams = useCallback(
    (nextImg: string) => {
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
    if (!storage?.getItem) return new Set<string>();
    const raw = storage.getItem(VISITED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set<string>(parsed);
  }, [storage]);

  const saveVisitedImages = useCallback(
    (visited: Set<string>) => {
      if (!storage?.setItem) return;
      storage.setItem(VISITED_KEY, JSON.stringify(Array.from(visited)));
    },
    [storage],
  );

  const scheduleNavigation = useCallback(
    (nextImg: string, onNavigate: (next: string) => void, stepSec: number) => {
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
