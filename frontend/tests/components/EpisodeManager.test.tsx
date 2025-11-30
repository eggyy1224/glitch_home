// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EpisodeManager from "../../src/components/EpisodeManager";
import { AdminPanelContext, type AdminPanelContextValue } from "../../src/AdminPanelContext";

const {
  mockListEpisodes,
  mockFetchEpisode,
  mockCreateEpisode,
  mockUpdateEpisode,
  mockDeleteEpisode,
  mockCloneEpisode,
  mockPlayEpisode,
} = vi.hoisted(() => ({
  mockListEpisodes: vi.fn(),
  mockFetchEpisode: vi.fn(),
  mockCreateEpisode: vi.fn(),
  mockUpdateEpisode: vi.fn(),
  mockDeleteEpisode: vi.fn(),
  mockCloneEpisode: vi.fn(),
  mockPlayEpisode: vi.fn(),
}));

vi.mock("../../src/api", () => ({
  __esModule: true,
  listEpisodes: (...args) => mockListEpisodes(...args),
  fetchEpisode: (...args) => mockFetchEpisode(...args),
  createEpisode: (...args) => mockCreateEpisode(...args),
  updateEpisode: (...args) => mockUpdateEpisode(...args),
  deleteEpisode: (...args) => mockDeleteEpisode(...args),
  cloneEpisode: (...args) => mockCloneEpisode(...args),
  playEpisode: (...args) => mockPlayEpisode(...args),
}));

const episodeData = {
  id: "ep1",
  title: "demo",
  tracks: [{ timelineId: "t1", targetClientId: "c1" }],
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
  mockListEpisodes.mockResolvedValue({ episodes: [{ id: "ep1", title: "demo", track_count: 1 }] });
  mockFetchEpisode.mockResolvedValue({ episode: episodeData });
  mockCreateEpisode.mockResolvedValue({});
  mockUpdateEpisode.mockResolvedValue({});
  mockDeleteEpisode.mockResolvedValue({});
  mockCloneEpisode.mockResolvedValue({});
  mockPlayEpisode.mockResolvedValue({ tracks: [] });
});

describe("EpisodeManager", () => {
  it("切換到 episode 後可載入並播放", async () => {
    renderWithContext(<EpisodeManager />);

    await waitFor(() => expect(mockListEpisodes).toHaveBeenCalled());

    const loadButtons = screen.getAllByRole("button", { name: /載入 episode/i });
    fireEvent.click(loadButtons[loadButtons.length - 1]);
    await waitFor(() => expect(mockFetchEpisode).toHaveBeenCalledWith("ep1", { resolve: false }));

    fireEvent.click(screen.getByRole("button", { name: "播放 Episode" }));
    await waitFor(() => expect(mockPlayEpisode).toHaveBeenCalled());
  });

  it("新增 episode 時會使用輸入欄位的 id", async () => {
    renderWithContext(<EpisodeManager />);

    await waitFor(() => expect(mockListEpisodes).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText("新建請輸入 id 或在 JSON 設定"), { target: { value: "new-ep" } });
    const minimalJson = JSON.stringify({ title: "demo", tracks: [] }, null, 2);
    fireEvent.change(
      screen.getByDisplayValue((value) => typeof value === "string" && value.includes("new_episode")),
      { target: { value: minimalJson } },
    );

    fireEvent.click(screen.getByRole("button", { name: "新增" }));
    await waitFor(() =>
      expect(mockCreateEpisode).toHaveBeenCalledWith(expect.objectContaining({ id: "new-ep" }), { resolve: false }),
    );
  });
});
