"""In-memory coordination for screenshot capture requests via WebSocket."""

from __future__ import annotations

import asyncio
import secrets
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import WebSocket


def _utc_timestamp() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


class ScreenshotRequestManager:
    """Track screenshot requests and notify connected clients."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._requests: Dict[str, Dict[str, Any]] = {}
        self._connections: Dict[WebSocket, Dict[str, Optional[str]]] = {}

    async def create_request(self, metadata: Dict[str, Any] | None = None) -> Dict[str, Any]:
        request_id = secrets.token_hex(8)
        now = _utc_timestamp()
        meta_copy = dict(metadata or {})
        target_client_id: Optional[str] = None
        if "client_id" in meta_copy:
            raw_client = meta_copy.get("client_id")
            sanitized = str(raw_client).strip() if raw_client is not None else None
            if sanitized:
                target_client_id = sanitized
                meta_copy["client_id"] = sanitized
            else:
                target_client_id = None
                meta_copy.pop("client_id", None)
        record = {
            "id": request_id,
            "status": "pending",
            "created_at": now,
            "updated_at": now,
            "metadata": meta_copy,
            "result": None,
            "error": None,
            "target_client_id": target_client_id,
            "processed_by": None,
        }
        async with self._lock:
            self._requests[request_id] = record

        await self._broadcast(
            {
                "type": "screenshot_request",
                "request_id": request_id,
                "metadata": meta_copy,
                "target_client_id": target_client_id,
            },
            target_client_id=target_client_id,
        )
        return dict(record)

    async def mark_completed(
        self,
        request_id: str,
        result: Dict[str, Any],
        processed_by: Optional[str] = None,
    ) -> Dict[str, Any] | None:
        async with self._lock:
            record = self._requests.get(request_id)
            if record is None:
                return None
            record["status"] = "completed"
            record["result"] = result
            record["error"] = None
            record["updated_at"] = _utc_timestamp()
            record["processed_by"] = processed_by
            snapshot = dict(record)

        await self._broadcast(
            {"type": "screenshot_completed", "request_id": request_id},
            target_client_id=record.get("target_client_id"),
        )
        return snapshot

    async def mark_failed(
        self,
        request_id: str,
        message: str,
        processed_by: Optional[str] = None,
    ) -> Dict[str, Any] | None:
        async with self._lock:
            record = self._requests.get(request_id)
            if record is None:
                return None
            record["status"] = "failed"
            record["error"] = message
            record["updated_at"] = _utc_timestamp()
            record["processed_by"] = processed_by
            snapshot = dict(record)

        await self._broadcast(
            {"type": "screenshot_failed", "request_id": request_id, "error": message},
            target_client_id=record.get("target_client_id"),
        )
        return snapshot

    async def attach_sound_effect(self, request_id: str, sound_result: Dict[str, Any]) -> Dict[str, Any] | None:
        async with self._lock:
            record = self._requests.get(request_id)
            if record is None:
                return None
            record["sound_effect"] = sound_result
            record["updated_at"] = _utc_timestamp()
            snapshot = dict(record)

        await self._broadcast(
            {
                "type": "sound_effect_ready",
                "request_id": request_id,
                "sound": {
                    "filename": sound_result.get("filename"),
                    "relative_path": sound_result.get("relative_path"),
                    "output_format": sound_result.get("output_format"),
                },
            },
            target_client_id=record.get("target_client_id"),
        )
        return snapshot

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
        await self._broadcast(payload, target_client_id=target_client_id)

    async def broadcast_iframe_config(
        self,
        config_payload: Dict[str, Any],
        target_client_id: Optional[str] = None,
    ) -> None:
        payload = {
            "type": "iframe_config",
            "config": config_payload,
        }
        if target_client_id:
            payload["target_client_id"] = target_client_id
        await self._broadcast(payload, target_client_id=target_client_id)

    async def broadcast_subtitle(
        self,
        subtitle_payload: Optional[Dict[str, Any]],
        target_client_id: Optional[str] = None,
    ) -> None:
        payload = {
            "type": "subtitle_update",
            "subtitle": subtitle_payload,
        }
        if target_client_id:
            payload["target_client_id"] = target_client_id
        await self._broadcast(payload, target_client_id=target_client_id)

    async def get_request(self, request_id: str) -> Dict[str, Any] | None:
        async with self._lock:
            record = self._requests.get(request_id)
            if record is None:
                return None
            return dict(record)

    async def list_pending_messages(self, client_id: Optional[str] = None) -> List[Dict[str, Any]]:
        async with self._lock:
            pending = [
                dict(rec)
                for rec in self._requests.values()
                if rec.get("status") == "pending"
                and (
                    rec.get("target_client_id") is None
                    or rec.get("target_client_id") == client_id
                )
            ]
        return [
            {
                "type": "screenshot_request",
                "request_id": rec["id"],
                "metadata": rec.get("metadata", {}),
                "target_client_id": rec.get("target_client_id"),
            }
            for rec in pending
        ]

    async def add_connection(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[websocket] = {"client_id": None}

    async def register_client(self, websocket: WebSocket, client_id: Optional[str]) -> None:
        async with self._lock:
            info = self._connections.get(websocket)
            if info is None:
                return
            info["client_id"] = client_id
            pending = [
                dict(rec)
                for rec in self._requests.values()
                if rec.get("status") == "pending"
                and (
                    rec.get("target_client_id") is None
                    or rec.get("target_client_id") == client_id
                )
            ]

        for rec in pending:
            await self._send(
                websocket,
                {
                    "type": "screenshot_request",
                    "request_id": rec["id"],
                    "metadata": rec.get("metadata", {}),
                    "target_client_id": rec.get("target_client_id"),
                },
            )

    async def remove_connection(self, websocket: WebSocket) -> None:
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

    async def _broadcast(
        self,
        message: Dict[str, Any],
        target_client_id: Optional[str] = None,
    ) -> None:
        async with self._lock:
            targets = [
                ws
                for ws, info in self._connections.items()
                if target_client_id is None
                or info.get("client_id") == target_client_id
            ]
        for connection in targets:
            await self._send(connection, message)

    async def _send(self, websocket: WebSocket, message: Dict[str, Any]) -> None:
        try:
            await websocket.send_json(message)
        except Exception:
            await self.remove_connection(websocket)


screenshot_requests_manager = ScreenshotRequestManager()
