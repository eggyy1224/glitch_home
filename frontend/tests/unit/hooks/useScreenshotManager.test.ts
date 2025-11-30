// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScreenshotManager } from "../../../src/hooks/useScreenshotManager";
import { uploadScreenshot, reportScreenshotFailure } from "../../../src/api";

vi.mock("../../../src/api", () => ({
  uploadScreenshot: vi.fn(),
  reportScreenshotFailure: vi.fn(),
}));

const createManager = (clientId = "client-a", options) =>
  renderHook(() => useScreenshotManager(clientId, options));

describe("useScreenshotManager", () => {
  let originalActEnv;
  beforeAll(() => {
    originalActEnv = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalActEnv;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    uploadScreenshot.mockResolvedValue({ filename: "capture.png" });
    reportScreenshotFailure.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("要求截圖函式未就緒時 requestCapture 會拋錯", async () => {
    const { result } = createManager();
    await expect(result.current.requestCapture()).rejects.toThrow("場景尚未準備好");
  });

  it("手動截圖成功會呼叫 upload 並顯示訊息", async () => {
    const capture = vi.fn(() => Promise.resolve(new Blob()));
    const { result } = createManager();

    act(() => {
      result.current.handleCaptureReady(capture);
    });

    await act(async () => {
      await result.current.requestCapture();
    });

    expect(uploadScreenshot).toHaveBeenCalled();
    expect(result.current.screenshotMessage).toContain("截圖完成");

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(result.current.screenshotMessage).toBeNull();
  });

  it("排隊截圖會自動處理請求並在失敗時回報", async () => {
    uploadScreenshot.mockRejectedValueOnce(new Error("oops"));
    const capture = vi.fn(() => Promise.resolve(new Blob()));
    const { result } = createManager("client-auto");

    act(() => {
      result.current.handleCaptureReady(capture);
    });

    act(() => {
      result.current.enqueueScreenshotRequest({
        request_id: "auto-1",
        metadata: { label: "自動" },
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isCapturing).toBe(false);
    expect(reportScreenshotFailure).toHaveBeenCalledWith("auto-1", "oops", "client-auto");
    expect(result.current.screenshotMessage).toContain("自動截圖失敗");
  });

  it("在無寫入權限時會立即回報失敗並忽略佇列", async () => {
    const { result } = createManager("client-readonly", {
      canWriteAssets: false,
      forbidMessage: "禁止寫入",
    });

    await act(async () => {
      result.current.enqueueScreenshotRequest({
        request_id: "blocked-1",
        metadata: { label: "blocked" },
      });
      await Promise.resolve();
    });

    expect(uploadScreenshot).not.toHaveBeenCalled();
    expect(reportScreenshotFailure).toHaveBeenCalledWith("blocked-1", "禁止寫入", "client-readonly");
    expect(result.current.screenshotMessage).toContain("禁止寫入");
  });

  it("不同 clientId 的請求會被忽略", async () => {
    const { result } = createManager("client-target");

    await act(async () => {
      result.current.enqueueScreenshotRequest({ request_id: "skip", target_client_id: "other" });
    });
    expect(result.current.screenshotMessage).toBeNull();
    expect(uploadScreenshot).not.toHaveBeenCalled();
  });

  it("handleCaptureReady(null) 不會觸發截圖", () => {
    const { result } = createManager();
    const processSpy = vi.spyOn(result.current, "enqueueScreenshotRequest");
    act(() => {
      result.current.handleCaptureReady(null);
    });
    expect(processSpy).not.toHaveBeenCalled();
  });
});
