import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useKinshipData } from "../../../src/hooks/useKinshipData.js";

const { mockFetchKinship } = vi.hoisted(() => ({
  mockFetchKinship: vi.fn(),
}));

vi.mock("../../../src/api.js", () => ({
  __esModule: true,
  fetchKinship: (...args) => mockFetchKinship(...args),
}));

const kinshipPayload = {
  original_image: "seed.png",
  children: ["child-1"],
  siblings: ["sib-1"],
  parents: ["parent-1"],
};

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "?autoplay=0");
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useKinshipData", () => {
  it("載入資料並建立 clusters（非 phylogeny/incubator）", async () => {
    mockFetchKinship.mockResolvedValue(kinshipPayload);
    const { result } = renderHook(() =>
      useKinshipData({
        initialImg: "seed.png",
        shouldLoadKinshipData: true,
        incubatorMode: false,
        phylogenyMode: false,
        maxClusters: 2,
      }),
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.err).toBeNull();
    expect(result.current.data.original_image).toBe("seed.png");
    expect(result.current.clusters).toHaveLength(1);
    expect(result.current.clusters[0].original).toBe("seed.png");
  });

  it("navigateToImage 會更新 history 與 imgId", async () => {
    mockFetchKinship.mockResolvedValue(kinshipPayload);
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() =>
      useKinshipData({
        initialImg: "seed.png",
        shouldLoadKinshipData: true,
        incubatorMode: false,
        phylogenyMode: false,
      }),
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => {
      result.current.navigateToImage("next.png");
    });

    expect(replaceSpy).toHaveBeenCalled();
    expect(result.current.imgId).toBe("next.png");
    replaceSpy.mockRestore();
  });

  it("當 fetch 失敗時回傳錯誤並不建立 clusters", async () => {
    mockFetchKinship.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() =>
      useKinshipData({
        initialImg: "seed.png",
        shouldLoadKinshipData: true,
        incubatorMode: false,
        phylogenyMode: false,
      }),
    );

    await waitFor(() => expect(result.current.err).toBe("boom"));
    expect(result.current.clusters).toHaveLength(0);
  });
});
