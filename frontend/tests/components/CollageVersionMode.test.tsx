import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CollageVersionMode from "../../src/CollageVersionMode";
import { createMockApi } from "../testUtils";
import type * as api from "../../src/api";

const { mocks: apiMocks, createApi } = vi.hoisted(() => {
  const { mocks, factory } = createMockApi<
    typeof api,
    | "generateCollageVersionFromNames"
    | "listOffspringImages"
    | "createTextSearchRequest"
    | "createImageUploadRequest"
    | "createImageSearchRequest"
    | "getCollageProgress"
  >([
    "generateCollageVersionFromNames",
    "listOffspringImages",
    "createTextSearchRequest",
    "createImageUploadRequest",
    "createImageSearchRequest",
    "getCollageProgress",
  ]);
  return { mocks, createApi: factory };
});

vi.mock("../../src/api", () => ({
  __esModule: true,
  ...createApi(),
}));

const sampleImages = [
  { filename: "a.png", url: "/imgs/a.png" },
  { filename: "b.png", url: "/imgs/b.png" },
];

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.listOffspringImages.mockResolvedValue({ images: sampleImages });
  const resolvedRequest = <T,>(value: T) => ({
    controller: new AbortController(),
    promise: Promise.resolve(value),
  });
  apiMocks.createTextSearchRequest.mockReturnValue(resolvedRequest({ results: [] }));
  apiMocks.createImageUploadRequest.mockReturnValue(resolvedRequest({ searchPath: "", fallbackPath: "" }));
  apiMocks.createImageSearchRequest.mockReturnValue(resolvedRequest({ results: [] }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CollageVersionMode", () => {
  it("缺少最少張數時顯示錯誤，再生成並顯示結果", async () => {
    const clearIntervalMock = vi.spyOn(global, "clearInterval").mockImplementation(() => {});
    const setIntervalMock = vi.spyOn(global, "setInterval").mockImplementation((fn: Parameters<typeof setInterval>[0]) => {
      if (typeof fn === "function") {
        fn();
      }
      return 1 as unknown as ReturnType<typeof setInterval>;
    });
    apiMocks.generateCollageVersionFromNames.mockResolvedValue({ task_id: "task-1" });
    apiMocks.getCollageProgress.mockResolvedValue({
      progress: 100,
      stage: "completed",
      completed: true,
      output_image: "out.png",
      width: 200,
      height: 100,
      output_format: "png",
      parents: ["a", "b"],
    });

    render(<CollageVersionMode />);

    await waitFor(() => {
      expect(screen.getByText("a.png")).toBeInTheDocument();
      expect(screen.getByText("b.png")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("a.png"));
    const generateBtn = screen.getByRole("button", { name: "生成拼貼" });
    expect(generateBtn).toBeDisabled();

    fireEvent.click(screen.getByText("b.png"));
    expect(generateBtn).toBeEnabled();
    fireEvent.click(generateBtn);

    await waitFor(() => expect(apiMocks.generateCollageVersionFromNames).toHaveBeenCalled());

    await waitFor(() => {
      expect(apiMocks.getCollageProgress).toHaveBeenCalledWith("task-1");
      expect(screen.getByText("檔名: out.png")).toBeInTheDocument();
    });

    setIntervalMock.mockRestore();
    clearIntervalMock.mockRestore();
  });

  it("文字/檔名搜尋切換到搜尋結果並可返回", async () => {
    const resolvedRequest = {
      controller: new AbortController(),
      promise: Promise.resolve({ results: [{ id: "found-one", distance: 0.2 }] }),
    };
    apiMocks.createTextSearchRequest.mockReturnValue(resolvedRequest);

    render(<CollageVersionMode />);
    const searchInput = await screen.findByPlaceholderText(/圖片名稱或關鍵字/);

    fireEvent.change(searchInput, { target: { value: "night" } });
    fireEvent.click(screen.getByRole("button", { name: "搜尋" }));

    await waitFor(() => expect(apiMocks.createTextSearchRequest).toHaveBeenCalledWith("night", 50));

    await waitFor(() => {
      expect(screen.getByText("顯示：搜尋結果 (1 張)")).toBeInTheDocument();
      expect(screen.getByText("found-one")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "返回全部" }));
    await waitFor(() => expect(screen.getByText("a.png")).toBeInTheDocument());
  });
});
