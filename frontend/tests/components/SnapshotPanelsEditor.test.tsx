import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SnapshotPanelsEditor from "../../src/components/snapshot/SnapshotPanelsEditor";
import type * as api from "../../src/api";
import type { SnapshotPanel } from "../../src/types/admin";
import type { IframePanelConfig } from "../../src/types/control";

type ApiMocks = {
  listOffspringImages: Mock;
  listAncestorImages: Mock;
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
  const { mocks, factory } = createMockApi<typeof api, "listOffspringImages" | "listAncestorImages" | "listVideoAssets">([
    "listOffspringImages",
    "listAncestorImages",
    "listVideoAssets",
  ]);
  apiMocksRef.current = mocks;
  return { __esModule: true, ...factory() };
});

type PanelChangeHandler = (index: number, patch: Partial<SnapshotPanel & IframePanelConfig>) => void;

function ControlledEditor({
  onPanelChange,
  selectedRows = [0],
  initialPanels,
}: {
  onPanelChange: PanelChangeHandler;
  selectedRows?: number[];
  initialPanels?: SnapshotPanel[];
}) {
  const [panels, setPanels] = useState<SnapshotPanel[]>(initialPanels ?? [{ id: "p1", url: "", image: "" }]);
  const handleChange: PanelChangeHandler = (index, patch) => {
    setPanels((prev) => prev.map((panel, i) => (i === index ? { ...panel, ...patch } : panel)));
    onPanelChange(index, patch);
  };
  return (
    <SnapshotPanelsEditor
      panels={panels}
      selectedRows={selectedRows}
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
  apiMocks.listAncestorImages.mockResolvedValue({ images: [{ relative_path: "攝影圖像/img-b.png" }] });
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
    await waitFor(() => expect(apiMocks.listAncestorImages).toHaveBeenCalled());
    expect(screen.getByText(/資產：後代 1 \/ 祖先 1 \/ 影片 1/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("模式"), { target: { value: "video_mode" } });
    expect(onPanelChange).toHaveBeenLastCalledWith(
      0,
      expect.objectContaining({ url: "/?video_mode=true", params: { __preset_mode: "video_mode" } }),
    );

    fireEvent.change(screen.getByLabelText("資產（依模式）"), { target: { value: "clipA.mp4" } });
    expect(onPanelChange).toHaveBeenLastCalledWith(
      0,
      expect.objectContaining({ url: "/?video_mode=true&video=clipA.mp4", params: { __preset_mode: "video_mode" } }),
    );

    fireEvent.change(screen.getByLabelText("模式"), { target: { value: "static_mode" } });
    fireEvent.change(screen.getByLabelText("資產（依模式）"), { target: { value: "img-a.png" } });
    expect(onPanelChange).toHaveBeenLastCalledWith(
      0,
      expect.objectContaining({
        url: "/?static_mode=true&img=img-a.png",
        image: "img-a.png",
        params: { __preset_mode: "static_mode" },
      }),
    );

    fireEvent.change(screen.getByLabelText("image"), { target: { value: "img-b.png" } });
    expect(onPanelChange).toHaveBeenLastCalledWith(
      0,
      expect.objectContaining({
        image: "img-b.png",
        url: "/?static_mode=true&img=img-b.png",
        params: { __preset_mode: "static_mode" },
      }),
    );
  });

  it("祖先資產面板會過濾 offspring 檔名並自動帶入 img_base", async () => {
    apiMocks.listAncestorImages.mockResolvedValue({
      images: [
        { relative_path: "攝影圖像/good-a.png" },
        { relative_path: "offspring_legacy.png" },
      ],
    });
    const onPanelChange = vi.fn();
    render(<ControlledEditor onPanelChange={onPanelChange} />);

    await waitFor(() => expect(apiMocks.listAncestorImages).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "ANCESTOR_IMAGES" }));

    const assetButton = await screen.findByRole("button", { name: /good-a\.png/i });
    expect(screen.queryByText(/offspring_legacy\.png/i)).not.toBeInTheDocument();

    fireEvent.click(assetButton);

    await waitFor(() => {
      expect(onPanelChange).toHaveBeenCalledWith(
        0,
        expect.objectContaining({ url: expect.stringContaining("static_mode=true") }),
      );
    });

    const lastPatch = onPanelChange.mock.calls[onPanelChange.mock.calls.length - 1]?.[1] as SnapshotPanel;
    const parsed = new URL(lastPatch.url || "", "http://localhost");
    expect(parsed.searchParams.get("img")).toBe("攝影圖像/good-a.png");
    expect(parsed.searchParams.get("img_base")).toBe("/nightwalk_assets/");
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

    const lastPatch = onPanelChange.mock.calls[onPanelChange.mock.calls.length - 1]?.[1] as SnapshotPanel;
    const parsed = new URL(lastPatch.url || "", "http://localhost");
    expect(parsed.searchParams.get("slide_mode")).toBe("true");
    expect(parsed.searchParams.get("img")).toBe("bar.png");
    expect(lastPatch.image).toBe("bar.png");
  });

  it("slide_mode 可以在表單調整輪播間隔並同步寫回 url/params", async () => {
    const onPanelChange = vi.fn();
    const presetPanel = { id: "p1", url: "/?slide_mode=true&img=foo.png&slide_interval=1500" };
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

    const intervalInput = screen.getByLabelText(/輪播間隔/);
    expect((intervalInput as HTMLInputElement).value).toBe("1500");

    fireEvent.change(intervalInput, { target: { value: "2200" } });

    const lastPatch = onPanelChange.mock.calls[onPanelChange.mock.calls.length - 1]?.[1] as SnapshotPanel;
    const parsed = new URL(lastPatch.url || "", "http://localhost");
    expect(parsed.searchParams.get("slide_interval")).toBe("2200");
    expect(parsed.searchParams.get("slide_interval_ms")).toBe("2200");
    expect(lastPatch.params).toEqual(
      expect.objectContaining({
        __preset_mode: "slide_mode",
        slide_interval: "2200",
        slide_interval_ms: "2200",
      }),
    );
  });

  it("slide_mode 其他參數會出現在表單並寫回 url/params", async () => {
    const onPanelChange = vi.fn();
    const presetPanel = {
      id: "p1",
      url: "/?slide_mode=true&img=foo.png&slide_interval=1500&top_k=18&slide_source=kinship&kinship_depth=2&kinship_order=parents,children&include_deprecated=true",
    };
    render(<ControlledEditor onPanelChange={onPanelChange} initialPanels={[presetPanel as SnapshotPanel]} />);
    await waitFor(() => expect(apiMocks.listOffspringImages).toHaveBeenCalled());

    const topKInput = screen.getByLabelText(/結果數量/);
    expect((topKInput as HTMLInputElement).value).toBe("18");
    const sourceSelect = screen.getByLabelText("資料來源") as HTMLSelectElement;
    expect(sourceSelect.value).toBe("kinship");
    const depthInput = screen.getByLabelText(/親緣深度/);
    expect((depthInput as HTMLInputElement).value).toBe("2");
    const orderInput = screen.getByLabelText(/親緣排序偏好/);
    expect((orderInput as HTMLInputElement).value).toBe("parents,children");
    const includeDeprecated = screen.getByLabelText("包含 deprecated") as HTMLInputElement;
    expect(includeDeprecated.checked).toBe(true);

    fireEvent.change(topKInput, { target: { value: "25" } });
    fireEvent.change(orderInput, { target: { value: "children,siblings,parents" } });
    fireEvent.click(includeDeprecated);

    const lastPatch = onPanelChange.mock.calls[onPanelChange.mock.calls.length - 1]?.[1] as SnapshotPanel;
    const parsed = new URL(lastPatch.url || "", "http://localhost");
    expect(parsed.searchParams.get("top_k")).toBe("25");
    expect(parsed.searchParams.get("slide_source")).toBe("kinship");
    expect(parsed.searchParams.get("kinship_depth")).toBe("2");
    expect(parsed.searchParams.get("kinship_order")).toBe("children,siblings,parents");
    expect(parsed.searchParams.get("include_deprecated")).toBe("false");
    expect(lastPatch.params).toEqual(
      expect.objectContaining({
        top_k: "25",
        kinship_depth: "2",
        kinship_order: "children,siblings,parents",
        include_deprecated: "false",
      }),
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
