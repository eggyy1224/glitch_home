import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import GenerateResultsList from "../../../../src/components/generate/GenerateResultsList";
import type { ResolvableImage } from "../../../../src/utils/generate";

const mockImages = [
  { filename: "one.png", url: "one.png" },
  { filename: "two.png", url: "two.png" },
];

const resolver = (image: ResolvableImage) => image.url ?? image.filename ?? "";

describe("GenerateResultsList", () => {
  it("會顯示搜尋模式切換並回呼返回按鈕", () => {
    const onDisplayAll = vi.fn();

    render(
      <GenerateResultsList
        displayMode="search"
        searchResultsLength={2}
        onDisplayAll={onDisplayAll}
        loadingImages={false}
        images={mockImages}
        selectedImages={[]}
        onToggleImage={() => {}}
        onClearSelection={() => {}}
        resolveImageUrl={resolver}
      />
    );

    expect(screen.getByText("顯示：搜尋結果 (2 張)")).toBeInTheDocument();
    fireEvent.click(screen.getByText("返回全部"));
    expect(onDisplayAll).toHaveBeenCalledTimes(1);
  });

  it("點擊圖片會觸發選取回呼", () => {
    const onToggleImage = vi.fn();

    render(
      <GenerateResultsList
        displayMode="all"
        searchResultsLength={0}
        onDisplayAll={() => {}}
        loadingImages={false}
        images={mockImages}
        selectedImages={[]}
        onToggleImage={onToggleImage}
        onClearSelection={() => {}}
        resolveImageUrl={resolver}
      />
    );

    fireEvent.click(screen.getByAltText("one.png"));
    expect(onToggleImage).toHaveBeenCalledWith("one.png");
  });
});
