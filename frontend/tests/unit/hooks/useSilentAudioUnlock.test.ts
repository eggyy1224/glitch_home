// @ts-nocheck
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSilentAudioUnlock } from "../../../src/hooks/useSilentAudioUnlock";
import { SILENT_AUDIO_SRC } from "../../../src/constants/silentAudio";

describe("useSilentAudioUnlock", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("建立並清理靜音音訊元素", () => {
    const { result, unmount } = renderHook(() => useSilentAudioUnlock());

    const audio = result.current.current;

    expect(audio).toBeInstanceOf(HTMLAudioElement);
    expect(audio.src).toContain(SILENT_AUDIO_SRC);
    expect(audio.muted).toBe(true);
    expect(audio.preload).toBe("auto");
    expect(audio.style.position).toBe("absolute");
    expect(document.body.contains(audio)).toBe(true);

    unmount();

    expect(document.body.contains(audio)).toBe(false);
    expect(result.current.current).toBeNull();
  });
});
