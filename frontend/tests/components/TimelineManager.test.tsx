import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TimelineManager from "../../src/components/TimelineManager";
import { AdminPanelContext, type AdminPanelContextValue } from "../../src/AdminPanelContext";
import { createMockApi } from "../testUtils";
import type * as api from "../../src/api";

const { mocks: apiMocks, createApi } = vi.hoisted(() => {
  const { mocks, factory } = createMockApi<
    typeof api,
    | "listIframeTimelines"
    | "fetchIframeTimeline"
    | "createIframeTimeline"
    | "updateIframeTimeline"
    | "deleteIframeTimeline"
    | "cloneIframeTimeline"
    | "playIframeTimeline"
    | "getIframeSnapshot"
  >([
    "listIframeTimelines",
    "fetchIframeTimeline",
    "createIframeTimeline",
    "updateIframeTimeline",
    "deleteIframeTimeline",
    "cloneIframeTimeline",
    "playIframeTimeline",
    "getIframeSnapshot",
  ]);
  return { mocks, createApi: factory };
});

vi.mock("../../src/api", () => ({
  __esModule: true,
  ...createApi(),
}));

const timelineData = {
  id: "t1",
  clientId: "c1",
  steps: [{ snapshot: "c1/snap1", duration: 3, label: "step1" }],
};

const adminContextValue: AdminPanelContextValue = {
  defaultClientId: "desktop",
  appMode: "STUDIO",
  canWriteMetadata: true,
  canWriteAssets: true,
  canAnalyze: true,
  canRebuildIndex: true,
  forbidMessage: "",
};

function renderWithContext(ui: React.ReactElement) {
  return render(<AdminPanelContext.Provider value={adminContextValue}>{ui}</AdminPanelContext.Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.listIframeTimelines.mockResolvedValue({ timelines: [{ id: "t1", client_id: "c1" }] });
  apiMocks.fetchIframeTimeline.mockResolvedValue(timelineData);
  apiMocks.createIframeTimeline.mockResolvedValue(timelineData);
  apiMocks.updateIframeTimeline.mockResolvedValue(timelineData);
  apiMocks.deleteIframeTimeline.mockResolvedValue({});
  apiMocks.cloneIframeTimeline.mockResolvedValue(timelineData);
  apiMocks.playIframeTimeline.mockResolvedValue({});
  apiMocks.getIframeSnapshot.mockResolvedValue({ raw: { layout: "grid", gap: 0, columns: 1, panels: [{ id: "p1", url: "/demo" }] } });
});

describe("TimelineManager", () => {
  it("載入 timeline 並處理 JSON 解析錯誤", async () => {
    renderWithContext(<TimelineManager />);

    await waitFor(() => expect(apiMocks.listIframeTimelines).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /^載入 timeline /i }));
    await waitFor(() => expect(apiMocks.fetchIframeTimeline).toHaveBeenCalledWith("t1", { resolve: false }));
    expect(screen.getByDisplayValue("t1")).toBeInTheDocument();
    await waitFor(() => expect(apiMocks.getIframeSnapshot).toHaveBeenCalled());
    expect(screen.getByTitle("timeline-preview")).toBeInTheDocument();

    const timelineTextarea = screen.getByDisplayValue((value) => typeof value === "string" && value.includes('"id": "t1"'));
    fireEvent.change(timelineTextarea, { target: { value: "bad json" } });
    const playButtons = screen.getAllByRole("button", { name: "播放" });
    fireEvent.click(playButtons[playButtons.length - 1]);
    expect(screen.getByText("JSON 解析失敗，無法播放")).toBeInTheDocument();
  });

  it("新增 timeline 時會使用輸入欄位的 id", async () => {
    renderWithContext(<TimelineManager />);

    await waitFor(() => expect(apiMocks.listIframeTimelines).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText("新建請輸入 id 或在 JSON 設定"), { target: { value: "typed-id" } });
    const minimalJson = JSON.stringify({ title: "tmp", steps: [] }, null, 2);
    fireEvent.change(
      screen.getByDisplayValue((value) => typeof value === "string" && value.includes("new_timeline")),
      { target: { value: minimalJson } },
    );

    fireEvent.click(screen.getByRole("button", { name: "新增" }));
    await waitFor(() =>
      expect(apiMocks.createIframeTimeline).toHaveBeenCalledWith(
        expect.objectContaining({ id: "typed-id" }),
        { resolve: false },
      ),
    );
  });
});
