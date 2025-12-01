import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminPanel from "../../src/AdminPanel";
import { createMockApi } from "../testUtils";
import type * as api from "../../src/api";

const { mocks: apiMocks, createApi } = vi.hoisted(() => {
  const { mocks, factory } = createMockApi<typeof api, "listIframeSnapshots" | "listIframeTimelines" | "listEpisodes">(
    ["listIframeSnapshots", "listIframeTimelines", "listEpisodes"],
  );
  return { mocks, createApi: factory };
});

vi.mock("../../src/api", () => ({
  __esModule: true,
  ...createApi(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.listIframeSnapshots.mockResolvedValue({ snapshots: [] });
  apiMocks.listIframeTimelines.mockResolvedValue({ timelines: [] });
  apiMocks.listEpisodes.mockResolvedValue({ episodes: [] });
});

describe("AdminPanel", () => {
  it("切換標籤時載入對應列表並套用預設 client", async () => {
    render(<AdminPanel clientId="admin" />);

    await waitFor(() => expect(apiMocks.listIframeSnapshots).toHaveBeenCalledWith("desktop"));

    fireEvent.click(screen.getByRole("tab", { name: "Timeline 管理" }));
    await waitFor(() => expect(apiMocks.listIframeTimelines).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("tab", { name: "Episode 管理" }));
    await waitFor(() => expect(apiMocks.listEpisodes).toHaveBeenCalled());
  });

  it("切換標籤後不會重置已輸入資料", async () => {
    render(<AdminPanel clientId="admin" />);

    fireEvent.click(screen.getByRole("tab", { name: "Timeline 管理" }));
    const timelineIdInput = await screen.findByPlaceholderText("新建請輸入 id 或在 JSON 設定");
    fireEvent.change(timelineIdInput, { target: { value: "tmp-id" } });

    fireEvent.click(screen.getByRole("tab", { name: "Snapshot 管理" }));
    fireEvent.click(screen.getByRole("tab", { name: "Timeline 管理" }));

    expect(screen.getByPlaceholderText("新建請輸入 id 或在 JSON 設定")).toHaveValue("tmp-id");
  });
});
