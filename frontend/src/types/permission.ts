import type { AppMode, AppModeCapabilities } from "./mode";

export type PermissionKey = "generate" | "writeMetadata" | "writeAssets" | "analyze" | "rebuildIndex";
export type PermissionSet = Record<PermissionKey, boolean>;

export interface RuntimeCapsPayload {
  app_mode?: AppMode | string;
  enable_generation?: boolean;
  enable_metadata_write?: boolean;
  enable_asset_write?: boolean;
  enable_analysis_llm?: boolean;
  enable_index_rebuild?: boolean;
  [key: string]: unknown;
}

export interface DerivedAppMode {
  appMode: AppMode | string;
  capabilities: AppModeCapabilities;
}
