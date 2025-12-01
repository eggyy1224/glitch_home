import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import useScriptEditor from "../../../src/hooks/useScriptEditor";
import { AdminPanelContext } from "../../../src/AdminPanelContext";

const apiMocks = vi.hoisted(() => {
  return {
    listScripts: vi.fn().mockResolvedValue({ scripts: [] }),
    listScenes: vi.fn().mockResolvedValue({ scenes: [{ id: "scene_a", title: "A" }] }),
    fetchScene: vi.fn().mockResolvedValue({
      scene: {
        targets: [
          { client_id: "left", snapshot: "left/snap_a", config: { layout: "grid", panels: [{ id: "p1", url: "/?img=a" }] } },
        ],
      },
    }),
    fetchScript: vi.fn().mockResolvedValue({ script: { id: "loaded", entries: [{ type: "scene", scene_id: "scene_a", duration: 3 }] } }),
    getIframeSnapshot: vi.fn().mockResolvedValue({ layout: "grid", panels: [{ id: "p1", url: "/?img=x" }] }),
    listIframeSnapshots: vi.fn().mockResolvedValue({ snapshots: [{ client: "left", name: "snap_a" }] }),
    createScript: vi.fn().mockResolvedValue({
      script: { id: "script_new", entries: [{ type: "scene", scene_id: "scene_a", duration: 5 }], tags: [] },
    }),
    updateScript: vi.fn().mockResolvedValue({
      script: { id: "script_new", entries: [{ type: "scene", scene_id: "scene_a", duration: 5 }], tags: [] },
    }),
    playScript: vi.fn().mockResolvedValue({}),
    enqueueClientQueueItem: vi.fn().mockResolvedValue({}),
  };
});

vi.mock("../../../src/api", () => ({
  __esModule: true,
  ...apiMocks,
}));

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AdminPanelContext.Provider
    value={{
      defaultClientId: "left",
      appMode: "STUDIO",
      canWriteMetadata: true,
      canWriteAssets: true,
      canAnalyze: true,
      canRebuildIndex: true,
      forbidMessage: "",
    }}
  >
    {children}
  </AdminPanelContext.Provider>
);

describe("useScriptEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validateAndPreview 會解析 scene 與 snapshot_pair entries", async () => {
    const { result } = renderHook(() => useScriptEditor(), { wrapper });
    await waitFor(() => expect(apiMocks.listScripts).toHaveBeenCalled());
    await waitFor(() => expect(apiMocks.listScenes).toHaveBeenCalled());

    act(() => {
      result.current[1].setScriptField("id", "script_preview");
      result.current[1].setEntryField(0, "scene_id", "scene_a");
      result.current[1].setEntryField(1, "left_snapshot", "left/snap_l");
      result.current[1].setEntryField(1, "right_snapshot", "right/snap_r");
    });

    await act(async () => {
      await result.current[1].validateAndPreview();
    });

    expect(apiMocks.fetchScene).toHaveBeenCalledWith("scene_a", { resolve: true });
    expect(apiMocks.getIframeSnapshot).toHaveBeenCalledWith("left", "snap_l");
    expect(apiMocks.getIframeSnapshot).toHaveBeenCalledWith("right", "snap_r");
    expect(result.current[0].previewEntries.length).toBe(2);
    expect(result.current[0].message).toContain("解析完成");
  });

  it("saveScript 在新腳本時呼叫 create，已有腳本時呼叫 update", async () => {
    const { result } = renderHook(() => useScriptEditor(), { wrapper });
    await waitFor(() => expect(apiMocks.listScripts).toHaveBeenCalled());

    act(() => {
      result.current[1].setScriptField("id", "script_new");
    });

    await act(async () => {
      await result.current[1].saveScript();
    });
    expect(apiMocks.createScript).toHaveBeenCalled();

    apiMocks.listScripts.mockResolvedValueOnce({ scripts: [{ id: "script_new", entries: [{ type: "scene", scene_id: "scene_a", duration: 1 }] }] });
    await act(async () => {
      await result.current[1].reloadScripts();
    });
    await waitFor(() => expect(result.current[0].scripts.find((s) => s.id === "script_new")).toBeTruthy());

    await act(async () => {
      await result.current[1].saveScript();
    });
    expect(apiMocks.updateScript).toHaveBeenCalled();
  });

  it("enqueueScript 沒 queue client 會被擋下，填入後可送出", async () => {
    const { result } = renderHook(() => useScriptEditor(), { wrapper });
    await waitFor(() => expect(apiMocks.listScripts).toHaveBeenCalled());

    act(() => {
      result.current[1].setScriptField("id", "script_queue");
      result.current[1].setQueueClientId("");
    });
    await act(async () => {
      await result.current[1].enqueueScript();
    });
    expect(apiMocks.enqueueClientQueueItem).not.toHaveBeenCalled();
    expect(result.current[0].message).toContain("請提供 queue client id");

    act(() => {
      result.current[1].setQueueClientId("worker-b");
    });
    await act(async () => {
      await result.current[1].enqueueScript();
    });
    expect(apiMocks.enqueueClientQueueItem).toHaveBeenCalledWith({
      client_id: "worker-b",
      type: "script",
      target_id: "script_queue",
      payload: {},
    });
  });

  it("entries 編輯操作會更新總長度", async () => {
    const { result } = renderHook(() => useScriptEditor(), { wrapper });
    await waitFor(() => expect(apiMocks.listScripts).toHaveBeenCalled());

    const initialDuration = result.current[0].totalDuration;
    expect(initialDuration).toBeGreaterThan(0);

    act(() => {
      result.current[1].addEntry();
    });
    await waitFor(() => expect(result.current[0].entries.length).toBeGreaterThan(2));
    const afterAdd = result.current[0].totalDuration;
    expect(afterAdd).toBeGreaterThan(initialDuration);

    act(() => {
      result.current[1].duplicateEntry(0);
    });
    let duplicatedLength = 0;
    await waitFor(() => {
      duplicatedLength = result.current[0].entries.length;
      expect(duplicatedLength).toBeGreaterThan(3);
    });
    const afterDuplicate = result.current[0].totalDuration;
    expect(afterDuplicate).toBeGreaterThan(afterAdd);

    act(() => {
      result.current[1].removeEntry(0);
    });
    await waitFor(() => expect(result.current[0].entries.length).toBe(duplicatedLength - 1));
  });
});
