"""In-memory display state manager for admin console control."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from ..models.display_state import DisplayStatePayload


def _utc_now() -> datetime:
    return datetime.now(tz=timezone.utc).replace(microsecond=0)


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat().replace("+00:00", "Z") if dt else None


@dataclass(slots=True)
class _StateRecord:
    payload: DisplayStatePayload
    updated_at: datetime
    expires_at: Optional[datetime]


class DisplayStateManager:
    """Keep track of per-client display configuration and broadcast updates."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._states: Dict[Optional[str], _StateRecord] = {}

    async def set_state(
        self,
        client_id: Optional[str],
        payload: DisplayStatePayload,
        expires_in: Optional[float] = None,
    ) -> dict[str, Any]:
        expires_at: Optional[datetime] = None
        if expires_in is not None:
            expires_at = _utc_now() + timedelta(seconds=max(0.0, expires_in))

        record = _StateRecord(payload=payload, updated_at=_utc_now(), expires_at=expires_at)
        async with self._lock:
            self._states[client_id] = record

        # 延後 import 避免循環依賴
        from .screenshot_requests import screenshot_requests_manager

        await screenshot_requests_manager.broadcast_display_state(client_id, payload.model_dump())
        return {
            "client_id": client_id,
            "state": payload,
            "updated_at": _iso(record.updated_at),
            "expires_at": _iso(record.expires_at),
        }

    async def clear_state(self, client_id: Optional[str]) -> None:
        async with self._lock:
            self._states.pop(client_id, None)

        from .screenshot_requests import screenshot_requests_manager

        await screenshot_requests_manager.broadcast_display_state(client_id, None)

    async def get_state(self, client_id: Optional[str]) -> dict[str, Any]:
        async with self._lock:
            record = self._states.get(client_id)
        if record is None:
            return {
                "client_id": client_id,
                "state": None,
                "updated_at": None,
                "expires_at": None,
            }
        if record.expires_at and record.expires_at <= _utc_now():
            # 自動移除過期狀態
            await self.clear_state(client_id)
            return {
                "client_id": client_id,
                "state": None,
                "updated_at": None,
                "expires_at": None,
            }
        return {
            "client_id": client_id,
            "state": record.payload,
            "updated_at": _iso(record.updated_at),
            "expires_at": _iso(record.expires_at),
        }

    async def list_states(self) -> dict[Optional[str], dict[str, Any]]:
        async with self._lock:
            keys = list(self._states.keys())
        result: dict[Optional[str], dict[str, Any]] = {}
        for key in keys:
            result[key] = await self.get_state(key)
        return result


display_state_manager = DisplayStateManager()

