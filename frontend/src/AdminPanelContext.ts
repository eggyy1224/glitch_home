import { createContext } from "react";

export interface AdminPanelContextValue {
  defaultClientId: string;
  appMode: string;
  canWriteMetadata: boolean;
  canWriteAssets: boolean;
  canAnalyze: boolean;
  canRebuildIndex: boolean;
  forbidMessage: string;
}

export const AdminPanelContext = createContext<AdminPanelContextValue>({
  defaultClientId: "desktop",
  appMode: "STUDIO",
  canWriteMetadata: true,
  canWriteAssets: true,
  canAnalyze: true,
  canRebuildIndex: true,
  forbidMessage: "",
});
