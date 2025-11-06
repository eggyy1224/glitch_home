"""In-memory coordination for screenshot capture requests via WebSocket."""

from __future__ import annotations

import asyncio
import secrets
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import WebSocket

from .display_state import display_state_manager
from .iframe_config import config_payload_for_response, load_iframe_config


def _utc_timestamp() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


class ScreenshotRequestManager:
    """Track screenshot requests and notify connected clients."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._requests: Dict[str, Dict[str, Any]] = {}
        self._connections: Dict[WebSocket, Dict[str, Any]] = {}

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

    async def broadcast_display_state(
        self,
        target_client_id: Optional[str],
        state: Optional[Dict[str, Any]],
    ) -> None:
        payload: Dict[str, Any] = {
            "type": "display_state",
            "state": state,
        }
        if target_client_id:
            payload["target_client_id"] = target_client_id
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

    async def broadcast_container_layout(
        self,
        config_payload: Dict[str, Any],
        target_client_id: Optional[str] = None,
    ) -> None:
        payload = {
            "type": "container_layout",
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

    async def broadcast_caption(
        self,
        caption_payload: Optional[Dict[str, Any]],
        target_client_id: Optional[str] = None,
    ) -> None:
        payload = {
            "type": "caption_update",
            "caption": caption_payload,
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
            self._connections[websocket] = {
                "client_id": None,
                "capabilities": [],
                "metadata": {},
                "last_seen": _utc_timestamp(),
            }

    async def register_client(
        self,
        websocket: WebSocket,
        client_id: Optional[str],
        capabilities: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        async with self._lock:
            info = self._connections.get(websocket)
            if info is None:
                return
            info["client_id"] = client_id
            info["capabilities"] = list(dict.fromkeys(capabilities or []))
            if metadata is not None:
                info["metadata"] = metadata
            info["last_seen"] = _utc_timestamp()
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

        # 連線註冊完成後，回放目前有效的 display_state：
        # 1) 先取該 client 專屬狀態
        # 2) 若無則回退到全域（client_id=None）
        # 僅針對當前連線單播，不做廣播
        try:
            display_snapshot = await display_state_manager.get_state(client_id)
            state_model = display_snapshot.get("state")
            is_client_specific = state_model is not None
            if state_model is None:
                # 回退到全域預設
                display_snapshot = await display_state_manager.get_state(None)
                state_model = display_snapshot.get("state")

            if state_model is not None:
                message: Dict[str, Any] = {
                    "type": "display_state",
                    "state": state_model.model_dump(),
                }
                # 若為 client 專屬狀態，附帶 target，避免其他 client 誤用
                if is_client_specific and client_id:
                    message["target_client_id"] = client_id
                await self._send(websocket, message)
        except Exception:
            # 保守處理：任何錯誤都不阻斷註冊流程
            pass

    async def remove_connection(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.pop(websocket, None)

    async def touch_connection(
        self,
        websocket: WebSocket,
        *,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        async with self._lock:
            info = self._connections.get(websocket)
            if info is None:
                return
            info["last_seen"] = _utc_timestamp()
            if metadata is not None:
                info["metadata"] = metadata

    async def list_clients(self) -> list[dict]:
        """Return snapshot of registered clients, capabilities, and cached states."""

        async with self._lock:
            snapshot = list(self._connections.values())

        grouped: dict[Optional[str], dict[str, Any]] = {}
        for info in snapshot:
            client_id = info.get("client_id")
            record = grouped.setdefault(
                client_id,
                {
                    "client_id": client_id,
                    "connections": 0,
                    "capabilities": set(),
                    "last_heartbeat": None,
                    "metadata_samples": [],
                },
            )
            record["connections"] += 1

            caps = info.get("capabilities") or []
            if isinstance(caps, (list, tuple, set)):
                record["capabilities"].update(str(cap) for cap in caps if cap)
            elif isinstance(caps, str) and caps:
                record["capabilities"].add(caps)

            last_seen = info.get("last_seen")
            if last_seen:
                if record["last_heartbeat"] is None or str(last_seen) > str(record["last_heartbeat"]):
                    record["last_heartbeat"] = last_seen

            metadata = info.get("metadata")
            if metadata:
                record["metadata_samples"].append(metadata)

        clients: list[dict] = []
        for client_id, record in grouped.items():
            payload: dict[str, Any] = {
                "client_id": client_id,
                "connections": record["connections"],
                "capabilities": sorted(record["capabilities"]),
                "last_heartbeat": record["last_heartbeat"],
            }
            if record["metadata_samples"]:
                payload["sample_metadata"] = record["metadata_samples"][:5]

            display_snapshot = await display_state_manager.get_state(client_id)
            state = display_snapshot.get("state")
            if state is not None:
                payload["display_state"] = {
                    "mode": state.mode,
                    "params": state.params,
                    "frames": [frame.model_dump() for frame in state.frames],
                    "updated_at": display_snapshot.get("updated_at"),
                    "expires_at": display_snapshot.get("expires_at"),
                }
            else:
                payload["display_state"] = None

            try:
                config = load_iframe_config(client_id)
                payload["container_layout"] = config_payload_for_response(config, client_id)
            except ValueError:
                payload["container_layout"] = None

            clients.append(payload)

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
