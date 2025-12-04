import React, { useCallback, useMemo, useState } from "react";
import type { AdminPanelContextValue } from "./AdminPanelContext";
import { AdminPanelContext } from "./AdminPanelContext";
import AdminPanelMobile from "./AdminPanelMobile";
import "./AdminPanelMatrix.css";
import {
  activeTabButtonStyle,
  containerStyle,
  hiddenTabPanelStyle,
  tabButtonStyle,
  tabPanelStyle,
  tabRowStyle,
} from "./AdminPanelStyles";
import { useIsMobileAdmin } from "./hooks/useIsMobileAdmin";
import SnapshotManager from "./components/SnapshotManager";
import TimelineManager from "./components/TimelineManager";
import EpisodeManager from "./components/EpisodeManager";
import ScenesManager from "./components/ScenesManager";
import ScriptsManager from "./components/ScriptsManager";
import SceneEditor from "./components/scene/SceneEditor";
import ScriptEditor from "./components/script/ScriptEditor";
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

interface AdminPanelDesktopProps {
  appMode: string;
  canWriteMetadata: boolean;
  forbidMessage: string;
}

function AdminPanelDesktop({ appMode, canWriteMetadata, forbidMessage }: AdminPanelDesktopProps) {
  const [activeTab, setActiveTab] = useState<string>("manage");
  const [visitedTabs, setVisitedTabs] = useState<string[]>(["manage"]);
  const [manageTab, setManageTab] = useState<string>("snapshot");
  const [visitedManageTabs, setVisitedManageTabs] = useState<string[]>(["snapshot"]);
  const [editorTab, setEditorTab] = useState<string>("timeline");
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => (prev.includes(tab) ? prev : [...prev, tab]));
  }, []);
  const handleManageTabChange = useCallback((tab: string) => {
    setManageTab(tab);
    setVisitedManageTabs((prev) => (prev.includes(tab) ? prev : [...prev, tab]));
  }, []);

  return (
    <div style={containerStyle} className="admin-matrix">
      {!canWriteMetadata && (
        <div role="alert" style={{ marginBottom: 12, padding: "10px 12px", background: "#2a2a2a", border: "1px solid #f39c12" }}>
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
              <button
                type="button"
                style={manageTab === "scene" ? activeTabButtonStyle : tabButtonStyle}
                onClick={() => handleManageTabChange("scene")}
                role="tab"
                aria-selected={manageTab === "scene"}
                aria-controls="admin-manage-tabpanel-scene"
                id="admin-manage-tab-scene"
                data-ai-id="admin.manage.tab.scene"
              >
                Scene 管理
              </button>
              <button
                type="button"
                style={manageTab === "script" ? activeTabButtonStyle : tabButtonStyle}
                onClick={() => handleManageTabChange("script")}
                role="tab"
                aria-selected={manageTab === "script"}
                aria-controls="admin-manage-tabpanel-script"
                id="admin-manage-tab-script"
                data-ai-id="admin.manage.tab.script"
              >
                Script 管理
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
            {visitedManageTabs.includes("scene") && (
              <div
                role="tabpanel"
                aria-hidden={manageTab !== "scene"}
                style={manageTab === "scene" ? tabPanelStyle : hiddenTabPanelStyle}
                aria-labelledby="admin-manage-tab-scene"
                id="admin-manage-tabpanel-scene"
                data-ai-section="admin.manage.tabpanel.scene"
              >
                <ScenesManager />
              </div>
            )}
            {visitedManageTabs.includes("script") && (
              <div
                role="tabpanel"
                aria-hidden={manageTab !== "script"}
                style={manageTab === "script" ? tabPanelStyle : hiddenTabPanelStyle}
                aria-labelledby="admin-manage-tab-script"
                id="admin-manage-tabpanel-script"
                data-ai-section="admin.manage.tabpanel.script"
              >
                <ScriptsManager />
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
            <div style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap" }} role="tablist" aria-label="Editor 類型切換">
              <button
                type="button"
                onClick={() => setEditorTab("timeline")}
                style={editorTab === "timeline" ? activeTabButtonStyle : tabButtonStyle}
                role="tab"
                aria-selected={editorTab === "timeline"}
                aria-controls="admin-editor-panel"
                id="admin-editor-tab-timeline"
              >
                Snapshot / Timeline / Episode
              </button>
              <button
                type="button"
                onClick={() => setEditorTab("scene")}
                style={editorTab === "scene" ? activeTabButtonStyle : tabButtonStyle}
                role="tab"
                aria-selected={editorTab === "scene"}
                aria-controls="admin-editor-panel"
                id="admin-editor-tab-scene"
              >
                Scene
              </button>
              <button
                type="button"
                onClick={() => setEditorTab("script")}
                style={editorTab === "script" ? activeTabButtonStyle : tabButtonStyle}
                role="tab"
                aria-selected={editorTab === "script"}
                aria-controls="admin-editor-panel"
                id="admin-editor-tab-script"
              >
                Script
              </button>
            </div>
            {editorTab === "timeline" ? <TimelineEpisodeEditor /> : editorTab === "scene" ? <SceneEditor /> : <ScriptEditor />}
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
  );
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
  const resolvedDefaultClient = useMemo(() => {
    if (clientId && clientId !== "admin") return clientId;
    return "desktop";
  }, [clientId]);

  const resolvedForbidMessage = useMemo(
    () => forbidMessage || `目前 APP_MODE=${appMode} 禁止此操作`,
    [appMode, forbidMessage],
  );

  const contextValue = useMemo<AdminPanelContextValue>(
    () => ({
      defaultClientId: resolvedDefaultClient,
      appMode,
      canWriteMetadata,
      canWriteAssets,
      canAnalyze,
      canRebuildIndex,
      forbidMessage: resolvedForbidMessage,
    }),
    [appMode, canAnalyze, canRebuildIndex, canWriteAssets, canWriteMetadata, resolvedDefaultClient, resolvedForbidMessage],
  );

  const desktopProps = useMemo<AdminPanelDesktopProps>(
    () => ({
      appMode,
      canWriteMetadata,
      forbidMessage: resolvedForbidMessage,
    }),
    [appMode, canWriteMetadata, resolvedForbidMessage],
  );

  const isMobileAdmin = useIsMobileAdmin();

  return (
    <AdminPanelContext.Provider value={contextValue}>
      {isMobileAdmin ? <AdminPanelMobile /> : <AdminPanelDesktop {...desktopProps} />}
    </AdminPanelContext.Provider>
  );
}
