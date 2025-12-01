import { describe, it, expect, vi, beforeEach } from "vitest";
import { createImageProcessing, edgeKeyForPiece, type CollageImageProcessing } from "../../../src/utils/collageImageProcessing";

class FakeImage {
  width = 2;
  height = 2;
  naturalWidth = 2;
  naturalHeight = 2;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = "";

  set src(value: string) {
    this._src = value;
    this.onload?.();
  }

  get src() {
    return this._src;
  }
}

describe("createImageProcessing", () => {
  let createImageElement: () => HTMLImageElement;
  let createCanvas: () => HTMLCanvasElement;
  let service: CollageImageProcessing;

  beforeEach(() => {
    createImageElement = vi.fn(() => new FakeImage() as unknown as HTMLImageElement);
    createCanvas = vi.fn(() => {
      const ctx = {
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({
          data: new Uint8ClampedArray([
            10, 20, 30, 255, 10, 20, 30, 255,
            10, 20, 30, 255, 10, 20, 30, 255,
          ]),
        })),
      };
      return { width: 0, height: 0, getContext: vi.fn(() => ctx) } as unknown as HTMLCanvasElement;
    });

    service = createImageProcessing({
      createImageElement,
      createCanvas,
      maxCacheSize: 5,
    });
  });

  it("快取圖像尺寸以避免重複讀取", async () => {
    const first = await service.ensureImageDimensions("foo.png");
    const second = await service.ensureImageDimensions("foo.png");

    expect(first).toEqual({ width: 2, height: 2, ratio: 1 });
    expect(second).toBe(first);
    expect(createImageElement).toHaveBeenCalledTimes(1);
  });

  it("計算邊緣顏色並重複呼叫時使用快取", async () => {
    const first = await service.computeEdgesForImage("image-a", "foo.png", 1, 1);
    const second = await service.computeEdgesForImage("image-a", "foo.png", 1, 1);

    expect(first).toBe(second);
    expect(createImageElement).toHaveBeenCalledTimes(1);
    const edges = first.get(edgeKeyForPiece({ imageId: "image-a", sourceRow: 0, sourceCol: 0 }));
    expect(edges).toBeDefined();
    if (!edges) {
      throw new Error("edges not computed");
    }
    expect(edges).toHaveProperty("center");
    expect(edges.top[0]).toBeGreaterThan(0);
  });

  it("使用邊緣配對資訊產生混合拼貼碎片", () => {
    const pieces = [
      { imageId: "a", sourceRow: 0, sourceCol: 0, key: "a", delay: 0, fromX: 0, fromY: 0, fromRot: 0 },
      { imageId: "b", sourceRow: 0, sourceCol: 1, key: "b", delay: 0, fromX: 0, fromY: 0, fromRot: 0 },
    ];
    const edgeLookup = new Map();
    edgeLookup.set(edgeKeyForPiece(pieces[0]), {
      top: [0, 0, 0],
      bottom: [0, 0, 0],
      left: [0, 0, 0],
      right: [0, 0, 0],
      center: [0, 0, 0],
    });
    edgeLookup.set(edgeKeyForPiece(pieces[1]), {
      top: [255, 255, 255],
      bottom: [255, 255, 255],
      left: [255, 255, 255],
      right: [255, 255, 255],
      center: [255, 255, 255],
    });

    const mixed = service.buildEdgeAwareMixedPieces(pieces, 1, 2, 42, edgeLookup);

    expect(mixed).toHaveLength(2);
    expect(mixed[0]).toHaveProperty("row", 0);
    expect(new Set(mixed.map((piece) => piece.key)).size).toBe(2);
  });
});
