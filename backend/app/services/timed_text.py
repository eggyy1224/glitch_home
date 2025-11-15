"""Shared utilities for managing timed text states (subtitles/captions)."""

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
class TimedTextState:
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


class TimedTextManager:
    """In-memory storage for timed text with optional expiration."""

    def __init__(
        self,
        *,
        default_duration: Optional[float] = None,
        empty_error_message: str = "text cannot be empty",
    ) -> None:
        self._lock = asyncio.Lock()
        self._default_duration = default_duration
        self._empty_error_message = empty_error_message
        self._global_state: Optional[TimedTextState] = None
        self._client_states: Dict[str, Optional[TimedTextState]] = {}

    def _clean_language(self, language: Optional[str]) -> Optional[str]:
        if isinstance(language, str):
            candidate = language.strip()
            if candidate:
                return candidate
        return None

    def _compute_duration(
        self,
        duration_seconds: Optional[float],
        *,
        now: datetime,
    ) -> tuple[Optional[float], Optional[datetime]]:
        expires_at: Optional[datetime] = None
        duration_value: Optional[float] = None

        if duration_seconds is None:
            duration_value = self._default_duration
        else:
            try:
                duration_value = float(duration_seconds)
            except (TypeError, ValueError) as exc:
                raise ValueError("duration_seconds must be a number") from exc

        if duration_value is None:
            return None, None

        if duration_value <= 0:
            return None, None

        expires_at = now + timedelta(seconds=duration_value)
        return duration_value, expires_at

    async def set_text(
        self,
        text: str,
        *,
        language: Optional[str] = None,
        duration_seconds: Optional[float] = None,
        target_client_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        cleaned = text.strip()
        if not cleaned:
            raise ValueError(self._empty_error_message)

        now = _now()
        duration_value, expires_at = self._compute_duration(duration_seconds, now=now)

        new_state = TimedTextState(
            text=cleaned,
            language=self._clean_language(language),
            duration_seconds=duration_value,
            expires_at=expires_at,
            updated_at=now,
        )

        async with self._lock:
            if target_client_id:
                self._client_states[target_client_id] = new_state
            else:
                self._global_state = new_state
            return new_state.to_payload()

    async def clear_text(self, target_client_id: Optional[str] = None) -> None:
        async with self._lock:
            if target_client_id:
                if target_client_id in self._client_states:
                    self._client_states[target_client_id] = None
            else:
                self._global_state = None

    async def get_text(self, client_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        now = _now()
        async with self._lock:
            if client_id and client_id in self._client_states:
                state = self._client_states[client_id]
                if state is not None:
                    if state.expires_at and state.expires_at <= now:
                        self._client_states[client_id] = None
                        return None
                    return state.to_payload()

            state = self._global_state
            if state is None:
                return None
            if state.expires_at and state.expires_at <= now:
                self._global_state = None
                return None
            return state.to_payload()
