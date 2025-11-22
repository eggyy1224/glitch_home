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
        <div style={tabRowStyle}>
          <button
            type="button"
            style={activeTab === "snapshot" ? activeTabButtonStyle : tabButtonStyle}
            onClick={() => handleTabChange("snapshot")}
          >
            Snapshot 管理
          </button>
          <button
            type="button"
            style={activeTab === "timeline" ? activeTabButtonStyle : tabButtonStyle}
            onClick={() => handleTabChange("timeline")}
          >
            Timeline 管理
          </button>
          <button
            type="button"
            style={activeTab === "episode" ? activeTabButtonStyle : tabButtonStyle}
            onClick={() => handleTabChange("episode")}
          >
            Episode 管理
          </button>
        </div>

        {visitedTabs.includes("snapshot") && (
          <div
            role="tabpanel"
            aria-hidden={activeTab !== "snapshot"}
            style={activeTab === "snapshot" ? tabPanelStyle : hiddenTabPanelStyle}
          >
            <SnapshotManager />
          </div>
        )}
        {visitedTabs.includes("timeline") && (
          <div
            role="tabpanel"
            aria-hidden={activeTab !== "timeline"}
            style={activeTab === "timeline" ? tabPanelStyle : hiddenTabPanelStyle}
          >
            <TimelineManager />
          </div>
        )}
        {visitedTabs.includes("episode") && (
          <div
            role="tabpanel"
            aria-hidden={activeTab !== "episode"}
            style={activeTab === "episode" ? tabPanelStyle : hiddenTabPanelStyle}
          >
            <EpisodeManager />
          </div>
        )}
      </div>
    </AdminPanelContext.Provider>
  );
}
