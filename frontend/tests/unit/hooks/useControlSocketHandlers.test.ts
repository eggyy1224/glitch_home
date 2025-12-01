import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useControlSocketHandlers } from "../../../src/hooks/useControlSocketHandlers";

const createHandlers = (overrides = {}) => {
  const props = {
    clientId: "client-a",
    applySubtitle: vi.fn(),
    applyCaption: vi.fn(),
    applyRemoteIframeConfig: vi.fn(),
    applyRemoteCollageConfig: vi.fn(),
    markRequestDone: vi.fn(),
    unlockAudioElementRef: { current: null },
    videoControllerRef: { current: null },
    ...overrides,
  };
  const { result } = renderHook(() => useControlSocketHandlers(props));
  return { handlers: result.current, props };
};

describe("useControlSocketHandlers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("標記截圖請求完成並尊重 target client", () => {
    const { handlers, props } = createHandlers();
    handlers.handleScreenshotLifecycle({ request_id: "req-1" });
    expect(props.markRequestDone).toHaveBeenCalledWith("req-1");

    handlers.handleSubtitleMessage({ target_client_id: "client-b", subtitle: { text: "skip" } });
    expect(props.applySubtitle).not.toHaveBeenCalled();

    handlers.handleSubtitleMessage({ target_client_id: "client-a", subtitle: { text: "ok" } });
    expect(props.applySubtitle).toHaveBeenCalledWith({ text: "ok" });
  });

  it("處理 caption 與 iframe / collage 配置", () => {
    const { handlers, props } = createHandlers();
    handlers.handleCaptionMessage({ caption: { text: "描述" } });
    expect(props.applyCaption).toHaveBeenCalledWith({ text: "描述" });

    handlers.handleIframeConfigMessage({
      target_client_id: "client-a",
      config: { layout: "grid" },
    });
    expect(props.applyRemoteIframeConfig).toHaveBeenCalledWith({ layout: "grid" });

    handlers.handleCollageConfigMessage({
      config: { images: ["a"] },
    });
    expect(props.applyRemoteCollageConfig).toHaveBeenCalledWith({ config: { images: ["a"] } });
  });

  it("遠端解鎖音訊可正常播放或觸發 fallback", async () => {
    const audioPlay = vi.fn(() => Promise.resolve());
    const audioPause = vi.fn();
    const audioRef = { current: { play: audioPlay, pause: audioPause, currentTime: 0 } };
    const { handlers } = createHandlers({ unlockAudioElementRef: audioRef });

    await act(async () => {
      handlers.handleUnlockAudioMessage({});
      await Promise.resolve();
    });
    expect(audioPlay).toHaveBeenCalled();
    expect(audioPause).toHaveBeenCalled();

    const bodyClick = vi.fn();
    document.body.click = bodyClick;
    const { handlers: fallbackHandlers } = createHandlers({
      unlockAudioElementRef: { current: null },
    });
    fallbackHandlers.handleUnlockAudioMessage({});
    expect(bodyClick).toHaveBeenCalled();
  });

  it("遠端點擊支援 selector 與 target selector", () => {
    const root = document.createElement("div");
    root.id = "video-root";
    const button = document.createElement("button");
    button.id = "remote-btn";
    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    root.appendChild(button);
    document.body.appendChild(root);

    const { handlers } = createHandlers();
    handlers.handleRemoteClickMessage({
      selector: "#video-root",
      target_selector: "#remote-btn",
    });

    expect(onClick).toHaveBeenCalled();
  });

  it("依 action 控制影片", () => {
    const controller = {
      play: vi.fn(),
      pause: vi.fn(),
      seek: vi.fn(),
      setVolume: vi.fn(),
      setMuted: vi.fn(),
    };
    const { handlers } = createHandlers({
      videoControllerRef: { current: controller },
    });

    handlers.handleVideoControlMessage({ action: "play" });
    handlers.handleVideoControlMessage({ action: "pause" });
    handlers.handleVideoControlMessage({ action: "seek", time: 42 });
    handlers.handleVideoControlMessage({ action: "set_volume", volume: 0.5 });
    handlers.handleVideoControlMessage({ action: "set_muted", muted: true });
    handlers.handleVideoControlMessage({ action: "unmute", volume: 0.9 });

    expect(controller.play).toHaveBeenCalled();
    expect(controller.pause).toHaveBeenCalled();
    expect(controller.seek).toHaveBeenCalledWith(42);
    expect(controller.setVolume).toHaveBeenNthCalledWith(1, 0.5);
    expect(controller.setMuted).toHaveBeenCalledWith(true);
    expect(controller.setMuted).toHaveBeenCalledWith(false);
  });

  it("在沒有 controller 時會對所有媒體套用音量/靜音", () => {
    const videoA = document.createElement("video");
    const videoB = document.createElement("video");
    document.body.appendChild(videoA);
    document.body.appendChild(videoB);
    const { handlers } = createHandlers();

    handlers.handleVideoControlMessage({ action: "set_volume", volume: 0 });
    expect(videoA.volume).toBe(0);
    expect(videoB.volume).toBe(0);

    handlers.handleVideoControlMessage({ action: "set_muted", muted: true });
    expect(videoA.muted).toBe(true);
    expect(videoB.muted).toBe(true);
  });

  it("有 controller 時不會覆寫其他媒體音量", () => {
    const video = document.createElement("video");
    video.volume = 0.7;
    document.body.appendChild(video);
    const controller = {
      play: vi.fn(),
      pause: vi.fn(),
      seek: vi.fn(),
      setVolume: vi.fn(),
      setMuted: vi.fn(),
    };
    const { handlers } = createHandlers({
      videoControllerRef: { current: controller },
    });

    handlers.handleVideoControlMessage({ action: "set_volume", volume: 0.1 });
    expect(controller.setVolume).toHaveBeenCalledWith(0.1);
    expect(video.volume).toBeCloseTo(0.7); // 未被全域覆寫

    handlers.handleVideoControlMessage({ action: "mute" });
    expect(controller.setMuted).toHaveBeenCalledWith(true);
    expect(video.muted).toBe(false); // 未被全域覆寫
  });
});
