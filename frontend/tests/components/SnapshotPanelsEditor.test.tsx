import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SnapshotPanelsEditor from "../../src/components/snapshot/SnapshotPanelsEditor";

const { mockListOffspringImages, mockListVideoAssets } = vi.hoisted(() => ({
  mockListOffspringImages: vi.fn(),
  mockListVideoAssets: vi.fn(),
}));

vi.mock("../../src/api", () => ({
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
      onMoveRow={(from, delta) => handleChange(from + delta, {})}
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
  const createDataTransfer = () => {
    const data = {};
    return {
      setData: (type, value) => {
        data[type] = value;
      },
      getData: (type) => data[type] || "",
    };
  };

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

  it("拖放數字檔名資產時不會被當成面板索引，會生成 static_mode 網址", async () => {
    const onPanelChange = vi.fn();
    render(<ControlledEditor onPanelChange={onPanelChange} />);
    await waitFor(() => expect(mockListOffspringImages).toHaveBeenCalled());

    const panelButton = screen.getByRole("button", { name: /p1/i });
    const dataTransfer = createDataTransfer();
    dataTransfer.setData("application/x-snapshot-asset", "0001.png");
    dataTransfer.setData("application/x-snapshot-asset-type", "image");
    fireEvent.drop(panelButton, { dataTransfer });

    await waitFor(() =>
      expect(onPanelChange).toHaveBeenCalledWith(0, expect.objectContaining({ url: "/?static_mode=true&img=0001.png" })),
    );
  });

  it("影像模式 slide_mode 會在套用圖片後保留模式並更新網址", async () => {
    const onPanelChange = vi.fn();
    const presetPanel = { id: "p1", url: "/?slide_mode=true&img=foo.png" };
    const Wrapper = () => (
      <SnapshotPanelsEditor
        panels={[presetPanel]}
        selectedRows={[0]}
        onToggleRow={vi.fn()}
        onMoveRow={vi.fn()}
        onDuplicateRow={vi.fn()}
        onRemoveRow={vi.fn()}
        onAddPanel={vi.fn()}
        onCopy={vi.fn()}
        onPaste={vi.fn()}
        canPaste
        onPanelChange={onPanelChange}
      />
    );
    render(<Wrapper />);
    await waitFor(() => expect(mockListOffspringImages).toHaveBeenCalled());

    const assetInput = screen.getByLabelText("資產（依模式）");
    fireEvent.change(assetInput, { target: { value: "bar.png" } });

    expect(onPanelChange).toHaveBeenLastCalledWith(
      0,
      expect.objectContaining({ url: "/?slide_mode=true&img=bar.png", image: "bar.png" }),
    );
  });

  it("拖放影片資產會強制使用 video_mode 並更新 url", async () => {
    const onPanelChange = vi.fn();
    render(<ControlledEditor onPanelChange={onPanelChange} />);
    await waitFor(() => expect(mockListVideoAssets).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Videos" }));
    const panelButton = screen.getByRole("button", { name: /p1/i });
    const dataTransfer = createDataTransfer();
    dataTransfer.setData("application/x-snapshot-asset", "clip123.mp4");
    dataTransfer.setData("application/x-snapshot-asset-type", "video");
    fireEvent.drop(panelButton, { dataTransfer });

    await waitFor(() =>
      expect(onPanelChange).toHaveBeenCalledWith(0, expect.objectContaining({ url: "/?video_mode=true&video=clip123.mp4" })),
    );
  });
});
