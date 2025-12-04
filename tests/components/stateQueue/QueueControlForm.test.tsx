import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueueControlForm } from "../../../frontend/src/components/stateQueue/QueueControlForm";

describe("QueueControlForm", () => {
  it("更新欄位與觸發載入/派送", () => {
    const handlers = {
      onClientChange: vi.fn(),
      onTypeChange: vi.fn(),
      onTargetIdChange: vi.fn(),
      onPriorityChange: vi.fn(),
      onRetriesChange: vi.fn(),
      onEtaChange: vi.fn(),
      onLoadTargetOptions: vi.fn(),
      onEnqueue: vi.fn(),
    };

    render(
      <QueueControlForm
        type="snapshot"
        targetId=""
        priority="0"
        retries={0}
        etaSeconds=""
        activeClient=""
        loadingTargets={false}
        targetOptions={[{ value: "s1", label: "snap-1" }]}
        targetOptionsMessage="已載入 1 筆"
        currentHeadline="ready"
        {...handlers}
      />,
    );

    fireEvent.change(screen.getByLabelText("Client"), { target: { value: "client-a" } });
    fireEvent.change(screen.getByLabelText("類型"), { target: { value: "timeline" } });
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: "tl-1" } });
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Retries"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("ETA (秒後)"), { target: { value: "30" } });

    expect(handlers.onClientChange).toHaveBeenCalledWith("client-a");
    expect(handlers.onTypeChange).toHaveBeenCalledWith("timeline");
    expect(handlers.onTargetIdChange).toHaveBeenCalledWith("tl-1");
    expect(handlers.onPriorityChange).toHaveBeenCalledWith("5");
    expect(handlers.onRetriesChange).toHaveBeenCalledWith(2);
    expect(handlers.onEtaChange).toHaveBeenCalledWith("30");

    fireEvent.click(screen.getByTestId("queue-load-options"));
    fireEvent.click(screen.getByTestId("queue-enqueue"));
    expect(handlers.onLoadTargetOptions).toHaveBeenCalledTimes(1);
    expect(handlers.onEnqueue).toHaveBeenCalledTimes(1);

    expect(screen.getByText("已載入 1 筆")).toBeInTheDocument();
  });
});
