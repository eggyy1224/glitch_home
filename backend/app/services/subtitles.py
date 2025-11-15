"""Manage in-memory subtitle state for API and WebSocket delivery."""

from __future__ import annotations

from typing import Dict, Optional

from .timed_text import TimedTextManager


class SubtitleManager:
    def __init__(self) -> None:
        self._manager = TimedTextManager(
            default_duration=30.0,
            empty_error_message="subtitle text cannot be empty",
        )

    async def set_subtitle(
        self,
        text: str,
        *,
        language: Optional[str] = None,
        duration_seconds: Optional[float] = None,
        target_client_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return await self._manager.set_text(
            text,
            language=language,
            duration_seconds=duration_seconds,
            target_client_id=target_client_id,
        )

    async def clear_subtitle(self, target_client_id: Optional[str] = None) -> None:
        await self._manager.clear_text(target_client_id)

    async def get_subtitle(self, client_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        return await self._manager.get_text(client_id)


subtitle_manager = SubtitleManager()
