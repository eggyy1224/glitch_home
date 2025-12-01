import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useKinshipData } from "../../../src/hooks/useKinshipData";
import type * as api from "../../../src/api";

type ApiMocks = {
  fetchKinship: Mock;
};

const apiMocksRef = vi.hoisted(() => ({ current: null as ApiMocks | null }));
let apiMocks: ApiMocks;

const getApiMocks = () => {
  const mocks = apiMocksRef.current;
  if (!mocks) {
    throw new Error("apiMocks not initialized");
  }
  return mocks;
};

vi.mock("../../../src/api", async () => {
  const { createMockApi } = await import("../../testUtils");
  const { mocks, factory } = createMockApi<typeof api, "fetchKinship">(["fetchKinship"]);
  apiMocksRef.current = mocks;
  return { __esModule: true, ...factory() };
});

const kinshipPayload = {
  original_image: "seed.png",
  children: ["child-1"],
  siblings: ["sib-1"],
  parents: ["parent-1"],
};

beforeEach(() => {
  apiMocks = getApiMocks();
  vi.clearAllMocks();
  window.history.replaceState({}, "", "?autoplay=0");
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useKinshipData", () => {
  it("載入資料並建立 clusters（非 phylogeny/incubator）", async () => {
    apiMocks.fetchKinship.mockResolvedValue(kinshipPayload);
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
    const data = result.current.data;
    expect(result.current.err).toBeNull();
    if (!data) {
      throw new Error("data not loaded");
    }
    expect(data.original_image).toBe("seed.png");
    expect(result.current.clusters).toHaveLength(1);
    expect(result.current.clusters[0].original).toBe("seed.png");
  });

  it("navigateToImage 會透過注入的 URL 更新器並設定 imgId", async () => {
    apiMocks.fetchKinship.mockResolvedValue(kinshipPayload);
    const navigation = {
      updateUrlParams: vi.fn(),
      getAutoplayConfig: () => ({ continuous: true, autoplay: false, stepSec: 2 }),
      readVisitedImages: () => new Set<string>(),
      saveVisitedImages: vi.fn(),
      scheduleNavigation: vi.fn(),
    };
    const navigationFactory = () => navigation;
    const { result } = renderHook(() =>
      useKinshipData({
        initialImg: "seed.png",
        shouldLoadKinshipData: false,
        incubatorMode: false,
        phylogenyMode: false,
        navigationFactory,
      }),
    );

    act(() => {
      result.current.navigateToImage("next.png");
    });

    expect(navigation.updateUrlParams).toHaveBeenCalledWith("next.png");
    expect(result.current.imgId).toBe("next.png");
  });

  it("當 fetch 失敗時回傳錯誤並不建立 clusters", async () => {
    apiMocks.fetchKinship.mockRejectedValue(new Error("boom"));
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

  it("會使用注入的導覽工具安排自動播放並更新 imgId", async () => {
    apiMocks.fetchKinship.mockResolvedValue(kinshipPayload);
    const navigation = {
      updateUrlParams: vi.fn(),
      readVisitedImages: vi.fn(() => new Set<string>(["seed.png"])),
      saveVisitedImages: vi.fn(),
      scheduleNavigation: vi.fn((nextImg, onNavigate) => {
        onNavigate(nextImg);
        return vi.fn();
      }),
      getAutoplayConfig: () => ({ continuous: false, autoplay: true, stepSec: 3 }),
    };
    const navigationFactory = () => navigation;

    const { result } = renderHook(() =>
      useKinshipData({
        initialImg: "seed.png",
        shouldLoadKinshipData: true,
        incubatorMode: false,
        phylogenyMode: false,
        navigationFactory,
      }),
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    await waitFor(() => expect(result.current.imgId).toBe("child-1"));

    expect(navigation.readVisitedImages).toHaveBeenCalled();
    expect(navigation.saveVisitedImages).toHaveBeenCalled();
    expect(navigation.scheduleNavigation).toHaveBeenCalledWith("child-1", expect.anything(), 3);
    expect(navigation.updateUrlParams).toHaveBeenCalledWith("child-1");
  });
});
