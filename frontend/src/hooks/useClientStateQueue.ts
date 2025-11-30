import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelClientQueueItems,
  delayClientQueueItems,
  enqueueClientQueueItem,
  fetchClientQueue,
  fetchClientStates,
  moveClientQueueItems,
  stopIframeTimeline,
} from "../api";
import type { ClientQueueItem, ClientState } from "../types/client";
import { useControlSocket } from "./useControlSocket";

const POLL_INTERVAL_MS = 8000;

type EnqueuePayload = Partial<ClientQueueItem> & { type: string; target_id?: string | null; client_id?: string | null };

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

function normalizeClients(clients: unknown): ClientState[] {
  if (!Array.isArray(clients)) return [];
  return clients
    .map((item) => ({
      client_id: item?.client_id ?? "",
      status: item?.status ?? "offline",
      last_heartbeat: item?.last_heartbeat ?? null,
      current_item: item?.current_item ?? null,
      last_completed_item: item?.last_completed_item ?? null,
      queue_size: item?.queue_size ?? 0,
      errors: Array.isArray(item?.errors) ? item.errors : [],
    }))
    .sort((a, b) => String(a.client_id || "").localeCompare(String(b.client_id || "")));
}

export function useClientStateQueue(defaultClientId?: string) {
  const [clients, setClients] = useState<ClientState[]>([]);
  const [selectedClient, setSelectedClient] = useState(defaultClientId || "");
  const selectedClientRef = useRef(defaultClientId || "");
  const [queueItems, setQueueItems] = useState<ClientQueueItem[]>([]);
  const [loadingState, setLoadingState] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [message, setMessage] = useState("");

  const refreshStates = useCallback(async () => {
    setLoadingState(true);
    try {
      const data = await fetchClientStates();
      setClients(normalizeClients(data));
    } catch (err) {
      setMessage(toErrorMessage(err, "載入 client 狀態失敗"));
    } finally {
      setLoadingState(false);
    }
  }, []);

  const refreshQueue = useCallback(
    async (clientOverride?: string, { silent = false }: { silent?: boolean } = {}) => {
      const client = clientOverride ?? selectedClient;
      if (!client) return;
      if (!silent) setLoadingQueue(true);
      try {
        const data = await fetchClientQueue(client);
        setQueueItems(Array.isArray(data?.items) ? data.items : []);
      } catch (err) {
        setMessage(toErrorMessage(err, "載入佇列失敗"));
      } finally {
        if (!silent) setLoadingQueue(false);
      }
    },
    [selectedClient],
  );

  const handleClientStateEvent = useCallback((payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const eventPayload = payload as { client_id?: string; state?: ClientState; queue?: ClientQueueItem[] };
    const clientId = eventPayload.client_id || eventPayload.state?.client_id;
    if (!clientId) return;
    const nextState = eventPayload.state || (payload as ClientState);
    setClients((prev) => {
      const filtered = prev.filter((item) => item.client_id !== clientId);
      const merged = normalizeClients([nextState, ...filtered]);
      return merged;
    });
    if (selectedClientRef.current && selectedClientRef.current === clientId && Array.isArray(eventPayload.queue)) {
      setQueueItems(eventPayload.queue);
    }
  }, []);

  useControlSocket({
    clientId: null,
    onClientState: handleClientStateEvent,
  });

  useEffect(() => {
    refreshStates();
  }, [refreshStates]);

  useEffect(() => {
    selectedClientRef.current = selectedClient;
    if (selectedClient) {
      refreshQueue(selectedClient);
    }
  }, [refreshQueue, selectedClient]);

  useEffect(() => {
    const timer = setInterval(() => {
      refreshStates();
      if (selectedClient) {
        refreshQueue(selectedClient, { silent: true });
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refreshQueue, refreshStates, selectedClient]);

  const enqueueItem = useCallback(
    async (payload: EnqueuePayload) => {
      const clientId = payload.client_id || selectedClient;
      if (!clientId) throw new Error("client_id 必填");
      const body: Record<string, any> = {
        client_id: clientId,
        type: payload.type,
        target_id: payload.target_id,
      };
      if (payload.priority !== undefined && payload.priority !== null) body.priority = Number(payload.priority);
      if (payload.retries !== undefined && payload.retries !== null) body.retries = Number(payload.retries);
      if (payload.eta !== undefined && payload.eta !== null) body.eta = payload.eta;
      if (payload.payload) body.payload = payload.payload;
      const result = await enqueueClientQueueItem(body);
      setMessage(`已送出佇列：${result?.item?.type || payload.type} → ${clientId}`);
      await refreshQueue(clientId);
      await refreshStates();
      return result;
    },
    [refreshQueue, refreshStates, selectedClient],
  );

  const cancelItems = useCallback(
    async (ids: string | string[]) => {
      await cancelClientQueueItems(ids);
      await refreshQueue();
      await refreshStates();
      setMessage("已取消指定項目");
    },
    [refreshQueue, refreshStates],
  );

  const delayItems = useCallback(
    async (ids: string | string[], deltaSeconds?: number) => {
      await delayClientQueueItems(ids, { deltaSeconds: deltaSeconds ?? null });
      await refreshQueue();
      await refreshStates();
      setMessage("已延後指定項目");
    },
    [refreshQueue, refreshStates],
  );

  const moveItems = useCallback(
    async (ids: string | string[], position?: number | string) => {
      await moveClientQueueItems(ids, { position: position ?? null });
      await refreshQueue();
      await refreshStates();
      setMessage("已重新排序指定項目");
    },
    [refreshQueue, refreshStates],
  );

  const forceStopItem = useCallback(
    async (item: ClientQueueItem | null | undefined) => {
      if (!item) return;
      if (item.type === "timeline") {
        await stopIframeTimeline(item.client_id || null, item.target_id);
      } else if (item.type === "episode") {
        await stopIframeTimeline(item.client_id || null, null);
      }
      await cancelClientQueueItems([item.id]);
      await refreshQueue();
      await refreshStates();
      setMessage("已送出強制停止");
    },
    [refreshQueue, refreshStates],
  );

  const currentClientState = useMemo(() => clients.find((c) => c.client_id === selectedClient) || null, [clients, selectedClient]);

  return {
    clients,
    selectedClient,
    setSelectedClient,
    queueItems,
    loadingState,
    loadingQueue,
    message,
    enqueueItem,
    cancelItems,
    delayItems,
    moveItems,
    forceStopItem,
    refreshStates,
    refreshQueue,
    currentClientState,
  };
}
