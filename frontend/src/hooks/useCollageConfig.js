import { useCallback, useEffect, useState } from "react";
import { isRemoteCollageSource, sanitizeCollageConfig } from "../utils/collageConfig.js";

const API_BASE = import.meta.env.VITE_API_BASE || "";

const deriveRemoteState = (payload) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const configPayload = payload.config ?? payload;
  const sanitized = sanitizeCollageConfig(configPayload);
  if (!sanitized) {
    return null;
  }
  const hasOwner =
    Boolean(payload.owner_client_id) ||
    Boolean(payload.target_client_id);
  const source = payload.source ?? (hasOwner ? "client" : "global");
  if (!isRemoteCollageSource(source)) {
    return null;
  }
  return {
    config: sanitized,
    source,
  };
};

export function useCollageConfig({ collageMode, clientId }) {
  const [remoteState, setRemoteState] = useState(null);
  const [error, setError] = useState(null);

  const applyRemoteConfig = useCallback((payload) => {
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
        setError(err?.message || String(err));
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
