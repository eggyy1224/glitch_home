import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useVjVideoPool } from "../../../src/hooks/useVjVideoPool";
import type { VideoAssetEntry } from "../../../src/api/media";

const fetchVideoAssetsMock = vi.hoisted(() => vi.fn());

vi.mock("../../../src/api/media", async () => {
  const actual = await vi.importActual<typeof import("../../../src/api/media")>("../../../src/api/media");
  return {
    ...actual,
    fetchVideoAssets: fetchVideoAssetsMock,
  };
});

describe("useVjVideoPool", () => {
  beforeEach(() => {
    fetchVideoAssetsMock.mockReset();
  });

  it("selects preferred video when available", async () => {
    const videos: VideoAssetEntry[] = [
      { filename: "a.mp4", url: "/a.mp4" },
      { filename: "b.mp4", url: "/b.mp4" },
    ];
    fetchVideoAssetsMock.mockResolvedValueOnce({ videos });

    const { result } = renderHook(() => useVjVideoPool({ preferredVideo: "b.mp4", shuffle: false }));

    await waitFor(() => expect(fetchVideoAssetsMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.current).toEqual(videos[1]));
  });

  it("falls back to videoBase when fetch fails", async () => {
    fetchVideoAssetsMock.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() =>
      useVjVideoPool({ preferredVideo: "fallback.mp4", videoBase: "/videos" }),
    );

    await waitFor(() => expect(fetchVideoAssetsMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.error).toBe("boom"));
    await waitFor(() =>
      expect(result.current.current).toEqual({ filename: "fallback.mp4", url: "/videos/fallback.mp4" }),
    );
  });
});
