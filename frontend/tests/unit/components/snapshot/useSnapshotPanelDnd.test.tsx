import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ASSET_DRAG_TYPE, ASSET_TYPE_DRAG_TYPE, PANEL_DRAG_TYPE, useSnapshotPanelDnd } from "../../../../src/components/snapshot/useSnapshotPanelDnd";
import type { PanelConfig } from "../../../../src/components/snapshot/types";

function buildEvent(data: Record<string, string>, client = { x: 0, y: 0, width: 100, height: 100 }) {
  return {
    dataTransfer: {
      getData: (key: string) => data[key] || "",
      setData: vi.fn(),
      effectAllowed: "",
    },
    clientX: client.x,
    clientY: client.y,
    currentTarget: {
      getBoundingClientRect: () => ({ top: 0, left: 0, width: client.width, height: client.height }),
    },
  } as any;
}

const panels: PanelConfig[] = [
  { id: "p1", label: "A" },
  { id: "p2", label: "B" },
  { id: "p3", label: "C" },
];

describe("useSnapshotPanelDnd", () => {
  function renderHook(args: Parameters<typeof useSnapshotPanelDnd>[0]) {
    const bag: { handlers?: ReturnType<typeof useSnapshotPanelDnd> } = {};
    function Wrapper() {
      bag.handlers = useSnapshotPanelDnd(args);
      return null;
    }
    render(<Wrapper />);
    return bag.handlers!;
  }

  it("拖拉 panel 會呼叫 onMoveRow 並選取新索引", () => {
    const onMoveRow = vi.fn();
    const onSelectPanel = vi.fn();
    const { handlePanelDrop } = renderHook({
      panels,
      onMoveRow,
      applyAssetToPanel: vi.fn(),
      onSelectPanel,
    });

    const evt = buildEvent({ [PANEL_DRAG_TYPE]: "0" }, { x: 0, y: 0, width: 100, height: 100 });
    handlePanelDrop(evt as any, 2);

    expect(onMoveRow).toHaveBeenCalledWith(0, 1);
    expect(onSelectPanel).toHaveBeenCalledWith(1);
  });

  it("丟入 asset payload 會套用到目標 panel", () => {
    const applyAssetToPanel = vi.fn();
    const { handlePanelDrop } = renderHook({
      panels,
      onMoveRow: vi.fn(),
      applyAssetToPanel,
    });

    const evt = buildEvent({ [ASSET_DRAG_TYPE]: "asset-1", [ASSET_TYPE_DRAG_TYPE]: "video" });
    handlePanelDrop(evt as any, 1);

    expect(applyAssetToPanel).toHaveBeenCalledWith(1, "asset-1", "video");
  });
});
