"""In-memory coordination for screenshot capture requests via WebSocket."""

from __future__ import annotations

import asyncio
import secrets
from datetime import datetime
from typing import Any, Dict, List

from fastapi import WebSocket


def _utc_timestamp() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


class ScreenshotRequestManager:
    """Track screenshot requests and notify connected clients."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._requests: Dict[str, Dict[str, Any]] = {}
        self._connections: set[WebSocket] = set()

    async def create_request(self, metadata: Dict[str, Any] | None = None) -> Dict[str, Any]:
        request_id = secrets.token_hex(8)
        now = _utc_timestamp()
        record = {
            "id": request_id,
            "status": "pending",
            "created_at": now,
            "updated_at": now,
            "metadata": metadata or {},
            "result": None,
            "error": None,
        }
        async with self._lock:
            self._requests[request_id] = record

        await self._broadcast(
            {
                "type": "screenshot_request",
                "request_id": request_id,
                "metadata": metadata or {},
            }
        )
        return dict(record)

    async def mark_completed(self, request_id: str, result: Dict[str, Any]) -> Dict[str, Any] | None:
        async with self._lock:
            record = self._requests.get(request_id)
            if record is None:
                return None
            record["status"] = "completed"
            record["result"] = result
            record["error"] = None
            record["updated_at"] = _utc_timestamp()
            snapshot = dict(record)

        await self._broadcast({"type": "screenshot_completed", "request_id": request_id})
        return snapshot

    async def mark_failed(self, request_id: str, message: str) -> Dict[str, Any] | None:
        async with self._lock:
            record = self._requests.get(request_id)
            if record is None:
                return None
            record["status"] = "failed"
            record["error"] = message
            record["updated_at"] = _utc_timestamp()
            snapshot = dict(record)

        await self._broadcast({"type": "screenshot_failed", "request_id": request_id, "error": message})
        return snapshot

    async def get_request(self, request_id: str) -> Dict[str, Any] | None:
        async with self._lock:
            record = self._requests.get(request_id)
            if record is None:
                return None
            return dict(record)

    async def list_pending_messages(self) -> List[Dict[str, Any]]:
        async with self._lock:
            pending = [dict(rec) for rec in self._requests.values() if rec.get("status") == "pending"]
        return [
            {
                "type": "screenshot_request",
                "request_id": rec["id"],
                "metadata": rec.get("metadata", {}),
            }
            for rec in pending
        ]

    async def add_connection(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

        # Send any pending requests so a reconnecting client can catch up.
        pending_messages = await self.list_pending_messages()
        for message in pending_messages:
            await self._send(websocket, message)

    async def remove_connection(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def _broadcast(self, message: Dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._connections)
        for connection in targets:
            await self._send(connection, message)

    async def _send(self, websocket: WebSocket, message: Dict[str, Any]) -> None:
        try:
            await websocket.send_json(message)
        except Exception:
            await self.remove_connection(websocket)


screenshot_requests_manager = ScreenshotRequestManager()
