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
  return render(
    <AdminPanelContext.Provider value={{ defaultClientId: "desktop" }}>{ui}</AdminPanelContext.Provider>,
  );
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

    fireEvent.click(screen.getByRole("button", { name: "儲存/覆寫" }));
    expect(screen.getByText("請輸入 snapshot 名稱")).toBeInTheDocument();

    fireEvent.click(screen.getByText("查看"));
    await waitFor(() => expect(mockGetIframeSnapshot).toHaveBeenCalledWith("desktop", "snapA"));
    expect(screen.getByTitle("snapshot-preview")).toBeInTheDocument();
  });
});
