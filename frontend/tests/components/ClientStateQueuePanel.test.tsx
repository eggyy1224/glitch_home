import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import ClientStateQueuePanel from "../../src/components/ClientStateQueuePanel";
import { AdminPanelContext } from "../../src/AdminPanelContext";

const apiMocks = vi.hoisted(() => ({
  listIframeSnapshots: vi.fn().mockResolvedValue({ snapshots: [] }),
  listIframeTimelines: vi.fn().mockResolvedValue({ timelines: [] }),
  listEpisodes: vi.fn().mockResolvedValue({ episodes: [] }),
  listScenes: vi.fn().mockResolvedValue({ scenes: [{ id: "scene_a", title: "A" }] }),
  listScripts: vi.fn().mockResolvedValue({ scripts: [{ id: "script_a", title: "S" }] }),
}));

vi.mock("../../src/api", () => ({
  __esModule: true,
  ...apiMocks,
}));

const queueMock = vi.hoisted(() =>
  vi.fn(() => ({
    clients: [],
    selectedClient: "desktop",
    setSelectedClient: vi.fn(),
    queueItems: [],
    loadingState: false,
    loadingQueue: false,
    message: "",
    enqueueItem: vi.fn(),
    cancelItems: vi.fn(),
    delayItems: vi.fn(),
    moveItems: vi.fn(),
    forceStopItem: vi.fn(),
    refreshStates: vi.fn(),
    refreshQueue: vi.fn(),
    currentClientState: null,
  })),
);

vi.mock("../../src/hooks/useClientStateQueue", () => ({
  useClientStateQueue: queueMock,
}));

const renderPanel = () =>
  render(
    <AdminPanelContext.Provider
      value={{
        defaultClientId: "desktop",
        appMode: "STUDIO",
        canWriteMetadata: true,
        canWriteAssets: true,
        canAnalyze: true,
        canRebuildIndex: true,
        forbidMessage: "",
      }}
    >
      <ClientStateQueuePanel />
    </AdminPanelContext.Provider>,
  );

describe("ClientStateQueuePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queue 表單可載入 scene 與 script 目標選單", async () => {
    renderPanel();

    const typeSelect = screen.getByLabelText("類型");
    const loadButton = await screen.findByTestId("queue-load-options");
    await waitFor(() => expect(loadButton).not.toBeDisabled());

    fireEvent.change(typeSelect, { target: { value: "scene" } });
    fireEvent.click(loadButton);

    await waitFor(() => expect(apiMocks.listScenes).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/已載入 1 個 scene/)).toBeInTheDocument());
    const datalist = document.querySelectorAll("#queue-target-options option");
    expect(Array.from(datalist).some((opt) => opt.getAttribute("value") === "scene_a")).toBe(true);

    fireEvent.change(typeSelect, { target: { value: "script" } });
    fireEvent.click(loadButton);

    await waitFor(() => expect(apiMocks.listScripts).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/已載入 1 個 script/)).toBeInTheDocument());
    const optionsAfterScript = document.querySelectorAll("#queue-target-options option");
    expect(Array.from(optionsAfterScript).some((opt) => opt.getAttribute("value") === "script_a")).toBe(true);
  });
});
