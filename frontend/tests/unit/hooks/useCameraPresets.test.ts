// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCameraPresets } from "../../../src/hooks/useCameraPresets";

const {
  mockFetchCameraPresets,
  mockSaveCameraPreset,
  mockDeleteCameraPreset,
} = vi.hoisted(() => ({
  mockFetchCameraPresets: vi.fn(),
  mockSaveCameraPreset: vi.fn(),
  mockDeleteCameraPreset: vi.fn(),
}));

vi.mock("../../../src/api", () => ({
  __esModule: true,
  fetchCameraPresets: (...args) => mockFetchCameraPresets(...args),
  saveCameraPreset: (...args) => mockSaveCameraPreset(...args),
  deleteCameraPreset: (...args) => mockDeleteCameraPreset(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchCameraPresets.mockResolvedValue([
    { name: "center", position: { x: 0 }, target: { y: 0 } },
    { name: "a-preset", position: {}, target: {} },
  ]);
});

describe("useCameraPresets", () => {
  it("初始化時載入並預設選中心，更新 camera 資訊", async () => {
    const { result } = renderHook(() => useCameraPresets());
    await waitFor(() => expect(result.current.cameraPresets.length).toBe(2));
    expect(result.current.selectedPresetName).toBe("center");
    expect(result.current.pendingPreset?.name).toBe("center");

    act(() => {
      result.current.handleCameraUpdate({ position: { x: 1 }, target: { y: 2 } });
    });
    expect(result.current.cameraInfo).toEqual({ position: { x: 1 }, target: { y: 2 } });
  });

  it("儲存/套用/刪除預設流程", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("newCam");
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockSaveCameraPreset.mockResolvedValue({ name: "newCam", position: { x: 3 }, target: { y: 4 } });
    mockDeleteCameraPreset.mockResolvedValue({});

    const { result } = renderHook(() => useCameraPresets());
    await waitFor(() => expect(result.current.cameraPresets.length).toBe(2));

    act(() => {
      result.current.handleCameraUpdate({ position: { x: 3 }, target: { y: 4 } });
    });

    await act(async () => {
      await result.current.handleSavePreset();
    });
    expect(mockSaveCameraPreset).toHaveBeenCalledWith({ name: "newCam", position: { x: 3 }, target: { y: 4 } });
    expect(result.current.selectedPresetName).toBe("newCam");
    expect(result.current.cameraPresets.find((p) => p.name === "newCam")).toBeTruthy();

    act(() => {
      result.current.setSelectedPresetName("newCam");
      result.current.handleApplyPreset();
    });
    expect(result.current.pendingPreset?.name).toBe("newCam");

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    await act(async () => {
      await result.current.handleDeletePreset();
    });
    expect(mockDeleteCameraPreset).toHaveBeenCalledWith("newCam");
    expect(result.current.cameraPresets.find((p) => p.name === "newCam")).toBeUndefined();

    promptSpy.mockRestore();
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it("handleSavePreset 沒有 cameraInfo 時提示並返回", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("ignored");
    mockFetchCameraPresets.mockResolvedValue([]);

    const { result } = renderHook(() => useCameraPresets());
    await waitFor(() => expect(result.current.cameraPresets).toEqual([]));

    await act(async () => {
      await result.current.handleSavePreset();
    });
    expect(alertSpy).toHaveBeenCalled();
    expect(mockSaveCameraPreset).not.toHaveBeenCalled();

    alertSpy.mockRestore();
    promptSpy.mockRestore();
  });
});
