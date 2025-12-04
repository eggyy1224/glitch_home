import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  ASSET_DRAG_TYPE,
  ASSET_TYPE_DRAG_TYPE,
  PANEL_DRAG_TYPE,
  useSnapshotPanelDnd,
} from "../../../../frontend/src/components/snapshot/useSnapshotPanelDnd";
import type { PanelConfig } from "../../../../frontend/src/components/snapshot/types";

const panels: PanelConfig[] = [
  { id: "a", url: "", image: "" },
  { id: "b", url: "", image: "" },
  { id: "c", url: "", image: "" },
];

function createEvent(data: Record<string, string>, rect?: Partial<DOMRect>, coords?: { x?: number; y?: number }) {
  return {
    dataTransfer: {
      getData: vi.fn((key: string) => data[key] || ""),
      setData: vi.fn(),
    },
    currentTarget: {
      getBoundingClientRect: () =>
        ({
          top: 0,
          left: 0,
          width: 100,
          height: 100,
          ...rect,
        }) as DOMRect,
    },
    clientX: coords?.x ?? 0,
    clientY: coords?.y ?? 0,
  } as unknown as React.DragEvent<HTMLDivElement>;
}

describe("useSnapshotPanelDnd", () => {
  it("拖放資產時會套用到目標面板並帶入 assetType", () => {
    const applyAssetToPanel = vi.fn();
    const onMoveRow = vi.fn();
    const { result } = renderHook(() =>
      useSnapshotPanelDnd({ panels, onMoveRow, applyAssetToPanel, onSelectPanel: vi.fn() }),
    );

    const event = createEvent({
      [ASSET_DRAG_TYPE]: "cover.png",
      [ASSET_TYPE_DRAG_TYPE]: "image",
    });

    act(() => {
      result.current.handlePanelDrop(event, 1);
    });

    expect(applyAssetToPanel).toHaveBeenCalledWith(1, "cover.png", "image");
    expect(onMoveRow).not.toHaveBeenCalled();
  });

  it("拖放面板索引時會計算插入位置並觸發 onSelectPanel", () => {
    const applyAssetToPanel = vi.fn();
    const onMoveRow = vi.fn();
    const onSelectPanel = vi.fn();
    const { result } = renderHook(() =>
      useSnapshotPanelDnd({ panels, onMoveRow, applyAssetToPanel, onSelectPanel }),
    );

    const event = createEvent(
      { [PANEL_DRAG_TYPE]: "0" },
      { top: 0, left: 0, width: 100, height: 100 },
      { y: 80, x: 80 },
    );

    act(() => {
      result.current.handlePanelDrop(event, 2);
    });

    expect(onMoveRow).toHaveBeenCalledWith(0, 2);
    expect(onSelectPanel).toHaveBeenCalledWith(2);
  });

  it("向上拖放會使用 text/plain 傳遞並避免同索引操作", () => {
    const applyAssetToPanel = vi.fn();
    const onMoveRow = vi.fn();
    const { result } = renderHook(() =>
      useSnapshotPanelDnd({ panels, onMoveRow, applyAssetToPanel }),
    );

    const eventSameIndex = createEvent({ [PANEL_DRAG_TYPE]: "1" });
    act(() => {
      result.current.handlePanelDrop(eventSameIndex, 1);
    });
    expect(onMoveRow).not.toHaveBeenCalled();

    const event = createEvent({ "text/plain": "panel:2" }, { top: 0, left: 0, width: 100, height: 100 }, { y: 10 });
    act(() => {
      result.current.handlePanelDrop(event, 0);
    });

    expect(onMoveRow).toHaveBeenCalledWith(2, -2);
    expect(applyAssetToPanel).not.toHaveBeenCalled();
  });

  it("text/plain 的 asset: 前綴會被視為資產套用", () => {
    const applyAssetToPanel = vi.fn();
    const onMoveRow = vi.fn();
    const { result } = renderHook(() =>
      useSnapshotPanelDnd({ panels, onMoveRow, applyAssetToPanel }),
    );

    const event = createEvent({ "text/plain": "asset:clip.mp4", [ASSET_TYPE_DRAG_TYPE]: "video" });
    act(() => {
      result.current.handlePanelDrop(event, 0);
    });

    expect(applyAssetToPanel).toHaveBeenCalledWith(0, "clip.mp4", "video");
    expect(onMoveRow).not.toHaveBeenCalled();
  });
});
