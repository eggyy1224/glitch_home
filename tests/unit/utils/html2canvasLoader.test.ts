import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

const loaderPath = "../../../frontend/src/utils/html2canvasLoader";

describe("html2canvasLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
    // restore globals touched by tests
    (globalThis as typeof globalThis & { html2canvas?: unknown }).html2canvas = undefined;
  });

  it("在沒有 window 的環境會拒絕", async () => {
    vi.resetModules();
    const originalWindow = globalThis.window;
    // @ts-expect-error purposely unset
    delete (globalThis as { window?: unknown }).window;
    const { ensureHtml2Canvas } = await import(loaderPath);

    await expect(ensureHtml2Canvas()).rejects.toThrow("瀏覽器環境才支援截圖");
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  it("已有全域 html2canvas 時直接重用並共用 promise", async () => {
    vi.resetModules();
    const html2canvasMock = vi.fn();
    (window as typeof window & { html2canvas?: unknown }).html2canvas = html2canvasMock;
    const createSpy = vi.spyOn(document, "createElement");
    const { ensureHtml2Canvas } = await import(loaderPath);

    const resultA = await ensureHtml2Canvas();
    const resultB = await ensureHtml2Canvas();

    expect(resultA).toBe(html2canvasMock);
    expect(resultB).toBe(html2canvasMock);
    expect(createSpy).not.toHaveBeenCalled();
    createSpy.mockRestore();
  });

  it("模組沒有預設匯出時會 fallback 到 CDN 並成功解析", async () => {
    vi.resetModules();
    vi.doMock("html2canvas", () => ({ default: undefined }));
    const html2canvasMock = vi.fn();
    const appendSpy = vi.spyOn(document.head, "appendChild").mockImplementation((script: any) => {
      (window as typeof window & { html2canvas?: unknown }).html2canvas = html2canvasMock;
      script.onload?.();
      return script;
    });
    const { ensureHtml2Canvas } = await import(loaderPath);

    const result = await ensureHtml2Canvas();

    expect(result).toBe(html2canvasMock);
    expect(appendSpy).toHaveBeenCalled();
    appendSpy.mockRestore();
  });

  it("CDN 失敗會重置快取，後續仍可重試", async () => {
    vi.resetModules();
    vi.doMock("html2canvas", () => ({ default: undefined }));
    const html2canvasMock = vi.fn();
    let attempt = 0;
    const appendSpy = vi.spyOn(document.head, "appendChild").mockImplementation((script: any) => {
      attempt += 1;
      if (attempt === 1) {
        script.onerror?.(new Error("cdn fail"));
      } else {
        (window as typeof window & { html2canvas?: unknown }).html2canvas = html2canvasMock;
        script.onload?.();
      }
      return script;
    });
    const { ensureHtml2Canvas } = await import(loaderPath);

    await expect(ensureHtml2Canvas()).rejects.toThrow();
    const retryResult = await ensureHtml2Canvas();

    expect(retryResult).toBe(html2canvasMock);
    expect(appendSpy).toHaveBeenCalledTimes(2);
    appendSpy.mockRestore();
  });
});
