import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
});
