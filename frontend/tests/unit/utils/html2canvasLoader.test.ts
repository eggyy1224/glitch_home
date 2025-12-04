import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalHtml2canvas = (window as any).html2canvas;
const importState = vi.hoisted(() => ({ fail: false }));
const html2canvasMock = vi.hoisted(() => vi.fn());

vi.mock("html2canvas", () => ({
  __esModule: true,
  get default() {
    if (importState.fail) {
      throw new Error("import fail");
    }
    return html2canvasMock;
  },
}));

describe("ensureHtml2Canvas", () => {
  beforeEach(() => {
    importState.fail = false;
    html2canvasMock.mockReset();
    vi.resetModules();
    vi.clearAllMocks();
    document.head.innerHTML = "";
    (window as any).html2canvas = undefined;
  });

  afterEach(() => {
    (window as any).html2canvas = originalHtml2canvas;
  });

  it("直接回傳已存在的 window.html2canvas", async () => {
    const preset = vi.fn();
    (window as any).html2canvas = preset;
    const { ensureHtml2Canvas } = await import("../../../src/utils/html2canvasLoader");
    const result = await ensureHtml2Canvas();
    expect(result).toBe(preset);
  });

  it("成功載入模組並共用同一個 promise", async () => {
    const { ensureHtml2Canvas } = await import("../../../src/utils/html2canvasLoader");
    const first = ensureHtml2Canvas();
    const second = ensureHtml2Canvas();
    expect(first).toBe(second);
    const resolved = await first;
    expect(resolved).toBe(html2canvasMock);
    expect((window as any).html2canvas).toBe(html2canvasMock);
  });

  it("模組載入失敗時會 fallback 到 CDN", async () => {
    importState.fail = true;
    const originalCreate = document.createElement.bind(document);
    const cdnFn = vi.fn();
    const createSpy = vi.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = originalCreate(tag);
      if (tag === "script") {
        queueMicrotask(() => {
          (window as any).html2canvas = cdnFn;
          el.dispatchEvent(new Event("load"));
        });
      }
      return el;
    });
    const { ensureHtml2Canvas } = await import("../../../src/utils/html2canvasLoader");
    const promise = ensureHtml2Canvas();
    await expect(promise).resolves.toBe(cdnFn);
    createSpy.mockRestore();
  });

  it("CDN 也失敗時會重置 promise 方便重試", async () => {
    importState.fail = true;
    const originalCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = originalCreate(tag);
      if (tag === "script") {
        queueMicrotask(() => {
          el.dispatchEvent(new Event("error"));
        });
      }
      return el;
    });
    const { ensureHtml2Canvas } = await import("../../../src/utils/html2canvasLoader");
    const first = ensureHtml2Canvas();
    await expect(first).rejects.toThrow("下載 html2canvas 失敗");

    const second = ensureHtml2Canvas();
    expect(second).not.toBe(first);
    createSpy.mockRestore();
  });
});
