import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { QueueTableSection } from "../../../src/components/stateQueue/QueueTableSection";
import type { ClientQueueItem } from "../../../src/types/admin";

const item: ClientQueueItem = {
  id: "q1",
  type: "timeline",
  target_id: "t1",
  status: "pending",
  priority: 5,
  eta: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:01Z",
};

describe("QueueTableSection", () => {
  it("渲染佇列並觸發操作按鈕", async () => {
    const user = userEvent.setup();
    const handlers = {
      onRefresh: vi.fn(),
      onCancel: vi.fn(),
      onMoveFront: vi.fn(),
      onMoveBack: vi.fn(),
      onDelay: vi.fn(),
      onForceStop: vi.fn(),
    };
    render(
      <QueueTableSection
        queueItems={[item]}
        loadingQueue={false}
        selectedClient="c1"
        clientOverride=""
        {...handlers}
      />,
    );

    expect(screen.getByText("佇列列表")).toBeInTheDocument();
    expect(screen.getByText("正在查看的 queue client：c1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重新整理" }));
    await user.click(screen.getByRole("button", { name: "取消" }));
    await user.click(screen.getByRole("button", { name: "插隊" }));
    await user.click(screen.getByRole("button", { name: "延後" }));
    await user.click(screen.getByRole("button", { name: "+30s" }));
    await user.click(screen.getByRole("button", { name: "停止播放" }));

    expect(handlers.onRefresh).toHaveBeenCalled();
    expect(handlers.onCancel).toHaveBeenCalledWith(item);
    expect(handlers.onMoveFront).toHaveBeenCalledWith(item);
    expect(handlers.onMoveBack).toHaveBeenCalledWith(item);
    expect(handlers.onDelay).toHaveBeenCalledWith(item, 30);
    expect(handlers.onForceStop).toHaveBeenCalledWith(item);
  });

  it("空列表時顯示空態", () => {
    render(
      <QueueTableSection
        queueItems={[]}
        loadingQueue
        selectedClient=""
        clientOverride="override"
        onRefresh={vi.fn()}
        onCancel={vi.fn()}
        onMoveFront={vi.fn()}
        onMoveBack={vi.fn()}
        onDelay={vi.fn()}
        onForceStop={vi.fn()}
      />,
    );

    expect(screen.getByText("(載入中)")).toBeInTheDocument();
    expect(screen.getByText("正在查看的 queue client：override")).toBeInTheDocument();
    expect(screen.getByText("尚無佇列項目")).toBeInTheDocument();
  });
});
