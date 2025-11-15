import { describe, expect, it } from "vitest";
import { DisplayModes, getActiveMode } from "../../../src/hooks/useDisplayMode.js";

const buildParams = (query = "") => new URLSearchParams(query);

describe("getActiveMode", () => {
  it("returns kinship by default", () => {
    const result = getActiveMode(buildParams());
    expect(result.type).toBe(DisplayModes.KINSHIP);
    expect(result.config).toMatchObject({ incubator: false, phylogeny: false });
  });

  it("prefers incubator over other flags", () => {
    const params = buildParams("incubator=true&iframe_mode=true&video_mode=true");
    const result = getActiveMode(params);
    expect(result).toEqual({ type: DisplayModes.KINSHIP, config: { incubator: true, phylogeny: false } });
  });

  it("uses the first matching mode in the priority list", () => {
    const params = buildParams("slide_mode=true&iframe_mode=true");
    const result = getActiveMode(params);
    expect(result.type).toBe(DisplayModes.IFRAME);
  });

  it("passes through the phylogeny flag inside config", () => {
    const params = buildParams("phylogeny=true");
    const result = getActiveMode(params);
    expect(result.config.phylogeny).toBe(true);
  });

  it("detects downstream modes like video", () => {
    const params = buildParams("video_mode=true");
    const result = getActiveMode(params);
    expect(result.type).toBe(DisplayModes.VIDEO);
  });
});
