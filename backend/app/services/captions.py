"""Manage in-memory caption state for API and WebSocket delivery."""

from __future__ import annotations

from typing import Dict, Optional

from .timed_text import TimedTextManager


class CaptionManager:
    def __init__(self) -> None:
        self._manager = TimedTextManager(
            default_duration=None,
            empty_error_message="caption text cannot be empty",
        )

    async def set_caption(
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

    async def clear_caption(self, target_client_id: Optional[str] = None) -> None:
        await self._manager.clear_text(target_client_id)

    async def get_caption(self, client_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        return await self._manager.get_text(client_id)


caption_manager = CaptionManager()
