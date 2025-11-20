"""Focused tests for sound-related endpoints."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.config import settings


@pytest.fixture(autouse=True)
def isolate_generated_sounds(tmp_path, monkeypatch):
    root = tmp_path / "sounds"
    root.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "generated_sounds_dir", str(root))


def _create_sound(name: str = "tone.mp3") -> Path:
    path = Path(settings.generated_sounds_dir) / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"sound")
    return path


def test_sound_file_not_found(client):
    resp = client.get("/api/sound-files/missing.wav")
    assert resp.status_code == 404


def test_sound_files_listing_basic(client):
    _create_sound("tone.mp3")
    resp = client.get("/api/sound-files")

    assert resp.status_code == 200
    files = resp.json()["files"]
    assert any(f["filename"] == "tone.mp3" for f in files)


def test_sound_play_broadcasts(client, monkeypatch):
    sound = _create_sound("playme.mp3")
    mock_broadcast = AsyncMock()
    monkeypatch.setattr(
        "app.api.sound.realtime_broadcaster.broadcast_sound_play",
        mock_broadcast,
    )

    resp = client.post("/api/sound-play", json={"filename": sound.name})

    assert resp.status_code == 202
    assert resp.json()["filename"] == sound.name
    mock_broadcast.assert_awaited_once()


def test_sound_file_serving(client):
    sound = _create_sound("serve.mp3")
    resp = client.get(f"/api/sound-files/{sound.name}")

    assert resp.status_code == 200
    assert resp.content == b"sound"
