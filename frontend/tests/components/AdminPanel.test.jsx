import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminPanel from "../../src/AdminPanel.jsx";

const {
  mockListIframeSnapshots,
  mockGetIframeSnapshot,
  mockSaveIframeSnapshot,
  mockDeleteIframeSnapshot,
  mockCloneIframeSnapshot,
  mockListIframeTimelines,
  mockFetchIframeTimeline,
  mockCreateIframeTimeline,
  mockUpdateIframeTimeline,
  mockDeleteIframeTimeline,
  mockCloneIframeTimeline,
  mockPlayIframeTimeline,
  mockListEpisodes,
  mockFetchEpisode,
  mockCreateEpisode,
  mockUpdateEpisode,
  mockDeleteEpisode,
  mockCloneEpisode,
  mockPlayEpisode,
} = vi.hoisted(() => ({
  mockListIframeSnapshots: vi.fn(),
  mockGetIframeSnapshot: vi.fn(),
  mockSaveIframeSnapshot: vi.fn(),
  mockDeleteIframeSnapshot: vi.fn(),
  mockCloneIframeSnapshot: vi.fn(),
  mockListIframeTimelines: vi.fn(),
  mockFetchIframeTimeline: vi.fn(),
  mockCreateIframeTimeline: vi.fn(),
  mockUpdateIframeTimeline: vi.fn(),
  mockDeleteIframeTimeline: vi.fn(),
  mockCloneIframeTimeline: vi.fn(),
  mockPlayIframeTimeline: vi.fn(),
  mockListEpisodes: vi.fn(),
  mockFetchEpisode: vi.fn(),
  mockCreateEpisode: vi.fn(),
  mockUpdateEpisode: vi.fn(),
  mockDeleteEpisode: vi.fn(),
  mockCloneEpisode: vi.fn(),
  mockPlayEpisode: vi.fn(),
}));

vi.mock("../../src/api.js", () => ({
  __esModule: true,
  listIframeSnapshots: (...args) => mockListIframeSnapshots(...args),
  getIframeSnapshot: (...args) => mockGetIframeSnapshot(...args),
  saveIframeSnapshot: (...args) => mockSaveIframeSnapshot(...args),
  deleteIframeSnapshot: (...args) => mockDeleteIframeSnapshot(...args),
  cloneIframeSnapshot: (...args) => mockCloneIframeSnapshot(...args),
  listIframeTimelines: (...args) => mockListIframeTimelines(...args),
  fetchIframeTimeline: (...args) => mockFetchIframeTimeline(...args),
  createIframeTimeline: (...args) => mockCreateIframeTimeline(...args),
  updateIframeTimeline: (...args) => mockUpdateIframeTimeline(...args),
  deleteIframeTimeline: (...args) => mockDeleteIframeTimeline(...args),
  cloneIframeTimeline: (...args) => mockCloneIframeTimeline(...args),
  playIframeTimeline: (...args) => mockPlayIframeTimeline(...args),
  listEpisodes: (...args) => mockListEpisodes(...args),
  fetchEpisode: (...args) => mockFetchEpisode(...args),
  createEpisode: (...args) => mockCreateEpisode(...args),
  updateEpisode: (...args) => mockUpdateEpisode(...args),
  deleteEpisode: (...args) => mockDeleteEpisode(...args),
  cloneEpisode: (...args) => mockCloneEpisode(...args),
  playEpisode: (...args) => mockPlayEpisode(...args),
}));

const snapshotConfig = {
  layout: "grid",
  gap: 0,
  columns: 1,
  panels: [{ id: "p1", url: "/foo" }],
};

const timelineData = {
  id: "t1",
  clientId: "c1",
  steps: [{ snapshot: "c1/snap1", duration: 3, label: "step1" }],
};

const episodeData = {
  id: "ep1",
  title: "demo",
  tracks: [{ timelineId: "t1", targetClientId: "c1" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockListIframeSnapshots.mockResolvedValue({ snapshots: [{ name: "snapA" }] });
  mockGetIframeSnapshot.mockResolvedValue({ raw: snapshotConfig });
  mockSaveIframeSnapshot.mockResolvedValue({ snapshot: { name: "snapA" } });
  mockDeleteIframeSnapshot.mockResolvedValue({});
  mockCloneIframeSnapshot.mockResolvedValue({});

  mockListIframeTimelines.mockResolvedValue({ timelines: [{ id: "t1", client_id: "c1" }] });
  mockFetchIframeTimeline.mockResolvedValue({ timeline: timelineData });
  mockCreateIframeTimeline.mockResolvedValue({});
  mockUpdateIframeTimeline.mockResolvedValue({});
  mockDeleteIframeTimeline.mockResolvedValue({});
  mockCloneIframeTimeline.mockResolvedValue({});
  mockPlayIframeTimeline.mockResolvedValue({});

  mockListEpisodes.mockResolvedValue({ episodes: [{ id: "ep1", title: "demo", track_count: 1 }] });
  mockFetchEpisode.mockResolvedValue({ episode: episodeData });
  mockCreateEpisode.mockResolvedValue({});
  mockUpdateEpisode.mockResolvedValue({});
  mockDeleteEpisode.mockResolvedValue({});
  mockCloneEpisode.mockResolvedValue({});
  mockPlayEpisode.mockResolvedValue({ tracks: [] });
});

describe("AdminPanel", () => {
  it("載入 snapshot 列表、驗證空名稱提示並生成預覽", async () => {
    render(<AdminPanel clientId="desktop" />);

    await waitFor(() => expect(mockListIframeSnapshots).toHaveBeenCalled());
    expect(screen.getByText("snapA")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "儲存/覆寫" }));
    expect(screen.getByText("請輸入 snapshot 名稱")).toBeInTheDocument();

    fireEvent.click(screen.getByText("查看"));
    await waitFor(() => expect(mockGetIframeSnapshot).toHaveBeenCalledWith("desktop", "snapA"));
    expect(screen.getByTitle("snapshot-preview")).toBeInTheDocument();
  });

  it("切換到 timeline 標籤後可載入預覽並處理 JSON 解析錯誤", async () => {
    render(<AdminPanel clientId="desktop" />);

    fireEvent.click(screen.getByRole("button", { name: "Timeline 管理" }));
    await waitFor(() => expect(mockListIframeTimelines).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "載入" }));
    await waitFor(() => expect(mockFetchIframeTimeline).toHaveBeenCalledWith("t1", { resolve: false }));
    expect(screen.getByDisplayValue("t1")).toBeInTheDocument();
    expect(screen.getByTitle("timeline-preview")).toBeInTheDocument();

    const timelineTextarea = screen.getByDisplayValue((value) => typeof value === "string" && value.includes('"id": "t1"'));
    fireEvent.change(timelineTextarea, { target: { value: "bad json" } });
    const playButtons = screen.getAllByRole("button", { name: "播放" });
    fireEvent.click(playButtons[playButtons.length - 1]);
    expect(screen.getByText("JSON 解析失敗，無法播放")).toBeInTheDocument();
  });

  it("切換到 episode 標籤後可載入並播放", async () => {
    render(<AdminPanel clientId="desktop" />);

    fireEvent.click(screen.getByRole("button", { name: "Episode 管理" }));
    await waitFor(() => expect(mockListEpisodes).toHaveBeenCalled());

    const loadButtons = screen.getAllByRole("button", { name: "載入" });
    fireEvent.click(loadButtons[loadButtons.length - 1]);
    await waitFor(() => expect(mockFetchEpisode).toHaveBeenCalledWith("ep1", { resolve: false }));

    fireEvent.click(screen.getByRole("button", { name: "播放 Episode" }));
    await waitFor(() => expect(mockPlayEpisode).toHaveBeenCalled());
  });
});
