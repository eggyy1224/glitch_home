import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import useSceneEditor from "../../../src/hooks/useSceneEditor";
import { AdminPanelContext } from "../../../src/AdminPanelContext";

const apiMocks = vi.hoisted(() => {
  return {
    listScenes: vi.fn().mockResolvedValue({ scenes: [] }),
    fetchScene: vi.fn().mockResolvedValue({ scene: { id: "loaded", targets: { left: "left/snap_a" } } }),
    createScene: vi.fn().mockImplementation(async (payload) => ({
      scene: { id: payload.id ?? "scene_x", targets: { left: "left/snap_a" }, tags: [] },
    })),
    updateScene: vi.fn().mockImplementation(async (sceneId, payload) => ({
      scene: { id: sceneId || payload?.id || "scene_x", targets: { left: "left/snap_a" }, tags: [] },
    })),
    playScene: vi.fn().mockResolvedValue({}),
    enqueueClientQueueItem: vi.fn().mockResolvedValue({}),
    listIframeSnapshots: vi.fn().mockResolvedValue({ snapshots: [{ client: "left", name: "snap_a" }] }),
    getIframeSnapshot: vi.fn().mockResolvedValue({
      layout: "grid",
      gap: 0,
      columns: 1,
      panels: [{ id: "p1", url: "/?img=test.png" }],
    }),
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

describe("useSceneEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("驗證並預覽成功並帶出 iframe config", async () => {
    const { result } = renderHook(() => useSceneEditor(), { wrapper });

    await waitFor(() => expect(apiMocks.listScenes).toHaveBeenCalled());

    act(() => {
      result.current[1].setSceneField("id", "scene_preview");
    });

    await act(async () => {
      await result.current[1].validateAndPreview();
    });

    expect(apiMocks.getIframeSnapshot).toHaveBeenCalledWith("left", "snapshot_left");
    expect(apiMocks.getIframeSnapshot).toHaveBeenCalledWith("right", "snapshot_right");
    expect(result.current[0].previewEntries.length).toBeGreaterThanOrEqual(2);
    expect(result.current[0].message).toContain("解析完成");
    expect(result.current[0].validationErrors).toHaveLength(0);
  });

  it("saveScene 會在不存在時呼叫 create，在存在時呼叫 update", async () => {
    const { result } = renderHook(() => useSceneEditor(), { wrapper });
    await waitFor(() => expect(apiMocks.listScenes).toHaveBeenCalled());

    act(() => {
      result.current[1].setSceneField("id", "scene_new");
    });

    await act(async () => {
      await result.current[1].saveScene();
    });
    expect(apiMocks.createScene).toHaveBeenCalled();

    apiMocks.listScenes.mockResolvedValueOnce({ scenes: [{ id: "scene_new", targets: { left: "left/snap_a" } }] });
    await act(async () => {
      await result.current[1].reloadScenes();
    });
    await waitFor(() => expect(result.current[0].sceneList.find((s) => s.id === "scene_new")).toBeTruthy());

    await act(async () => {
      await result.current[1].saveScene();
    });
    expect(apiMocks.updateScene).toHaveBeenCalled();
  });

  it("enqueueScene 需要 queue client，成功時會送出 payload", async () => {
    const { result } = renderHook(() => useSceneEditor(), { wrapper });
    await waitFor(() => expect(apiMocks.listScenes).toHaveBeenCalled());

    act(() => {
      result.current[1].setSceneField("id", "scene_queue");
      result.current[1].setQueueClientId("");
    });
    await act(async () => {
      await result.current[1].enqueueScene();
    });
    expect(apiMocks.enqueueClientQueueItem).not.toHaveBeenCalled();
    expect(result.current[0].message).toContain("請提供 queue client id");

    act(() => {
      result.current[1].setQueueClientId("worker-a");
    });
    await act(async () => {
      await result.current[1].enqueueScene();
    });
    expect(apiMocks.enqueueClientQueueItem).toHaveBeenCalledWith({
      client_id: "worker-a",
      type: "scene",
      target_id: "scene_queue",
      payload: {},
    });
  });

  it("預覽時 snapshot 解析失敗會記錄錯誤訊息", async () => {
    apiMocks.getIframeSnapshot.mockRejectedValueOnce(new Error("missing snapshot"));
    const { result } = renderHook(() => useSceneEditor(), { wrapper });
    await waitFor(() => expect(apiMocks.listScenes).toHaveBeenCalled());

    act(() => {
      result.current[1].setTargetField(0, "snapshot", "left/unknown");
      result.current[1].setSceneField("id", "scene_error");
    });

    await act(async () => {
      await result.current[1].validateAndPreview();
    });

    expect(result.current[0].previewEntries[0].previewSrc).toBeNull();
    expect(result.current[0].previewEntries[0].error).toBeDefined();
  });
});
