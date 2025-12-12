import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SnapshotListEntry = {
  name?: string;
  createdAt?: string | null;
};

export type AutoRotationStatus = "idle" | "loading" | "playing" | "paused" | "error";

export interface AutoRotationSnapshot {
  clientId: string;
  name: string;
  createdAt: string | null;
}

export interface UseIframeAutoRotationOptions {
  enabled: boolean;
  clientId: string;
  intervalMs?: number;
  refreshMs?: number;
  onApplyConfig: (config: Record<string, unknown>) => void;
}

export interface UseIframeAutoRotationResult {
  status: AutoRotationStatus;
  statusText: string;
  error: string | null;
  isPlaying: boolean;
  queue: AutoRotationSnapshot[];
  current: AutoRotationSnapshot | null;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  reload: () => void;
}

const DEFAULT_INTERVAL_MS = 10_000;
const DEFAULT_REFRESH_MS = 60_000;
const GLOBAL_SNAPSHOT_CLIENT_ID = "global";

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return (err as { name?: unknown }).name === "AbortError";
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeSnapshots(
  raw: unknown,
): SnapshotListEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: SnapshotListEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const typed = item as Record<string, unknown>;
    const name = normalizeString(typed.name);
    if (!name) continue;
    entries.push({
      name,
      createdAt: normalizeString(typed.created_at) ?? null,
    });
  }
  return entries;
}

type SnapshotListResponse = {
  clientId: string;
  queue: AutoRotationSnapshot[];
};

async function fetchSnapshotList(
  targetClientId: string | null,
  signal: AbortSignal,
): Promise<SnapshotListResponse> {
  const query = targetClientId ? `?client=${encodeURIComponent(targetClientId)}` : "";
  const response = await fetch(`/api/iframe-config/snapshots${query}`, { signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const json = (await response.json()) as Record<string, unknown>;
  const resolvedClientId =
    normalizeString(json.client_id) ??
    (targetClientId ? targetClientId : GLOBAL_SNAPSHOT_CLIENT_ID);
  const entries = normalizeSnapshots(json.snapshots);
  const queue: AutoRotationSnapshot[] = entries.map((entry) => ({
    clientId: resolvedClientId,
    name: entry.name || "",
    createdAt: entry.createdAt ?? null,
  }));
  return { clientId: resolvedClientId, queue: queue.filter((item) => Boolean(item.name)) };
}

async function fetchSnapshotConfig(
  snapshot: AutoRotationSnapshot,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  const endpoint = `/api/iframe-config/snapshots/${encodeURIComponent(snapshot.clientId)}/${encodeURIComponent(snapshot.name)}`;
  const response = await fetch(endpoint, { signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const json = (await response.json()) as unknown;
  if (!json || typeof json !== "object") {
    throw new Error("snapshot payload 格式錯誤");
  }
  return json as Record<string, unknown>;
}

export function useIframeAutoRotation({
  enabled,
  clientId,
  intervalMs = DEFAULT_INTERVAL_MS,
  refreshMs = DEFAULT_REFRESH_MS,
  onApplyConfig,
}: UseIframeAutoRotationOptions): UseIframeAutoRotationResult {
  const [status, setStatus] = useState<AutoRotationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<AutoRotationSnapshot[]>([]);
  const [current, setCurrent] = useState<AutoRotationSnapshot | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const enabledRef = useRef(enabled);
  const isPlayingRef = useRef(isPlaying);
  const queueRef = useRef<AutoRotationSnapshot[]>([]);
  const currentRef = useRef<AutoRotationSnapshot | null>(null);
  const currentIndexRef = useRef<number | null>(null);
  const refreshAtRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof globalThis.setInterval> | number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const abortInflight = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const stopAll = useCallback(() => {
    stopTimer();
    abortInflight();
  }, [stopTimer, abortInflight]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      stopAll();
      setStatus("idle");
      setError(null);
      setQueue([]);
      setCurrent(null);
      setIsPlaying(false);
      isPlayingRef.current = false;
      queueRef.current = [];
      currentRef.current = null;
      currentIndexRef.current = null;
      refreshAtRef.current = 0;
    }
  }, [enabled, stopAll]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const statusText = useMemo(() => {
    if (!enabled) return "";
    if (status === "loading") return "自動播放載入中";
    if (status === "error") return "自動播放錯誤";
    if (status === "paused") return "自動播放已暫停";
    if (status === "playing") return "自動播放中";
    return "自動播放待命";
  }, [enabled, status]);

  const refreshQueue = useCallback(
    async (options: { force?: boolean } = {}) => {
      const force = Boolean(options.force);
      const now = Date.now();
      if (!force && queueRef.current.length > 0 && now - refreshAtRef.current < refreshMs) {
        return queueRef.current;
      }

      abortInflight();
      const controller = new AbortController();
      abortRef.current = controller;
      const runId = ++runIdRef.current;

      setStatus("loading");
      setError(null);

      try {
        const primary = await fetchSnapshotList(clientId || null, controller.signal);
        const resolved = primary.queue.length ? primary : await fetchSnapshotList(null, controller.signal);
        if (runId !== runIdRef.current) return queueRef.current;

        const nextQueue = resolved.queue;
        refreshAtRef.current = Date.now();
        setQueue(nextQueue);
        queueRef.current = nextQueue;

        const prev = currentRef.current;
        if (prev) {
          const pos = nextQueue.findIndex((item) => item.clientId === prev.clientId && item.name === prev.name);
          if (pos >= 0) {
            currentIndexRef.current = pos;
          } else {
            currentIndexRef.current = nextQueue.length ? 0 : null;
          }
        } else {
          currentIndexRef.current = nextQueue.length ? 0 : null;
        }

        if (nextQueue.length === 0) {
          setError("找不到任何 iframe snapshot，已停止輪播。");
          setStatus("paused");
          setIsPlaying(false);
          isPlayingRef.current = false;
          stopTimer();
        } else {
          setStatus(isPlayingRef.current ? "playing" : "paused");
        }

        return nextQueue;
      } catch (err) {
        if (isAbortError(err)) return queueRef.current;
        const message = err && typeof err === "object" && "message" in err ? String((err as Error).message) : String(err);
        setError(message);
        setStatus("error");
        setIsPlaying(false);
        isPlayingRef.current = false;
        stopTimer();
        return queueRef.current;
      }
    },
    [abortInflight, clientId, refreshMs, stopTimer],
  );

  const playAtIndex = useCallback(
    async (startIndex: number, direction: 1 | -1, signal: AbortSignal) => {
      const list = queueRef.current;
      if (list.length === 0) {
        throw new Error("找不到任何 iframe snapshot");
      }
      let idx = ((startIndex % list.length) + list.length) % list.length;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < list.length; attempt += 1) {
        const candidate = list[idx];
        try {
          const payload = await fetchSnapshotConfig(candidate, signal);
          onApplyConfig(payload);
          setCurrent(candidate);
          currentIndexRef.current = idx;
          setStatus(isPlayingRef.current ? "playing" : "paused");
          setError(null);
          return;
        } catch (err) {
          if (isAbortError(err)) throw err;
          lastError = err;
          console.warn("[auto_mode] snapshot 載入失敗，將跳過", candidate, err);
          idx = (idx + direction + list.length) % list.length;
        }
      }

      const message =
        lastError && typeof lastError === "object" && "message" in lastError
          ? String((lastError as Error).message)
          : String(lastError || "未知錯誤");
      throw new Error(`所有 snapshots 都無法載入：${message}`);
    },
    [onApplyConfig],
  );

  const playFirst = useCallback(
    async (options: { forceReload?: boolean } = {}) => {
      if (!enabledRef.current) return;
      await refreshQueue({ force: Boolean(options.forceReload) || queueRef.current.length === 0 });

      if (!queueRef.current.length) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        stopTimer();
        return;
      }

      abortInflight();
      const controller = new AbortController();
      abortRef.current = controller;
      const runId = ++runIdRef.current;

      setStatus("loading");
      setError(null);

      try {
        await playAtIndex(0, 1, controller.signal);
        if (runId !== runIdRef.current) return;
      } catch (err) {
        if (isAbortError(err)) return;
        const message = err && typeof err === "object" && "message" in err ? String((err as Error).message) : String(err);
        setError(message);
        setStatus("error");
        setIsPlaying(false);
        isPlayingRef.current = false;
        stopTimer();
      }
    },
    [abortInflight, playAtIndex, refreshQueue, stopTimer],
  );

  const playStep = useCallback(
    async (direction: 1 | -1, options: { forceReload?: boolean } = {}) => {
      if (!enabledRef.current) return;
      await refreshQueue({ force: Boolean(options.forceReload) });

      const list = queueRef.current;
      if (!list.length) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        stopTimer();
        return;
      }

      const currentIndex = currentIndexRef.current;
      const startIndex = currentIndex === null ? 0 : (currentIndex + direction + list.length) % list.length;

      abortInflight();
      const controller = new AbortController();
      abortRef.current = controller;
      const runId = ++runIdRef.current;

      setStatus("loading");
      setError(null);

      try {
        await playAtIndex(startIndex, direction, controller.signal);
        if (runId !== runIdRef.current) return;
      } catch (err) {
        if (isAbortError(err)) return;
        const message = err && typeof err === "object" && "message" in err ? String((err as Error).message) : String(err);
        setError(message);
        setStatus("error");
        setIsPlaying(false);
        isPlayingRef.current = false;
        stopTimer();
      }
    },
    [abortInflight, playAtIndex, refreshQueue, stopTimer],
  );

  const next = useCallback(() => {
    playStep(1).catch(() => {});
  }, [playStep]);

  const previous = useCallback(() => {
    playStep(-1).catch(() => {});
  }, [playStep]);

  const reload = useCallback(() => {
    playFirst({ forceReload: true }).catch(() => {});
  }, [playFirst]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    stopTimer();
    setStatus((prev) => (prev === "error" ? "error" : "paused"));
  }, [stopTimer]);

  const play = useCallback(() => {
    if (!enabledRef.current) return;
    setIsPlaying(true);
    isPlayingRef.current = true;
    setStatus((prev) => (prev === "error" ? "loading" : "playing"));
    if (!currentRef.current) {
      playFirst().catch(() => {});
    }
  }, [playFirst]);

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      play();
    }
  }, [pause, play]);

  useEffect(() => {
    if (!enabled) return undefined;

    stopAll();
    isPlayingRef.current = true;
    setIsPlaying(true);
    setStatus("loading");
    setError(null);

    playFirst({ forceReload: true }).catch(() => {});

    return () => {
      stopAll();
    };
  }, [enabled, clientId, playFirst, stopAll]);

  useEffect(() => {
    if (!enabled) return;
    stopTimer();

    if (!isPlaying) {
      return;
    }

    intervalRef.current = window.setInterval(() => {
      playStep(1).catch(() => {});
    }, intervalMs);

    return () => stopTimer();
  }, [enabled, intervalMs, isPlaying, playStep, stopTimer]);

  return {
    status,
    statusText,
    error,
    isPlaying,
    queue,
    current,
    play,
    pause,
    togglePlay,
    next,
    previous,
    reload,
  };
}
