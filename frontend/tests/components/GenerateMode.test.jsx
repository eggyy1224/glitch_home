import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GenerateMode from "../../src/GenerateMode.jsx";

const mockGenerateMixTwo = vi.fn();
const mockListOffspringImages = vi.fn();
const mockCreateTextSearchRequest = vi.fn();
const mockCreateImageUploadRequest = vi.fn();
const mockCreateImageSearchRequest = vi.fn();

vi.mock("../../src/api.js", () => ({
  __esModule: true,
  generateMixTwo: (...args) => mockGenerateMixTwo(...args),
  listOffspringImages: (...args) => mockListOffspringImages(...args),
  createTextSearchRequest: (...args) => mockCreateTextSearchRequest(...args),
  createImageUploadRequest: (...args) => mockCreateImageUploadRequest(...args),
  createImageSearchRequest: (...args) => mockCreateImageSearchRequest(...args),
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

describe("GenerateMode", () => {
  it("載入圖片後可選擇並生成，顯示結果", async () => {
    mockGenerateMixTwo.mockResolvedValue({
      output_image: "/gen/out.png",
      width: 256,
      height: 128,
      output_format: "png",
      parents: ["a.png", "b.png"],
    });

    render(<GenerateMode />);

    await waitFor(() => {
      expect(screen.getByText("a.png")).toBeInTheDocument();
      expect(screen.getByText("b.png")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByAltText("a.png"));
    fireEvent.click(screen.getByAltText("b.png"));

    fireEvent.click(screen.getByRole("button", { name: "生成圖像" }));
    await waitFor(() =>
      expect(mockGenerateMixTwo).toHaveBeenCalledWith({
        parents: ["a.png", "b.png"],
        output_format: "png",
        resize_mode: "cover",
        strength: 0.5,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(/檔名:/)).toBeInTheDocument();
      expect(screen.getByAltText("Generated Image")).toBeInTheDocument();
    });
  });

  it("文字搜尋會切換到搜尋結果並提供返回", async () => {
    const resolvedRequest = {
      controller: new AbortController(),
      promise: Promise.resolve({ results: [{ id: "found-img", distance: 0.1 }] }),
    };
    mockCreateTextSearchRequest.mockReturnValue(resolvedRequest);

    render(<GenerateMode />);
    await waitFor(() => screen.getByPlaceholderText(/輸入搜尋詞/));

    fireEvent.change(screen.getByPlaceholderText(/輸入搜尋詞/), { target: { value: "horse" } });
    fireEvent.click(screen.getByRole("button", { name: "搜尋" }));

    await waitFor(() => expect(mockCreateTextSearchRequest).toHaveBeenCalledWith("horse", 50));

    await waitFor(() => {
      expect(screen.getByText("顯示：搜尋結果 (1 張)")).toBeInTheDocument();
      expect(screen.getByText("found-img")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "返回全部" }));
    await waitFor(() => {
      expect(screen.getByText("a.png")).toBeInTheDocument();
    });
  });

  it("搜尋失敗會顯示錯誤並重置狀態", async () => {
    const error = new Error("boom");
    mockCreateTextSearchRequest.mockImplementation(() => {
      throw error;
    });

    render(<GenerateMode />);
    await waitFor(() => screen.getByPlaceholderText(/輸入搜尋詞/));

    fireEvent.change(screen.getByPlaceholderText(/輸入搜尋詞/), { target: { value: "horse" } });
    fireEvent.click(screen.getByRole("button", { name: "搜尋" }));

    await waitFor(() => {
      expect(screen.getByText("boom")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "搜尋" })).toBeEnabled();
    });
  });
});
