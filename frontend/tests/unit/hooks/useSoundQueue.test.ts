import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSoundQueue } from "../../../src/hooks/useSoundQueue";

describe("useSoundQueue", () => {
  it("處理播放訊息與清除", () => {
    const { result } = renderHook(() => useSoundQueue());

    act(() => {
      result.current.handleSoundPlayMessage({ filename: "tone.wav", url: "/sound/tone.wav" });
    });
    expect(result.current.soundPlayRequest).toEqual({ filename: "tone.wav", url: "/sound/tone.wav" });

    act(() => {
      result.current.handleSoundHandled();
    });
    expect(result.current.soundPlayRequest).toBeNull();
  });

  it("沒有檔名時忽略訊息", () => {
    const { result } = renderHook(() => useSoundQueue());

    act(() => {
      result.current.handleSoundPlayMessage({});
    });
    expect(result.current.soundPlayRequest).toBeNull();
  });
});
