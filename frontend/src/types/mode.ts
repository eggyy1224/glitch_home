export type AppMode = "STUDIO" | "CONSOLE" | "DISPLAY" | "UNKNOWN";

export interface AppModeCapabilities {
  canGenerate: boolean;
  canWriteMetadata: boolean;
  canWriteAssets: boolean;
  canAnalyze: boolean;
  canRebuildIndex: boolean;
}

export interface AppModeContextValue {
  appMode: string | AppMode;
  capabilities: AppModeCapabilities;
  loading: boolean;
  error: string | null;
  refresh: () => void | Promise<void>;
  forbidMessage: string;
}
