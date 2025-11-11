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
        self._global_state: Optional[SubtitleState] = None
        self._client_states: Dict[str, Optional[SubtitleState]] = {}

    async def set_subtitle(
        self,
        text: str,
        *,
        language: Optional[str] = None,
        duration_seconds: Optional[float] = None,
        target_client_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Set subtitle with optional duration.
        
        If duration_seconds is None (not specified), it defaults to 30 seconds
        to ensure subtitles automatically expire and don't remain on screen indefinitely.
        If duration_seconds is explicitly provided, that value is used.
        """
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
        
        # Apply default duration of 30 seconds if not specified
        if duration_seconds is None:
            duration_value = 30.0
            expires_at = _now() + timedelta(seconds=duration_value)
        else:
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
            new_state = SubtitleState(
                text=cleaned,
                language=language_clean,
                duration_seconds=duration_value,
                expires_at=expires_at,
                updated_at=now,
            )
            if target_client_id:
                self._client_states[target_client_id] = new_state
            else:
                self._global_state = new_state
            payload = new_state.to_payload()
        return payload

    async def clear_subtitle(self, target_client_id: Optional[str] = None) -> None:
        async with self._lock:
            if target_client_id:
                if target_client_id in self._client_states:
                    self._client_states[target_client_id] = None
            else:
                self._global_state = None

    async def get_subtitle(self, client_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        now = _now()
        async with self._lock:
            # 優先查找 client 特定的字幕
            if client_id and client_id in self._client_states:
                state = self._client_states[client_id]
                if state is not None:
                    if state.expires_at and state.expires_at <= now:
                        self._client_states[client_id] = None
                        return None
                    return state.to_payload()
            
            # 回落到全局字幕
            state = self._global_state
            if state is None:
                return None
            if state.expires_at and state.expires_at <= now:
                self._global_state = None
                return None
            return state.to_payload()


subtitle_manager = SubtitleManager()
