import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { request } from "../utils/request";

const FALLBACK_MODE = (import.meta.env.VITE_APP_MODE || "STUDIO").toUpperCase();

function deriveFromMode(mode = FALLBACK_MODE) {
  const normalized = (mode || FALLBACK_MODE).toUpperCase();
  if (normalized === "CONSOLE") {
    return { appMode: normalized, canGenerate: false, canWriteMetadata: true, canWriteAssets: true };
  }
  if (normalized === "DISPLAY") {
    return { appMode: normalized, canGenerate: false, canWriteMetadata: false, canWriteAssets: false };
  }
  return { appMode: normalized, canGenerate: true, canWriteMetadata: true, canWriteAssets: true };
}

function deriveCapabilities(runtimeCaps) {
  if (!runtimeCaps) {
    return deriveFromMode(FALLBACK_MODE);
  }
  const mode = (runtimeCaps.app_mode || FALLBACK_MODE).toUpperCase();
  const fallback = deriveFromMode(mode);
  return {
    appMode: mode,
    canGenerate: runtimeCaps.enable_generation ?? fallback.canGenerate,
    canWriteMetadata: runtimeCaps.enable_metadata_write ?? fallback.canWriteMetadata,
    canWriteAssets: runtimeCaps.enable_asset_write ?? fallback.canWriteAssets,
  };
}

const AppModeContext = createContext({
  appMode: FALLBACK_MODE,
  capabilities: deriveFromMode(FALLBACK_MODE),
  loading: false,
  error: null,
  refresh: () => {},
});

export function AppModeProvider({ children }) {
  const [appMode, setAppMode] = useState(FALLBACK_MODE);
  const [capabilities, setCapabilities] = useState(deriveFromMode(FALLBACK_MODE));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request("/api/runtime-caps");
      const derived = deriveCapabilities(data);
      setAppMode(derived.appMode);
      setCapabilities({
        canGenerate: Boolean(derived.canGenerate),
        canWriteMetadata: Boolean(derived.canWriteMetadata),
        canWriteAssets: Boolean(derived.canWriteAssets),
      });
      setError(null);
    } catch (err) {
      // 保留 env 推導並紀錄錯誤供 UI 判斷
      setError(err.message || "無法取得執行模式");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
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

export function useAppMode() {
  return useContext(AppModeContext);
}
