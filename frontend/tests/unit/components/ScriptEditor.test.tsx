import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import ScriptEditor from "../../../src/components/script/ScriptEditor";
import { AdminPanelContext } from "../../../src/AdminPanelContext";
import { validateScript } from "../../../src/utils/adminEditorUtils";

const apiMocks = vi.hoisted(() => {
  return {
    listScripts: vi.fn().mockResolvedValue({ scripts: [] }),
    listScenes: vi.fn().mockResolvedValue({ scenes: [{ id: "scene_a", title: "A" }] }),
    fetchScript: vi.fn().mockResolvedValue({ script: { id: "loaded_script", entries: [{ type: "scene", scene_id: "scene_a", duration: 3 }] } }),
    fetchScene: vi.fn().mockResolvedValue({
      scene: { targets: [{ client_id: "left", snapshot: "left/snap_a", config: { layout: "grid", panels: [{ id: "p1", url: "/?img=a" }] } }] },
    }),
    getIframeSnapshot: vi.fn().mockResolvedValue({ layout: "grid", panels: [{ id: "p1", url: "/?img=a" }] }),
    listIframeSnapshots: vi.fn().mockResolvedValue({ snapshots: [{ client: "left", name: "snap_a" }] }),
    createScript: vi.fn().mockResolvedValue({ script: { id: "script_x", entries: [{ type: "scene", scene_id: "scene_a", duration: 5 }] } }),
    updateScript: vi.fn().mockResolvedValue({ script: { id: "script_x", entries: [{ type: "scene", scene_id: "scene_a", duration: 5 }] } }),
    playScript: vi.fn().mockResolvedValue({}),
    enqueueClientQueueItem: vi.fn().mockResolvedValue({}),
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
      <ScriptEditor />
    </AdminPanelContext.Provider>,
  );

describe("validateScript", () => {
  it("缺少 id 或 entries 會報錯", () => {
    const errors = validateScript({ id: "", entries: [] });
    expect(errors.find((e) => e.path === "id")).toBeTruthy();
    expect(errors.find((e) => e.path === "entries")).toBeTruthy();
  });

  it("snapshot_pair 需要 client/name", () => {
    const errors = validateScript({ id: "s1", entries: [{ type: "snapshot_pair", left_snapshot: "name_only", duration: 1 }] });
    expect(errors.find((e) => e.path?.includes("left_snapshot"))).toBeTruthy();
  });
});

describe("ScriptEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("表單欄位渲染並可編輯", async () => {
    renderEditor();

    const idInput = screen.getByLabelText("Script ID");
    fireEvent.change(idInput, { target: { value: "script_x" } });

    const sceneSelect = screen.getByLabelText("scene_id");
    fireEvent.change(sceneSelect, { target: { value: "scene_a" } });

    const snapshotInputs = screen.getAllByPlaceholderText("client/name");
    fireEvent.change(snapshotInputs[0], { target: { value: "left/snap_a" } });
    fireEvent.change(snapshotInputs[1], { target: { value: "left/snap_b" } });

    const validateBtn = screen.getByRole("button", { name: "驗證並預覽" });
    expect(validateBtn).toBeEnabled();
  });
});
