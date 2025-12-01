import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useCollageControls } from "../../../src/hooks/useCollageControls";
import { fetchKinship } from "../../../src/api";
import { ensureHtml2Canvas } from "../../../src/utils/html2canvasLoader";
import type { Mock } from "vitest";
import type { CollageControlsOptions } from "../../../src/hooks/useCollageControls";
import type React from "react";

vi.mock("../../../src/api", () => ({
  fetchKinship: vi.fn(),
}));

vi.mock("../../../src/utils/html2canvasLoader", () => ({
  ensureHtml2Canvas: vi.fn(() => Promise.resolve(() => {})),
}));

describe("useCollageControls", () => {
  const originalImage = global.Image;
  const fetchKinshipMock = fetchKinship as Mock<Parameters<typeof fetchKinship>, ReturnType<typeof fetchKinship>>;
  const ensureHtml2CanvasMock = ensureHtml2Canvas as Mock<
    Parameters<typeof ensureHtml2Canvas>,
    ReturnType<typeof ensureHtml2Canvas>
  >;

  beforeAll(() => {
    class FakeImage {
      width = 160;
      height = 90;
      naturalWidth = 160;
      naturalHeight = 90;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      _src = "";

      set src(value: string) {
        this._src = value;
        if (this.onload) {
          this.onload();
        }
      }
    }
    global.Image = FakeImage as unknown as typeof Image;
  });

  afterAll(() => {
    global.Image = originalImage;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    fetchKinshipMock.mockResolvedValue({
      original_image: "anchor.png",
      children: ["child-a.png", "child-b.png"],
    });
    ensureHtml2CanvasMock.mockResolvedValue(() => Promise.resolve(document.createElement("canvas")));
  });

  it("當缺少 anchor 圖像時顯示提示錯誤並不觸發載入", async () => {
    const { result } = renderHook(() =>
      useCollageControls({
        imagesBase: "/images",
        anchorImage: null,
      }),
    );

    await waitFor(() => {
      expect(result.current.error).toContain("請在網址加上 ?img=檔名");
    });
    expect(result.current.imagePool).toEqual([]);
    expect(fetchKinship).not.toHaveBeenCalled();
  });

  it("成功載入拼貼圖像池並清除錯誤訊息", async () => {
    const { result } = renderHook(() =>
      useCollageControls({
        imagesBase: "/images",
        anchorImage: "anchor.png",
      }),
    );

    await waitFor(() => {
      expect(fetchKinshipMock).toHaveBeenCalledWith("anchor.png", -1);
    });

    await waitFor(() => {
      expect(result.current.imagePool).toEqual(["anchor.png", "child-a.png", "child-b.png"]);
    });
    expect(result.current.error).toBeNull();
  });

  it("套用遠端配置並在移除後恢復原本 pool", async () => {
    const initialProps: CollageControlsOptions = {
      imagesBase: "/images",
      anchorImage: "anchor.png",
      remoteConfig: null,
    };

    const { result, rerender } = renderHook((props) => useCollageControls(props), {
      initialProps,
    });

    await waitFor(() => {
      expect(result.current.imagePool[0]).toBe("anchor.png");
    });

    const remoteConfig = {
      images: ["remote-a.png", "remote-b.png"],
      image_count: 2,
      rows: 5,
      cols: 4,
      mix: false,
      seed: 99,
      stage_width: 900,
      stage_height: 500,
    };

    rerender({ ...initialProps, remoteConfig });

    await waitFor(() => {
      expect(result.current.imagePool).toEqual(remoteConfig.images);
    });

    expect(result.current.rows).toBe(5);
    expect(result.current.cols).toBe(4);
    expect(result.current.imageCount).toBe(2);
    expect(result.current.stageWidth).toBe(900);
    expect(result.current.finalStageHeight).toBe(500);

    rerender({ ...initialProps, remoteConfig: null });

    await waitFor(() => {
      expect(result.current.imagePool).toEqual(["anchor.png", "child-a.png", "child-b.png"]);
    });
  });

  it("在 controlsDisabled 時忽略控制輸入", async () => {
    const createEvent = (value: string) => ({ target: { value } } as unknown as React.ChangeEvent<HTMLInputElement>);
    const { result } = renderHook(() =>
      useCollageControls({
        imagesBase: "/images",
        anchorImage: "anchor.png",
        controlsEnabled: false,
      }),
    );

    await waitFor(() => {
      expect(result.current.imagePool.length).toBeGreaterThan(0);
    });

    const beforeCount = result.current.imageCount;
    act(() => {
      result.current.handleImageCountChange(createEvent(String(beforeCount + 5)));
      result.current.handleRowsChange(createEvent("99"));
      result.current.handleColsChange(createEvent("99"));
      result.current.toggleMixPieces();
      result.current.handleShuffle();
    });

    expect(result.current.imageCount).toBe(beforeCount);
    expect(result.current.rows).not.toBe(99);
    expect(result.current.cols).not.toBe(99);
    expect(result.current.mixPieces).toBe(false);
  });
});
