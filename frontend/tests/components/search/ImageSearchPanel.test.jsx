import React, { createRef } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ImageSearchPanel from "../../../src/components/search/ImageSearchPanel.jsx";

const makeProps = (override = {}) => ({
  preview: null,
  selectedFile: null,
  onFileChange: vi.fn(),
  onSearch: vi.fn(),
  onClear: vi.fn(),
  searching: false,
  fileInputRef: createRef(),
  ...override,
});

describe("ImageSearchPanel", () => {
  it("沒有預覽時顯示上傳提示並可觸發檔案選擇", () => {
    const props = makeProps();
    render(<ImageSearchPanel {...props} />);

    const uploadPrompt = screen.getByRole("button", { name: /點擊上傳圖片或拖放/ });

    const input = document.querySelector("input[type='file']");
    expect(input).not.toBeNull();
    const clickSpy = vi.spyOn(input, "click");

    fireEvent.keyDown(uploadPrompt, { key: "Enter" });
    expect(clickSpy).toHaveBeenCalled();

    const file = new File(["123"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(props.onFileChange).toHaveBeenCalledWith(file);
  });

  it("有已選檔案時會顯示預覽並允許清除", () => {
    const file = new File(["data"], "chosen.png", { type: "image/png" });
    const props = makeProps({
      preview: "data:image/png;base64,aaa",
      selectedFile: file,
    });

    render(<ImageSearchPanel {...props} />);

    expect(screen.getByRole("img", { name: "預覽" })).toBeInTheDocument();
    expect(screen.getByText("chosen.png")).toBeInTheDocument();

    const searchBtn = screen.getByRole("button", { name: "🚀 搜尋" });
    expect(searchBtn).toBeEnabled();
    fireEvent.click(searchBtn);
    expect(props.onSearch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("清除"));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });
});
