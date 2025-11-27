import { createContext } from "react";

export const AdminPanelContext = createContext({
  defaultClientId: "desktop",
  appMode: "STUDIO",
  canWriteMetadata: true,
  canWriteAssets: true,
  canAnalyze: true,
  canRebuildIndex: true,
  forbidMessage: "",
});
