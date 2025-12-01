import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import GenerateMode from "../../src/GenerateMode";
import { createMockApi } from "../testUtils";
import type * as api from "../../src/api";

const { mocks: apiMocks, createApi } = vi.hoisted(() => {
  const { mocks, factory } = createMockApi<
    typeof api,
    | "generateMixTwo"
    | "listOffspringImages"
    | "createTextSearchRequest"
    | "createImageUploadRequest"
    | "createImageSearchRequest"
  >(["generateMixTwo", "listOffspringImages", "createTextSearchRequest", "createImageUploadRequest", "createImageSearchRequest"]);
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
  const resolvedRequest = <T,>(value: T) => ({ controller: new AbortController(), promise: Promise.resolve(value) });
  apiMocks.createTextSearchRequest.mockReturnValue(resolvedRequest({ results: [] }));
  apiMocks.createImageUploadRequest.mockReturnValue(resolvedRequest({ searchPath: "", fallbackPath: "" }));
  apiMocks.createImageSearchRequest.mockReturnValue(resolvedRequest({ results: [] }));
});

describe("GenerateMode", () => {
  const renderGeneratePanel = async () => {
    render(<GenerateMode canGenerate />);
    fireEvent.click(screen.getByRole("tab", { name: "生成模式" }));
    const panel = await screen.findByText("圖像生成");
    const container = panel.closest(".generate-mode") as HTMLElement;
    return { container };
  };

  it("載入圖片後可選擇並生成，顯示結果", async () => {
    apiMocks.generateMixTwo.mockResolvedValue({
      output_image: "/gen/out.png",
      width: 256,
      height: 128,
      output_format: "png",
      parents: ["a.png", "b.png"],
    });

    const { container } = await renderGeneratePanel();
    const scoped = within(container);

    await waitFor(() => {
      expect(scoped.getAllByText("a.png").length).toBeGreaterThan(0);
      expect(scoped.getAllByText("b.png").length).toBeGreaterThan(0);
    });

    fireEvent.click(scoped.getAllByAltText("a.png")[0]);
    fireEvent.click(scoped.getAllByAltText("b.png")[0]);

    fireEvent.click(scoped.getByRole("button", { name: "生成圖像" }));
    await waitFor(() =>
      expect(apiMocks.generateMixTwo).toHaveBeenCalledWith({
        parents: ["a.png", "b.png"],
        output_format: "png",
        resize_mode: "cover",
        strength: 0.5,
      }),
    );

    await waitFor(() => {
      expect(scoped.getByText(/檔名:/)).toBeInTheDocument();
      expect(scoped.getByAltText("Generated Image")).toBeInTheDocument();
    });
  });

  it("文字搜尋會切換到搜尋結果並提供返回", async () => {
    const resolvedRequest = {
      controller: new AbortController(),
      promise: Promise.resolve({ results: [{ id: "found-img", distance: 0.1 }] }),
    };
    apiMocks.createTextSearchRequest.mockReturnValue(resolvedRequest);

    const { container } = await renderGeneratePanel();
    const scoped = within(container);
    const input = await scoped.findByPlaceholderText(/圖片名稱或關鍵字/);

    fireEvent.change(input, { target: { value: "horse" } });
    fireEvent.click(scoped.getByRole("button", { name: "搜尋" }));

    await waitFor(() => expect(apiMocks.createTextSearchRequest).toHaveBeenCalledWith("horse", 50));

    await waitFor(() => {
      expect(scoped.getByText("顯示：搜尋結果 (1 張)")).toBeInTheDocument();
      expect(scoped.getByText("found-img")).toBeInTheDocument();
    });

    fireEvent.click(scoped.getByRole("button", { name: "返回全部" }));
    await waitFor(() => {
      expect(scoped.getAllByText("a.png").length).toBeGreaterThan(0);
    });
  });

  it("搜尋失敗會顯示錯誤並重置狀態", async () => {
    const error = new Error("boom");
    apiMocks.createTextSearchRequest.mockImplementation(() => {
      throw error;
    });

    const { container } = await renderGeneratePanel();
    const scoped = within(container);
    const input = await scoped.findByPlaceholderText(/圖片名稱或關鍵字/);

    fireEvent.change(input, { target: { value: "horse" } });
    fireEvent.click(scoped.getByRole("button", { name: "搜尋" }));

    await waitFor(() => {
      expect(scoped.getByText("boom")).toBeInTheDocument();
      expect(scoped.getByRole("button", { name: "搜尋" })).toBeEnabled();
    });
  });
});
