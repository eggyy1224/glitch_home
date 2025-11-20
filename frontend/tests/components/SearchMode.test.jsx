import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SearchMode from "../../src/SearchMode.jsx";

const {
  mockUseSearch,
  mockImagePanel,
  mockTextPanel,
  mockResultsGrid,
} = vi.hoisted(() => ({
  mockUseSearch: vi.fn(),
  mockImagePanel: vi.fn(() => <div data-testid="image-panel" />),
  mockTextPanel: vi.fn(() => <div data-testid="text-panel" />),
  mockResultsGrid: vi.fn(() => <div data-testid="results-grid" />),
}));

vi.mock("../../src/hooks/useSearch.js", () => ({
  __esModule: true,
  default: mockUseSearch,
}));

vi.mock("../../src/components/search/ImageSearchPanel.jsx", () => ({
  __esModule: true,
  default: mockImagePanel,
}));

vi.mock("../../src/components/search/TextSearchPanel.jsx", () => ({
  __esModule: true,
  default: mockTextPanel,
}));

vi.mock("../../src/components/search/SearchResultsGrid.jsx", () => ({
  __esModule: true,
  default: mockResultsGrid,
}));

const baseHook = {
  fileInputRef: { current: null },
  preview: null,
  selectedFile: null,
  textQuery: "",
  results: [],
  searching: false,
  error: null,
  selectFile: vi.fn(),
  clearFileSelection: vi.fn(),
  searchByImage: vi.fn(),
  setTextQuery: vi.fn(),
  searchByText: vi.fn(),
  clearTextQuery: vi.fn(),
  searchFromResult: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSearch.mockReturnValue({ ...baseHook });
});

describe("SearchMode", () => {
  it("預設顯示圖片搜尋並可切換到文字搜尋", () => {
    renderSearchMode();

    expect(screen.getByText("📸 以圖搜圖")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("image-panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "📝 文字搜尋" }));

    expect(screen.getByText("📝 文字搜尋")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("text-panel")).toBeInTheDocument();
    expect(mockUseSearch).toHaveBeenCalled();
  });

  it("呈現錯誤訊息與搜尋結果", () => {
    const searchFromResult = vi.fn();
    const results = [{ id: "img-1", distance: 0.12 }];
    mockUseSearch.mockReturnValue({
      ...baseHook,
      error: "boom",
      results,
      searchFromResult,
    });

    renderSearchMode({ imagesBase: "/imgs/" });

    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(mockResultsGrid).toHaveBeenCalledWith(
      expect.objectContaining({
        results,
        imagesBase: "/imgs/",
        onResultClick: searchFromResult,
      }),
      expect.anything(),
    );
  });
});

function renderSearchMode(props = {}) {
  return render(<SearchMode {...props} />);
}
