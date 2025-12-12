import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useIframeAutoRotation } from "../../../src/hooks/useIframeAutoRotation";

const createResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

describe("useIframeAutoRotation", () => {
  let originalActEnv: boolean | undefined;
  const fetchMock = vi.fn();

  beforeAll(() => {
    const globalObj = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    originalActEnv = globalObj.IS_REACT_ACT_ENVIRONMENT;
    globalObj.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = originalActEnv;
  });

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enabled=false 時不會觸發 fetch", () => {
    const onApplyConfig = vi.fn();
    renderHook(() =>
      useIframeAutoRotation({
        enabled: false,
        clientId: "desktop",
        onApplyConfig,
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onApplyConfig).not.toHaveBeenCalled();
  });

  it("啟動後會載入清單並套用第一筆 snapshot", async () => {
    const onApplyConfig = vi.fn();
    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          client_id: "desktop",
          snapshots: [{ name: "snap-1", created_at: "t1" }],
        }),
      )
      .mockResolvedValueOnce(createResponse({ layout: "grid", gap: 0, columns: 1, panels: [] }));

    const { result } = renderHook(() =>
      useIframeAutoRotation({
        enabled: true,
        clientId: "desktop",
        intervalMs: 1_000_000,
        refreshMs: 1_000_000,
        onApplyConfig,
      }),
    );

    await waitFor(() => {
      expect(onApplyConfig).toHaveBeenCalledTimes(1);
      expect(result.current.current?.name).toBe("snap-1");
      expect(result.current.status).toBe("playing");
      expect(result.current.statusText).toBe("自動播放中");
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/iframe-config/snapshots?client=desktop", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/iframe-config/snapshots/desktop/snap-1",
      expect.any(Object),
    );
  });

  it("到時間會切換到下一筆 snapshot", async () => {
    const onApplyConfig = vi.fn();
    vi.useFakeTimers();
    try {
      fetchMock
        .mockResolvedValueOnce(
          createResponse({
            client_id: "desktop",
            snapshots: [{ name: "snap-1" }, { name: "snap-2" }],
          }),
        )
        .mockResolvedValueOnce(createResponse({ layout: "grid", gap: 0, columns: 1, panels: [] }))
        .mockResolvedValueOnce(createResponse({ layout: "vertical", gap: 0, columns: 1, panels: [] }));

      const { result } = renderHook(() =>
        useIframeAutoRotation({
          enabled: true,
          clientId: "desktop",
          intervalMs: 1000,
          refreshMs: 1_000_000,
          onApplyConfig,
        }),
      );

      for (let i = 0; i < 10; i += 1) {
        await act(async () => {
          await Promise.resolve();
        });
        if (onApplyConfig.mock.calls.length >= 1) break;
      }
      expect(onApplyConfig).toHaveBeenCalledTimes(1);
      expect(result.current.current?.name).toBe("snap-1");

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      for (let i = 0; i < 10; i += 1) {
        await act(async () => {
          await Promise.resolve();
        });
        if (onApplyConfig.mock.calls.length >= 2) break;
      }
      expect(onApplyConfig).toHaveBeenCalledTimes(2);
      expect(result.current.current?.name).toBe("snap-2");

      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "/api/iframe-config/snapshots/desktop/snap-2",
        expect.any(Object),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("client 清單為空時會 fallback 到 global", async () => {
    const onApplyConfig = vi.fn();
    fetchMock
      .mockResolvedValueOnce(createResponse({ client_id: "desktop", snapshots: [] }))
      .mockResolvedValueOnce(createResponse({ client_id: null, snapshots: [{ name: "g-1" }] }))
      .mockResolvedValueOnce(createResponse({ layout: "grid", gap: 0, columns: 1, panels: [] }));

    const { result } = renderHook(() =>
      useIframeAutoRotation({
        enabled: true,
        clientId: "desktop",
        intervalMs: 1_000_000,
        refreshMs: 1_000_000,
        onApplyConfig,
      }),
    );

    await waitFor(() => {
      expect(onApplyConfig).toHaveBeenCalledTimes(1);
      expect(result.current.current?.name).toBe("g-1");
      expect(result.current.current?.clientId).toBe("global");
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/iframe-config/snapshots?client=desktop", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/iframe-config/snapshots", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/iframe-config/snapshots/global/g-1",
      expect.any(Object),
    );
  });

  it("清單 API 失敗會進入 error 並停止播放", async () => {
    const onApplyConfig = vi.fn();
    fetchMock.mockResolvedValueOnce(createResponse({ detail: "boom" }, 500));

    const { result } = renderHook(() =>
      useIframeAutoRotation({
        enabled: true,
        clientId: "desktop",
        intervalMs: 1_000_000,
        refreshMs: 1_000_000,
        onApplyConfig,
      }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("error");
      expect(result.current.isPlaying).toBe(false);
      expect(result.current.error).toContain("HTTP 500");
    });

    expect(onApplyConfig).not.toHaveBeenCalled();
  });
});
