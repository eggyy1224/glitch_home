import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StaticMode from "../../src/StaticMode";

const { mockEnsureHtml2Canvas } = vi.hoisted(() => ({
  mockEnsureHtml2Canvas: vi.fn<[], Promise<(node: HTMLElement, options?: unknown) => Promise<HTMLCanvasElement>>>(
    async () => async () => document.createElement("canvas"),
  ),
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

  it("回傳截圖函式並在卸載時清除", async () => {
    const blob = new Blob(["ok"], { type: "image/png" });
    const toBlob = vi.fn((cb: BlobCallback) => cb(blob));
    const fakeCanvas = { toBlob } as unknown as HTMLCanvasElement;
    mockEnsureHtml2Canvas.mockResolvedValueOnce(async () => fakeCanvas);
    const onCaptureReady = vi.fn();

    const { unmount } = render(
      <StaticMode imagesBase="/imgs/" imgId="keep.png" onCaptureReady={onCaptureReady} />,
    );

    await waitFor(() => expect(onCaptureReady).toHaveBeenCalledWith(expect.any(Function)));
    const capture = onCaptureReady.mock.calls[0][0] as () => Promise<Blob>;
    await expect(capture()).resolves.toEqual(blob);
    expect(mockEnsureHtml2Canvas).toHaveBeenCalled();

    unmount();
    expect(onCaptureReady).toHaveBeenCalledWith(null);
  });

  it("圖片載入失敗時可切換回 placeholder", () => {
    const onCaptureReady = vi.fn();
    const { rerender } = render(
      <StaticMode imagesBase="/imgs/" imgId="broken.png" onCaptureReady={onCaptureReady} />,
    );

    fireEvent.error(screen.getByAltText("broken.png"));

    rerender(<StaticMode imagesBase="/imgs/" imgId={null} onCaptureReady={onCaptureReady} />);
    expect(screen.getByText("請在網址加上 ?img=檔名")).toBeInTheDocument();
    expect(screen.queryByAltText("broken.png")).toBeNull();
  });
});
