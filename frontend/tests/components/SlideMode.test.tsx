import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SlideMode from "../../src/SlideMode";

const { mockUseSlidePlayback, mockUseSlideScreenshot } = vi.hoisted(() => ({
  mockUseSlidePlayback: vi.fn(),
  mockUseSlideScreenshot: vi.fn(),
}));

vi.mock("../../src/hooks/useSlidePlayback", () => ({
  __esModule: true,
  useSlidePlayback: mockUseSlidePlayback,
}));

vi.mock("../../src/hooks/useSlideScreenshot", () => ({
  __esModule: true,
  useSlideScreenshot: mockUseSlideScreenshot,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SlideMode", () => {
  it("顯示當前圖片與控制列，並觸發播放控制", () => {
    const togglePause = vi.fn();
    const setPlaybackSpeed = vi.fn();
    mockUseSlidePlayback.mockReturnValue({
      current: { cleanId: "img-1" },
      items: [{ cleanId: "img-1" }, { cleanId: "img-2" }],
      index: 0,
      loading: false,
      error: null,
      showCaption: true,
      playbackSpeed: 1.2,
      isPaused: false,
      setPlaybackSpeed,
      togglePause,
    });

    render(<SlideMode imagesBase="/imgs/" anchorImage="img-1" intervalMs={2000} />);

    expect(screen.getByAltText("img-1")).toHaveAttribute("src", "/imgs/img-1");
    expect(screen.getByText("1/2 · img-1")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider"), { target: { value: "2.0" } });
    expect(setPlaybackSpeed).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByRole("button", { name: "⏸ 暫停" }));
    expect(togglePause).toHaveBeenCalledTimes(1);
  });

  it("沒有資料時顯示狀態訊息", () => {
    mockUseSlidePlayback.mockReturnValue({
      current: null,
      items: [],
      index: 0,
      loading: false,
      error: "load failed",
      showCaption: false,
      playbackSpeed: 1,
      isPaused: true,
      setPlaybackSpeed: vi.fn(),
      togglePause: vi.fn(),
    });

    render(<SlideMode imagesBase="/imgs/" anchorImage={null} />);
    expect(screen.getByText("load failed")).toBeInTheDocument();
  });

  it("ResizeObserver 存在時會更新 size class", async () => {
    const togglePause = vi.fn();
    const setPlaybackSpeed = vi.fn();
    let resizeHandler: () => void = () => {};

    mockUseSlidePlayback.mockReturnValue({
      current: { cleanId: "img-3" },
      items: [{ cleanId: "img-3" }],
      index: 0,
      loading: false,
      error: null,
      showCaption: false,
      playbackSpeed: 1,
      isPaused: true,
      setPlaybackSpeed,
      togglePause,
    });

    class MockResizeObserver {
      disconnect = vi.fn();
      observe = vi.fn();
      constructor(handler: () => void) {
        resizeHandler = handler;
      }
    }

    const originalResizeObserver = global.ResizeObserver;
    // @ts-expect-error jsdom 注入 mock
    global.ResizeObserver = MockResizeObserver;

    const { container } = render(<SlideMode imagesBase="/imgs/" anchorImage="img-3" />);
    const root = container.firstChild as HTMLElement;
    root.getBoundingClientRect = () => DOMRect.fromRect({ width: 380, height: 300, x: 0, y: 0 });

    resizeHandler();

    await screen.findByAltText("img-3");
    await waitFor(() => expect(root.style.padding).toBe("12px"));

    global.ResizeObserver = originalResizeObserver;
  });

  it("沒有 ResizeObserver 時使用 window.resize", async () => {
    const togglePause = vi.fn();
    const setPlaybackSpeed = vi.fn();
    mockUseSlidePlayback.mockReturnValue({
      current: { cleanId: "img-4" },
      items: [{ cleanId: "img-4" }],
      index: 0,
      loading: false,
      error: null,
      showCaption: true,
      playbackSpeed: 1,
      isPaused: false,
      setPlaybackSpeed,
      togglePause,
    });

    const originalResizeObserver = global.ResizeObserver;
    // @ts-expect-error 覆寫為 undefined 模擬舊環境
    global.ResizeObserver = undefined;

    const { container } = render(<SlideMode imagesBase="/imgs/" anchorImage="img-4" />);
    const root = container.firstChild as HTMLElement;
    root.getBoundingClientRect = () => DOMRect.fromRect({ width: 600, height: 480, x: 0, y: 0 });

    window.dispatchEvent(new Event("resize"));

    await waitFor(() => expect(root.style.padding).toBe("24px 16px 32px"));

    global.ResizeObserver = originalResizeObserver;
  });
});
