import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { SetStateAction } from "react";
import { useCollageImagePool } from "../../../frontend/src/hooks/useCollageImagePool";
import type * as api from "../../../frontend/src/api";

type ApiMocks = { fetchKinship: ReturnType<typeof vi.fn> };

const apiMocksRef = vi.hoisted(() => ({ current: null as ApiMocks | null }));
let apiMocks: ApiMocks;

const getApiMocks = () => {
  const mocks = apiMocksRef.current;
  if (!mocks) throw new Error("apiMocks not initialized");
  return mocks;
};

vi.mock("../../../frontend/src/api", async () => {
  const { createMockApi } = await import("../../../frontend/tests/testUtils");
  const { mocks, factory } = createMockApi<typeof api, "fetchKinship">(["fetchKinship"]);
  apiMocksRef.current = mocks;
  return { __esModule: true, ...factory() };
});

const createSetter = <T,>(initial: T) => {
  let value = initial;
  const fn = vi.fn((next: SetStateAction<T>) => {
    value = typeof next === "function" ? (next as (prev: T) => T)(value) : next;
  });
  return { fn, get: () => value };
};

beforeEach(() => {
  apiMocks = getApiMocks();
  vi.clearAllMocks();
});

describe("useCollageImagePool", () => {
  it("沒有 anchor 時會回報提示並停止載入", async () => {
    const { result } = renderHook(() =>
      useCollageImagePool({
        anchorImage: null,
        remoteConfig: null,
        setImageCount: vi.fn(),
        setRows: vi.fn(),
        setCols: vi.fn(),
        setMixPieces: vi.fn(),
        setSeed: vi.fn(),
        setStageWidth: vi.fn(),
        setStageHeight: vi.fn(),
        setDesiredRatio: vi.fn(),
        setRemoteStageHeightSet: vi.fn(),
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.imagePool).toEqual([]);
    expect(result.current.error).toContain("請在網址加上");
    expect(apiMocks.fetchKinship).not.toHaveBeenCalled();
  });

  it("成功載入 kinship pool 並套用 remoteConfig 覆蓋", async () => {
    apiMocks.fetchKinship.mockResolvedValue({
      original_image: "seed.png",
      children: ["child.png"],
    });

    const imageCount = createSetter(0);
    const rows = createSetter(1);
    const cols = createSetter(1);
    const mix = createSetter(false);
    const seed = createSetter(0);
    const stageWidth = createSetter(400);
    const stageHeight = createSetter(400);
    const desiredRatio = createSetter(1);
    const remoteStageHeightSet = createSetter(false);

    const { result, rerender } = renderHook(
      (props: { remoteConfig: any }) =>
        useCollageImagePool({
          anchorImage: "seed.png",
          remoteConfig: props.remoteConfig,
          setImageCount: imageCount.fn,
          setRows: rows.fn,
          setCols: cols.fn,
          setMixPieces: mix.fn,
          setSeed: seed.fn,
          setStageWidth: stageWidth.fn,
          setStageHeight: stageHeight.fn,
          setDesiredRatio: desiredRatio.fn,
          setRemoteStageHeightSet: remoteStageHeightSet.fn,
        }),
      { initialProps: { remoteConfig: null } },
    );

    await waitFor(() => expect(result.current.imagePool.length).toBeGreaterThan(0));
    expect(result.current.error).toBeNull();
    expect(result.current.imagePool[0]).toBe("seed.png");

    rerender({
      remoteConfig: {
        images: ["override-a.png", "override-b.png"],
        image_count: 50,
        rows: 5,
        cols: 6,
        mix: true,
        seed: 123.8,
        stage_width: 99999,
        stage_height: 1,
      },
    });

    await waitFor(() => expect(result.current.imagePool).toEqual(["override-a.png", "override-b.png"]));
    expect(result.current.loading).toBe(false);
    expect(imageCount.fn).toHaveBeenCalled();
    expect(rows.get()).toBe(5);
    expect(cols.get()).toBe(6);
    expect(mix.get()).toBe(true);
    expect(seed.get()).toBe(123);
    expect(stageWidth.get()).toBeGreaterThan(0);
    expect(stageHeight.get()).toBe(1);
    expect(desiredRatio.get()).toBeLessThan(2);
    expect(remoteStageHeightSet.get()).toBe(true);
  });

  it("當載入失敗時會回傳 fallback 並紀錄錯誤", async () => {
    apiMocks.fetchKinship.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() =>
      useCollageImagePool({
        anchorImage: "seed.png",
        remoteConfig: null,
        setImageCount: vi.fn(),
        setRows: vi.fn(),
        setCols: vi.fn(),
        setMixPieces: vi.fn(),
        setSeed: vi.fn(),
        setStageWidth: vi.fn(),
        setStageHeight: vi.fn(),
        setDesiredRatio: vi.fn(),
        setRemoteStageHeightSet: vi.fn(),
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.imagePool).toEqual(["seed.png"]);
    expect(result.current.error).toBe("boom");
  });
});
