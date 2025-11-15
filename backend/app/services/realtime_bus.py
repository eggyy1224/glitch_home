"""Realtime broadcaster responsible for WebSocket management and fan-out."""

from __future__ import annotations

import asyncio
from typing import Any, Iterable, Optional

from fastapi import WebSocket


class RealtimeBroadcaster:
    """Manage active WebSocket connections and broadcast JSON payloads."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._connections: dict[WebSocket, dict[str | None]] = {}

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
        for connection in targets:
            await self._send(connection, message)

    async def send_messages(self, websocket: WebSocket, messages: Iterable[dict[str, Any]]) -> None:
        """Send a collection of messages to a specific WebSocket."""

        for message in messages:
            await self._send(websocket, message)

    async def broadcast_sound_play(
        self,
        filename: str,
        url: str,
        target_client_id: Optional[str] = None,
    ) -> None:
        payload = {
            "type": "sound_play",
            "filename": filename,
            "url": url,
        }
        await self.broadcast(payload, target_client_id=target_client_id)

    async def broadcast_iframe_config(
        self,
        config_payload: dict,
        target_client_id: Optional[str] = None,
    ) -> None:
        payload = {
            "type": "iframe_config",
            "config": config_payload,
        }
        if target_client_id:
            payload["target_client_id"] = target_client_id
        await self.broadcast(payload, target_client_id=target_client_id)

    async def broadcast_collage_config(
        self,
        config_payload: dict,
        target_client_id: Optional[str] = None,
    ) -> None:
        owner_client_id = None
        if isinstance(config_payload, dict):
            owner_candidate = config_payload.get("owner_client_id") or config_payload.get("target_client_id")
            if isinstance(owner_candidate, str):
                owner_client_id = owner_candidate
        payload = {
            "type": "collage_config",
            "config": config_payload.get("config") if isinstance(config_payload, dict) else None,
            "source": config_payload.get("source") if isinstance(config_payload, dict) else None,
            "updated_at": config_payload.get("updated_at") if isinstance(config_payload, dict) else None,
        }
        if owner_client_id:
            payload["owner_client_id"] = owner_client_id
        if target_client_id:
            payload["target_client_id"] = target_client_id
        await self.broadcast(payload, target_client_id=target_client_id)

    async def broadcast_subtitle(
        self,
        subtitle_payload: Optional[dict],
        target_client_id: Optional[str] = None,
    ) -> None:
        payload = {
            "type": "subtitle_update",
            "subtitle": subtitle_payload,
        }
        if target_client_id:
            payload["target_client_id"] = target_client_id
        await self.broadcast(payload, target_client_id=target_client_id)

    async def broadcast_caption(
        self,
        caption_payload: Optional[dict],
        target_client_id: Optional[str] = None,
    ) -> None:
        payload = {
            "type": "caption_update",
            "caption": caption_payload,
        }
        if target_client_id:
            payload["target_client_id"] = target_client_id
        await self.broadcast(payload, target_client_id=target_client_id)

    async def _send(self, websocket: WebSocket, message: dict[str, Any]) -> None:
        try:
            await websocket.send_json(message)
        except Exception:
            await self.remove_connection(websocket)

realtime_broadcaster = RealtimeBroadcaster()
