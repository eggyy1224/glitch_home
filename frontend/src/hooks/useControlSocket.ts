import { useEffect, useRef } from "react";

interface ControlSocketOptions {
  clientId: string | null;
  onScreenshotRequest?: (payload: Record<string, unknown>) => void;
  onScreenshotLifecycle?: (payload: Record<string, unknown>) => void;
  onSoundPlay?: (payload: Record<string, unknown>) => void;
  onSubtitleUpdate?: (payload: Record<string, unknown>) => void;
  onCaptionUpdate?: (payload: Record<string, unknown>) => void;
  onIframeConfig?: (payload: Record<string, unknown>) => void;
  onCollageConfig?: (payload: Record<string, unknown>) => void;
  onUnlockAudio?: (payload: Record<string, unknown>) => void;
  onRemoteClick?: (payload: Record<string, unknown>) => void;
  onVideoControl?: (payload: Record<string, unknown>) => void;
  onTimelineControl?: (payload: Record<string, unknown>) => void;
  onClientState?: (payload: Record<string, unknown>) => void;
}

export function useControlSocket({
  clientId,
  onScreenshotRequest,
  onScreenshotLifecycle,
  onSoundPlay,
  onSubtitleUpdate,
  onCaptionUpdate,
  onIframeConfig,
  onCollageConfig,
  onUnlockAudio,
  onRemoteClick,
  onVideoControl,
  onTimelineControl,
  onClientState,
}: ControlSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function cleanupSocket() {
      const existing = wsRef.current;
      if (existing) {
        try {
          existing.close();
        } catch (err) {
          // ignore close error
        }
      }
      wsRef.current = null;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    }

    function scheduleReconnect() {
      if (!active || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connect();
      }, 2000);
    }

    function connect() {
      if (!active) return;
      let base = import.meta.env.VITE_API_BASE as string | undefined;
      if (!base) {
        base = window.location.origin;
      }
      base = base.replace(/\/$/, "");
      const wsUrl = `${base.replace(/^http/, "ws")}/ws/screenshots`;

      let socket: WebSocket;
      try {
        socket = new WebSocket(wsUrl);
      } catch (err) {
        console.error("WebSocket 連線失敗", err);
        scheduleReconnect();
        return;
      }

      wsRef.current = socket;

      socket.onopen = () => {
        if (!active) return;
        const hello = {
          type: "hello",
          client_id: clientId,
        };
        try {
          socket.send(JSON.stringify(hello));
        } catch (err) {
          console.error("WebSocket hello 發送失敗", err);
        }

        // keep-alive for status: only when clientId is present
        if (clientId && !heartbeatRef.current) {
          heartbeatRef.current = setInterval(() => {
            const live = wsRef.current;
            if (!live || live.readyState !== WebSocket.OPEN) return;
            try {
              live.send(JSON.stringify({ type: "heartbeat", client_id: clientId }));
            } catch (err) {
              // ignore send error; reconnect logic will handle
            }
          }, 5000);
        }
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        if (!active) return;
        let payload: Record<string, unknown> | null = null;
        try {
          payload = JSON.parse(event.data);
        } catch (err) {
          return;
        }
        if (!payload || typeof payload !== "object") return;
        const type = (payload as { type?: unknown }).type;

        if (type === "screenshot_request") {
          onScreenshotRequest?.(payload);
        } else if (type === "screenshot_completed" || type === "screenshot_failed") {
          onScreenshotLifecycle?.(payload);
        } else if (type === "sound_play") {
          onSoundPlay?.(payload);
        } else if (type === "subtitle_update") {
          onSubtitleUpdate?.(payload);
        } else if (type === "caption_update") {
          onCaptionUpdate?.(payload);
        } else if (type === "iframe_config" && (payload as { config?: unknown }).config) {
          onIframeConfig?.(payload);
        } else if (type === "collage_config" && (payload as { config?: unknown }).config) {
          onCollageConfig?.(payload);
        } else if (type === "unlock_audio") {
          onUnlockAudio?.(payload);
        } else if (type === "remote_click") {
          onRemoteClick?.(payload);
        } else if (type === "video_control") {
          onVideoControl?.(payload);
        } else if (type === "timeline_control") {
          onTimelineControl?.(payload);
        } else if (type === "client_state") {
          onClientState?.(payload);
        }
      };

      socket.onclose = () => {
        if (!active) return;
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
        scheduleReconnect();
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    connect();

    return () => {
      active = false;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      cleanupSocket();
    };
  }, [
    clientId,
    onScreenshotRequest,
    onScreenshotLifecycle,
    onSoundPlay,
    onSubtitleUpdate,
    onCaptionUpdate,
    onIframeConfig,
    onCollageConfig,
    onUnlockAudio,
    onRemoteClick,
    onVideoControl,
    onTimelineControl,
    onClientState,
  ]);
}
