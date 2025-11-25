"""Realtime broadcaster responsible for WebSocket management and fan-out."""

from __future__ import annotations

import asyncio
import errno
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

from fastapi import WebSocket


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EventPayloadConfig:
    fields: tuple[str, ...] = ()
    merge_payload: bool = False
    include_target_in_payload: bool = False


class RealtimeBroadcaster:
    """Manage active WebSocket connections and broadcast JSON payloads."""

    EVENT_PAYLOAD_CONFIGS: dict[str, EventPayloadConfig] = {
        "sound_play": EventPayloadConfig(fields=("filename", "url")),
        "iframe_config": EventPayloadConfig(fields=("config",), include_target_in_payload=True),
        "subtitle_update": EventPayloadConfig(fields=("subtitle",), include_target_in_payload=True),
        "caption_update": EventPayloadConfig(fields=("caption",), include_target_in_payload=True),
        "remote_click": EventPayloadConfig(merge_payload=True, include_target_in_payload=True),
        "unlock_audio": EventPayloadConfig(include_target_in_payload=True),
        "video_control": EventPayloadConfig(merge_payload=True, include_target_in_payload=True),
        "client_state": EventPayloadConfig(merge_payload=True, include_target_in_payload=True),
    }

    def __init__(self, send_timeout: float = 1.0) -> None:
        self._lock = asyncio.Lock()
        self._connections: dict[WebSocket, dict[str | None]] = {}
        self._send_timeout = send_timeout

    async def add_connection(self, websocket: WebSocket) -> None:
        """Register a new WebSocket connection."""

        await websocket.accept()
        async with self._lock:
            self._connections[websocket] = {"client_id": None}

    async def register_client(self, websocket: WebSocket, client_id: Optional[str]) -> None:
        """Associate a logical client id with the WebSocket connection."""

        async with self._lock:
            info = self._connections.get(websocket)
            if info is None:
                return
            info["client_id"] = client_id

    async def remove_connection(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection from the registry."""

        async with self._lock:
            self._connections.pop(websocket, None)

    async def list_clients(self) -> list[dict]:
        """Return snapshot of registered clients with connection counts."""

        async with self._lock:
            counts: dict[str | None, int] = {}
            for info in self._connections.values():
                client_id = info.get("client_id")
                counts[client_id] = counts.get(client_id, 0) + 1

        clients: list[dict] = []
        for client_id, connection_count in counts.items():
            clients.append(
                {
                    "client_id": client_id,
                    "connections": connection_count,
                }
            )
        clients.sort(key=lambda item: (item["client_id"] is None, item["client_id"] or ""))
        return clients

    async def broadcast(self, message: dict[str, Any], target_client_id: Optional[str] = None) -> None:
        """Broadcast a JSON payload to all or targeted clients."""

        async with self._lock:
            targets = [
                ws
                for ws, info in self._connections.items()
                if target_client_id is None or info.get("client_id") == target_client_id
            ]

        if not targets:
            return

        await asyncio.gather(
            *(self._send_with_timeout(connection, message) for connection in targets),
            return_exceptions=True,
        )

    async def send_messages(self, websocket: WebSocket, messages: Iterable[dict[str, Any]]) -> None:
        """Send a collection of messages to a specific WebSocket."""

        for message in messages:
            await self._send_with_timeout(websocket, message)

    async def broadcast_sound_play(
        self,
        filename: str,
        url: str,
        target_client_id: Optional[str] = None,
    ) -> None:
        payload_data = {"filename": filename, "url": url}
        payload = self._build_payload(
            "sound_play",
            payload_data,
            target_client_id=target_client_id,
        )
        await self.broadcast(payload, target_client_id=target_client_id)

    async def broadcast_iframe_config(
        self,
        config_payload: dict,
        target_client_id: Optional[str] = None,
    ) -> None:
        payload = self._build_payload(
            "iframe_config",
            {"config": config_payload},
            target_client_id=target_client_id,
        )
        await self.broadcast(payload, target_client_id=target_client_id)

    async def broadcast_collage_config(
        self,
        config_payload: dict,
        target_client_id: Optional[str] = None,
    ) -> None:
        owner_client_id = None
        config_payload = config_payload if isinstance(config_payload, dict) else {}
        if isinstance(config_payload, dict):
            owner_candidate = config_payload.get("owner_client_id") or config_payload.get("target_client_id")
            if isinstance(owner_candidate, str):
                owner_client_id = owner_candidate
        payload_data = {
            "config": config_payload.get("config"),
            "source": config_payload.get("source"),
            "updated_at": config_payload.get("updated_at"),
        }
        payload = self._build_payload(
            "collage_config",
            payload_data,
            target_client_id=target_client_id,
            config=EventPayloadConfig(fields=("config", "source", "updated_at"), include_target_in_payload=True),
        )
        if owner_client_id:
            payload["owner_client_id"] = owner_client_id
        await self.broadcast(payload, target_client_id=target_client_id)

    async def broadcast_subtitle(
        self,
        subtitle_payload: Optional[dict],
        target_client_id: Optional[str] = None,
    ) -> None:
        payload = self._build_payload(
            "subtitle_update",
            {"subtitle": subtitle_payload},
            target_client_id=target_client_id,
        )
        await self.broadcast(payload, target_client_id=target_client_id)

    async def broadcast_caption(
        self,
        caption_payload: Optional[dict],
        target_client_id: Optional[str] = None,
    ) -> None:
        payload = self._build_payload(
            "caption_update",
            {"caption": caption_payload},
            target_client_id=target_client_id,
        )
        await self.broadcast(payload, target_client_id=target_client_id)

    async def broadcast_remote_click(
        self,
        click_payload: dict[str, Any],
        target_client_id: Optional[str] = None,
    ) -> None:
        payload = self._build_payload(
            "remote_click",
            click_payload,
            target_client_id=target_client_id,
        )
        await self.broadcast(payload, target_client_id=target_client_id)

    async def broadcast_unlock_audio(self, target_client_id: Optional[str] = None) -> None:
        payload = self._build_payload(
            "unlock_audio",
            None,
            target_client_id=target_client_id,
        )
        await self.broadcast(payload, target_client_id=target_client_id)

    async def broadcast_video_control(
        self,
        control_payload: dict[str, Any],
        target_client_id: Optional[str] = None,
    ) -> None:
        payload = self._build_payload(
            "video_control",
            control_payload,
            target_client_id=target_client_id,
        )
        await self.broadcast(payload, target_client_id=target_client_id)

    async def broadcast_client_state(
        self,
        payload: dict[str, Any],
        target_client_id: Optional[str] = None,
    ) -> None:
        message = self._build_payload(
            "client_state",
            payload,
            target_client_id=target_client_id,
            config=EventPayloadConfig(merge_payload=True, include_target_in_payload=True),
        )
        await self.broadcast(message, target_client_id=target_client_id)

    async def broadcast_timeline_control(
        self,
        action: str,
        timeline_id: Optional[str],
        target_client_id: Optional[str],
        options: Optional[dict[str, Any]] = None,
    ) -> None:
        extra_fields: dict[str, Any] = {
            "action": action,
            "issued_at": datetime.now(timezone.utc).isoformat(),
        }
        if timeline_id:
            extra_fields["timeline_id"] = timeline_id
        if options:
            extra_fields["options"] = options
        payload = self._build_payload(
            "timeline_control",
            None,
            target_client_id=target_client_id,
            config=EventPayloadConfig(include_target_in_payload=True),
            extra=extra_fields,
        )
        await self.broadcast(payload, target_client_id=target_client_id)

    def _build_payload(
        self,
        event_type: str,
        payload_data: Optional[dict[str, Any]],
        *,
        target_client_id: Optional[str] = None,
        config: Optional[EventPayloadConfig] = None,
        extra: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        cfg = config or self.EVENT_PAYLOAD_CONFIGS.get(event_type, EventPayloadConfig())
        payload: dict[str, Any] = {"type": event_type}

        if cfg.merge_payload and payload_data:
            payload.update(payload_data)

        for field in cfg.fields:
            payload[field] = payload_data.get(field) if payload_data else None

        if extra:
            payload.update(extra)

        if cfg.include_target_in_payload and target_client_id:
            payload["target_client_id"] = target_client_id

        return payload

    @staticmethod
    def _is_retryable_error(exc: Exception) -> bool:
        retryable_exceptions = (
            asyncio.TimeoutError,
            TimeoutError,
            ConnectionResetError,
            BrokenPipeError,
        )
        if isinstance(exc, retryable_exceptions):
            return True

        error_number = getattr(exc, "errno", None)
        if error_number in {errno.EAGAIN, errno.EWOULDBLOCK}:
            return True

        message = str(exc).lower()
        return any(keyword in message for keyword in ("temporar", "backpressure", "timeout"))

    async def _send(self, websocket: WebSocket, message: dict[str, Any]) -> bool:
        client_id = self._connections.get(websocket, {}).get("client_id")
        try:
            await websocket.send_json(message)
            return True
        except Exception as exc:
            retryable = self._is_retryable_error(exc)
            log_template = (
                "Retryable WebSocket send_json failure for client %s: %s"
                if retryable
                else "Non-retryable WebSocket send_json failure for client %s: %s"
            )
            log_func = logger.warning if retryable else logger.error
            log_func(log_template, client_id, exc, exc_info=exc)

            if retryable:
                await asyncio.sleep(0.1)
                try:
                    await websocket.send_json(message)
                    return True
                except Exception as retry_exc:
                    logger.error(
                        "WebSocket send_json failed after retry for client %s: %s",
                        client_id,
                        retry_exc,
                        exc_info=retry_exc,
                    )

            await self.remove_connection(websocket)
            return False

    async def _send_with_timeout(self, websocket: WebSocket, message: dict[str, Any]) -> bool:
        try:
            return await asyncio.wait_for(self._send(websocket, message), timeout=self._send_timeout)
        except asyncio.TimeoutError:
            client_id = self._connections.get(websocket, {}).get("client_id")
            logger.error("WebSocket send_json timed out for client %s", client_id)
            await self.remove_connection(websocket)
            return False

realtime_broadcaster = RealtimeBroadcaster()
