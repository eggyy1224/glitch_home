import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueueTableSection } from "../../../frontend/src/components/stateQueue/QueueTableSection";
import type { ClientQueueItem } from "../../../frontend/src/types/admin";

const queueItems: ClientQueueItem[] = [
  { id: "1", type: "snapshot", target_id: "snap-1", status: "pending", priority: 1, eta: "2024-01-01T00:00:00Z" },
  { id: "2", type: "timeline", target_id: "tl-1", status: "running", priority: 0, eta: null },
];

describe("QueueTableSection", () => {
  it("顯示空列表狀態並可重新整理", () => {
    const onRefresh = vi.fn();
    render(
      <QueueTableSection
        queueItems={[]}
        loadingQueue={false}
        selectedClient="client-1"
        clientOverride=""
        onRefresh={onRefresh}
        onCancel={vi.fn()}
        onMoveFront={vi.fn()}
        onMoveBack={vi.fn()}
        onDelay={vi.fn()}
        onForceStop={vi.fn()}
      />,
    );

    expect(screen.getByText("尚無佇列項目")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新整理" }));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("點擊操作按鈕會回呼對應事件，timeline 顯示停止播放按鈕", () => {
    const onCancel = vi.fn();
    const onMoveFront = vi.fn();
    const onMoveBack = vi.fn();
    const onDelay = vi.fn();
    const onForceStop = vi.fn();

    render(
      <QueueTableSection
        queueItems={queueItems}
        loadingQueue={false}
        selectedClient=""
        clientOverride="override-client"
        onRefresh={vi.fn()}
        onCancel={onCancel}
        onMoveFront={onMoveFront}
        onMoveBack={onMoveBack}
        onDelay={onDelay}
        onForceStop={onForceStop}
      />,
    );

    const timelineRow = document.querySelector('[data-ai-item="queue:2"]');
    if (!timelineRow) throw new Error("timeline row not found");
    const timelineButtons = within(timelineRow).getAllByRole("button");
    fireEvent.click(within(timelineRow).getByRole("button", { name: "取消" }));
    fireEvent.click(within(timelineRow).getByRole("button", { name: "插隊" }));
    fireEvent.click(within(timelineRow).getByRole("button", { name: "延後" }));
    fireEvent.click(within(timelineRow).getByRole("button", { name: "+30s" }));
    fireEvent.click(within(timelineRow).getByRole("button", { name: "停止播放" }));

    expect(onCancel).toHaveBeenCalledWith(queueItems[1]);
    expect(onMoveFront).toHaveBeenCalledWith(queueItems[1]);
    expect(onMoveBack).toHaveBeenCalledWith(queueItems[1]);
    expect(onDelay).toHaveBeenCalledWith(queueItems[1], 30);
    expect(onForceStop).toHaveBeenCalledWith(queueItems[1]);

    const snapshotRow = document.querySelector('[data-ai-item="queue:1"]');
    if (!snapshotRow) throw new Error("snapshot row not found");
    expect(within(snapshotRow).queryByRole("button", { name: "停止播放" })).toBeNull();

    expect(timelineButtons.length).toBeGreaterThan(0);
  });
});
