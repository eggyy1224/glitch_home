import React, { useCallback, useMemo, useState } from "react";
import { AdminPanelContext } from "./AdminPanelContext.js";
import {
  activeTabButtonStyle,
  containerStyle,
  hiddenTabPanelStyle,
  tabButtonStyle,
  tabPanelStyle,
  tabRowStyle,
} from "./AdminPanelStyles.js";
import SnapshotManager from "./components/SnapshotManager.jsx";
import TimelineManager from "./components/TimelineManager.jsx";
import EpisodeManager from "./components/EpisodeManager.jsx";
import ClientStateQueuePanel from "./components/ClientStateQueuePanel.jsx";

export default function AdminPanel({ clientId }) {
  const [activeTab, setActiveTab] = useState("snapshot");
  const [visitedTabs, setVisitedTabs] = useState(["snapshot"]);
  const contextValue = useMemo(() => ({ defaultClientId: clientId || "desktop" }), [clientId]);
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => (prev.includes(tab) ? prev : [...prev, tab]));
  }, []);

  return (
    <AdminPanelContext.Provider value={contextValue}>
      <div style={containerStyle}>
        <div style={tabRowStyle} role="tablist" aria-label="Admin panel tabs" data-ai-id="admin.tablist">
          <button
            type="button"
            style={activeTab === "snapshot" ? activeTabButtonStyle : tabButtonStyle}
            onClick={() => handleTabChange("snapshot")}
            role="tab"
            aria-selected={activeTab === "snapshot"}
            aria-controls="admin-tabpanel-snapshot"
            id="admin-tab-snapshot"
            data-ai-id="admin.tab.snapshot"
          >
            Snapshot 管理
          </button>
          <button
            type="button"
            style={activeTab === "timeline" ? activeTabButtonStyle : tabButtonStyle}
            onClick={() => handleTabChange("timeline")}
            role="tab"
            aria-selected={activeTab === "timeline"}
            aria-controls="admin-tabpanel-timeline"
            id="admin-tab-timeline"
            data-ai-id="admin.tab.timeline"
          >
            Timeline 管理
          </button>
          <button
            type="button"
            style={activeTab === "episode" ? activeTabButtonStyle : tabButtonStyle}
            onClick={() => handleTabChange("episode")}
            role="tab"
            aria-selected={activeTab === "episode"}
            aria-controls="admin-tabpanel-episode"
            id="admin-tab-episode"
            data-ai-id="admin.tab.episode"
          >
            Episode 管理
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

        {visitedTabs.includes("snapshot") && (
          <div
            role="tabpanel"
            aria-hidden={activeTab !== "snapshot"}
            style={activeTab === "snapshot" ? tabPanelStyle : hiddenTabPanelStyle}
            aria-labelledby="admin-tab-snapshot"
            id="admin-tabpanel-snapshot"
            data-ai-section="admin.tabpanel.snapshot"
          >
            <SnapshotManager />
          </div>
        )}
        {visitedTabs.includes("timeline") && (
          <div
            role="tabpanel"
            aria-hidden={activeTab !== "timeline"}
            style={activeTab === "timeline" ? tabPanelStyle : hiddenTabPanelStyle}
            aria-labelledby="admin-tab-timeline"
            id="admin-tabpanel-timeline"
            data-ai-section="admin.tabpanel.timeline"
          >
            <TimelineManager />
          </div>
        )}
        {visitedTabs.includes("episode") && (
          <div
            role="tabpanel"
            aria-hidden={activeTab !== "episode"}
            style={activeTab === "episode" ? tabPanelStyle : hiddenTabPanelStyle}
            aria-labelledby="admin-tab-episode"
            id="admin-tabpanel-episode"
            data-ai-section="admin.tabpanel.episode"
          >
            <EpisodeManager />
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
