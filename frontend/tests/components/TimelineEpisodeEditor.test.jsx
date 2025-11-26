import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TimelineEpisodeEditor from "../../src/components/TimelineEpisodeEditor.jsx";
import { AdminPanelContext } from "../../src/AdminPanelContext.js";

const {
  mockListIframeTimelines,
  mockListEpisodes,
  mockListIframeSnapshots,
  mockFetchIframeTimeline,
  mockFetchEpisode,
  mockUpdateIframeTimeline,
  mockCreateIframeTimeline,
  mockUpdateEpisode,
  mockCreateEpisode,
  mockPlayIframeTimeline,
  mockPlayEpisode,
  mockGetIframeSnapshot,
} = vi.hoisted(() => ({
  mockListIframeTimelines: vi.fn(),
  mockListEpisodes: vi.fn(),
  mockListIframeSnapshots: vi.fn(),
  mockFetchIframeTimeline: vi.fn(),
  mockFetchEpisode: vi.fn(),
  mockUpdateIframeTimeline: vi.fn(),
  mockCreateIframeTimeline: vi.fn(),
  mockUpdateEpisode: vi.fn(),
  mockCreateEpisode: vi.fn(),
  mockPlayIframeTimeline: vi.fn(),
  mockPlayEpisode: vi.fn(),
  mockGetIframeSnapshot: vi.fn(),
}));

vi.mock("../../src/api.js", () => ({
  __esModule: true,
  listIframeTimelines: (...args) => mockListIframeTimelines(...args),
  listEpisodes: (...args) => mockListEpisodes(...args),
  listIframeSnapshots: (...args) => mockListIframeSnapshots(...args),
  fetchIframeTimeline: (...args) => mockFetchIframeTimeline(...args),
  fetchEpisode: (...args) => mockFetchEpisode(...args),
  updateIframeTimeline: (...args) => mockUpdateIframeTimeline(...args),
  createIframeTimeline: (...args) => mockCreateIframeTimeline(...args),
  updateEpisode: (...args) => mockUpdateEpisode(...args),
  createEpisode: (...args) => mockCreateEpisode(...args),
  playIframeTimeline: (...args) => mockPlayIframeTimeline(...args),
  playEpisode: (...args) => mockPlayEpisode(...args),
  getIframeSnapshot: (...args) => mockGetIframeSnapshot(...args),
}));

function renderWithContext(ui) {
  return render(<AdminPanelContext.Provider value={{ defaultClientId: "desktop" }}>{ui}</AdminPanelContext.Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListIframeTimelines.mockResolvedValue({ timelines: [{ id: "demo_tl", client_id: "desktop" }] });
  mockListEpisodes.mockResolvedValue({ episodes: [{ id: "ep1", track_count: 1 }] });
  mockListIframeSnapshots.mockResolvedValue({ snapshots: [{ id: "snapA", client: "desktop" }] });
  mockFetchIframeTimeline.mockResolvedValue({
    timeline: { id: "demo_tl", clientId: "wall", steps: [{ snapshot: "wall/snap1", duration: 5 }] },
  });
  mockFetchEpisode.mockResolvedValue({ episode: { id: "ep1", tracks: [{ timelineId: "t1", targetClientId: "desktop" }] } });
  mockUpdateIframeTimeline.mockResolvedValue({});
  mockCreateIframeTimeline.mockResolvedValue({});
  mockUpdateEpisode.mockResolvedValue({});
  mockCreateEpisode.mockResolvedValue({});
  mockPlayIframeTimeline.mockResolvedValue({});
  mockPlayEpisode.mockResolvedValue({});
  mockGetIframeSnapshot.mockResolvedValue({
    raw: { layout: "grid", gap: 0, columns: 1, panels: [{ url: "/preview" }] },
  });
});

describe("TimelineEpisodeEditor", () => {
  it("載入 timeline 時會同步 snapshot client 並刷新清單", async () => {
    renderWithContext(<TimelineEpisodeEditor />);

    await waitFor(() => expect(mockListIframeSnapshots).toHaveBeenCalledWith("desktop"));

    const loadButtons = await screen.findAllByRole("button", { name: "載入" });
    fireEvent.click(loadButtons[0]);

    await waitFor(() => expect(mockFetchIframeTimeline).toHaveBeenCalledWith("demo_tl", { resolve: false }));
    await waitFor(() => expect(mockListIframeSnapshots).toHaveBeenLastCalledWith("wall"));
  });

  it("儲存 timeline 時遇到 404 會改用 create 並重新載入列表", async () => {
    mockUpdateIframeTimeline.mockRejectedValueOnce(new Error("404 not found"));
    renderWithContext(<TimelineEpisodeEditor />);

    await waitFor(() => expect(mockListIframeTimelines).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Timeline ID"), { target: { value: "tl-new" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() =>
      expect(mockCreateIframeTimeline).toHaveBeenCalledWith(expect.objectContaining({ id: "tl-new" }), { resolve: false }),
    );
    await waitFor(() => expect(mockListIframeTimelines).toHaveBeenCalledTimes(2));
  });

  it("dirty 狀態下 iframe 預覽會先觸發儲存並顯示播放 iframe", async () => {
    renderWithContext(<TimelineEpisodeEditor />);

    fireEvent.change(screen.getByLabelText("Timeline ID"), { target: { value: "tl-preview" } });
    fireEvent.click(screen.getByRole("button", { name: "以 iframe 預覽 timeline" }));

    await waitFor(() =>
      expect(mockUpdateIframeTimeline).toHaveBeenCalledWith(
        "tl-preview",
        expect.objectContaining({ id: "tl-preview" }),
        { resolve: false },
      ),
    );
    await waitFor(() => expect(screen.getByTitle("timeline-full-preview")).toBeInTheDocument());
  });

  it("Episode 播放可解析覆寫 map 並送出 play 指令", async () => {
    renderWithContext(<TimelineEpisodeEditor />);

    fireEvent.click(screen.getByRole("button", { name: "Episode 模式" }));
    fireEvent.change(screen.getByLabelText("Episode ID"), { target: { value: "ep-demo" } });
    fireEvent.change(screen.getByLabelText(/目標 map 覆寫/), { target: { value: "t1:desktop2,t2:mobile" } });
    fireEvent.click(screen.getByRole("button", { name: "播放 Episode（含覆寫）" }));

    await waitFor(() =>
      expect(mockPlayEpisode).toHaveBeenCalledWith("ep-demo", { target_client_map: { t1: "desktop2", t2: "mobile" } }),
    );
  });
});
