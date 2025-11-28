import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SnapshotPanelsEditor from "../../src/components/snapshot/SnapshotPanelsEditor.jsx";

const { mockListOffspringImages, mockListVideoAssets } = vi.hoisted(() => ({
  mockListOffspringImages: vi.fn(),
  mockListVideoAssets: vi.fn(),
}));

vi.mock("../../src/api.js", () => ({
  __esModule: true,
  listOffspringImages: (...args) => mockListOffspringImages(...args),
  listVideoAssets: (...args) => mockListVideoAssets(...args),
}));

function ControlledEditor({ onPanelChange }) {
  const [panels, setPanels] = useState([{ id: "p1", url: "", image: "" }]);
  const handleChange = (index, patch) => {
    setPanels((prev) => prev.map((panel, i) => (i === index ? { ...panel, ...patch } : panel)));
    onPanelChange(index, patch);
  };
  return (
    <SnapshotPanelsEditor
      panels={panels}
      selectedRows={[]}
      onToggleRow={vi.fn()}
      onMoveRow={vi.fn()}
      onDuplicateRow={vi.fn()}
      onRemoveRow={vi.fn()}
      onAddPanel={vi.fn()}
      onCopy={vi.fn()}
      onPaste={vi.fn()}
      canPaste
      onPanelChange={handleChange}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListOffspringImages.mockResolvedValue({ images: [{ filename: "img-a.png" }] });
  mockListVideoAssets.mockResolvedValue({ videos: [{ filename: "clipA.mp4" }] });
});

describe("SnapshotPanelsEditor", () => {
  it("載入資產並依模式組出對應的 url 與 image", async () => {
    const onPanelChange = vi.fn();
    render(<ControlledEditor onPanelChange={onPanelChange} />);

    await waitFor(() => expect(mockListOffspringImages).toHaveBeenCalled());
    expect(screen.getByText(/資產：圖片 1 \/ 影片 1/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("模式"), { target: { value: "video_mode" } });
    expect(onPanelChange).toHaveBeenLastCalledWith(0, { url: "/?video_mode=true" });

    fireEvent.change(screen.getByLabelText("資產（依模式）"), { target: { value: "clipA.mp4" } });
    expect(onPanelChange).toHaveBeenLastCalledWith(0, { url: "/?video_mode=true&video=clipA.mp4" });

    fireEvent.change(screen.getByLabelText("模式"), { target: { value: "static_mode" } });
    fireEvent.change(screen.getByLabelText("資產（依模式）"), { target: { value: "img-a.png" } });
    expect(onPanelChange).toHaveBeenLastCalledWith(0, { url: "/?static_mode=true&img=img-a.png", image: "img-a.png" });

    fireEvent.change(screen.getByLabelText("image"), { target: { value: "img-b.png" } });
    expect(onPanelChange).toHaveBeenLastCalledWith(0, { image: "img-b.png", url: "/?static_mode=true&img=img-b.png" });
  });
});
