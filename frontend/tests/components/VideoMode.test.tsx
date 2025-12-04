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

  it("自動解除靜音失敗時等待使用者點擊", async () => {
    window.history.replaceState({}, "", "?video=demo.mp4&auto_unmute=true");

    const playMock = vi.fn().mockRejectedValueOnce(new Error("blocked")).mockResolvedValueOnce(undefined);
    const pauseMock = vi.fn();
    const loadMock = vi.fn();

    const originalPlay = HTMLMediaElement.prototype.play;
    const originalPause = HTMLMediaElement.prototype.pause;
    const originalLoad = HTMLMediaElement.prototype.load;
    const readyStateDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "readyState");

    Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: playMock });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: pauseMock });
    Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value: loadMock });
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 3 });

    const { container } = render(<VideoMode />);
    const button = screen.getByRole("button");
    const video = container.querySelector("video") as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    if (!video) throw new Error("video not found");

    await waitFor(() => expect(playMock).toHaveBeenCalled());
    expect(button).toHaveAttribute("aria-pressed", "true");

    document.dispatchEvent(new Event("click"));
    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(2));
    expect(button).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(playMock).toHaveBeenCalledTimes(2);

    Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: originalPlay });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: originalPause });
    Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value: originalLoad });
    if (readyStateDescriptor) {
      Object.defineProperty(HTMLMediaElement.prototype, "readyState", readyStateDescriptor);
    }
  });

  it("支援控制播放、快轉、靜音與截圖回呼", async () => {
    window.history.replaceState({}, "", "?video=demo.mp4&auto_unmute=false&video_volume=0.3&video_speed=1.5&loop=false");
    const controlRef = createRef<VideoController | null>();
    const blob = new Blob(["video"], { type: "image/png" });
    const toBlob = vi.fn((cb: BlobCallback) => cb(blob));
    mockEnsureHtml2Canvas.mockResolvedValueOnce(async () => ({ toBlob } as unknown as HTMLCanvasElement));
    const onCaptureReady = vi.fn();

    const { container } = render(<VideoMode controlRef={controlRef} onCaptureReady={onCaptureReady} />);
    const video = container.querySelector("video") as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    if (!video) throw new Error("video not found");

    const playMock = vi.fn().mockResolvedValue(undefined);
    const pauseMock = vi.fn();
    video.play = playMock;
    video.pause = pauseMock;
    Object.defineProperty(video, "currentTime", { value: 0, writable: true });

    await waitFor(() => {
      expect(video.volume).toBeCloseTo(0.3);
      expect(video.playbackRate).toBeCloseTo(1.5);
    });

    const controller = controlRef.current;
    expect(controller).toBeDefined();
    if (!controller) throw new Error("controller missing");

    await controller.play?.();
    controller.setVolume?.(0.8);
    controller.setMuted?.(false);
    controller.setSpeed?.(2.5);
    controller.seek?.(5);
    controller.pause?.();

    expect(video.volume).toBeCloseTo(0.8);
    expect(video.muted).toBe(false);
    expect(video.playbackRate).toBeCloseTo(2.5);
    expect(video.currentTime).toBe(5);
    expect(playMock).toHaveBeenCalled();
    expect(pauseMock).toHaveBeenCalled();

    await waitFor(() => expect(onCaptureReady).toHaveBeenCalledWith(expect.any(Function)));
    const capture = onCaptureReady.mock.calls[0][0] as () => Promise<Blob>;
    await expect(capture()).resolves.toEqual(blob);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.keyDown(button, { key: "Enter" });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });
});
