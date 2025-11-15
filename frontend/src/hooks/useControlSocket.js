import { useEffect, useRef } from "react";

export function useControlSocket({
  clientId,
  onScreenshotRequest,
  onScreenshotLifecycle,
  onSoundPlay,
  onSubtitleUpdate,
  onCaptionUpdate,
  onIframeConfig,
  onCollageConfig,
  enabled = true,
}) {
  const wsRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      const existing = wsRef.current;
      if (existing) {
        try {
          existing.close();
        } catch (err) {
          // ignore close error
        }
      }
      wsRef.current = null;
      return undefined;
    }

    let active = true;
    let retryTimer = null;

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
      let base = import.meta.env.VITE_API_BASE;
      if (!base) {
        base = window.location.origin;
      }
      base = base.replace(/\/$/, "");
      const wsUrl = `${base.replace(/^http/, "ws")}/ws/screenshots`;

      let socket;
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
      };

      socket.onmessage = (event) => {
        if (!active) return;
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch (err) {
          return;
        }

        if (payload?.type === "screenshot_request") {
          onScreenshotRequest?.(payload);
        } else if (payload?.type === "screenshot_completed" || payload?.type === "screenshot_failed") {
          onScreenshotLifecycle?.(payload);
        } else if (payload?.type === "sound_play") {
          onSoundPlay?.(payload);
        } else if (payload?.type === "subtitle_update") {
          onSubtitleUpdate?.(payload);
        } else if (payload?.type === "caption_update") {
          onCaptionUpdate?.(payload);
        } else if (payload?.type === "iframe_config" && payload?.config) {
          onIframeConfig?.(payload);
        } else if (payload?.type === "collage_config" && payload?.config) {
          onCollageConfig?.(payload);
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
    enabled,
    clientId,
    onScreenshotRequest,
    onScreenshotLifecycle,
    onSoundPlay,
    onSubtitleUpdate,
    onCaptionUpdate,
    onIframeConfig,
    onCollageConfig,
  ]);
}
