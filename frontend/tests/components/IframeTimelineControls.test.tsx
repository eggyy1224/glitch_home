import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import IframeTimelineControls from "../../src/components/IframeTimelineControls";
import type { IframeTimeline, TimelineStep } from "../../src/types/admin";

const baseTimeline: IframeTimeline = {
  id: "t-1",
  title: "Demo Timeline",
  step_count: 3,
  loop: true,
  created_at: "",
  updated_at: "",
  steps: [],
};

const baseStep: TimelineStep = {
  label: "第一段",
  snapshot: "snap-1",
  duration: 5,
  type: "iframe",
};

function renderControls(overrides: Partial<React.ComponentProps<typeof IframeTimelineControls>> = {}) {
  const props: React.ComponentProps<typeof IframeTimelineControls> = {
    timelineId: "t-1",
    timeline: baseTimeline,
    currentStep: baseStep,
    currentStepIndex: 0,
    status: "paused",
    isPlaying: false,
    loading: false,
    error: null,
    actionError: null,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onStop: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onReload: vi.fn(),
    ...overrides,
  };
  const view = render(<IframeTimelineControls {...props} />);
  return { ...props, view };
}

describe("IframeTimelineControls", () => {
  it("沒有 timelineId 時不渲染", () => {
    const { container } = render(
      <IframeTimelineControls
        timelineId={null}
        timeline={null}
        currentStep={null}
        currentStepIndex={0}
        status="idle"
        isPlaying={false}
        loading={false}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onStop={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("展示標題、狀態與目前步驟資訊並觸發控制按鈕", async () => {
    const user = userEvent.setup();
    const callbacks = renderControls({
      currentStepIndex: 1,
    });

    expect(screen.getByText("Demo Timeline")).toBeInTheDocument();
    expect(screen.getByText("#t-1 · 3 段 · 循環播放")).toBeInTheDocument();
    expect(screen.getByText("暫停")).toBeInTheDocument();
    expect(screen.getByText("第 2 段 · 第一段")).toBeInTheDocument();
    expect(screen.getByText(/維持 5s/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "播放" }));
    await user.click(screen.getByRole("button", { name: "停止" }));
    await user.click(screen.getByRole("button", { name: "◀" }));
    await user.click(screen.getByRole("button", { name: "▶" }));
    await user.click(screen.getByRole("button", { name: "重新載入" }));

    expect(callbacks.onPlay).toHaveBeenCalledTimes(1);
    expect(callbacks.onStop).toHaveBeenCalledTimes(1);
    expect(callbacks.onPrevious).toHaveBeenCalledTimes(1);
    expect(callbacks.onNext).toHaveBeenCalledTimes(1);
    expect(callbacks.onReload).toHaveBeenCalledTimes(1);
  });

  it("播放中顯示暫停按鈕並套用 loading/錯誤狀態", async () => {
    const user = userEvent.setup();
    const callbacks = renderControls({
      isPlaying: true,
      status: "playing",
      loading: true,
      currentStep: { ...baseStep, client_id: "c-1" },
      actionError: "action failed",
      error: "load failed",
    });

    expect(screen.getByText("播放中")).toBeInTheDocument();
    expect(screen.getByText(/client=c-1/)).toBeInTheDocument();
    expect(screen.getByText("load failed")).toBeInTheDocument();
    expect(screen.getByText("action failed")).toBeInTheDocument();

    const pauseButton = screen.getByRole("button", { name: "暫停" });
    expect(pauseButton).toBeDisabled();

    await user.click(pauseButton);
    expect(callbacks.onPause).not.toHaveBeenCalled();

    expect(screen.getByRole("button", { name: "◀" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "▶" })).toBeDisabled();
  });

  it("依照狀態顯示 loading/error/待命標籤", () => {
    const loading = renderControls({ status: "loading", isPlaying: false });
    expect(screen.getByText("載入中")).toBeInTheDocument();
    loading.view.unmount();

    const error = renderControls({ status: "error" });
    expect(screen.getByText("錯誤")).toBeInTheDocument();
    error.view.unmount();

    renderControls({ status: "idle" as any });
    expect(screen.getByText("待命")).toBeInTheDocument();
  });
});
