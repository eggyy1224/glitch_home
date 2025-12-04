import React, { useState } from "react";
import { render, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRemoteTimelineControl } from "../../../src/hooks/useRemoteTimelineControl";
import { DisplayModes } from "../../../src/hooks/useDisplayMode";
import type { IframeTimelineResolved, TimelineStepWithConfig } from "../../../src/types/control";

const executeStepActions = vi.fn();
const cancelPendingActions = vi.fn();
const clearActionError = vi.fn();

vi.mock("../../../src/hooks/useTimelineStepActions", () => ({
  useTimelineStepActions: () => ({
    executeStepActions,
    actionError: null,
    clearActionError,
    cancelPendingActions,
  }),
}));

let lastPlayerOpts: any = null;
let lastPlayerReturn: any = null;

vi.mock("../../../src/hooks/useIframeTimelinePlayer", () => ({
  useIframeTimelinePlayer: (opts: any) => {
    lastPlayerOpts = opts;
    lastPlayerReturn = {
      timeline: { id: opts.timelineId } as IframeTimelineResolved,
      currentStep: null,
      currentStepIndex: 0,
      status: "idle",
      isPlaying: false,
      loading: false,
      error: null,
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      next: vi.fn(),
      previous: vi.fn(),
      reload: vi.fn(),
    };
    return lastPlayerReturn;
  },
}));

function renderHook(initialProps: Parameters<typeof useRemoteTimelineControl>[0]) {
  const bag: { latest: ReturnType<typeof useRemoteTimelineControl> | null; setProps?: React.Dispatch<any> } = {
    latest: null,
  };

  function Wrapper() {
    const [props, setProps] = useState(initialProps);
    bag.setProps = setProps;
    bag.latest = useRemoteTimelineControl(props);
    return null;
  }

  render(<Wrapper />);
  return bag as { latest: ReturnType<typeof useRemoteTimelineControl>; setProps: React.Dispatch<any> };
}

describe("useRemoteTimelineControl", () => {
  const baseProps = {
    activeMode: DisplayModes.IFRAME,
    iframeTimelineId: "base-tl",
    clientId: "client-1",
    applyRemoteIframeConfig: vi.fn(),
    releaseRemoteIframeConfig: vi.fn(),
    setActiveModeOverride: vi.fn(),
    capabilities: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    lastPlayerOpts = null;
    lastPlayerReturn = null;
  });

  it("忽略 admin 模式與非目標 client 的指令", () => {
    const bag = renderHook({ ...baseProps, activeMode: DisplayModes.ADMIN });
    act(() => {
      bag.latest.handleTimelineControlMessage({ action: "play", timeline_id: "x", target_client_id: "other" } as any);
    });
    expect(baseProps.setActiveModeOverride).not.toHaveBeenCalled();
    expect(bag.latest.effectiveTimelineId).toBe("base-tl");
  });

  it("接收 play 指令時設定遠端 timeline 並呼叫 step actions", async () => {
    const bag = renderHook(baseProps);

    act(() => {
      bag.latest.handleTimelineControlMessage({
        action: "play",
        timeline_id: "remote-1",
        options: { startStep: 2, loop: false, version: 5, autoPlay: true },
      } as any);
    });

    await waitFor(() => expect(lastPlayerOpts?.timelineId).toBe("remote-1"));
    expect(lastPlayerOpts.timelineVersion).toBe(5);
    expect(lastPlayerOpts.initialStep).toBe(2);
    expect(baseProps.setActiveModeOverride).toHaveBeenCalledWith(DisplayModes.IFRAME);

    const step: TimelineStepWithConfig = { label: "s", duration: 1 };
    act(() => {
      lastPlayerOpts.onStepStart({ step, stepIndex: 1, runId: 99 });
    });
    expect(executeStepActions).toHaveBeenCalledWith({
      step,
      stepIndex: 1,
      timelineId: "remote-1",
      runId: 99,
    });
  });

  it("stop 指令會停止 timeline 並可選擇保留遠端控制", async () => {
    const bag = renderHook(baseProps);

    act(() => {
      bag.latest.handleTimelineControlMessage({ action: "play", timeline_id: "remote-2" } as any);
    });
    await waitFor(() => expect(lastPlayerOpts?.timelineId).toBe("remote-2"));

    act(() => {
      bag.latest.handleTimelineControlMessage({
        action: "stop",
        timeline_id: "remote-2",
        options: { releaseControl: false },
      } as any);
    });

    const stopSpy = lastPlayerReturn?.stop;
    await waitFor(() => expect(stopSpy).toHaveBeenCalled());
    expect(bag.latest.effectiveTimelineId).toBe("remote-2"); // 未釋放控制時仍保留
  });

  it("切換離開 iframe 模式時會清理 pending actions", () => {
    const bag = renderHook(baseProps);
    act(() => bag.setProps((prev: any) => ({ ...prev, activeMode: DisplayModes.ADMIN })));
    expect(cancelPendingActions).toHaveBeenCalled();
    expect(clearActionError).toHaveBeenCalled();
    expect(bag.latest.effectiveTimelineId).toBe("base-tl");
  });
});
