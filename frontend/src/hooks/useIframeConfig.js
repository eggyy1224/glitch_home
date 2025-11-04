import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildQueryFromIframeConfig,
  parseIframeConfigFromParams,
  sanitizeIframeConfig,
} from "../utils/iframeConfig.js";

const PERSIST_IFRAME_QUERY =
  String(import.meta.env.VITE_IFRAME_PERSIST_QUERY ?? "false").trim().toLowerCase() === "true";

export function useIframeConfig({ initialParams, iframeMode, clientId, defaultConfig }) {
  const initialConfigFromParams = useMemo(
    () => sanitizeIframeConfig(parseIframeConfigFromParams(initialParams), defaultConfig),
    [initialParams, defaultConfig],
  );

  const [localConfig, setLocalConfig] = useState(initialConfigFromParams);
  const [serverConfig, setServerConfig] = useState(null);
  const [error, setError] = useState(null);

  const updateQueryWithIframeConfig = useCallback((config) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const params = url.searchParams;

    if (!PERSIST_IFRAME_QUERY) {
      const keysToDelete = [];
      params.forEach((_, key) => {
        if (key.startsWith("iframe_") && key !== "iframe_mode") {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach((key) => params.delete(key));
      window.history.replaceState(null, "", `${url.pathname}?${params.toString()}`);
      return;
    }

    if (!config) return;
    const reserved = new Set(["iframe_mode", "iframe_layout", "iframe_gap", "iframe_columns"]);
    const keysToDelete = [];
    params.forEach((_, key) => {
      if (key.startsWith("iframe_") && !reserved.has(key)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => params.delete(key));

    const entries = buildQueryFromIframeConfig(config);
    if (entries) {
      entries.forEach(([key, value]) => {
        params.set(key, value);
      });
    } else {
      params.delete("iframe_panels");
    }

    window.history.replaceState(null, "", `${url.pathname}?${params.toString()}`);
  }, []);

  const handleLocalApply = useCallback(
    (nextConfig) => {
      const sanitized = sanitizeIframeConfig(nextConfig, defaultConfig);
      setLocalConfig(sanitized);
      updateQueryWithIframeConfig(sanitized);
    },
    [defaultConfig, updateQueryWithIframeConfig],
  );

  const applyRemoteConfig = useCallback(
    (config) => {
      const sanitized = sanitizeIframeConfig(config, defaultConfig);
      setServerConfig(sanitized);
      setError(null);
      updateQueryWithIframeConfig(sanitized);
    },
    [defaultConfig, updateQueryWithIframeConfig],
  );

  useEffect(() => {
    if (!iframeMode) {
      setServerConfig(null);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadConfig = async () => {
      try {
        let endpoint = "/api/iframe-config";
        if (clientId) {
          const qs = new URLSearchParams({ client: clientId });
          endpoint = `${endpoint}?${qs.toString()}`;
        }
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        if (cancelled) return;
        applyRemoteConfig(json);
      } catch (err) {
        if (cancelled) return;
        console.error("取得 iframe 配置失敗", err);
        setError(err.message || String(err));
        setServerConfig(null);
      }
    };

    loadConfig();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [iframeMode, clientId, applyRemoteConfig]);

  return {
    activeConfig: serverConfig || localConfig || defaultConfig,
    controlsEnabled: !serverConfig,
    handleLocalApply,
    applyRemoteConfig,
    updateQueryWithIframeConfig,
    iframeConfigError: error,
  };
}
