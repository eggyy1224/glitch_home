import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { request } from "../utils/request";
import type { AppModeCapabilities, AppModeContextValue } from "../types/control";

interface RuntimeCapabilities {
  app_mode?: string;
  enable_generation?: boolean;
  enable_metadata_write?: boolean;
  enable_asset_write?: boolean;
  enable_analysis_llm?: boolean;
  enable_index_rebuild?: boolean;
  [key: string]: unknown;
}

const FALLBACK_MODE = (import.meta.env.VITE_APP_MODE || "STUDIO").toUpperCase();

function deriveFromMode(mode = FALLBACK_MODE): { appMode: string; capabilities: AppModeCapabilities } {
  const normalized = (mode || FALLBACK_MODE).toUpperCase();
  if (normalized === "CONSOLE") {
    return {
      appMode: normalized,
      capabilities: {
        canGenerate: false,
        canWriteMetadata: true,
        canWriteAssets: true,
        canAnalyze: true,
        canRebuildIndex: false,
      },
    };
  }
  if (normalized === "DISPLAY") {
    return {
      appMode: normalized,
      capabilities: {
        canGenerate: false,
        canWriteMetadata: false,
        canWriteAssets: false,
        canAnalyze: false,
        canRebuildIndex: false,
      },
    };
  }
  return {
    appMode: normalized,
    capabilities: {
      canGenerate: true,
      canWriteMetadata: true,
      canWriteAssets: true,
      canAnalyze: true,
      canRebuildIndex: true,
    },
  };
}

function deriveCapabilities(runtimeCaps: RuntimeCapabilities | null): { appMode: string; capabilities: AppModeCapabilities } {
  if (!runtimeCaps) {
    return deriveFromMode(FALLBACK_MODE);
  }
  const mode = (runtimeCaps.app_mode || FALLBACK_MODE).toUpperCase();
  const fallback = deriveFromMode(mode);
  return {
    appMode: mode,
    capabilities: {
      canGenerate: runtimeCaps.enable_generation ?? fallback.capabilities.canGenerate,
      canWriteMetadata: runtimeCaps.enable_metadata_write ?? fallback.capabilities.canWriteMetadata,
      canWriteAssets: runtimeCaps.enable_asset_write ?? fallback.capabilities.canWriteAssets,
      canAnalyze: runtimeCaps.enable_analysis_llm ?? fallback.capabilities.canAnalyze,
      canRebuildIndex: runtimeCaps.enable_index_rebuild ?? fallback.capabilities.canRebuildIndex,
    },
  };
}

const fallbackDerived = deriveFromMode(FALLBACK_MODE);

const AppModeContext = createContext<AppModeContextValue>({
  appMode: fallbackDerived.appMode,
  capabilities: fallbackDerived.capabilities,
  loading: false,
  error: null,
  refresh: () => {},
  forbidMessage: `目前 APP_MODE=${FALLBACK_MODE} 禁止此操作`,
});

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const [appMode, setAppMode] = useState<string>(fallbackDerived.appMode);
  const [capabilities, setCapabilities] = useState<AppModeCapabilities>(fallbackDerived.capabilities);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await request("/api/runtime-caps")) as RuntimeCapabilities | null;
      const derived = deriveCapabilities(data);
      setAppMode(derived.appMode);
      setCapabilities({
        canGenerate: Boolean(derived.capabilities.canGenerate),
        canWriteMetadata: Boolean(derived.capabilities.canWriteMetadata),
        canWriteAssets: Boolean(derived.capabilities.canWriteAssets),
        canAnalyze: Boolean(derived.capabilities.canAnalyze),
        canRebuildIndex: Boolean(derived.capabilities.canRebuildIndex),
      });
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err && typeof err === "object" && "message" in err ? (err as Error).message : null;
      setError(errorMessage || "無法取得執行模式");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<AppModeContextValue>(
    () => ({
      appMode,
      capabilities,
      loading,
      error,
      refresh,
      forbidMessage: `目前 APP_MODE=${appMode} 禁止此操作`,
    }),
    [appMode, capabilities, loading, error, refresh],
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppModeContextValue {
  return useContext(AppModeContext);
}
