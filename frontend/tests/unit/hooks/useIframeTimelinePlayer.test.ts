// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useIframeTimelinePlayer } from "../../../src/hooks/useIframeTimelinePlayer";
import { fetchIframeTimeline } from "../../../src/api";

vi.mock("../../../src/api", () => ({
  fetchIframeTimeline: vi.fn(),
}));

describe("useIframeTimelinePlayer", () => {
  const mockApplyConfig = vi.fn();
  const mockReleaseConfig = vi.fn();
  const mockOnStepStart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("載入 timeline 後自動播放並循環步驟", async () => {
    fetchIframeTimeline.mockResolvedValue({
      timeline: {
        id: "tl-1",
        loop: true,
        steps: [
          { snapshot: "a", duration: 0.1, config: { foo: 1 } },
          { snapshot: "b", duration: 0.1, config: { foo: 2 } },
        ],
      },
    });

    const { result } = renderHook(() =>
      useIframeTimelinePlayer({
        timelineId: "tl-1",
        isActive: true,
        applyRemoteConfig: mockApplyConfig,
        releaseRemoteConfig: mockReleaseConfig,
        onStepStart: mockOnStepStart,
      }),
    );

    await waitFor(() => expect(fetchIframeTimeline).toHaveBeenCalledWith("tl-1", expect.any(Object)));
    const firstFetch = fetchIframeTimeline.mock.results[0]?.value;
    if (firstFetch?.then) {
      await act(async () => {
        await firstFetch;
      });
    }
    await waitFor(() => expect(result.current.timeline?.id).toBe("tl-1"), { timeout: 1000 });
    expect(result.current.isPlaying).toBe(true);
    expect(mockApplyConfig).toHaveBeenCalledWith({ foo: 1 });
    expect(mockOnStepStart).toHaveBeenCalledWith(expect.objectContaining({ stepIndex: 0, runId: 1 }));

    await waitFor(() => expect(result.current.currentStepIndex).toBe(1), { timeout: 1000 });
    expect(mockApplyConfig).toHaveBeenCalledWith({ foo: 2 });

    await waitFor(() => expect(result.current.currentStepIndex).toBe(0), { timeout: 1500 });
    expect(result.current.isPlaying).toBe(true);
    expect(mockReleaseConfig).not.toHaveBeenCalled();

    act(() => {
      result.current.stop();
    });
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentStepIndex).toBe(0);
    expect(mockReleaseConfig).toHaveBeenCalled();
  });

  it("支援跳轉、播放/暫停、重載並套用配置", async () => {
    fetchIframeTimeline.mockResolvedValue({
      timeline: {
        id: "tl-2",
        loop: false,
        steps: [
          { snapshot: "x", duration: 0.1, config: { foo: "x" } },
          { snapshot: "y", duration: 0.1, config: { foo: "y" } },
        ],
      },
    });

    const { result, rerender } = renderHook(
      (props) =>
        useIframeTimelinePlayer({
          timelineId: "tl-2",
          isActive: props.isActive,
          applyRemoteConfig: mockApplyConfig,
          releaseRemoteConfig: mockReleaseConfig,
          onStepStart: mockOnStepStart,
          autoPlayOnLoad: false,
          initialStep: 1,
        }),
      { initialProps: { isActive: true } },
    );

    await waitFor(() => expect(fetchIframeTimeline).toHaveBeenCalledTimes(1));
    const firstFetch = fetchIframeTimeline.mock.results[0]?.value;
    if (firstFetch?.then) {
      await act(async () => {
        await firstFetch;
      });
    }
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentStepIndex).toBe(1);

    act(() => {
      result.current.jumpToStep(0);
    });
    expect(mockApplyConfig).toHaveBeenCalledWith({ foo: "x" });

    act(() => {
      result.current.play();
    });
    expect(result.current.isPlaying).toBe(true);

    act(() => {
      result.current.pause();
    });
    expect(result.current.isPlaying).toBe(false);

    act(() => {
      result.current.reload();
    });
    await waitFor(() => expect(fetchIframeTimeline).toHaveBeenCalledTimes(2));
    const secondFetch = fetchIframeTimeline.mock.results[1]?.value;
    if (secondFetch?.then) {
      await act(async () => {
        await secondFetch;
      });
    }

    rerender({ isActive: false });
    expect(result.current.isPlaying).toBe(false);
    expect(mockReleaseConfig).toHaveBeenCalled();
  });

  it("載入失敗時回報錯誤並停播", async () => {
    fetchIframeTimeline.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() =>
      useIframeTimelinePlayer({
        timelineId: "tl-err",
        isActive: true,
      }),
    );

    await waitFor(() => expect(fetchIframeTimeline).toHaveBeenCalled());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("boom");
    expect(result.current.isPlaying).toBe(false);
  });
});
