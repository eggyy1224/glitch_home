"""Tests for shared timed text managers (captions/subtitles)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Callable

import pytest

from app.services import timed_text as timed_text_module
from app.services.captions import CaptionManager
from app.services.subtitles import SubtitleManager


class FakeClock:
    def __init__(self, start: datetime) -> None:
        self._value = start

    def advance(self, seconds: float) -> None:
        self._value += timedelta(seconds=seconds)

    def __call__(self) -> datetime:
        return self._value


@pytest.mark.asyncio
async def test_subtitle_uses_default_duration(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = FakeClock(datetime(2024, 1, 1, tzinfo=timezone.utc))
    monkeypatch.setattr(timed_text_module, "_now", clock)

    manager = SubtitleManager()
    payload = await manager.set_subtitle(" 你好世界 ")

    assert payload["text"] == "你好世界"
    assert payload["duration_seconds"] == pytest.approx(30.0)
    assert payload["updated_at"] == "2024-01-01T00:00:00Z"
    assert payload["expires_at"] == "2024-01-01T00:00:30Z"


@pytest.mark.asyncio
async def test_caption_without_default_duration(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = FakeClock(datetime(2024, 5, 1, tzinfo=timezone.utc))
    monkeypatch.setattr(timed_text_module, "_now", clock)

    manager = CaptionManager()
    payload = await manager.set_caption("敘述文字")

    assert payload["text"] == "敘述文字"
    assert payload["duration_seconds"] is None
    assert payload["expires_at"] is None
    assert payload["updated_at"] == "2024-05-01T00:00:00Z"


@pytest.mark.asyncio
async def test_client_specific_state_overrides_global(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = FakeClock(datetime(2024, 6, 1, tzinfo=timezone.utc))
    monkeypatch.setattr(timed_text_module, "_now", clock)

    manager = CaptionManager()
    await manager.set_caption("Global")
    await manager.set_caption("Client", target_client_id="client-1")

    client_payload = await manager.get_caption("client-1")
    assert client_payload is not None
    assert client_payload["text"] == "Client"

    other_payload = await manager.get_caption("another")
    assert other_payload is not None
    assert other_payload["text"] == "Global"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "manager_factory,setter_name,getter_name",
    [
        (SubtitleManager, "set_subtitle", "get_subtitle"),
        (CaptionManager, "set_caption", "get_caption"),
    ],
)
async def test_expired_entries_are_cleared(
    monkeypatch: pytest.MonkeyPatch,
    manager_factory: Callable[[], object],
    setter_name: str,
    getter_name: str,
) -> None:
    clock = FakeClock(datetime(2024, 7, 1, tzinfo=timezone.utc))
    monkeypatch.setattr(timed_text_module, "_now", clock)

    manager = manager_factory()
    setter = getattr(manager, setter_name)
    getter = getattr(manager, getter_name)

    await setter("即時訊息", duration_seconds=5)

    clock.advance(6)
    assert await getter() is None
    # 再次查詢也應該保持為 None（狀態已清除）
    assert await getter() is None
