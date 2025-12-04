import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { Camera, Scene, WebGLRenderer } from "three";
import { useKinshipCapture } from "../../../src/components/kinship/hooks/useKinshipCapture";

describe("useKinshipCapture", () => {
  it("registers and cleans up capture handler", () => {
    const onCaptureReady = vi.fn();
    const { unmount } = renderHook(() => useKinshipCapture(onCaptureReady));

    expect(onCaptureReady).toHaveBeenCalledTimes(1);
    expect(typeof onCaptureReady.mock.calls[0][0]).toBe("function");

    unmount();
    expect(onCaptureReady).toHaveBeenLastCalledWith(null);
  });

  it("rejects capture when renderer resources are missing", async () => {
    const onCaptureReady = vi.fn();
    renderHook(() => useKinshipCapture(onCaptureReady));
    const capture = onCaptureReady.mock.calls[0][0] as () => Promise<Blob>;

    await expect(capture()).rejects.toThrow("renderer not ready");
  });

  it("enables preserveDrawingBuffer and resolves capture", async () => {
    const onCaptureReady = vi.fn();
    const { result } = renderHook(() => useKinshipCapture(onCaptureReady));
    const capture = onCaptureReady.mock.calls[0][0] as () => Promise<Blob>;

    const render = vi.fn();
    const toBlob = vi.fn((cb: (blob: Blob | null) => void) => cb(new Blob(["ok"], { type: "image/png" })));
    const domElement = { toBlob } as unknown as HTMLCanvasElement;
    const gl = { render, domElement } as unknown as WebGLRenderer;
    const scene = { name: "scene" } as unknown as Scene;
    const camera = { name: "camera" } as unknown as Camera;

    act(() => {
      result.current.handleCreated({ gl, scene, camera });
    });

    expect((gl as WebGLRenderer & { preserveDrawingBuffer?: boolean }).preserveDrawingBuffer).toBe(true);

    const blob = await capture();
    expect(blob).toBeInstanceOf(Blob);
    expect(render).toHaveBeenCalledWith(scene, camera);
    expect(toBlob).toHaveBeenCalled();
  });
});
