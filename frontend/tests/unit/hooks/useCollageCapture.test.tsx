import React, { useEffect } from "react";
import { render, act, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useCollageCapture } from "../../../src/hooks/useCollageCapture";

const html2canvasMock = vi.fn();

vi.mock("../../../src/utils/html2canvasLoader", () => ({
  ensureHtml2Canvas: () => Promise.resolve(html2canvasMock),
}));

function TestComponent({
  onCaptureReady,
  withPiece = true,
  statusText,
}: {
  onCaptureReady: (fn: (() => Promise<Blob>) | null) => void;
  withPiece?: boolean;
  statusText?: string;
}) {
  const { rootRef } = useCollageCapture(onCaptureReady);

  useEffect(() => {
    if (rootRef.current) return;
  }, [rootRef]);

  return (
    <div ref={rootRef} data-testid="collage-root" style={{ width: 300, height: 200 }}>
      {withPiece ? (
        <div className="collage-piece" style={{ backgroundImage: "url(http://example.com/a.png)" }} />
      ) : (
        <div className="collage-status">{statusText}</div>
      )}
    </div>
  );
}

describe("useCollageCapture", () => {
  beforeEach(() => {
    html2canvasMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("提供可用的 capture 函式並產出 Blob", async () => {
    const toBlob = vi.fn((cb) => cb(new Blob(["ok"], { type: "image/png" })));
    html2canvasMock.mockResolvedValue({ toBlob });
    let captureFn: (() => Promise<Blob>) | null = null;

    render(<TestComponent onCaptureReady={(fn) => (captureFn = fn)} />);
    expect(captureFn).toBeTruthy();

    const blob = await captureFn!();
    expect(html2canvasMock).toHaveBeenCalled();
    expect(blob).toBeInstanceOf(Blob);
    expect(toBlob).toHaveBeenCalled();
  });

  it("當沒有碎片且顯示載入中文字時會丟出錯誤", async () => {
    html2canvasMock.mockResolvedValue({ toBlob: vi.fn() });
    let captureFn: (() => Promise<Blob>) | null = null;
    render(<TestComponent onCaptureReady={(fn) => (captureFn = fn)} withPiece={false} statusText="正在載入中" />);

    await expect(captureFn!()).rejects.toThrow(/載入中/);
  });
});
