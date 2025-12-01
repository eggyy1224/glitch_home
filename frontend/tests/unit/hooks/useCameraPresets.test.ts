import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCameraPresets } from "../../../src/hooks/useCameraPresets";
import type * as api from "../../../src/api";

type ApiMocks = {
  fetchCameraPresets: Mock;
  saveCameraPreset: Mock;
  deleteCameraPreset: Mock;
};

const apiMocksRef = vi.hoisted(() => ({ current: null as ApiMocks | null }));
let apiMocks: ApiMocks;

const getApiMocks = () => {
  const mocks = apiMocksRef.current;
  if (!mocks) {
    throw new Error("apiMocks not initialized");
  }
  return mocks;
};

vi.mock("../../../src/api", async () => {
  const { createMockApi } = await import("../../testUtils");
  const { mocks, factory } = createMockApi<typeof api, "fetchCameraPresets" | "saveCameraPreset" | "deleteCameraPreset">([
    "fetchCameraPresets",
    "saveCameraPreset",
    "deleteCameraPreset",
  ]);
  apiMocksRef.current = mocks;
  return { __esModule: true, ...factory() };
});

beforeEach(() => {
  apiMocks = getApiMocks();
  vi.clearAllMocks();
  apiMocks.fetchCameraPresets.mockResolvedValue([
    { name: "center", position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    { name: "a-preset", position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
  ]);
});

describe("useCameraPresets", () => {
  it("初始化時載入並預設選中心，更新 camera 資訊", async () => {
    const { result } = renderHook(() => useCameraPresets());
    await waitFor(() => expect(result.current.cameraPresets.length).toBe(2));
    expect(result.current.selectedPresetName).toBe("center");
    expect(result.current.pendingPreset?.name).toBe("center");

    act(() => {
      result.current.handleCameraUpdate({ position: { x: 1, y: 0, z: 0 }, target: { x: 0, y: 2, z: 0 } });
    });
    expect(result.current.cameraInfo).toEqual({ position: { x: 1, y: 0, z: 0 }, target: { x: 0, y: 2, z: 0 } });
  });

  it("儲存/套用/刪除預設流程", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("newCam");
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    apiMocks.saveCameraPreset.mockResolvedValue({
      name: "newCam",
      position: { x: 3, y: 0, z: 0 },
      target: { x: 0, y: 4, z: 0 },
    });
    apiMocks.deleteCameraPreset.mockResolvedValue({});

    const { result } = renderHook(() => useCameraPresets());
    await waitFor(() => expect(result.current.cameraPresets.length).toBe(2));

    act(() => {
      result.current.handleCameraUpdate({ position: { x: 3, y: 0, z: 0 }, target: { x: 0, y: 4, z: 0 } });
    });

    await act(async () => {
      await result.current.handleSavePreset();
    });
    expect(apiMocks.saveCameraPreset).toHaveBeenCalledWith({
      name: "newCam",
      position: { x: 3, y: 0, z: 0 },
      target: { x: 0, y: 4, z: 0 },
    });
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
    expect(apiMocks.deleteCameraPreset).toHaveBeenCalledWith("newCam");
    expect(result.current.cameraPresets.find((p) => p.name === "newCam")).toBeUndefined();

    promptSpy.mockRestore();
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it("handleSavePreset 沒有 cameraInfo 時提示並返回", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("ignored");
    apiMocks.fetchCameraPresets.mockResolvedValue([]);

    const { result } = renderHook(() => useCameraPresets());
    await waitFor(() => expect(result.current.cameraPresets).toEqual([]));

    await act(async () => {
      await result.current.handleSavePreset();
    });
    expect(alertSpy).toHaveBeenCalled();
    expect(apiMocks.saveCameraPreset).not.toHaveBeenCalled();

    alertSpy.mockRestore();
    promptSpy.mockRestore();
  });
});
