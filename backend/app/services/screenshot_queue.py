"""In-memory queue tracking screenshot request state and events."""

from __future__ import annotations

import asyncio
import secrets
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from .realtime_bus import RealtimeBroadcaster, realtime_broadcaster


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class ScreenshotRequestQueue:
    """Track screenshot requests and emit lifecycle events."""

    def __init__(
        self,
        broadcaster: RealtimeBroadcaster | None = None,
        *,
        max_entries: int | None = 1000,
        max_age_seconds: int | None = 3600,
        cleanup_interval_seconds: int | None = 30,
        time_provider: Callable[[], float] | None = None,
    ) -> None:
        self._lock = asyncio.Lock()
        self._requests: Dict[str, Dict[str, Any]] = {}
        self._request_timestamps: Dict[str, float] = {}
        self._broadcaster = broadcaster
        self._max_entries = max_entries
        self._max_age_seconds = max_age_seconds
        self._cleanup_interval_seconds = cleanup_interval_seconds
        self._time_provider = time_provider or time.time
        self._last_cleanup_ts = 0.0

    def set_broadcaster(self, broadcaster: RealtimeBroadcaster | None) -> None:
        self._broadcaster = broadcaster

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
            self._touch_request_locked(request_id)
            self._maybe_cleanup_locked()

        await self._emit(
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
            self._touch_request_locked(request_id)
            self._maybe_cleanup_locked()

        await self._emit(
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
            self._touch_request_locked(request_id)
            self._maybe_cleanup_locked()

        await self._emit(
            {"type": "screenshot_failed", "request_id": request_id, "error": message},
            target_client_id=record.get("target_client_id"),
        )
        return snapshot

    async def attach_sound_effect(
        self, request_id: str, sound_result: Dict[str, Any]
    ) -> Dict[str, Any] | None:
        async with self._lock:
            record = self._requests.get(request_id)
            if record is None:
                return None
            record["sound_effect"] = sound_result
            record["updated_at"] = _utc_timestamp()
            snapshot = dict(record)
            self._touch_request_locked(request_id)
            self._maybe_cleanup_locked()

        await self._emit(
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

    async def _emit(self, message: Dict[str, Any], target_client_id: Optional[str]) -> None:
        if self._broadcaster is None:
            return
        await self._broadcaster.broadcast(message, target_client_id=target_client_id)

    def _touch_request_locked(self, request_id: str) -> None:
        self._request_timestamps[request_id] = self._time_provider()

    def _maybe_cleanup_locked(self) -> None:
        if self._max_entries is None and self._max_age_seconds is None:
            return
        now = self._time_provider()
        size_limit_exceeded = (
            self._max_entries is not None and len(self._requests) > self._max_entries
        )
        should_run = size_limit_exceeded
        if not should_run:
            if self._cleanup_interval_seconds is None:
                return
            if now - self._last_cleanup_ts < self._cleanup_interval_seconds:
                return
        self._perform_cleanup_locked(now)

    def _perform_cleanup_locked(self, now: float) -> None:
        expired_ids: List[str] = []
        if self._max_age_seconds is not None:
            cutoff = now - self._max_age_seconds
            for request_id, ts in list(self._request_timestamps.items()):
                if ts < cutoff:
                    record = self._requests.get(request_id)
                    if record is None:
                        expired_ids.append(request_id)
                        continue
                    if record.get("status") == "pending":
                        # Keep pending requests regardless of age.
                        continue
                    expired_ids.append(request_id)
        for request_id in expired_ids:
            self._remove_request_locked(request_id)

        if self._max_entries is not None and len(self._requests) > self._max_entries:
            overflow = len(self._requests) - self._max_entries
            sorted_items = sorted(
                self._request_timestamps.items(),
                key=lambda item: (self._requests.get(item[0], {}).get("status") == "pending", item[1]),
            )
            for request_id, _ in sorted_items:
                if overflow <= 0:
                    break
                self._remove_request_locked(request_id)
                overflow -= 1
        self._last_cleanup_ts = now

    def _remove_request_locked(self, request_id: str) -> None:
        self._requests.pop(request_id, None)
        self._request_timestamps.pop(request_id, None)


screenshot_request_queue = ScreenshotRequestQueue(realtime_broadcaster)
