import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSlidePlayback } from "../../../src/hooks/useSlidePlayback.js";

const setSearch = (query) => {
  window.history.replaceState(null, "", query ? `?${query}` : "");
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("useSlidePlayback", () => {
  beforeEach(() => {
    setSearch("slide_source=vector");
  });

  it("loads vector results and auto-advances", async () => {
    const searchByImage = vi.fn().mockResolvedValue({
      results: [
        { id: "offspring_a.png", distance: 0.1 },
        { id: "offspring_b.png", distance: 0.2 },
      ],
    });
    const fetchKinshipData = vi.fn();

    const { result } = renderHook(() =>
      useSlidePlayback({ anchorImage: "offspring_seed.png", intervalMs: 100, searchByImage, fetchKinshipData }),
    );

    await waitFor(() => expect(result.current.current?.cleanId).toBe("offspring_seed.png"));
    expect(result.current.items.length).toBeGreaterThan(1);

    await act(async () => {
      await sleep(1100);
    });

    expect(result.current.index).toBeGreaterThanOrEqual(1);
    expect(searchByImage).toHaveBeenCalledWith("backend/offspring_images/offspring_seed.png", 15);
  });

  it("switches to kinship mode when requested", async () => {
    setSearch("slide_source=kinship");
    const searchByImage = vi.fn();
    const fetchKinshipData = vi.fn().mockResolvedValue({
      original_image: "offspring_seed.png",
      children: ["offspring_child.png"],
    });

    const { result } = renderHook(() =>
      useSlidePlayback({ anchorImage: "offspring_seed.png", searchByImage, fetchKinshipData }),
    );

    await waitFor(() => expect(result.current.current?.cleanId).toBe("offspring_seed.png"));
    expect(fetchKinshipData).toHaveBeenCalledWith("offspring_seed.png", -1);
  });

  it("toggles caption with Ctrl+R", async () => {
    const searchByImage = vi.fn().mockResolvedValue({ results: [{ id: "offspring_seed.png" }] });
    const fetchKinshipData = vi.fn();
    const { result } = renderHook(() => useSlidePlayback({ anchorImage: "offspring_seed.png", searchByImage, fetchKinshipData }));

    await waitFor(() => expect(result.current.current).not.toBeNull());

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "r", ctrlKey: true }));
    });

    expect(result.current.showCaption).toBe(true);
  });
});
