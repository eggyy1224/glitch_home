import { describe, expect, it } from "vitest";
import { buildVjVideoModeUrl, parseVjVideoPanelOptions } from "../../../src/components/snapshot/vjVideoPanelUtils";

describe("vjVideoPanelUtils", () => {
  it("parses and clamps vj video options from url", () => {
    const options = parseVjVideoPanelOptions(
      "/?vj_video_mode=true&video=clip.mp4&vj_bgm=bgm.mp3&vj_bgm_volume=1.5&vj_autostart_mic=true&vj_debug=1&vj_video_rate_min=0.01&vj_video_rate_max=9&vj_video_jump_min=0.01&vj_video_jump_max=30&vj_video_swap_threshold=-0.5&vj_video_shuffle=false",
    );

    expect(options).toMatchObject({
      video: "clip.mp4",
      vjBgm: "bgm.mp3",
      vjBgmVolume: 1,
      vjAutostartMic: true,
      vjDebug: true,
      vjVideoRateMin: 0.1,
      vjVideoRateMax: 6,
      vjVideoJumpMin: 0.05,
      vjVideoJumpMax: 20,
      vjVideoSwapThreshold: 0,
      vjVideoShuffle: false,
    });
  });

  it("builds vj_video_mode url and clears unrelated flags", () => {
    const nextUrl = buildVjVideoModeUrl("/?slide_mode=true&img=foo.png&vj_debug=true", {
      video: "clipA.mp4",
      vjBgm: "bgm.mp3",
      vjBgmVolume: 0.3333,
      vjAutostartMic: true,
      vjDebug: false,
      vjVideoShuffle: false,
      vjVideoRateMin: 0.5,
    });

    const parsed = new URL(nextUrl, "http://localhost");
    expect(parsed.searchParams.get("vj_video_mode")).toBe("true");
    expect(parsed.searchParams.get("video")).toBe("clipA.mp4");
    expect(parsed.searchParams.get("vj_bgm")).toBe("bgm.mp3");
    expect(parsed.searchParams.get("vj_bgm_volume")).toBe("0.333");
    expect(parsed.searchParams.get("vj_autostart_mic")).toBe("true");
    expect(parsed.searchParams.get("vj_video_rate_min")).toBe("0.5");
    expect(parsed.searchParams.get("vj_video_shuffle")).toBe("false");
    expect(parsed.searchParams.has("slide_mode")).toBe(false);
    expect(parsed.searchParams.has("img")).toBe(false);
    expect(parsed.searchParams.has("vj_debug")).toBe(false);
  });
});
