import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSlideScreenshot } from "../../../src/hooks/useSlideScreenshot.js";

describe("useSlideScreenshot", () => {
  it("registers capture callback and produces blob", async () => {
    const rootRef = { current: document.createElement("div") };
    const onCaptureReady = vi.fn();
    const fakeCanvas = {
      toBlob: (cb) => {
        cb(new Blob(["data"], { type: "image/png" }));
      },
    };
    const html2canvas = vi.fn().mockResolvedValue(fakeCanvas);
    const loader = vi.fn().mockResolvedValue(html2canvas);

    const { unmount } = renderHook(() =>
      useSlideScreenshot({ rootRef, onCaptureReady, html2canvasLoader: loader }),
    );

    await waitFor(() => expect(onCaptureReady).toHaveBeenCalledTimes(1));
    const capture = onCaptureReady.mock.calls[0][0];

    await act(async () => {
      const blob = await capture();
      expect(blob).toBeInstanceOf(Blob);
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(html2canvas).toHaveBeenCalledWith(rootRef.current, expect.any(Object));

    unmount();
    expect(onCaptureReady).toHaveBeenLastCalledWith(null);
  });
});
