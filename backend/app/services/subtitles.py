"""Manage in-memory subtitle state for API and WebSocket delivery."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass
class SubtitleState:
    text: str
    language: Optional[str]
    duration_seconds: Optional[float]
    expires_at: Optional[datetime]
    updated_at: datetime

    def to_payload(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "language": self.language,
            "duration_seconds": self.duration_seconds,
            "expires_at": _to_iso(self.expires_at),
            "updated_at": _to_iso(self.updated_at),
        }


class SubtitleManager:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._state: Optional[SubtitleState] = None

    async def set_subtitle(
        self,
        text: str,
        *,
        language: Optional[str] = None,
        duration_seconds: Optional[float] = None,
    ) -> Dict[str, Any]:
        cleaned = text.strip()
        if not cleaned:
            raise ValueError("subtitle text cannot be empty")

        language_clean = None
        if isinstance(language, str):
            candidate = language.strip()
            if candidate:
                language_clean = candidate

        expires_at = None
        duration_value: Optional[float] = None
        if duration_seconds is not None:
            try:
                duration_value = float(duration_seconds)
            except (TypeError, ValueError) as exc:
                raise ValueError("duration_seconds must be a number") from exc
            if duration_value <= 0:
                duration_value = None
            else:
                expires_at = _now() + timedelta(seconds=duration_value)

        now = _now()
        async with self._lock:
            self._state = SubtitleState(
                text=cleaned,
                language=language_clean,
                duration_seconds=duration_value,
                expires_at=expires_at,
                updated_at=now,
            )
            payload = self._state.to_payload()
        return payload

    async def clear_subtitle(self) -> None:
        async with self._lock:
            self._state = None

    async def get_subtitle(self) -> Optional[Dict[str, Any]]:
        now = _now()
        async with self._lock:
            state = self._state
            if state is None:
                return None
            if state.expires_at and state.expires_at <= now:
                self._state = None
                return None
            return state.to_payload()


subtitle_manager = SubtitleManager()
