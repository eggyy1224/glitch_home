import React from "react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import TimelineEpisodeEditor from "../../src/components/TimelineEpisodeEditor";
import { AdminPanelContext, type AdminPanelContextValue } from "../../src/AdminPanelContext";
import type * as api from "../../src/api";
import type { IframeTimeline, EpisodeEntry } from "../../src/types/timeline";

const timelineData: IframeTimeline = {
  id: "demo_tl",
  clientId: "wall",
  steps: [{ snapshot: "wall/snap1", duration: 5 }],
};

const episodePayload: EpisodeEntry = { id: "ep1", tracks: [{ timelineId: "t1", targetClientId: "desktop" }] };

type ApiMocks = {
  listIframeTimelines: Mock;
  listEpisodes: Mock;
  listIframeSnapshots: Mock;
  fetchIframeTimeline: Mock;
  fetchEpisode: Mock;
  updateIframeTimeline: Mock;
  createIframeTimeline: Mock;
  updateEpisode: Mock;
  createEpisode: Mock;
  playIframeTimeline: Mock;
  playEpisode: Mock;
  getIframeSnapshot: Mock;
  saveIframeSnapshot: Mock;
  restoreIframeSnapshot: Mock;
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
    | "listIframeTimelines"
    | "listEpisodes"
    | "listIframeSnapshots"
    | "fetchIframeTimeline"
    | "fetchEpisode"
    | "updateIframeTimeline"
    | "createIframeTimeline"
    | "updateEpisode"
    | "createEpisode"
    | "playIframeTimeline"
    | "playEpisode"
    | "getIframeSnapshot"
    | "saveIframeSnapshot"
    | "restoreIframeSnapshot"
  >([
    "listIframeTimelines",
    "listEpisodes",
    "listIframeSnapshots",
    "fetchIframeTimeline",
    "fetchEpisode",
    "updateIframeTimeline",
    "createIframeTimeline",
    "updateEpisode",
    "createEpisode",
    "playIframeTimeline",
    "playEpisode",
    "getIframeSnapshot",
    "saveIframeSnapshot",
    "restoreIframeSnapshot",
  ]);
  apiMocksRef.current = mocks;
  return { __esModule: true, ...factory() };
});

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
  apiMocks = getApiMocks();
  vi.clearAllMocks();
  apiMocks.listIframeTimelines.mockResolvedValue({ timelines: [{ id: "demo_tl", client_id: "desktop" }] });
  apiMocks.listEpisodes.mockResolvedValue({ episodes: [{ id: "ep1", track_count: 1 }] });
  apiMocks.listIframeSnapshots.mockResolvedValue({
    snapshots: [
      { id: "snapA", client: "desktop" },
      { id: "snapB", client: "desktop" },
    ],
  });
  apiMocks.fetchIframeTimeline.mockResolvedValue(timelineData);
  apiMocks.fetchEpisode.mockResolvedValue(episodePayload);
  apiMocks.updateIframeTimeline.mockResolvedValue(timelineData);
  apiMocks.createIframeTimeline.mockResolvedValue(timelineData);
  apiMocks.updateEpisode.mockResolvedValue(episodePayload);
  apiMocks.createEpisode.mockResolvedValue(episodePayload);
  apiMocks.playIframeTimeline.mockResolvedValue({});
  apiMocks.playEpisode.mockResolvedValue({});
  apiMocks.getIframeSnapshot.mockResolvedValue({
    raw: { layout: "grid", gap: 0, columns: 1, panels: [{ id: "p1", url: "/preview" }] },
  });
  apiMocks.saveIframeSnapshot.mockResolvedValue({});
  apiMocks.restoreIframeSnapshot.mockResolvedValue({});
});

describe("TimelineEpisodeEditor", () => {
  it("載入 timeline 時會同步 snapshot client 並刷新清單", async () => {
    renderWithContext(<TimelineEpisodeEditor />);

    await waitFor(() => expect(apiMocks.listIframeSnapshots).toHaveBeenCalledWith("desktop"));

    const loadButton = await screen.findByRole("button", { name: /載入 timeline demo_tl/ });
    fireEvent.click(loadButton);

    await waitFor(() => expect(apiMocks.fetchIframeTimeline).toHaveBeenCalledWith("demo_tl", { resolve: false }));
    await waitFor(() => expect(apiMocks.listIframeSnapshots).toHaveBeenLastCalledWith("wall"));
  });

  it("儲存 timeline 時遇到 404 會改用 create 並重新載入列表", async () => {
    apiMocks.updateIframeTimeline.mockRejectedValueOnce(new Error("404 not found"));
    renderWithContext(<TimelineEpisodeEditor />);

    await waitFor(() => expect(apiMocks.listIframeTimelines).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Timeline ID"), { target: { value: "tl-new" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() =>
      expect(apiMocks.createIframeTimeline).toHaveBeenCalledWith(expect.objectContaining({ id: "tl-new" }), { resolve: false }),
    );
    await waitFor(() => expect(apiMocks.listIframeTimelines).toHaveBeenCalledTimes(2));
  });

  it("dirty 狀態下 iframe 預覽會先觸發儲存並顯示播放 iframe", async () => {
    renderWithContext(<TimelineEpisodeEditor />);

    fireEvent.change(screen.getByLabelText("Timeline ID"), { target: { value: "tl-preview" } });
    fireEvent.click(screen.getByRole("button", { name: "以 iframe 預覽 timeline" }));

    await waitFor(() =>
      expect(apiMocks.updateIframeTimeline).toHaveBeenCalledWith(
        "tl-preview",
        expect.objectContaining({ id: "tl-preview" }),
        { resolve: false },
      ),
    );
    await waitFor(() => expect(screen.getByTitle("timeline-full-preview")).toBeInTheDocument());
  });

  it("Episode 播放可解析覆寫 map 並送出 play 指令", async () => {
    renderWithContext(<TimelineEpisodeEditor />);

    fireEvent.click(screen.getByRole("tab", { name: "Episode 模式" }));
    fireEvent.change(screen.getByLabelText("Episode ID"), { target: { value: "ep-demo" } });
    fireEvent.change(screen.getByLabelText(/目標 map 覆寫/), { target: { value: "t1:desktop2,t2:mobile" } });
    fireEvent.click(screen.getByRole("button", { name: "播放 Episode（含覆寫）" }));

    await waitFor(() =>
      expect(apiMocks.playEpisode).toHaveBeenCalledWith("ep-demo", { target_client_map: { t1: "desktop2", t2: "mobile" } }),
    );
  });

  it("鎖定 JSON 時不會同步，解除後可手動覆寫", async () => {
    renderWithContext(<TimelineEpisodeEditor />);
    const jsonArea = screen.getByLabelText(/JSON（雙向同步）/) as HTMLTextAreaElement;
    expect(jsonArea.value).toContain("new_timeline");

    const lockCheckbox = screen.getByLabelText("鎖定 JSON");
    await act(async () => {
      fireEvent.click(lockCheckbox);
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Timeline ID"), { target: { value: "locked-id" } });
    });
    expect(jsonArea.value).toContain("new_timeline");

    await act(async () => {
      fireEvent.click(lockCheckbox);
      fireEvent.click(screen.getByRole("button", { name: "以表單覆寫 JSON" }));
    });
    expect(jsonArea.value).toContain("locked-id");
  });

  it("JSON 解析錯誤時會顯示驗證錯誤", async () => {
    vi.useFakeTimers();
    renderWithContext(<TimelineEpisodeEditor />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/JSON（雙向同步）/), { target: { value: "not-json" } });
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText(/json：/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("Timeline 批次/複製貼上與 Episode 批次 target 皆能套用", async () => {
    renderWithContext(<TimelineEpisodeEditor />);

    const timelineSelects = await screen.findAllByLabelText(/選取 step/);
    await act(async () => {
      fireEvent.click(timelineSelects[0]);
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "複製選取" })).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "複製選取" }));
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "貼上" })).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "貼上" }));
    });
    expect(screen.getAllByText(/Step /)).toHaveLength(3);

    await act(async () => {
      fireEvent.change(screen.getByLabelText("批次 duration"), { target: { value: "9" } });
      fireEvent.click(screen.getByRole("button", { name: "套用" }));
    });
    const durationInputs = screen.getAllByLabelText(/duration（秒）/) as HTMLInputElement[];
    expect(durationInputs[0].value).toBe("9");

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Episode 模式" }));
    });
    const trackSelects = (await screen.findAllByLabelText(/選取 track/)) as HTMLSelectElement[];
    await act(async () => {
      fireEvent.click(trackSelects[0]);
      fireEvent.change(screen.getByLabelText("批次 target"), { target: { value: "client-x" } });
      fireEvent.click(screen.getByRole("button", { name: "套用" }));
    });
    const targetInputs = screen.getAllByLabelText(/targetClientId/) as HTMLInputElement[];
    expect(targetInputs[0].value).toBe("client-x");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "複製選取" }));
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "貼上" })).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "貼上" }));
    });
    expect(screen.getAllByLabelText(/選取 track/)).toHaveLength(3);
  });

  it("狀態訊息會依模式切換並只顯示該模式內容", async () => {
    renderWithContext(<TimelineEpisodeEditor />);

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Episode 模式" }));
    });
    const episodeIdInput = (await screen.findByLabelText("Episode ID")) as HTMLInputElement;
    fireEvent.change(episodeIdInput, { target: { value: "" } });
    await waitFor(() => expect(episodeIdInput.value).toBe(""));
    const episodePlayButton = await screen.findByRole("button", { name: "播放 Episode（含覆寫）" });
    await act(async () => {
      fireEvent.click(episodePlayButton);
    });
    await screen.findAllByText(/請先設定 episode id/);

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Snapshot 模式" }));
    });
    const snapshotNameInput = await screen.findByLabelText("名稱");
    fireEvent.change(snapshotNameInput, { target: { value: "" } });
    const snapshotPlayButton = await screen.findByRole("button", { name: "播放 snapshot" });
    await act(async () => {
      fireEvent.click(snapshotPlayButton);
    });
    await screen.findAllByText(/請先設定 client 與 snapshot 名稱/);

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Episode 模式" }));
    });
    await waitFor(() => expect(screen.queryByText(/請先設定 client 與 snapshot 名稱/)).toBeNull());
  });

  it("時間軸預覽 bar 支援拖曳重新排序", async () => {
    renderWithContext(<TimelineEpisodeEditor />);
    const previewBars = await screen.findAllByTestId(/timeline-preview-/);
    expect(previewBars).toHaveLength(2);

    const snapshotSelects = screen.getAllByLabelText("snapshot") as HTMLSelectElement[];
    fireEvent.change(snapshotSelects[0], { target: { value: "desktop/snapA" } });
    fireEvent.change(snapshotSelects[1], { target: { value: "desktop/snapB" } });
    const before = snapshotSelects.map((s) => s.value);

    const dataTransfer: {
      data: Record<string, string>;
      setData: (type: string, value: string) => void;
      getData: (type: string) => string;
    } = {
      data: {},
      setData(type, value) {
        this.data[type] = value;
      },
      getData(type) {
        return this.data[type] || "";
      },
    };

    await act(async () => {
      fireEvent.dragStart(previewBars[0], { dataTransfer });
      fireEvent.drop(previewBars[1], { dataTransfer });
    });

    const selects = await screen.findAllByLabelText(/選取 step/);
    expect(selects).toHaveLength(2);
    // 確認順序已交換
    await waitFor(() => {
      const updated = screen.getAllByLabelText("snapshot") as HTMLSelectElement[];
      expect(updated[0].value).toBe(before[1]);
      expect(updated[1].value).toBe(before[0]);
    });
  });

  it("播放與預覽缺少 id 時會顯示錯誤訊息", async () => {
    renderWithContext(<TimelineEpisodeEditor />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Timeline ID"), { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "以 iframe 預覽 timeline" }));
    });
    expect(screen.getByText("請先設定 id")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Episode 模式" }));
    });
    const episodeIdInput = await screen.findByLabelText("Episode ID");
    await act(async () => {
      fireEvent.change(episodeIdInput, { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "播放 Episode（含覆寫）" }));
    });
    expect(screen.getByRole("status")).toHaveTextContent("請先設定 episode id");
  });

  it("Snapshot 模式可儲存並播放 snapshot", async () => {
    renderWithContext(<TimelineEpisodeEditor />);

    await waitFor(() => expect(apiMocks.listIframeSnapshots).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("tab", { name: "Snapshot 模式" }));
    const nameInput = await screen.findByLabelText("名稱");
    fireEvent.change(nameInput, { target: { value: "snap-demo" } });
    fireEvent.change(screen.getByPlaceholderText("例如 /?slide_mode=true"), {
      target: { value: "/?static_mode=true&img=foo.png" },
    });

    fireEvent.click(screen.getByRole("button", { name: "儲存" }));
    await waitFor(() =>
      expect(apiMocks.saveIframeSnapshot).toHaveBeenCalledWith(
        "desktop",
        "snap-demo",
        expect.objectContaining({
          panels: expect.arrayContaining([]),
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "播放 snapshot" }));
    await waitFor(() => expect(apiMocks.restoreIframeSnapshot).toHaveBeenCalledWith("desktop", "snap-demo"));
  });
});
