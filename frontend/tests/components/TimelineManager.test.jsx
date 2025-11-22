import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TimelineManager from "../../src/components/TimelineManager.jsx";
import { AdminPanelContext } from "../../src/AdminPanelContext.js";

const {
  mockListIframeTimelines,
  mockFetchIframeTimeline,
  mockCreateIframeTimeline,
  mockUpdateIframeTimeline,
  mockDeleteIframeTimeline,
  mockCloneIframeTimeline,
  mockPlayIframeTimeline,
  mockGetIframeSnapshot,
} = vi.hoisted(() => ({
  mockListIframeTimelines: vi.fn(),
  mockFetchIframeTimeline: vi.fn(),
  mockCreateIframeTimeline: vi.fn(),
  mockUpdateIframeTimeline: vi.fn(),
  mockDeleteIframeTimeline: vi.fn(),
  mockCloneIframeTimeline: vi.fn(),
  mockPlayIframeTimeline: vi.fn(),
  mockGetIframeSnapshot: vi.fn(),
}));

vi.mock("../../src/api.js", () => ({
  __esModule: true,
  listIframeTimelines: (...args) => mockListIframeTimelines(...args),
  fetchIframeTimeline: (...args) => mockFetchIframeTimeline(...args),
  createIframeTimeline: (...args) => mockCreateIframeTimeline(...args),
  updateIframeTimeline: (...args) => mockUpdateIframeTimeline(...args),
  deleteIframeTimeline: (...args) => mockDeleteIframeTimeline(...args),
  cloneIframeTimeline: (...args) => mockCloneIframeTimeline(...args),
  playIframeTimeline: (...args) => mockPlayIframeTimeline(...args),
  getIframeSnapshot: (...args) => mockGetIframeSnapshot(...args),
}));

const timelineData = {
  id: "t1",
  clientId: "c1",
  steps: [{ snapshot: "c1/snap1", duration: 3, label: "step1" }],
};

function renderWithContext(ui) {
  return render(
    <AdminPanelContext.Provider value={{ defaultClientId: "desktop" }}>{ui}</AdminPanelContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListIframeTimelines.mockResolvedValue({ timelines: [{ id: "t1", client_id: "c1" }] });
  mockFetchIframeTimeline.mockResolvedValue({ timeline: timelineData });
  mockCreateIframeTimeline.mockResolvedValue({});
  mockUpdateIframeTimeline.mockResolvedValue({});
  mockDeleteIframeTimeline.mockResolvedValue({});
  mockCloneIframeTimeline.mockResolvedValue({});
  mockPlayIframeTimeline.mockResolvedValue({});
  mockGetIframeSnapshot.mockResolvedValue({ raw: { panels: [{ url: "/demo" }] } });
});

describe("TimelineManager", () => {
  it("載入 timeline 並處理 JSON 解析錯誤", async () => {
    renderWithContext(<TimelineManager />);

    await waitFor(() => expect(mockListIframeTimelines).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "載入" }));
    await waitFor(() => expect(mockFetchIframeTimeline).toHaveBeenCalledWith("t1", { resolve: false }));
    expect(screen.getByDisplayValue("t1")).toBeInTheDocument();
    await waitFor(() => expect(mockGetIframeSnapshot).toHaveBeenCalled());
    expect(screen.getByTitle("timeline-preview")).toBeInTheDocument();

    const timelineTextarea = screen.getByDisplayValue((value) => typeof value === "string" && value.includes('"id": "t1"'));
    fireEvent.change(timelineTextarea, { target: { value: "bad json" } });
    const playButtons = screen.getAllByRole("button", { name: "播放" });
    fireEvent.click(playButtons[playButtons.length - 1]);
    expect(screen.getByText("JSON 解析失敗，無法播放")).toBeInTheDocument();
  });

  it("新增 timeline 時會使用輸入欄位的 id", async () => {
    renderWithContext(<TimelineManager />);

    await waitFor(() => expect(mockListIframeTimelines).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText("新建請輸入 id 或在 JSON 設定"), { target: { value: "typed-id" } });
    const minimalJson = JSON.stringify({ title: "tmp", steps: [] }, null, 2);
    fireEvent.change(
      screen.getByDisplayValue((value) => typeof value === "string" && value.includes("new_timeline")),
      { target: { value: minimalJson } },
    );

    fireEvent.click(screen.getByRole("button", { name: "新增" }));
    await waitFor(() =>
      expect(mockCreateIframeTimeline).toHaveBeenCalledWith(
        expect.objectContaining({ id: "typed-id" }),
        { resolve: false },
      ),
    );
  });
});
