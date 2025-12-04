import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { IframeConfig } from "../../../src/types/control";

const originalEnv = { ...import.meta.env };

const defaultConfig: IframeConfig = { layout: "grid", gap: 0, columns: 2, panels: [] };

const setupLocation = (search: string) => {
  const suffix = search.startsWith("?") ? search : `?${search}`;
  window.history.replaceState(null, "", suffix);
};

describe("useIframeConfig", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    Object.assign(import.meta.env, originalEnv);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    Object.assign(import.meta.env, originalEnv);
  });

  it("skips fetch when iframe mode disabled or preview/skip flags are set", async () => {
    const { useIframeConfig } = await import("../../../src/hooks/useIframeConfig");
    setupLocation("?iframe_preview=true");
    const params = new URLSearchParams(window.location.search);

    renderHook(() =>
      useIframeConfig({
        iframeMode: false,
        clientId: "client-x",
        defaultConfig,
        initialParams: params,
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();

    renderHook(() =>
      useIframeConfig({
        iframeMode: true,
        clientId: "client-x",
        defaultConfig,
        skipServerFetch: true,
        initialParams: params,
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("updates query parameters based on persistence flag", async () => {
    const { useIframeConfig } = await import("../../../src/hooks/useIframeConfig");
    setupLocation("?iframe_panels=p1&iframe_layout=grid&iframe_mode=true&foo=1");
    const params = new URLSearchParams(window.location.search);
    const { result } = renderHook(() =>
      useIframeConfig({ iframeMode: true, clientId: "", defaultConfig, initialParams: params }),
    );

    act(() => {
      result.current.updateQueryWithIframeConfig({ layout: "vertical", gap: 1, columns: 3, panels: [] });
    });

    expect(window.location.search).toBe("?iframe_mode=true&foo=1");

    vi.resetModules();
    import.meta.env.VITE_IFRAME_PERSIST_QUERY = "true";
    const persistModule = await import("../../../src/hooks/useIframeConfig");
    setupLocation("?iframe_panels=p1&iframe_mode=true");
    const persistParams = new URLSearchParams(window.location.search);
    const { result: persistResult } = renderHook(() =>
      persistModule.useIframeConfig({
        iframeMode: true,
        clientId: "",
        defaultConfig,
        initialParams: persistParams,
      }),
    );

    act(() => {
      persistResult.current.updateQueryWithIframeConfig({
        layout: "horizontal",
        gap: 2,
        columns: 4,
        panels: [{ id: "p1", src: "http://a" }],
      });
    });

    expect(window.location.search).toContain("iframe_layout=horizontal");
    expect(window.location.search).toContain("iframe_gap=2");
    expect(window.location.search).toContain("iframe_columns=4");
    expect(window.location.search).toContain("iframe_panels=p1");
  });

  it("applies snapshots on success and resets on failure", async () => {
    const { useIframeConfig } = await import("../../../src/hooks/useIframeConfig");
    setupLocation("?iframe_mode=true");
    const params = new URLSearchParams(window.location.search);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ layout: "horizontal", panels: [{ id: "a", src: "//a" }] }), {
        status: 200,
      }),
    );

    const { result, rerender } = renderHook(
      (props: Parameters<typeof useIframeConfig>[0]) => useIframeConfig(props),
      {
        initialProps: {
          iframeMode: true,
          clientId: "client-1",
          defaultConfig,
          initialParams: params,
        },
      },
    );

    await waitFor(() => {
      expect(result.current.activeConfig.layout).toBe("horizontal");
      expect(result.current.controlsEnabled).toBe(false);
    });

    fetchMock.mockRejectedValueOnce(new Error("boom"));
    rerender({
      iframeMode: true,
      clientId: "client-2",
      defaultConfig,
      initialParams: params,
    });

    await waitFor(() => {
      expect(result.current.iframeConfigError).toBe("boom");
      expect(result.current.activeConfig.layout).toBe("horizontal");
      expect(result.current.controlsEnabled).toBe(true);
    });
  });
});
