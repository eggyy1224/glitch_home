import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import SceneEditor from "../../../src/components/scene/SceneEditor";
import { AdminPanelContext } from "../../../src/AdminPanelContext";
import { validateScene } from "../../../src/utils/adminEditorUtils";

const apiMocks = vi.hoisted(() => {
  return {
    listScenes: vi.fn().mockResolvedValue({ scenes: [] }),
    fetchScene: vi.fn().mockResolvedValue({ scene: { id: "loaded", targets: { left: "left/snap_a" } } }),
    createScene: vi.fn().mockResolvedValue({ scene: { id: "scene_x", targets: { left: "left/snap_a" }, tags: [] } }),
    updateScene: vi.fn().mockResolvedValue({ scene: { id: "scene_x", targets: { left: "left/snap_a" }, tags: [] } }),
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

const renderEditor = () =>
  render(
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
      <SceneEditor />
    </AdminPanelContext.Provider>,
  );

describe("validateScene", () => {
  it("驗證缺少 id 或 targets 會回報錯誤", () => {
    const errors = validateScene({ id: "", targets: {} });
    expect(errors.find((e) => e.path === "id")).toBeTruthy();
    expect(errors.find((e) => e.path === "targets")).toBeTruthy();
  });

  it("接受合法 scene", () => {
    const errors = validateScene({ id: "demo_scene", targets: { left: "left/snap" } });
    expect(errors).toHaveLength(0);
  });
});

describe("SceneEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("可填寫欄位並驗證、儲存與預覽", async () => {
    renderEditor();

    const idInput = screen.getByLabelText("Scene ID");
    fireEvent.change(idInput, { target: { value: "scene_x" } });

    const snapshotInput = screen.getAllByPlaceholderText("client/name 或 name")[0];
    fireEvent.change(snapshotInput, { target: { value: "left/snap_a" } });

    const validateButton = screen.getByRole("button", { name: "驗證並預覽" });
    fireEvent.click(validateButton);

    await waitFor(() => expect(apiMocks.getIframeSnapshot).toHaveBeenCalledWith("left", "snap_a"));
    const messages = await screen.findAllByText(/解析完成/);
    expect(messages.length).toBeGreaterThan(0);

    const saveButton = screen.getByRole("button", { name: /儲存/ });
    fireEvent.click(saveButton);
    await waitFor(() => expect(apiMocks.createScene).toHaveBeenCalled());

    const playButton = screen.getByRole("button", { name: /播放/ });
    fireEvent.click(playButton);
    await waitFor(() => expect(apiMocks.playScene).toHaveBeenCalledWith("scene_x", {}));
  });
});
