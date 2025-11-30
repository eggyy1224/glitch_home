import React, { useCallback, useMemo, useState } from "react";
import type { AdminPanelContextValue } from "./AdminPanelContext";
import { AdminPanelContext } from "./AdminPanelContext";
import "./AdminPanelMatrix.css";
import {
  activeTabButtonStyle,
  containerStyle,
  hiddenTabPanelStyle,
  tabButtonStyle,
  tabPanelStyle,
  tabRowStyle,
} from "./AdminPanelStyles";
import SnapshotManager from "./components/SnapshotManager";
import TimelineManager from "./components/TimelineManager";
import EpisodeManager from "./components/EpisodeManager";
import ClientStateQueuePanel from "./components/ClientStateQueuePanel";
import TimelineEpisodeEditor from "./components/TimelineEpisodeEditor";

interface AdminPanelProps {
  clientId?: string;
  appMode?: string;
  canWriteMetadata?: boolean;
  canWriteAssets?: boolean;
  canAnalyze?: boolean;
  canRebuildIndex?: boolean;
  forbidMessage?: string;
}

export default function AdminPanel({
  clientId,
  appMode = "STUDIO",
  canWriteMetadata = true,
  canWriteAssets = true,
  canAnalyze = true,
  canRebuildIndex = true,
  forbidMessage = "",
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("manage");
  const [visitedTabs, setVisitedTabs] = useState<string[]>(["manage"]);
  const [manageTab, setManageTab] = useState<string>("snapshot");
  const [visitedManageTabs, setVisitedManageTabs] = useState<string[]>(["snapshot"]);
  const resolvedDefaultClient = useMemo(() => {
    if (clientId && clientId !== "admin") return clientId;
    return "desktop";
  }, [clientId]);
  const contextValue = useMemo<AdminPanelContextValue>(
    () => ({
      defaultClientId: resolvedDefaultClient,
      appMode,
      canWriteMetadata,
      canWriteAssets,
      canAnalyze,
      canRebuildIndex,
      forbidMessage: forbidMessage || `目前 APP_MODE=${appMode} 禁止此操作`,
    }),
    [appMode, canWriteAssets, canWriteMetadata, canAnalyze, canRebuildIndex, forbidMessage, resolvedDefaultClient],
  );
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => (prev.includes(tab) ? prev : [...prev, tab]));
  }, []);
  const handleManageTabChange = useCallback((tab: string) => {
    setManageTab(tab);
    setVisitedManageTabs((prev) => (prev.includes(tab) ? prev : [...prev, tab]));
  }, []);

  return (
    <AdminPanelContext.Provider value={contextValue}>
      <div style={containerStyle} className="admin-matrix">
        {!canWriteMetadata && (
          <div
            role="alert"
            style={{ marginBottom: 12, padding: "10px 12px", background: "#2a2a2a", border: "1px solid #f39c12" }}
          >
            {forbidMessage || `目前 APP_MODE=${appMode} 禁止管理操作，已切換為唯讀模式`}
          </div>
        )}
        <div style={tabRowStyle} role="tablist" aria-label="Admin panel tabs" data-ai-id="admin.tablist">
          <button
            type="button"
            style={activeTab === "manage" ? activeTabButtonStyle : tabButtonStyle}
            onClick={() => handleTabChange("manage")}
            role="tab"
            aria-selected={activeTab === "manage"}
            aria-controls="admin-tabpanel-manage"
            id="admin-tab-manage"
            data-ai-id="admin.tab.manage"
          >
            管理
          </button>
          <button
            type="button"
            style={activeTab === "editor" ? activeTabButtonStyle : tabButtonStyle}
            onClick={() => handleTabChange("editor")}
            role="tab"
            aria-selected={activeTab === "editor"}
            aria-controls="admin-tabpanel-editor"
            id="admin-tab-editor"
            data-ai-id="admin.tab.editor"
          >
            Editor
          </button>
          <button
            type="button"
            style={activeTab === "state" ? activeTabButtonStyle : tabButtonStyle}
            onClick={() => handleTabChange("state")}
            role="tab"
            aria-selected={activeTab === "state"}
            aria-controls="admin-tabpanel-state"
            id="admin-tab-state"
            data-ai-id="admin.tab.state"
          >
            狀態 / 排程
          </button>
        </div>

        {visitedTabs.includes("manage") && (
          <div
            role="tabpanel"
            aria-hidden={activeTab !== "manage"}
            style={activeTab === "manage" ? tabPanelStyle : hiddenTabPanelStyle}
            aria-labelledby="admin-tab-manage"
            id="admin-tabpanel-manage"
            data-ai-section="admin.tabpanel.manage"
          >
            <div style={{ ...tabRowStyle, marginBottom: 12 }} role="tablist" aria-label="管理子分頁" data-ai-id="admin.manage.tablist">
              <button
                type="button"
                style={manageTab === "snapshot" ? activeTabButtonStyle : tabButtonStyle}
                onClick={() => handleManageTabChange("snapshot")}
                role="tab"
                aria-selected={manageTab === "snapshot"}
                aria-controls="admin-manage-tabpanel-snapshot"
                id="admin-manage-tab-snapshot"
                data-ai-id="admin.manage.tab.snapshot"
              >
                Snapshot 管理
              </button>
              <button
                type="button"
                style={manageTab === "timeline" ? activeTabButtonStyle : tabButtonStyle}
                onClick={() => handleManageTabChange("timeline")}
                role="tab"
                aria-selected={manageTab === "timeline"}
                aria-controls="admin-manage-tabpanel-timeline"
                id="admin-manage-tab-timeline"
                data-ai-id="admin.manage.tab.timeline"
              >
                Timeline 管理
              </button>
              <button
                type="button"
                style={manageTab === "episode" ? activeTabButtonStyle : tabButtonStyle}
                onClick={() => handleManageTabChange("episode")}
                role="tab"
                aria-selected={manageTab === "episode"}
                aria-controls="admin-manage-tabpanel-episode"
                id="admin-manage-tab-episode"
                data-ai-id="admin.manage.tab.episode"
              >
                Episode 管理
              </button>
            </div>

            {visitedManageTabs.includes("snapshot") && (
              <div
                role="tabpanel"
                aria-hidden={manageTab !== "snapshot"}
                style={manageTab === "snapshot" ? tabPanelStyle : hiddenTabPanelStyle}
                aria-labelledby="admin-manage-tab-snapshot"
                id="admin-manage-tabpanel-snapshot"
                data-ai-section="admin.manage.tabpanel.snapshot"
              >
                <SnapshotManager />
              </div>
            )}
            {visitedManageTabs.includes("timeline") && (
              <div
                role="tabpanel"
                aria-hidden={manageTab !== "timeline"}
                style={manageTab === "timeline" ? tabPanelStyle : hiddenTabPanelStyle}
                aria-labelledby="admin-manage-tab-timeline"
                id="admin-manage-tabpanel-timeline"
                data-ai-section="admin.manage.tabpanel.timeline"
              >
                <TimelineManager />
              </div>
            )}
            {visitedManageTabs.includes("episode") && (
              <div
                role="tabpanel"
                aria-hidden={manageTab !== "episode"}
                style={manageTab === "episode" ? tabPanelStyle : hiddenTabPanelStyle}
                aria-labelledby="admin-manage-tab-episode"
                id="admin-manage-tabpanel-episode"
                data-ai-section="admin.manage.tabpanel.episode"
              >
                <EpisodeManager />
              </div>
            )}
          </div>
        )}
        {visitedTabs.includes("editor") && (
          <div
            role="tabpanel"
            aria-hidden={activeTab !== "editor"}
            style={activeTab === "editor" ? tabPanelStyle : hiddenTabPanelStyle}
            aria-labelledby="admin-tab-editor"
            id="admin-tabpanel-editor"
            data-ai-section="admin.tabpanel.editor"
          >
            <TimelineEpisodeEditor />
          </div>
        )}
        {visitedTabs.includes("state") && (
          <div
            role="tabpanel"
            aria-hidden={activeTab !== "state"}
            style={activeTab === "state" ? tabPanelStyle : hiddenTabPanelStyle}
            aria-labelledby="admin-tab-state"
            id="admin-tabpanel-state"
            data-ai-section="admin.tabpanel.state"
          >
            <ClientStateQueuePanel />
          </div>
        )}
      </div>
    </AdminPanelContext.Provider>
  );
}
