import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCollagePieces } from "../../../frontend/src/hooks/useCollagePieces";
import type { CollageImageProcessing } from "../../../frontend/src/utils/collageImageProcessing";

const createImageProcessing = (opts?: { fail?: boolean }) => {
  const computeEdgesForImage = vi.fn(async () => {
    if (opts?.fail) {
      throw new Error("edge fail");
    }
    const map = new Map();
    map.set("a", 1);
    return map;
  });
  const buildEdgeAwareMixedPieces = vi.fn(() => [{ key: "mixed", imageId: "a", row: 0, col: 0 }]);
  return { computeEdgesForImage, buildEdgeAwareMixedPieces } as unknown as CollageImageProcessing;
};

describe("useCollagePieces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mixPieces 為 false 時不計算 edges 並維持 idle", () => {
    const imageProcessing = createImageProcessing();
    const { result } = renderHook(() =>
      useCollagePieces({
        selectedImages: ["a.png"],
        rows: 2,
        cols: 2,
        seed: 1,
        mixPieces: false,
        desiredRatio: 1,
        imageProcessing,
      }),
    );

    expect(result.current.edgeStatus).toBe("idle");
    expect(result.current.mixedPieces).toEqual([]);
    expect(imageProcessing.computeEdgesForImage).not.toHaveBeenCalled();
  });

  it("mixPieces 會拉取 edge 資訊後建立混合拼片", async () => {
    const imageProcessing = createImageProcessing();
    const { result } = renderHook(() =>
      useCollagePieces({
        selectedImages: ["a.png", "b.png"],
        rows: 1,
        cols: 1,
        seed: 7,
        mixPieces: true,
        desiredRatio: 1.2,
        imagesBase: "/base",
        imageProcessing,
      }),
    );

    await waitFor(() => expect(result.current.edgeStatus).toBe("ready"));
    expect(imageProcessing.computeEdgesForImage).toHaveBeenCalledTimes(2);
    expect(result.current.edgesReady).toBe(true);
    expect(imageProcessing.buildEdgeAwareMixedPieces).toHaveBeenCalled();
    expect(result.current.mixedPieces[0]).toMatchObject({ key: "mixed" });
    expect(result.current.mixBoard.rows * result.current.mixBoard.cols).toBeGreaterThanOrEqual(2);
  });

  it("edge 計算失敗時會標記 failed 並回傳隨機混合結果", async () => {
    const imageProcessing = createImageProcessing({ fail: true });
    const { result } = renderHook(() =>
      useCollagePieces({
        selectedImages: ["a.png"],
        rows: 1,
        cols: 2,
        seed: 3,
        mixPieces: true,
        desiredRatio: 1,
        imageProcessing,
      }),
    );

    await waitFor(() => expect(result.current.edgeStatus).toBe("failed"));
    expect(result.current.edgesReady).toBe(false);
    expect(result.current.mixedPieces.length).toBeGreaterThan(0);
  });
});
