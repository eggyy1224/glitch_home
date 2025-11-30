import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRemoteTimelineControl } from "../../../src/hooks/useRemoteTimelineControl.js";
import { DisplayModes } from "../../../src/hooks/useDisplayMode";

vi.mock("../../../src/hooks/useIframeTimelinePlayer.js", () => ({
  __esModule: true,
  useIframeTimelinePlayer: () => ({
    timeline: null,
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
  }),
}));

vi.mock("../../../src/hooks/useTimelineStepActions.js", () => ({
  __esModule: true,
  useTimelineStepActions: () => ({
    executeStepActions: vi.fn(),
    actionError: null,
    clearActionError: vi.fn(),
    cancelPendingActions: vi.fn(),
  }),
}));

describe("useRemoteTimelineControl (admin guard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("忽略 admin 頁的 timeline_control 指令，不切換模式也不覆蓋 timeline", () => {
    const setActiveModeOverride = vi.fn();

    const { result } = renderHook(() =>
      useRemoteTimelineControl({
        activeMode: DisplayModes.ADMIN,
        iframeTimelineId: "local-timeline",
        clientId: "desktop",
        applyRemoteIframeConfig: vi.fn(),
        releaseRemoteIframeConfig: vi.fn(),
        setActiveModeOverride,
      }),
    );

    act(() => {
      result.current.handleTimelineControlMessage({
        action: "play",
        target_client_id: "desktop",
        timeline_id: "remote-timeline",
        options: {},
      });
    });

    expect(result.current.effectiveTimelineId).toBe("local-timeline");
    expect(setActiveModeOverride).not.toHaveBeenCalled();
  });
});
