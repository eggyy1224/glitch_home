import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScenesManager from "../../src/components/ScenesManager";
import ScriptsManager from "../../src/components/ScriptsManager";
import { AdminPanelContext } from "../../src/AdminPanelContext";

const apiMocks = vi.hoisted(() => ({
  listScenes: vi.fn(),
  fetchScene: vi.fn(),
  createScene: vi.fn(),
  updateScene: vi.fn(),
  deleteScene: vi.fn(),
  cloneScene: vi.fn(),
  playScene: vi.fn(),
  publishScene: vi.fn(),
  rollbackScene: vi.fn(),
  listSceneVersions: vi.fn(),
  listScripts: vi.fn(),
  fetchScript: vi.fn(),
  createScript: vi.fn(),
  updateScript: vi.fn(),
  deleteScript: vi.fn(),
  cloneScript: vi.fn(),
  playScript: vi.fn(),
  stopScript: vi.fn(),
  publishScript: vi.fn(),
  rollbackScript: vi.fn(),
  listScriptVersions: vi.fn(),
}));

vi.mock("../../src/api", () => ({
  __esModule: true,
  ...apiMocks,
}));

const adminContextValue = {
  defaultClientId: "tester",
  appMode: "STUDIO",
  canWriteMetadata: true,
  canWriteAssets: true,
  canAnalyze: true,
  canRebuildIndex: true,
  forbidMessage: "",
};

function renderWithContext(node: React.ReactElement) {
  return render(<AdminPanelContext.Provider value={adminContextValue}>{node}</AdminPanelContext.Provider>);
}

describe("ScenesManager", () => {
  const sceneListItem = { id: "scene-1", title: "Main", version: 3, status: "draft", updated_at: "today" };
  const scenePayload = { id: "scene-1", version: 3, status: "draft", steps: [] };

  beforeEach(() => {
    Object.values(apiMocks).forEach((fn) => fn.mockReset());
    apiMocks.listScenes.mockResolvedValue({ scenes: [sceneListItem] });
    apiMocks.fetchScene.mockResolvedValue({ scene: scenePayload });
    apiMocks.listSceneVersions.mockResolvedValue({ versions: [{ version: 1, status: "published" }, { version: 3, status: "draft" }] });
    apiMocks.cloneScene.mockResolvedValue({});
    apiMocks.playScene.mockResolvedValue({});
    apiMocks.publishScene.mockResolvedValue({});
    apiMocks.rollbackScene.mockResolvedValue({});
    apiMocks.deleteScene.mockResolvedValue({});
    apiMocks.updateScene.mockResolvedValue({ scene: { ...scenePayload, version: 4 } });
  });

  it("可以載入、複製、播放、發布與回滾 scene", async () => {
    const user = userEvent.setup();
    renderWithContext(<ScenesManager />);

    await waitFor(() => expect(apiMocks.listScenes).toHaveBeenCalledTimes(1));

    await user.click(screen.getByLabelText("載入 scene scene-1"));
    await waitFor(() => expect(apiMocks.fetchScene).toHaveBeenCalledWith("scene-1", { resolve: false }));
    expect(apiMocks.listSceneVersions).toHaveBeenCalledWith("scene-1");
    expect(screen.getByLabelText("Scene ID")).toHaveValue("scene-1");
    expect(screen.getByText(/已載入 scene scene-1/)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("new id"), "scene-copy");
    await user.click(screen.getByRole("button", { name: "複製" }));
    await waitFor(() =>
      expect(apiMocks.cloneScene).toHaveBeenCalledWith("scene-1", { new_id: "scene-copy" }, { resolve: false }),
    );

    await user.type(screen.getByPlaceholderText("版本號（可選）"), "5");
    await user.click(screen.getByLabelText("允許草稿"));
    await user.click(screen.getByRole("button", { name: "播放" }));
    await waitFor(() =>
      expect(apiMocks.playScene).toHaveBeenCalledWith("scene-1", {}, { allowDraft: true, version: 5 }),
    );
    expect(screen.getByText("已送出播放")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "發布" }));
    await waitFor(() => expect(apiMocks.publishScene).toHaveBeenCalledWith("scene-1", {}, { expectedVersion: 3 }));
    await waitFor(() => expect(apiMocks.fetchScene).toHaveBeenCalledTimes(2));
    expect(screen.getByPlaceholderText("版本號（可選）")).toHaveValue("");

    await user.type(screen.getByPlaceholderText("回滾版本號"), "1");
    await user.click(screen.getByRole("button", { name: "回滾" }));
    await waitFor(() =>
      expect(apiMocks.rollbackScene).toHaveBeenCalledWith("scene-1", { version: 1 }, { expectedVersion: 3 }),
    );
    expect(screen.getByPlaceholderText("回滾版本號")).toHaveValue("");
  });

  it("在缺少必要欄位時顯示提示且不呼叫 API", async () => {
    const user = userEvent.setup();
    apiMocks.listScenes.mockResolvedValue({ scenes: [] });
    renderWithContext(<ScenesManager />);

    await waitFor(() => expect(apiMocks.listScenes).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "複製" }));
    expect(apiMocks.cloneScene).not.toHaveBeenCalled();
    expect(screen.getByText("請先載入 source scene 並填入 new id")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "播放" }));
    expect(apiMocks.playScene).not.toHaveBeenCalled();
    expect(screen.getByText("請先載入或儲存 scene")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Scene ID"), "scene-x");
    await user.click(screen.getByRole("button", { name: "回滾" }));
    expect(apiMocks.rollbackScene).not.toHaveBeenCalled();
    expect(screen.getByText("請輸入要回滾的版本號")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Scene ID"));
    await user.clear(screen.getByLabelText("Scene JSON"));
    await user.type(screen.getByLabelText("Scene JSON"), "not-json");
    await user.click(screen.getByRole("button", { name: "更新" }));
    expect(apiMocks.updateScene).not.toHaveBeenCalled();
    expect(screen.getByText(/not valid JSON/)).toBeInTheDocument();
  });
});

describe("ScriptsManager", () => {
  const scriptListItem = { id: "script-1", title: "Script", version: 2, status: "draft", updated_at: "now" };
  const scriptPayload = { id: "script-1", version: 2, entries: [] };

  beforeEach(() => {
    Object.values(apiMocks).forEach((fn) => fn.mockReset());
    apiMocks.listScripts.mockResolvedValue({ scripts: [scriptListItem] });
    apiMocks.fetchScript.mockResolvedValue({ script: scriptPayload });
    apiMocks.listScriptVersions.mockResolvedValue({ versions: [{ version: 1, status: "published" }, { version: 2 }] });
    apiMocks.updateScript.mockResolvedValue({ script: { ...scriptPayload, version: 3 } });
    apiMocks.createScript.mockResolvedValue({ script: { id: "fresh-script", version: 1 } });
    apiMocks.playScript.mockResolvedValue({});
    apiMocks.stopScript.mockResolvedValue({});
    apiMocks.publishScript.mockResolvedValue({});
    apiMocks.rollbackScript.mockResolvedValue({});
    apiMocks.cloneScript.mockResolvedValue({});
    apiMocks.deleteScript.mockResolvedValue({});
  });

  it("支援載入、更新、播放、停止與回滾 script", async () => {
    const user = userEvent.setup();
    renderWithContext(<ScriptsManager />);

    await waitFor(() => expect(apiMocks.listScripts).toHaveBeenCalledTimes(1));

    await user.click(screen.getByLabelText("載入 script script-1"));
    await waitFor(() => expect(apiMocks.fetchScript).toHaveBeenCalledWith("script-1", { resolve: false }));
    expect(screen.getByLabelText("Script ID")).toHaveValue("script-1");

    const scriptJsonField = screen.getByLabelText("Script JSON");
    await user.clear(scriptJsonField);
    fireEvent.change(scriptJsonField, { target: { value: JSON.stringify(scriptPayload) } });
    await user.click(screen.getByRole("button", { name: "更新" }));
    await waitFor(() =>
      expect(apiMocks.updateScript).toHaveBeenCalledWith(
        "script-1",
        scriptPayload,
        { resolve: false, expectedVersion: 2 },
      ),
    );

    await user.type(screen.getByPlaceholderText("版本號（可選）"), "4");
    await user.click(screen.getByLabelText("允許草稿"));
    await user.click(screen.getByRole("button", { name: "播放" }));
    await waitFor(() =>
      expect(apiMocks.playScript).toHaveBeenCalledWith("script-1", {}, { allowDraft: true, version: 4 }),
    );
    expect(screen.getByText("已送出播放")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "停止" }));
    await waitFor(() => expect(apiMocks.stopScript).toHaveBeenCalledWith("script-1"));

    await user.type(screen.getByPlaceholderText("回滾版本號"), "1");
    await user.click(screen.getByRole("button", { name: "回滾" }));
    await waitFor(() =>
      expect(apiMocks.rollbackScript).toHaveBeenCalledWith("script-1", { version: 1 }, { expectedVersion: 3 }),
    );
  });

  it("在缺少必要欄位時不呼叫 script API 並顯示訊息", async () => {
    const user = userEvent.setup();
    apiMocks.listScripts.mockResolvedValue({ scripts: [] });
    renderWithContext(<ScriptsManager />);

    await waitFor(() => expect(apiMocks.listScripts).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "複製" }));
    expect(apiMocks.cloneScript).not.toHaveBeenCalled();
    expect(screen.getByText("請先載入 source script 並填入 new id")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "播放" }));
    expect(apiMocks.playScript).not.toHaveBeenCalled();
    expect(screen.getByText("請先載入或儲存 script")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "停止" }));
    expect(apiMocks.stopScript).not.toHaveBeenCalled();
    expect(screen.getByText("請先指定 script id")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Script ID"), "script-x");
    await user.click(screen.getByRole("button", { name: "回滾" }));
    expect(apiMocks.rollbackScript).not.toHaveBeenCalled();
    expect(screen.getByText("請輸入要回滾的版本號")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Script JSON"));
    await user.type(screen.getByLabelText("Script JSON"), "invalid");
    await user.click(screen.getByRole("button", { name: "更新" }));
    expect(apiMocks.updateScript).not.toHaveBeenCalled();
    expect(screen.getByText(/not valid JSON/)).toBeInTheDocument();
  });
});
