import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import IframeMode from "../../src/IframeMode.jsx";

const ensureHtml2CanvasMock = vi.fn();

vi.mock("../../src/utils/html2canvasLoader.js", () => ({
  __esModule: true,
  ensureHtml2Canvas: () => ensureHtml2CanvasMock(),
}));

describe("IframeMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("沒有面板時顯示提示並提供截圖回呼", () => {
    const onCaptureReady = vi.fn();
    render(<IframeMode config={{ panels: [] }} controlsEnabled={false} onApplyConfig={vi.fn()} onCaptureReady={onCaptureReady} />);

    expect(screen.getByText("尚未設定任何 iframe 來源。")).toBeInTheDocument();
    expect(onCaptureReady).toHaveBeenCalledWith(expect.any(Function));
  });

  it("可顯示 iframe 並開啟控制面板提交設定", () => {
    const onApplyConfig = vi.fn();
    render(
      <IframeMode
        controlsEnabled
        onApplyConfig={onApplyConfig}
        config={{ layout: "grid", columns: 2, panels: [{ id: "p1", src: "https://example.com", label: "範例" }] }}
      />,
    );

    expect(screen.getByTitle("範例")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "r", ctrlKey: true });
    fireEvent.click(screen.getByRole("button", { name: "套用設定" }));

    expect(onApplyConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        panels: expect.arrayContaining([expect.objectContaining({ src: "https://example.com" })]),
      }),
    );
  });
});
