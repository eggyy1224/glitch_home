import { describe, it, expect } from "vitest";
import {
  getSlideSourceMode,
  SlideSourceMode,
  getSizeClass,
  computeStyles,
  cleanId,
  canvasToBlob,
} from "../../../src/utils/slideMode";

describe("slideMode utils", () => {
  it("判斷 slide source mode 與 size class", () => {
    const params = new URLSearchParams([["slide_source", "kinship"]]);
    expect(getSlideSourceMode(params)).toBe(SlideSourceMode.KINSHIP);
    expect(getSlideSourceMode(new URLSearchParams())).toBe(SlideSourceMode.VECTOR);

    expect(getSizeClass(0, 0)).toBe("large");
    expect(getSizeClass(400, 300)).toBe("xsmall");
    expect(getSizeClass(700, 500)).toBe("small");
    expect(getSizeClass(900, 700)).toBe("medium");
    expect(getSizeClass(1400, 900)).toBe("large");
  });

  it("計算不同尺寸樣式並保有基礎屬性", () => {
    const baseStyles = computeStyles("large");
    expect(baseStyles.root.padding).toBe(0);
    expect(baseStyles.stage.position).toBe("absolute");
    expect(baseStyles.stage.inset).toBe(0);
    expect(baseStyles.image.width).toBe("100%");
    expect(baseStyles.image.height).toBe("100%");
    expect(baseStyles.button.fontSize).toBe("12px");

    const medium = computeStyles("medium");
    expect(medium.caption.bottom).toBe("72px");
    expect(medium.caption.fontSize).toBe("13px");

    const small = computeStyles("small");
    expect(small.image.borderRadius).toBe("0");
    expect(small.status.top).toBe("18px");

    const xsmall = computeStyles("xsmall");
    expect(xsmall.controlBar.flexDirection).toBe("column");
    expect(xsmall.slider.width).toBe("100%");
  });

  it("cleanId 移除語系 suffix", () => {
    expect(cleanId("abc:en")).toBe("abc");
    expect(cleanId("xyz:ZH")).toBe("xyz");
    expect(cleanId(null)).toBeNull();
  });

  it("canvasToBlob 成功與失敗", async () => {
    const okCanvas = {
      toBlob: (cb: BlobCallback) => cb(new Blob(["ok"])),
    } as unknown as HTMLCanvasElement;
    const okBlob = await canvasToBlob(okCanvas);
    expect(okBlob).toBeInstanceOf(Blob);

    const badCanvas = {
      toBlob: (cb: BlobCallback) => cb(null),
    } as unknown as HTMLCanvasElement;
    await expect(canvasToBlob(badCanvas)).rejects.toThrow("無法產生截圖");
  });
});
