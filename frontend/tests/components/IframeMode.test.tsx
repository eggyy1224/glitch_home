// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import IframeMode from "../../src/IframeMode";

const ensureHtml2CanvasMock = vi.fn();

vi.mock("../../src/utils/html2canvasLoader", () => ({
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

    act(() => {
      fireEvent.keyDown(window, { key: "r", ctrlKey: true });
    });
    fireEvent.click(screen.getByRole("button", { name: "套用設定" }));

    expect(onApplyConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        panels: expect.arrayContaining([expect.objectContaining({ src: "https://example.com" })]),
      }),
    );
  });

  it("控制面板缺網址時會提醒並阻止提交", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const onApplyConfig = vi.fn();
    render(
      <IframeMode
        controlsEnabled
        onApplyConfig={onApplyConfig}
        config={{ layout: "grid", columns: 1, panels: [{ id: "p1", src: "" }, { id: "p2", src: "https://ok" }] }}
      />,
    );

    act(() => {
      fireEvent.keyDown(window, { key: "r", ctrlKey: true });
    });
    const urlInput = screen.getAllByPlaceholderText("https://example.com")[0];
    fireEvent.change(urlInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "套用設定" }));

    expect(alertSpy).toHaveBeenCalled();
    expect(onApplyConfig).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("控制面板會依 config 更新面板輸入", async () => {
    const { rerender } = render(
      <IframeMode
        controlsEnabled
        onApplyConfig={vi.fn()}
        config={{ layout: "grid", columns: 1, panels: [{ id: "p1", src: "https://a" }] }}
      />,
    );

    act(() => {
      fireEvent.keyDown(window, { key: "r", ctrlKey: true });
    });
    expect(screen.getAllByPlaceholderText("https://example.com")).toHaveLength(1);

    rerender(
      <IframeMode
        controlsEnabled
        onApplyConfig={vi.fn()}
        config={{ layout: "grid", columns: 2, panels: [{ id: "p1", src: "https://a" }, { id: "p2", src: "https://b" }] }}
      />,
    );

    await waitFor(() => expect(screen.getAllByPlaceholderText("https://example.com")).toHaveLength(2));
    expect(screen.getAllByDisplayValue(/https:\/\/[ab]/)).toHaveLength(2);
  });
});
