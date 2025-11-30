// @ts-nocheck
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SearchResultsGrid from "../../../src/components/search/SearchResultsGrid";

const sampleResults = [
  { id: "abc:en", distance: 0.2 },
  { id: "def", distance: 0 },
];

describe("SearchResultsGrid", () => {
  it("沒有結果時不渲染內容", () => {
    const { container } = render(
      <SearchResultsGrid results={[]} imagesBase="/imgs/" onResultClick={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("顯示搜尋結果與相似度並處理 click/error", () => {
    const onResultClick = vi.fn();
    render(<SearchResultsGrid results={sampleResults} imagesBase="/imgs/" onResultClick={onResultClick} />);

    expect(screen.getByText("搜尋結果（2 張）")).toBeInTheDocument();

    const cards = screen.getAllByRole("button");
    expect(cards).toHaveLength(2);
    fireEvent.click(cards[0]);
    expect(onResultClick).toHaveBeenCalledWith("abc");

    const images = screen.getAllByRole("img");
    expect(images[0]).toHaveAttribute("src", "/imgs/abc");
    expect(images[1]).toHaveAttribute("src", "/imgs/def");

    fireEvent.error(images[0]);
    expect(images[0].classList.contains("is-missing")).toBe(true);

    expect(screen.getByText("相似度：90%")).toBeInTheDocument();
    expect(screen.getByText("相似度：100%")).toBeInTheDocument();
  });
});
