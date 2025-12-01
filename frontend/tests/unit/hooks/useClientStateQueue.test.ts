import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useClientStateQueue } from "../../../src/hooks/useClientStateQueue";
import type * as api from "../../../src/api";

type ApiMocks = {
  fetchClientStates: Mock;
  fetchClientQueue: Mock;
  enqueueClientQueueItem: Mock;
  cancelClientQueueItems: Mock;
  delayClientQueueItems: Mock;
  moveClientQueueItems: Mock;
  stopIframeTimeline: Mock;
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
  const { mocks, factory } = createMockApi<
    typeof api,
    | "fetchClientStates"
    | "fetchClientQueue"
    | "enqueueClientQueueItem"
    | "cancelClientQueueItems"
    | "delayClientQueueItems"
    | "moveClientQueueItems"
    | "stopIframeTimeline"
  >([
    "fetchClientStates",
    "fetchClientQueue",
    "enqueueClientQueueItem",
    "cancelClientQueueItems",
    "delayClientQueueItems",
    "moveClientQueueItems",
    "stopIframeTimeline",
  ]);
  apiMocksRef.current = mocks;
  return { __esModule: true, ...factory() };
});

let socketConfig: { onClientState?: (payload: unknown) => void } | null;
vi.mock("../../../src/hooks/useControlSocket", () => ({
  useControlSocket: vi.fn((options) => {
    socketConfig = options;
  }),
}));

describe("useClientStateQueue", () => {
  beforeEach(() => {
    apiMocks = getApiMocks();
    vi.clearAllMocks();
    socketConfig = null;
    apiMocks.fetchClientStates.mockResolvedValue([]);
    apiMocks.fetchClientQueue.mockResolvedValue({ items: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("初始化會載入並排序 client 狀態，並自動載入預設 client 的佇列", async () => {
    apiMocks.fetchClientStates.mockResolvedValue([
      { client_id: "bravo", status: "idle", queue_size: 2 },
      { client_id: "alpha", status: "online", queue_size: 1 },
    ]);
    apiMocks.fetchClientQueue.mockResolvedValue({ items: [{ id: "q1", type: "timeline" }] });

    const { result, unmount } = renderHook(() => useClientStateQueue("bravo"));

    await waitFor(() => {
      expect(result.current.clients.map((c) => c.client_id)).toEqual(["alpha", "bravo"]);
    });
    expect(result.current.selectedClient).toBe("bravo");
    await waitFor(() => {
      expect(apiMocks.fetchClientQueue).toHaveBeenCalledWith("bravo");
    });
    expect(result.current.queueItems).toEqual([{ id: "q1", type: "timeline" }]);
    expect(result.current.currentClientState?.status).toBe("idle");
    unmount();
  });

  it("支援 enqueue / delay / move / cancel / forceStop 流程並重整狀態", async () => {
    apiMocks.fetchClientStates.mockResolvedValue([{ client_id: "client-1", status: "online" }]);
    apiMocks.fetchClientQueue.mockResolvedValue({ items: [] });
    apiMocks.enqueueClientQueueItem.mockResolvedValue({ item: { type: "snapshot" } });

    const { result, unmount } = renderHook(() => useClientStateQueue("client-1"));

    await waitFor(() => {
      expect(apiMocks.fetchClientQueue).toHaveBeenCalledWith("client-1");
    });

    await act(async () => {
      await result.current.enqueueItem({
        client_id: "client-1",
        type: "snapshot",
        target_id: "snap-1",
        priority: 2,
        retries: 1,
        eta: "soon",
        payload: { foo: "bar" },
      });
    });

    expect(apiMocks.enqueueClientQueueItem).toHaveBeenCalledWith({
      client_id: "client-1",
      type: "snapshot",
      target_id: "snap-1",
      priority: 2,
      retries: 1,
      eta: "soon",
      payload: { foo: "bar" },
    });
    expect(apiMocks.fetchClientQueue).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchClientStates).toHaveBeenCalledTimes(2);

    await act(async () => {
      await result.current.delayItems(["a", "b"], 30);
      await result.current.moveItems(["a"], "front");
      await result.current.cancelItems(["b"]);
    });

    expect(apiMocks.delayClientQueueItems).toHaveBeenCalledWith(["a", "b"], { deltaSeconds: 30 });
    expect(apiMocks.moveClientQueueItems).toHaveBeenCalledWith(["a"], { position: "front" });
    expect(apiMocks.cancelClientQueueItems).toHaveBeenCalledWith(["b"]);

    await act(async () => {
      await result.current.forceStopItem({ id: "z1", type: "timeline", client_id: "client-1", target_id: "tl-9" });
    });

    expect(apiMocks.stopIframeTimeline).toHaveBeenCalledWith("client-1", "tl-9");
    expect(apiMocks.cancelClientQueueItems).toHaveBeenCalledWith(["z1"]);
    unmount();
  });

  it("收到 socket 狀態事件會更新 clients 與 queueItems", async () => {
    apiMocks.fetchClientStates.mockResolvedValue([{ client_id: "c-1", status: "offline", queue_size: 0 }]);
    apiMocks.fetchClientQueue.mockResolvedValue({ items: [] });

    const { result, unmount } = renderHook(() => useClientStateQueue("c-1"));

    await waitFor(() => {
      expect(socketConfig?.onClientState).toBeTypeOf("function");
    });

    act(() => {
      socketConfig?.onClientState?.({
        client_id: "c-1",
        status: "busy",
        queue: [{ id: "live" }],
      });
    });

    expect(result.current.clients[0].status).toBe("busy");
    expect(result.current.queueItems).toEqual([{ id: "live" }]);

    unmount();
  });
});
