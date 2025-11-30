// @ts-nocheck
import { describe, it, expect } from "vitest";
import {
  calculateDesiredRatio,
  defaultCollageStateUtils,
  readInitialBooleanParam,
  readInitialParam,
} from "../../../src/utils/collageStateUtils";
import {
  COLLAGE_RATIO_MAX as RATIO_MAX,
  COLLAGE_RATIO_MIN as RATIO_MIN,
} from "../../../src/constants/collage";

describe("collageStateUtils", () => {
  it("解析並限制數值參數", () => {
    expect(readInitialParam("collage_width", 100, 10, 200, "collage_width=250")).toBe(200);
    expect(readInitialParam("collage_width", 100, 10, 200, "collage_width=0")).toBe(10);
    expect(readInitialParam("collage_width", 100, 10, 200, "invalid=300")).toBe(100);
  });

  it("解析布林值參數並處理例外輸入", () => {
    expect(readInitialBooleanParam("collage_mix", false, "collage_mix=true")).toBe(true);
    expect(readInitialBooleanParam("collage_mix", false, "collage_mix=0")).toBe(false);
    expect(readInitialBooleanParam("collage_mix", true, "collage_mix=maybe")).toBe(true);
  });

  it("計算並限制畫布比例", () => {
    expect(calculateDesiredRatio(100, 50)).toBeCloseTo(0.5);
    expect(calculateDesiredRatio(1, 10000)).toBe(RATIO_MAX);
    expect(calculateDesiredRatio(10000, 1)).toBe(RATIO_MIN);
  });

  it("提供可注入的種子產生器", () => {
    expect(typeof defaultCollageStateUtils.nextSeed()).toBe("number");
  });
});
