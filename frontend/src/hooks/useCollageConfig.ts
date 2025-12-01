import { useCallback, useEffect, useState } from "react";
import { isRemoteCollageSource, sanitizeCollageConfig, type CollageConfig } from "../utils/collageConfig";

const API_BASE = import.meta.env.VITE_API_BASE || "";

type CollageRemoteSource = "client" | "global";

type CollageRemoteState = {
  config: CollageConfig;
  source: CollageRemoteSource;
};

const deriveRemoteState = (payload: unknown): CollageRemoteState | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  // biome-ignore lint/suspicious/noExplicitAny: 從遠端取得的 payload，逐步清洗
  const configPayload = (payload as any).config ?? payload;
  const sanitized = sanitizeCollageConfig(configPayload);
  if (!sanitized) {
    return null;
  }
  const hasOwner =
    Boolean((payload as { owner_client_id?: unknown }).owner_client_id) ||
    Boolean((payload as { target_client_id?: unknown }).target_client_id);
  const source = (payload as { source?: CollageRemoteSource | null | undefined }).source ?? (hasOwner ? "client" : "global");
  if (!isRemoteCollageSource(source)) {
    return null;
  }
  return {
    config: sanitized,
    source,
  };
};

interface UseCollageConfigOptions {
  collageMode: boolean;
  clientId?: string;
}

export function useCollageConfig({ collageMode, clientId }: UseCollageConfigOptions) {
  const [remoteState, setRemoteState] = useState<CollageRemoteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyRemoteConfig = useCallback((payload: unknown) => {
    const nextState = deriveRemoteState(payload);
    if (nextState) {
      setRemoteState(nextState);
    } else {
      setRemoteState(null);
    }
  }, []);

  useEffect(() => {
    if (!collageMode) {
      setRemoteState(null);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadConfig = async () => {
      try {
        let endpoint = `${API_BASE}/api/collage-config`;
        if (clientId) {
          const params = new URLSearchParams({ client: clientId });
          endpoint = `${endpoint}?${params.toString()}`;
        }
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (cancelled) return;
        const nextState = deriveRemoteState(data);
        setRemoteState(nextState);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error("取得 collage 配置失敗", err);
        setRemoteState(null);
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    };

    loadConfig();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [collageMode, clientId]);

  return {
    remoteConfig: remoteState?.config ?? null,
    remoteSource: remoteState?.source ?? null,
    controlsEnabled: remoteState == null,
    applyRemoteConfig,
    collageConfigError: error,
  };
}
