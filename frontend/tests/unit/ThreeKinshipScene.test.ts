import { describe, it, expect } from "vitest";
import KinshipScene from "../../src/components/kinship/KinshipScene";
import ThreeKinshipScene from "../../src/ThreeKinshipScene";

describe("ThreeKinshipScene", () => {
  it("re-exports KinshipScene 供外部使用", () => {
    expect(ThreeKinshipScene).toBe(KinshipScene);
  });
});
