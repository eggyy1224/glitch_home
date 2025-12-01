import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SnapshotPanelsEditor from "../../src/components/snapshot/SnapshotPanelsEditor";
import type * as api from "../../src/api";
import type { SnapshotPanel } from "../../src/types/admin";
import type { IframePanelConfig } from "../../src/types/control";

type ApiMocks = {
  listOffspringImages: Mock;
  listVideoAssets: Mock;
};

const apiMocksRef = vi.hoisted(() => ({ current: null as ApiMocks | null }));
let apiMocks: ApiMocks;

const getApiMocks = () => {
  const mocks = apiMocksRef.current;
  if (!mocks) {
    throw new Error("apiMocks not initialized");
  }
  return mocks;
};

vi.mock("../../src/api", async () => {
  const { createMockApi } = await import("../testUtils");
  const { mocks, factory } = createMockApi<typeof api, "listOffspringImages" | "listVideoAssets">([
    "listOffspringImages",
    "listVideoAssets",
  ]);
  apiMocksRef.current = mocks;
  return { __esModule: true, ...factory() };
});

type PanelChangeHandler = (index: number, patch: Partial<SnapshotPanel & IframePanelConfig>) => void;

function ControlledEditor({ onPanelChange }: { onPanelChange: PanelChangeHandler }) {
  const [panels, setPanels] = useState<SnapshotPanel[]>([{ id: "p1", url: "", image: "" }]);
  const handleChange: PanelChangeHandler = (index, patch) => {
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
  apiMocks = getApiMocks();
  vi.clearAllMocks();
  apiMocks.listOffspringImages.mockResolvedValue({ images: [{ filename: "img-a.png" }] });
  apiMocks.listVideoAssets.mockResolvedValue({ videos: [{ filename: "clipA.mp4" }] });
});

describe("SnapshotPanelsEditor", () => {
  const createDataTransfer = () => {
    const data: Record<string, string> = {};
    return {
      setData: (type: string, value: string) => {
        data[type] = value;
      },
      getData: (type: string) => data[type] || "",
    };
  };

  it("載入資產並依模式組出對應的 url 與 image", async () => {
    const onPanelChange = vi.fn();
    render(<ControlledEditor onPanelChange={onPanelChange} />);

    await waitFor(() => expect(apiMocks.listOffspringImages).toHaveBeenCalled());
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
    await waitFor(() => expect(apiMocks.listOffspringImages).toHaveBeenCalled());

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
    await waitFor(() => expect(apiMocks.listOffspringImages).toHaveBeenCalled());

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
    await waitFor(() => expect(apiMocks.listVideoAssets).toHaveBeenCalled());

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
