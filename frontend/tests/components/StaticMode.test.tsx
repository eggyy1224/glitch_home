import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import StaticMode from "../../src/StaticMode";

const { mockEnsureHtml2Canvas } = vi.hoisted(() => ({
  mockEnsureHtml2Canvas: vi.fn(() => vi.fn()),
}));

vi.mock("../../src/utils/html2canvasLoader", () => ({
  __esModule: true,
  ensureHtml2Canvas: () => mockEnsureHtml2Canvas(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("StaticMode", () => {
  it("沒有 imgId 時提示缺少參數", () => {
    render(<StaticMode imagesBase="/imgs/" imgId={null} onCaptureReady={vi.fn()} />);
    expect(screen.getByText("請在網址加上 ?img=檔名")).toBeInTheDocument();
  });

  it("顯示圖片並使用 query 的 img_base 覆蓋 base", () => {
    window.history.replaceState({}, "", "?img_base=/override/");
    render(<StaticMode imagesBase="/imgs/" imgId="photo.png" onCaptureReady={vi.fn()} />);
    const img = screen.getByAltText("photo.png");
    expect(img).toHaveAttribute("src", "/override/photo.png");
  });
});
