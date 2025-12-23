import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildQueryFromIframeConfig,
  parseIframeConfigFromParams,
  sanitizeIframeConfig,
} from "../utils/iframeConfig";
import type { IframeConfig } from "../types/control";

interface UseIframeConfigOptions {
  initialParams: URLSearchParams;
  iframeMode: boolean;
  clientId: string;
  defaultConfig: IframeConfig;
  skipServerFetch?: boolean;
}

const PERSIST_IFRAME_QUERY =
  String(import.meta.env.VITE_IFRAME_PERSIST_QUERY ?? "false").trim().toLowerCase() === "true";

export function useIframeConfig({
  initialParams,
  iframeMode,
  clientId,
  defaultConfig,
  skipServerFetch = false,
}: UseIframeConfigOptions) {
  const initialConfigFromParams = useMemo(
    () => sanitizeIframeConfig(parseIframeConfigFromParams(initialParams), defaultConfig),
    [initialParams, defaultConfig],
  );

  const [localConfig, setLocalConfig] = useState<IframeConfig | null>(initialConfigFromParams);
  const [serverConfig, setServerConfig] = useState<IframeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remoteNonceRef = useRef(0);

  const nextRemoteNonce = useCallback(() => {
    remoteNonceRef.current += 1;
    return `${Date.now()}-${remoteNonceRef.current}`;
  }, []);

  const updateQueryWithIframeConfig = useCallback((config?: IframeConfig | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const params = url.searchParams;

    if (!PERSIST_IFRAME_QUERY) {
      const keysToDelete: string[] = [];
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
    const keysToDelete: string[] = [];
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
    (nextConfig: Partial<IframeConfig> | null) => {
      const sanitized = sanitizeIframeConfig(nextConfig, defaultConfig);
      setLocalConfig(sanitized);
      updateQueryWithIframeConfig(sanitized);
    },
    [defaultConfig, updateQueryWithIframeConfig],
  );

  const applyRemoteConfig = useCallback(
    (config: Partial<IframeConfig> | null) => {
      const sanitized = sanitizeIframeConfig(config, defaultConfig);
      const reloadNonce = nextRemoteNonce();
      setServerConfig({ ...sanitized, reloadNonce });
      setError(null);
      updateQueryWithIframeConfig(sanitized);
    },
    [defaultConfig, updateQueryWithIframeConfig, nextRemoteNonce],
  );

  const applyServerSnapshot = useCallback(
    (config: Partial<IframeConfig> | null) => {
      const sanitized = sanitizeIframeConfig(config, defaultConfig);
      setLocalConfig(sanitized);
      setServerConfig(sanitized);
      setError(null);
      updateQueryWithIframeConfig(sanitized);
    },
    [defaultConfig, updateQueryWithIframeConfig],
  );

  const releaseRemoteConfig = useCallback(() => {
    setServerConfig((current) => {
      if (!current) {
        return null;
      }
      const fallback = sanitizeIframeConfig(localConfig || defaultConfig, defaultConfig);
      updateQueryWithIframeConfig(fallback);
      return null;
    });
  }, [defaultConfig, localConfig, updateQueryWithIframeConfig]);

  useEffect(() => {
    const skipFetch = skipServerFetch || (initialParams && initialParams.get("iframe_preview") === "true");
    if (!iframeMode || skipFetch) {
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
        const json = (await response.json()) as Partial<IframeConfig>;
        if (cancelled) return;
        applyServerSnapshot(json);
      } catch (err) {
        if (cancelled) return;
        console.error("取得 iframe 配置失敗", err);
        const errorMessage = err && typeof err === "object" && "message" in err ? (err as Error).message : String(err);
        setError(errorMessage);
        setServerConfig(null);
      }
    };

    loadConfig();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [iframeMode, clientId, applyServerSnapshot, skipServerFetch, initialParams]);

  return {
    activeConfig: serverConfig || localConfig || defaultConfig,
    controlsEnabled: !serverConfig,
    handleLocalApply,
    applyRemoteConfig,
    releaseRemoteConfig,
    updateQueryWithIframeConfig,
    iframeConfigError: error,
  };
}
