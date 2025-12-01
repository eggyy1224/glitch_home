import React, { createRef } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VideoMode from "../../src/VideoMode";
import type { VideoController } from "../../src/types/control";

const { mockEnsureHtml2Canvas } = vi.hoisted(() => ({
  mockEnsureHtml2Canvas: vi.fn(() => vi.fn()),
}));

vi.mock("../../src/utils/html2canvasLoader", () => ({
  __esModule: true,
  ensureHtml2Canvas: () => mockEnsureHtml2Canvas(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("VideoMode", () => {
  it("沒有 video 參數時顯示 placeholder 並註冊截圖回呼", () => {
    const onCaptureReady = vi.fn();
    render(<VideoMode onCaptureReady={onCaptureReady} />);

    expect(screen.getByText("請在網址加上 ?video=檔名.mp4")).toBeInTheDocument();
    expect(onCaptureReady).toHaveBeenCalledWith(expect.anything());
  });

  it("支援控制播放/音量/靜音，並將控制器暴露到 ref", async () => {
    window.history.replaceState({}, "", "?video=demo.mp4&auto_unmute=false&video_volume=0.3");
    const controlRef = createRef<VideoController | null>();

    const { container } = render(<VideoMode controlRef={controlRef} />);
    const video = container.querySelector("video") as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    if (!video) {
      throw new Error("video element not found");
    }

    video.play = vi.fn().mockResolvedValue(undefined);
    video.pause = vi.fn();

    await waitFor(() => expect(video.volume).toBeCloseTo(0.3));

    const controller = controlRef.current;
    expect(controller).toBeDefined();
    if (!controller) {
      throw new Error("controller not ready");
    }
    await controller.play?.();
    expect(video.play).toHaveBeenCalled();

    controller.setVolume?.(0.8);
    expect(video.volume).toBeCloseTo(0.8);
    expect(video.muted).toBe(false);

    controller.setMuted?.(true);
    expect(video.muted).toBe(true);

    fireEvent.click(screen.getByRole("button"));
    expect(video.muted).toBe(false);
  });
});
