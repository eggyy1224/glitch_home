import { describe, expect, it } from "vitest";
import { buildImagePool, clamp, computeBoardLayout } from "../../../src/utils/collageMath.js";

describe("clamp", () => {
  it("returns value within range", () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(999, 0, 10)).toBe(10);
  });

  it("falls back to min when value is not finite", () => {
    expect(clamp(Number.NaN, 2, 4)).toBe(2);
    expect(clamp(Number.POSITIVE_INFINITY, 0, 1)).toBe(1);
  });
});

describe("buildImagePool", () => {
  it("collects ids from kinship payload and removes duplicates", () => {
    const result = buildImagePool(
      {
        original_image: "foo:en",
        children: ["bar", "foo:en"],
        siblings: ["baz"],
        parents: null,
        ancestors: ["qux"],
        ancestors_by_level: [["lvl1"], ["lvl2"]],
      },
      "fallback",
    );

    expect(result).toEqual(["foo", "bar", "baz", "qux", "lvl1", "lvl2"]);
  });

  it("falls back to anchor when payload is missing", () => {
    expect(buildImagePool(null, "offspring_a")).toEqual(["offspring_a"]);
  });
});

describe("computeBoardLayout", () => {
  it("returns balanced rows and cols when ratio is square", () => {
    expect(computeBoardLayout(9, 1)).toEqual({ rows: 3, cols: 3 });
  });

  it("prefers near-square boards even when not perfect fit", () => {
    const layout = computeBoardLayout(5, 1);
    expect(layout.rows * layout.cols).toBeGreaterThanOrEqual(5);
    expect(layout.rows).toBeGreaterThan(1);
    expect(layout.cols).toBeGreaterThan(1);
    expect(layout.rows / layout.cols).toBeLessThan(1.6);
    expect(layout.cols / layout.rows).toBeLessThan(1.6);
  });

  it("clamps invalid inputs", () => {
    expect(computeBoardLayout(0, 10)).toEqual({ rows: 1, cols: 1 });
  });
});
