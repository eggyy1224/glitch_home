// @ts-nocheck
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useGenerateParams from "../../../src/hooks/useGenerateParams";

describe("useGenerateParams", () => {
  it("組裝包含親代與可選參數的 payload", () => {
    const { result } = renderHook(() => useGenerateParams());

    act(() => {
      result.current.setPrompt("  hello world  ");
      result.current.setStrength(0.75);
      result.current.setOutputFormat("jpeg");
      result.current.setOutputWidth("512");
      result.current.setOutputHeight("256");
      result.current.setOutputMaxSide("768");
      result.current.setResizeMode("fit");
    });

    const params = result.current.buildParams(["a.png", "b.png"]);
    expect(params).toEqual({
      parents: ["a.png", "b.png"],
      prompt: "hello world",
      strength: 0.75,
      output_format: "jpeg",
      output_width: 512,
      output_height: 256,
      output_max_side: 768,
      resize_mode: "fit",
    });
  });

  it("沒有足夠親代時會改用 count", () => {
    const { result } = renderHook(() => useGenerateParams());

    act(() => {
      result.current.setCount(3);
    });

    const params = result.current.buildParams([]);
    expect(params.count).toBe(3);
    expect(params.parents).toBeUndefined();
  });
});
