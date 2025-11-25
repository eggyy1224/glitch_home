import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminPanel from "../../src/AdminPanel.jsx";

const {
  mockListIframeSnapshots,
  mockListIframeTimelines,
  mockListEpisodes,
} = vi.hoisted(() => ({
  mockListIframeSnapshots: vi.fn(),
  mockListIframeTimelines: vi.fn(),
  mockListEpisodes: vi.fn(),
}));

vi.mock("../../src/api.js", () => ({
  __esModule: true,
  listIframeSnapshots: (...args) => mockListIframeSnapshots(...args),
  listIframeTimelines: (...args) => mockListIframeTimelines(...args),
  listEpisodes: (...args) => mockListEpisodes(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockListIframeSnapshots.mockResolvedValue({ snapshots: [] });
  mockListIframeTimelines.mockResolvedValue({ timelines: [] });
  mockListEpisodes.mockResolvedValue({ episodes: [] });
});

describe("AdminPanel", () => {
  it("切換標籤時載入對應列表並套用預設 client", async () => {
    render(<AdminPanel clientId="desktop" />);

    await waitFor(() => expect(mockListIframeSnapshots).toHaveBeenCalledWith("desktop"));

    fireEvent.click(screen.getByRole("tab", { name: "Timeline 管理" }));
    await waitFor(() => expect(mockListIframeTimelines).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("tab", { name: "Episode 管理" }));
    await waitFor(() => expect(mockListEpisodes).toHaveBeenCalled());
  });

  it("切換標籤後不會重置已輸入資料", async () => {
    render(<AdminPanel clientId="desktop" />);

    fireEvent.click(screen.getByRole("tab", { name: "Timeline 管理" }));
    const timelineIdInput = await screen.findByPlaceholderText("新建請輸入 id 或在 JSON 設定");
    fireEvent.change(timelineIdInput, { target: { value: "tmp-id" } });

    fireEvent.click(screen.getByRole("tab", { name: "Snapshot 管理" }));
    fireEvent.click(screen.getByRole("tab", { name: "Timeline 管理" }));

    expect(screen.getByPlaceholderText("新建請輸入 id 或在 JSON 設定")).toHaveValue("tmp-id");
  });
});
