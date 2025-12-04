import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const requestMock = vi.fn();
let appModeBackup: string | undefined;

describe("AppModeContext", () => {
  beforeEach(() => {
    requestMock.mockReset();
    vi.resetModules();
    appModeBackup = (import.meta.env as Record<string, string | undefined>).VITE_APP_MODE;
  });

  vi.mock("../../../src/utils/request", () => ({ request: requestMock }));

  afterEach(() => {
    (import.meta.env as Record<string, string | undefined>).VITE_APP_MODE = appModeBackup;
  });

  it("derives modes and capabilities per runtime caps", async () => {
    requestMock.mockResolvedValueOnce({
      app_mode: "console",
      enable_generation: false,
      enable_metadata_write: true,
      enable_asset_write: 1,
      enable_analysis_llm: 0,
      enable_index_rebuild: undefined,
    });
    const module = await import("../../../src/appMode/AppModeContext");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <module.AppModeProvider>{children}</module.AppModeProvider>
    );

    const { result } = renderHook(() => module.useAppMode(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.appMode).toBe("CONSOLE");
    expect(result.current.capabilities).toEqual({
      canGenerate: false,
      canWriteMetadata: true,
      canWriteAssets: true,
      canAnalyze: false,
      canRebuildIndex: false,
    });
    expect(result.current.forbidMessage).toContain("APP_MODE=CONSOLE");
  });

  it("uses display fallback and handles refresh errors", async () => {
    (import.meta.env as Record<string, string>).VITE_APP_MODE = "display";
    requestMock.mockRejectedValueOnce(new Error("runtime fail"));
    const module = await import("../../../src/appMode/AppModeContext");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <module.AppModeProvider>{children}</module.AppModeProvider>
    );

    const { result } = renderHook(() => module.useAppMode(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.appMode).toBe("DISPLAY");
    expect(result.current.capabilities).toEqual({
      canGenerate: false,
      canWriteMetadata: false,
      canWriteAssets: false,
      canAnalyze: false,
      canRebuildIndex: false,
    });
    expect(result.current.error).toBe("runtime fail");
    expect(result.current.forbidMessage).toContain("APP_MODE=DISPLAY");

    requestMock.mockResolvedValueOnce({ app_mode: "studio", enable_generation: true });
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.appMode).toBe("STUDIO");
    expect(result.current.capabilities.canGenerate).toBe(true);
  });
});
