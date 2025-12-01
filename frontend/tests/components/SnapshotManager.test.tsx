import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SnapshotManager from "../../src/components/SnapshotManager";
import { AdminPanelContext, type AdminPanelContextValue } from "../../src/AdminPanelContext";
import { createMockApi } from "../testUtils";
import type * as api from "../../src/api";

const { mocks: apiMocks, createApi } = vi.hoisted(() => {
  const { mocks, factory } = createMockApi<
    typeof api,
    "listIframeSnapshots" | "getIframeSnapshot" | "saveIframeSnapshot" | "deleteIframeSnapshot" | "cloneIframeSnapshot"
  >(["listIframeSnapshots", "getIframeSnapshot", "saveIframeSnapshot", "deleteIframeSnapshot", "cloneIframeSnapshot"]);
  return { mocks, createApi: factory };
});

vi.mock("../../src/api", () => ({
  __esModule: true,
  ...createApi(),
}));

const snapshotConfig = {
  layout: "grid",
  gap: 0,
  columns: 1,
  panels: [{ id: "p1", url: "/foo" }],
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
  apiMocks.listIframeSnapshots.mockResolvedValue({ snapshots: [{ name: "snapA" }] });
  apiMocks.getIframeSnapshot.mockResolvedValue({ raw: snapshotConfig });
  apiMocks.saveIframeSnapshot.mockResolvedValue({ snapshot: { name: "snapA" } });
  apiMocks.deleteIframeSnapshot.mockResolvedValue({});
  apiMocks.cloneIframeSnapshot.mockResolvedValue({});
});

describe("SnapshotManager", () => {
  it("載入列表、驗證空名稱提示並生成預覽", async () => {
    renderWithContext(<SnapshotManager />);

    await waitFor(() => expect(apiMocks.listIframeSnapshots).toHaveBeenCalledWith("desktop"));

    fireEvent.click(screen.getByRole("button", { name: /儲存.*snapshot/i }));
    expect(screen.getByText("請輸入 snapshot 名稱")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /查看 snapshot/i }));
    await waitFor(() => expect(apiMocks.getIframeSnapshot).toHaveBeenCalledWith("desktop", "snapA"));
    expect(screen.getByTitle("preview-main")).toBeInTheDocument();
  });

  it("變更 client 時自動重新載入列表", async () => {
    renderWithContext(<SnapshotManager />);

    await waitFor(() => expect(apiMocks.listIframeSnapshots).toHaveBeenCalledWith("desktop"));

    const clientInput = await screen.findByLabelText(/snapshot client id/i);
    fireEvent.change(clientInput, { target: { value: "mobile" } });

    await waitFor(() => expect(apiMocks.listIframeSnapshots).toHaveBeenLastCalledWith("mobile"));
  });

  it("手動按下重新載入列表時仍會使用當前 client", async () => {
    renderWithContext(<SnapshotManager />);

    await waitFor(() => expect(apiMocks.listIframeSnapshots).toHaveBeenCalledWith("desktop"));

    fireEvent.click(screen.getByRole("button", { name: /重新載入.*snapshot/ }));

    await waitFor(() => {
      expect(apiMocks.listIframeSnapshots).toHaveBeenCalledTimes(2);
      expect(apiMocks.listIframeSnapshots).toHaveBeenLastCalledWith("desktop");
    });
  });
});
