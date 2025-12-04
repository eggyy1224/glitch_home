import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCollageVersionGeneration } from "../../../frontend/src/hooks/useCollageVersionGeneration";
import { generateCollageVersionFromNames, getCollageProgress } from "../../../frontend/src/api";
import type { Mock } from "vitest";

vi.mock("../../../frontend/src/api", () => ({
  generateCollageVersionFromNames: vi.fn(),
  getCollageProgress: vi.fn(),
}));

const generateMock = generateCollageVersionFromNames as Mock<
  Parameters<typeof generateCollageVersionFromNames>,
  ReturnType<typeof generateCollageVersionFromNames>
>;
const progressMock = getCollageProgress as Mock<
  Parameters<typeof getCollageProgress>,
  ReturnType<typeof getCollageProgress>
>;

const baseParams = {
  rows: 1,
  cols: 1,
  mode: "grid",
  seed: 1,
  resize_w: 512,
  pad_px: 0,
  jitter_px: 0,
  rotate_deg: 0,
  format: "png",
  quality: 90,
};

describe("useCollageVersionGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generationDisabled 或圖片不足時會回報錯誤並略過呼叫", async () => {
    const setError = vi.fn();
    const { result, rerender } = renderHook(
      (props: { disabled: boolean; images: string[] }) =>
        useCollageVersionGeneration({
          apiBase: "http://api",
          selectedImages: props.images,
          minRequired: 2,
          generationDisabled: props.disabled,
          blockedMessage: "blocked",
          params: baseParams,
          setError,
        }),
      { initialProps: { disabled: true, images: [] } },
    );

    await act(async () => {
      await result.current.handleGenerate();
    });
    expect(setError).toHaveBeenCalledWith("blocked");
    expect(generateMock).not.toHaveBeenCalled();

    rerender({ disabled: false, images: ["only-one"] });
    await act(async () => {
      await result.current.handleGenerate();
    });
    expect(setError).toHaveBeenCalledWith("至少需要選擇 2 張圖片");
  });

  it("成功流程會輪詢進度並組出 imageUrl", async () => {
    vi.useFakeTimers();
    const setError = vi.fn();
    generateMock.mockResolvedValue({ task_id: "task-1" });
    progressMock.mockResolvedValue({
      progress: 55,
      stage: "running",
      message: "halfway",
      completed: true,
      output_image: "done.png",
    });

    const { result } = renderHook(() =>
      useCollageVersionGeneration({
        apiBase: "http://api",
        selectedImages: ["a", "b"],
        minRequired: 2,
        generationDisabled: false,
        blockedMessage: "",
        params: baseParams,
        setError,
      }),
    );

    await act(async () => {
      await result.current.handleGenerate();
    });

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    await waitFor(() => expect(result.current.result?.imageUrl).toBe("http://api/generated_images/done.png"));
    expect(result.current.loading).toBe(false);
    expect(result.current.progress).toBe(100);
    expect(result.current.progressStage).toBe("running");
    expect(result.current.progressMessage).toBe("halfway");
    expect(setError).not.toHaveBeenCalledWith(expect.stringContaining("失敗"));
  });

  it("生成失敗會清理定時器並回報錯誤", async () => {
    vi.useFakeTimers();
    const setError = vi.fn();
    generateMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() =>
      useCollageVersionGeneration({
        apiBase: "http://api",
        selectedImages: ["a", "b"],
        minRequired: 2,
        generationDisabled: false,
        blockedMessage: "",
        params: baseParams,
        setError,
      }),
    );

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(setError).toHaveBeenCalledWith("boom");
    expect(result.current.loading).toBe(false);
    expect(progressMock).not.toHaveBeenCalled();
  });
});
