import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SnapshotManager from "../../src/components/SnapshotManager.jsx";
import { AdminPanelContext } from "../../src/AdminPanelContext.js";

const {
  mockListIframeSnapshots,
  mockGetIframeSnapshot,
  mockSaveIframeSnapshot,
  mockDeleteIframeSnapshot,
  mockCloneIframeSnapshot,
} = vi.hoisted(() => ({
  mockListIframeSnapshots: vi.fn(),
  mockGetIframeSnapshot: vi.fn(),
  mockSaveIframeSnapshot: vi.fn(),
  mockDeleteIframeSnapshot: vi.fn(),
  mockCloneIframeSnapshot: vi.fn(),
}));

vi.mock("../../src/api.js", () => ({
  __esModule: true,
  listIframeSnapshots: (...args) => mockListIframeSnapshots(...args),
  getIframeSnapshot: (...args) => mockGetIframeSnapshot(...args),
  saveIframeSnapshot: (...args) => mockSaveIframeSnapshot(...args),
  deleteIframeSnapshot: (...args) => mockDeleteIframeSnapshot(...args),
  cloneIframeSnapshot: (...args) => mockCloneIframeSnapshot(...args),
}));

const snapshotConfig = {
  layout: "grid",
  gap: 0,
  columns: 1,
  panels: [{ id: "p1", url: "/foo" }],
};

function renderWithContext(ui) {
  return render(<AdminPanelContext.Provider value={{ defaultClientId: "desktop" }}>{ui}</AdminPanelContext.Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListIframeSnapshots.mockResolvedValue({ snapshots: [{ name: "snapA" }] });
  mockGetIframeSnapshot.mockResolvedValue({ raw: snapshotConfig });
  mockSaveIframeSnapshot.mockResolvedValue({ snapshot: { name: "snapA" } });
  mockDeleteIframeSnapshot.mockResolvedValue({});
  mockCloneIframeSnapshot.mockResolvedValue({});
});

describe("SnapshotManager", () => {
  it("載入列表、驗證空名稱提示並生成預覽", async () => {
    renderWithContext(<SnapshotManager />);

    await waitFor(() => expect(mockListIframeSnapshots).toHaveBeenCalledWith("desktop"));

    fireEvent.click(screen.getByRole("button", { name: /儲存.*snapshot/i }));
    expect(screen.getByText("請輸入 snapshot 名稱")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /查看 snapshot/i }));
    await waitFor(() => expect(mockGetIframeSnapshot).toHaveBeenCalledWith("desktop", "snapA"));
    expect(screen.getByTitle("preview-main")).toBeInTheDocument();
  });

  it("變更 client 時自動重新載入列表", async () => {
    renderWithContext(<SnapshotManager />);

    await waitFor(() => expect(mockListIframeSnapshots).toHaveBeenCalledWith("desktop"));

    const clientInput = await screen.findByLabelText(/snapshot client id/i);
    fireEvent.change(clientInput, { target: { value: "mobile" } });

    await waitFor(() => expect(mockListIframeSnapshots).toHaveBeenLastCalledWith("mobile"));
  });

  it("手動按下重新載入列表時仍會使用當前 client", async () => {
    renderWithContext(<SnapshotManager />);

    await waitFor(() => expect(mockListIframeSnapshots).toHaveBeenCalledWith("desktop"));

    fireEvent.click(screen.getByRole("button", { name: /重新載入.*snapshot/ }));

    await waitFor(() => {
      expect(mockListIframeSnapshots).toHaveBeenCalledTimes(2);
      expect(mockListIframeSnapshots).toHaveBeenLastCalledWith("desktop");
    });
  });
});
