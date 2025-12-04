import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminPanel from "../../src/AdminPanel";
import type * as api from "../../src/api";

type ApiMocks = {
  listIframeSnapshots: Mock;
  listIframeTimelines: Mock;
  listEpisodes: Mock;
  listScenes: Mock;
  listScripts: Mock;
  fetchClientStates: Mock;
  restoreIframeSnapshot: Mock;
  playIframeTimeline: Mock;
  playEpisode: Mock;
  playScene: Mock;
  playScript: Mock;
  stopIframeTimeline: Mock;
};

const apiMocksRef = vi.hoisted(() => ({ current: null as ApiMocks | null }));
let apiMocks: ApiMocks;

const getApiMocks = () => {
  const mocks = apiMocksRef.current;
  if (!mocks) {
    throw new Error("apiMocks not initialized");
  }
  return mocks;
};

vi.mock("../../src/api", async () => {
  const { createMockApi } = await import("../testUtils");
  const { mocks, factory } = createMockApi<
    typeof api,
    | "listIframeSnapshots"
    | "listIframeTimelines"
    | "listEpisodes"
    | "listScenes"
    | "listScripts"
    | "fetchClientStates"
    | "restoreIframeSnapshot"
    | "playIframeTimeline"
    | "playEpisode"
    | "playScene"
    | "playScript"
    | "stopIframeTimeline"
  >([
    "listIframeSnapshots",
    "listIframeTimelines",
    "listEpisodes",
    "listScenes",
    "listScripts",
    "fetchClientStates",
    "restoreIframeSnapshot",
    "playIframeTimeline",
    "playEpisode",
    "playScene",
    "playScript",
    "stopIframeTimeline",
  ]);
  apiMocksRef.current = mocks;
  return {
    __esModule: true,
    ...factory(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks = getApiMocks();
  apiMocks.listIframeSnapshots.mockResolvedValue({ snapshots: [] });
  apiMocks.listIframeTimelines.mockResolvedValue({ timelines: [] });
  apiMocks.listEpisodes.mockResolvedValue({ episodes: [] });
  apiMocks.listScenes.mockResolvedValue({ scenes: [] });
  apiMocks.listScripts.mockResolvedValue({ scripts: [] });
  apiMocks.fetchClientStates.mockResolvedValue([]);
  apiMocks.restoreIframeSnapshot.mockResolvedValue({});
  apiMocks.playIframeTimeline.mockResolvedValue({});
  apiMocks.playEpisode.mockResolvedValue({});
  apiMocks.playScene.mockResolvedValue({});
  apiMocks.playScript.mockResolvedValue({});
  apiMocks.stopIframeTimeline.mockResolvedValue({});
});

describe("AdminPanel", () => {
  it("切換標籤時載入對應列表並套用預設 client", async () => {
    const apiMocks = getApiMocks();
    render(<AdminPanel clientId="admin" />);

    await waitFor(() => expect(apiMocks.listIframeSnapshots).toHaveBeenCalledWith("desktop"));

    fireEvent.click(screen.getByRole("tab", { name: "Timeline 管理" }));
    await waitFor(() => expect(apiMocks.listIframeTimelines).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("tab", { name: "Episode 管理" }));
    await waitFor(() => expect(apiMocks.listEpisodes).toHaveBeenCalled());
  });

  it("切換標籤後不會重置已輸入資料", async () => {
    getApiMocks();
    render(<AdminPanel clientId="admin" />);

    fireEvent.click(screen.getByRole("tab", { name: "Timeline 管理" }));
    const timelineIdInput = await screen.findByPlaceholderText("新建請輸入 id 或在 JSON 設定");
    fireEvent.change(timelineIdInput, { target: { value: "tmp-id" } });

    fireEvent.click(screen.getByRole("tab", { name: "Snapshot 管理" }));
    fireEvent.click(screen.getByRole("tab", { name: "Timeline 管理" }));

    expect(screen.getByPlaceholderText("新建請輸入 id 或在 JSON 設定")).toHaveValue("tmp-id");
  });

  describe("行動版", () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })) as unknown as typeof window.matchMedia,
      );
    });

    afterEach(() => {
      (window as typeof window & { matchMedia?: typeof window.matchMedia }).matchMedia = originalMatchMedia;
    });

    it("matchMedia 偵測為行動版時顯示行動介面並可播放 snapshot", async () => {
      const apiMocks = getApiMocks();
      apiMocks.fetchClientStates.mockResolvedValue([
        { client_id: "desktop", status: "online" },
        { client_id: "mobile01", status: "online" },
      ]);
      apiMocks.listIframeSnapshots.mockResolvedValue({ snapshots: [{ name: "s1", client: "desktop" }] });

      render(<AdminPanel clientId="admin" />);

      await screen.findByText("Admin Mobile");
      expect(screen.getByRole("button", { name: "desktop" })).toHaveClass("active");

      // snapshot 下拉選單載入後送出播放
      await waitFor(() => expect(apiMocks.listIframeSnapshots).toHaveBeenCalled());
      fireEvent.change(screen.getByLabelText("從列表選擇"), { target: { value: "s1" } });
      fireEvent.click(screen.getByRole("button", { name: "播放 Snapshot" }));

      await waitFor(() => expect(apiMocks.restoreIframeSnapshot).toHaveBeenCalledWith("desktop", "s1"));
    });

    it("沒有 matchMedia 時，行動 UA 依然會顯示行動介面", async () => {
      const apiMocks = getApiMocks();
      apiMocks.fetchClientStates.mockResolvedValue([]);
      const originalUA = navigator.userAgent;
      (window as typeof window & { matchMedia?: unknown }).matchMedia = undefined;
      Object.defineProperty(window.navigator, "userAgent", { value: "iPhone", configurable: true });

      try {
        render(<AdminPanel />);
        await screen.findByText("Admin Mobile");
      } finally {
        Object.defineProperty(window.navigator, "userAgent", { value: originalUA, configurable: true });
      }
    });
  });
});
