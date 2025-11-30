// @ts-nocheck
import { describe, expect, it } from "vitest";
import { DisplayModes, getActiveMode } from "../../../src/hooks/useDisplayMode";

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

  it("keeps kinship when both incubator and phylogeny are set", () => {
    const params = buildParams("incubator=true&phylogeny=true&slide_mode=true");
    const result = getActiveMode(params);
    expect(result).toEqual({ type: DisplayModes.KINSHIP, config: { incubator: true, phylogeny: true } });
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

  it("keeps other modes ahead of phylogeny when applicable", () => {
    const params = buildParams("phylogeny=true&search_mode=true");
    const result = getActiveMode(params);
    expect(result).toEqual({ type: DisplayModes.SEARCH, config: { incubator: false, phylogeny: true } });
  });

  it("returns kinship when only phylogeny is provided", () => {
    const params = buildParams("phylogeny=true");
    const result = getActiveMode(params);
    expect(result).toEqual({ type: DisplayModes.KINSHIP, config: { incubator: false, phylogeny: true } });
  });

  it("detects downstream modes like video", () => {
    const params = buildParams("video_mode=true");
    const result = getActiveMode(params);
    expect(result.type).toBe(DisplayModes.VIDEO);
  });
});
