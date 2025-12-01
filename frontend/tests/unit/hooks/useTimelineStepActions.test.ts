import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTimelineStepActions } from "../../../src/hooks/useTimelineStepActions";
import {
  clearCaption,
  clearSubtitle,
  queueSoundPlay,
  sendRemoteClick,
  sendVideoControl,
  setCaption,
  setSubtitle,
  speakWithSubtitle,
  triggerTts,
  unlockAudio,
} from "../../../src/api";
import type { Mock } from "vitest";

vi.mock("../../../src/api", () => ({
  clearCaption: vi.fn(() => Promise.resolve()),
  clearSubtitle: vi.fn(() => Promise.resolve()),
  queueSoundPlay: vi.fn(() => Promise.resolve()),
  sendRemoteClick: vi.fn(() => Promise.resolve()),
  sendVideoControl: vi.fn(() => Promise.resolve()),
  setCaption: vi.fn(() => Promise.resolve()),
  setSubtitle: vi.fn(() => Promise.resolve()),
  speakWithSubtitle: vi.fn(() => Promise.resolve()),
  triggerTts: vi.fn(() => Promise.resolve()),
  unlockAudio: vi.fn(() => Promise.resolve()),
}));

const clearCaptionMock = clearCaption as Mock<Parameters<typeof clearCaption>, ReturnType<typeof clearCaption>>;
const clearSubtitleMock = clearSubtitle as Mock<Parameters<typeof clearSubtitle>, ReturnType<typeof clearSubtitle>>;
const queueSoundPlayMock = queueSoundPlay as Mock<Parameters<typeof queueSoundPlay>, ReturnType<typeof queueSoundPlay>>;
const sendRemoteClickMock = sendRemoteClick as Mock<Parameters<typeof sendRemoteClick>, ReturnType<typeof sendRemoteClick>>;
const sendVideoControlMock = sendVideoControl as Mock<Parameters<typeof sendVideoControl>, ReturnType<typeof sendVideoControl>>;
const setCaptionMock = setCaption as Mock<Parameters<typeof setCaption>, ReturnType<typeof setCaption>>;
const setSubtitleMock = setSubtitle as Mock<Parameters<typeof setSubtitle>, ReturnType<typeof setSubtitle>>;
const speakWithSubtitleMock = speakWithSubtitle as Mock<
  Parameters<typeof speakWithSubtitle>,
  ReturnType<typeof speakWithSubtitle>
>;
const triggerTtsMock = triggerTts as Mock<Parameters<typeof triggerTts>, ReturnType<typeof triggerTts>>;
const unlockAudioMock = unlockAudio as Mock<Parameters<typeof unlockAudio>, ReturnType<typeof unlockAudio>>;

describe("useTimelineStepActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("remote_click 缺少 selector/target 時會回報錯誤", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useTimelineStepActions({ clientId: "client-a", onError }));

    await act(async () => {
      await result.current.executeStepActions({
        step: { remote_clicks: [{}] },
        timelineId: "tl-1",
        stepIndex: 0,
        runId: 1,
      });
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
    expect(onError.mock.calls[0][0]).toContain("remote_click 需要 selector/target 或 x,y 座標");
    expect(result.current.actionError).toContain("remote_click");
  });

  it("remote_click 與 video_control 支援延遲與 target override", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimelineStepActions({ clientId: "client-base" }));

    await act(async () => {
      await result.current.executeStepActions({
        step: {
          remote_clicks: [
            { selector: "#btn", x: 10, y: 20, offset_seconds: 0.2, target_client_id: "override-client" },
          ],
          video_controls: [{ action: "set", volume: 2, time: -5, offset_seconds: 0.1 }],
        },
        timelineId: "tl-2",
        stepIndex: 1,
        runId: 99,
      });
    });

    expect(sendRemoteClickMock).not.toHaveBeenCalled();
    expect(sendVideoControlMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(sendRemoteClickMock).toHaveBeenCalledTimes(1);
    expect(sendVideoControlMock).toHaveBeenCalledTimes(1);

    const [clickPayload] = sendRemoteClickMock.mock.calls[0];
    expect(clickPayload).toMatchObject({
      selector: "#btn",
      x: 10,
      y: 20,
      target_client_id: "override-client",
    });

    const [videoPayload] = sendVideoControlMock.mock.calls[0];
    expect(videoPayload).toMatchObject({
      action: "set",
      volume: 1,
      time: 0,
    });
    expect(result.current.actionError).toBeNull();
  });

  it("字幕、caption、TTS 與 unlock audio 會依序執行並清除錯誤", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useTimelineStepActions({ clientId: "client-main", onError }));

    await act(async () => {
      await result.current.executeStepActions({
        step: {
          unlock_audio_targets: [" remote ", ""],
          subtitle: { text: "字幕", language: "zh", duration_seconds: 5 },
          caption: { clear: true },
          tts: {
            mode: "speak_with_subtitle",
            text: "hi",
            subtitle_text: "subtitle text",
            subtitle_duration_seconds: 3,
            auto_play: true,
            speed: 1.1,
            voice: "voice-x",
            model: "gpt",
            instructions: "demo",
            output_format: "wav",
            filename_base: "name",
            target_client_id: "client-tts",
          },
        },
        timelineId: "tl-3",
        stepIndex: 2,
        runId: 5,
      });
    });

    await waitFor(() => {
      expect(unlockAudioMock).toHaveBeenCalledTimes(2);
    });
    expect(unlockAudioMock.mock.calls[0][0]).toBe("remote");
    expect(unlockAudioMock.mock.calls[1][0]).toBeNull();

    expect(clearCaptionMock).toHaveBeenCalledWith("client-main", expect.anything());
    expect(setSubtitleMock).toHaveBeenCalledWith(
      { text: "字幕", language: "zh", duration_seconds: 5 },
      "client-main",
      expect.anything(),
    );
    expect(speakWithSubtitleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "hi",
        subtitle_text: "subtitle text",
        subtitle_duration_seconds: 3,
        target_client_id: "client-tts",
        auto_play: true,
        speed: 1.1,
        voice: "voice-x",
        model: "gpt",
        instructions: "demo",
        output_format: "wav",
        filename_base: "name",
      }),
      expect.anything(),
    );
    expect(result.current.actionError).toBeNull();
    expect(onError).toHaveBeenCalledWith(null);
  });

  it("sound_play 會觸發 queueSoundPlay 並支援 cancelPendingActions 清掉排程", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimelineStepActions({ clientId: "client-sound" }));

    await act(async () => {
      await result.current.executeStepActions({
        step: {
          remote_clicks: [{ selector: "#later", offset_seconds: 1 }],
          tts: { mode: "sound_play", sound_filename: "demo.wav" },
        },
        runId: 1,
      });
    });

    expect(queueSoundPlayMock).toHaveBeenCalledWith("demo.wav", "client-sound", expect.anything());

    act(() => {
      result.current.cancelPendingActions();
      vi.runAllTimers();
    });

    expect(sendRemoteClickMock).not.toHaveBeenCalled();
  });

  it("在資產寫入被禁用時會阻擋 TTS 並回報錯誤", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useTimelineStepActions({
        clientId: "client-deny",
        onError,
        capabilities: { canWriteAssets: false, canAnalyze: true, forbidMessage: "no write" },
      }),
    );

    await act(async () => {
      await result.current.executeStepActions({
        step: { tts: { mode: "speak_with_subtitle", text: "hi" } },
        runId: 1,
      });
    });

    expect(speakWithSubtitleMock).not.toHaveBeenCalled();
    expect(triggerTtsMock).not.toHaveBeenCalled();
    expect(result.current.actionError).toContain("no write");
    expect(onError).toHaveBeenCalled();
  });

  it("sound_play 仍可執行當分析關閉時", async () => {
    const { result } = renderHook(() =>
      useTimelineStepActions({
        clientId: "client-audio",
        capabilities: { canAnalyze: false, canWriteAssets: false },
      }),
    );

    await act(async () => {
      await result.current.executeStepActions({
        step: { tts: { mode: "sound_play", sound_filename: "cue.wav" } },
        runId: 2,
      });
    });

    expect(queueSoundPlayMock).toHaveBeenCalledWith("cue.wav", "client-audio", expect.anything());
    expect(result.current.actionError).toBeNull();
  });
});
