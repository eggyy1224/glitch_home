import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CollageVersionMode from "../../src/CollageVersionMode";

const {
  mockGenerateCollageVersionFromNames,
  mockListOffspringImages,
  mockCreateTextSearchRequest,
  mockCreateImageUploadRequest,
  mockCreateImageSearchRequest,
  mockGetCollageProgress,
} = vi.hoisted(() => ({
  mockGenerateCollageVersionFromNames: vi.fn(),
  mockListOffspringImages: vi.fn(),
  mockCreateTextSearchRequest: vi.fn(),
  mockCreateImageUploadRequest: vi.fn(),
  mockCreateImageSearchRequest: vi.fn(),
  mockGetCollageProgress: vi.fn(),
}));

vi.mock("../../src/api", () => ({
  __esModule: true,
  generateCollageVersionFromNames: (...args) => mockGenerateCollageVersionFromNames(...args),
  listOffspringImages: (...args) => mockListOffspringImages(...args),
  createTextSearchRequest: (...args) => mockCreateTextSearchRequest(...args),
  createImageUploadRequest: (...args) => mockCreateImageUploadRequest(...args),
  createImageSearchRequest: (...args) => mockCreateImageSearchRequest(...args),
  getCollageProgress: (...args) => mockGetCollageProgress(...args),
}));

const sampleImages = [
  { filename: "a.png", url: "/imgs/a.png" },
  { filename: "b.png", url: "/imgs/b.png" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockListOffspringImages.mockResolvedValue({ images: sampleImages });
  const resolvedRequest = (value) => ({ controller: new AbortController(), promise: Promise.resolve(value) });
  mockCreateTextSearchRequest.mockReturnValue(resolvedRequest({ results: [] }));
  mockCreateImageUploadRequest.mockReturnValue(resolvedRequest({ searchPath: "", fallbackPath: "" }));
  mockCreateImageSearchRequest.mockReturnValue(resolvedRequest({ results: [] }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CollageVersionMode", () => {
  it("缺少最少張數時顯示錯誤，再生成並顯示結果", async () => {
    const clearIntervalMock = vi.spyOn(global, "clearInterval").mockImplementation(() => {});
    const setIntervalMock = vi.spyOn(global, "setInterval").mockImplementation((fn: TimerHandler) => {
      fn();
      return 1 as unknown as ReturnType<typeof setInterval>;
    });
    mockGenerateCollageVersionFromNames.mockResolvedValue({ task_id: "task-1" });
    mockGetCollageProgress.mockResolvedValue({
      progress: 100,
      stage: "completed",
      completed: true,
      output_image: "out.png",
      width: 200,
      height: 100,
      output_format: "png",
      parents: ["a", "b"],
    });

    render(<CollageVersionMode forbidMessage={null} />);

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

    await waitFor(() => expect(mockGenerateCollageVersionFromNames).toHaveBeenCalled());

    await waitFor(() => {
      expect(mockGetCollageProgress).toHaveBeenCalledWith("task-1");
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
    mockCreateTextSearchRequest.mockReturnValue(resolvedRequest);

    render(<CollageVersionMode forbidMessage={null} />);
    const searchInput = await screen.findByPlaceholderText(/圖片名稱或關鍵字/);

    fireEvent.change(searchInput, { target: { value: "night" } });
    fireEvent.click(screen.getByRole("button", { name: "搜尋" }));

    await waitFor(() => expect(mockCreateTextSearchRequest).toHaveBeenCalledWith("night", 50));

    await waitFor(() => {
      expect(screen.getByText("顯示：搜尋結果 (1 張)")).toBeInTheDocument();
      expect(screen.getByText("found-one")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "返回全部" }));
    await waitFor(() => expect(screen.getByText("a.png")).toBeInTheDocument());
  });
});
