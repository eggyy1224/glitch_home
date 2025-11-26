import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useModeParams } from "../../../src/hooks/useModeParams.js";
import { DisplayModes } from "../../../src/hooks/useDisplayMode.js";

const setSearch = (query = "") => {
  const search = query ? `?${query}` : "";
  window.history.replaceState({}, "", `${window.location.pathname}${search}`);
};

describe("useModeParams", () => {
  beforeEach(() => {
    setSearch("");
  });

  it("provides defaults for kinship mode", () => {
    setSearch("img=offspring.png");
    const { result } = renderHook(() => useModeParams());

    expect(result.current.activeMode).toBe(DisplayModes.KINSHIP);
    expect(result.current.initialImg).toBe("offspring.png");
    expect(result.current.soundPlayerEnabled).toBe(true);
    expect(result.current.slideIntervalMs).toBe(3000);
    expect(result.current.clientId).toBe("default");
    expect(result.current.shouldLoadKinshipData).toBe(true);
  });

  it("reflects explicit params for downstream modes", () => {
    setSearch("slide_mode=true&sound_player=false&slide_interval=200&client=viewer");
    const { result } = renderHook(() => useModeParams());

    expect(result.current.activeMode).toBe(DisplayModes.SLIDE);
    expect(result.current.soundPlayerEnabled).toBe(false);
    expect(result.current.slideIntervalMs).toBe(1000);
    expect(result.current.clientId).toBe("viewer");
    expect(result.current.shouldLoadKinshipData).toBe(false);
  });
});
