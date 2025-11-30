// @ts-nocheck
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TextSearchPanel from "../../../src/components/search/TextSearchPanel";

const baseProps = () => ({
  textQuery: "",
  onChange: vi.fn(),
  onSearch: vi.fn(),
  onClear: vi.fn(),
  searching: false,
});

describe("TextSearchPanel", () => {
  it("空字串時搜尋按鈕停用並沒有清除鈕", () => {
    render(<TextSearchPanel {...baseProps()} />);
    expect(screen.getByRole("button", { name: "🚀 搜尋" })).toBeDisabled();
    expect(screen.queryByText("清除")).not.toBeInTheDocument();
  });

  it("輸入文字後可以搜尋與清除，也支援 Enter 觸發", () => {
    const props = baseProps();
    const { rerender } = render(<TextSearchPanel {...props} textQuery="init" />);

    const input = screen.getByPlaceholderText("輸入搜尋詞... 例如：白馬、夜晚、人物");
    fireEvent.change(input, { target: { value: "night" } });
    expect(props.onChange).toHaveBeenCalledWith("night");

    rerender(<TextSearchPanel {...props} textQuery="night" />);

    const searchBtn = screen.getByRole("button", { name: "🚀 搜尋" });
    expect(searchBtn).toBeEnabled();
    fireEvent.click(searchBtn);
    expect(props.onSearch).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onSearch).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByText("清除"));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });
});
