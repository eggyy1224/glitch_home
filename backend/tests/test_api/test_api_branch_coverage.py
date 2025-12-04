"""補齊 API 邊界條件的測試，涵蓋主要錯誤與成功分支。"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _dummy_scene(targets: int = 1, status: str = "published"):
    return SimpleNamespace(id="scene-1", version=1, status=status, targets=[None] * targets)


def _dummy_script(entries: int = 1, status: str = "published"):
    return SimpleNamespace(id="script-1", version=1, entries=[None] * entries, status=status)


def _dummy_episode(status: str = "published"):
    return SimpleNamespace(id="ep-1", version=1, status=status, tracks=[])


def _dummy_timeline(status: str = "published", client_id: str | None = None):
    return SimpleNamespace(id="tl-1", version=3, status=status, client_id=client_id)


class _ResolvedTracks:
    def __init__(self):
        self.tracks = []


class _ResolvedEntries:
    def __init__(self, count: int):
        self.entries = [None] * count


@patch("app.api.scene.load_scene_definition", side_effect=FileNotFoundError("missing scene"))
def test_scene_get_missing_returns_404(mock_loader, client):
    resp = client.get("/api/scenes/unknown")

    assert resp.status_code == 404
    assert "missing scene" in resp.json()["detail"]


@patch("app.api.scene.load_scene_definition", return_value=_dummy_scene())
@patch("app.api.scene.AudioMix.model_validate", side_effect=ValueError("bad audio"))
def test_scene_play_invalid_audio_override(mock_audio, mock_loader, client):
    resp = client.post("/api/scenes/s1/play", json={"audio_override": {"foo": "bar"}})

    assert resp.status_code == 400
    assert "bad audio" in resp.json()["detail"]


@patch("app.api.script.publish_script", side_effect=ValueError("版本不符"))
def test_script_publish_version_conflict_returns_409(mock_publish, client):
    resp = client.post("/api/scripts/s1/publish", json={})

    assert resp.status_code == 409
    assert "版本不符" in resp.json()["detail"]


@patch("app.api.script.sanitize_script_id", side_effect=ValueError("bad id"))
def test_script_stop_invalid_id(mock_sanitize, client):
    resp = client.post("/api/scripts/  /stop")

    assert resp.status_code == 400
    assert "bad id" in resp.json()["detail"]


@patch("app.api.script.load_script_definition", return_value=_dummy_script(status="draft"))
def test_script_play_disallows_draft_without_flag(mock_loader, client):
    resp = client.post("/api/scripts/s1/play")

    assert resp.status_code == 400
    assert "僅允許播放已發布" in resp.json()["detail"]


@patch("app.api.episode.load_episode_definition", side_effect=FileNotFoundError("not found"))
def test_episode_update_requires_existing_file(mock_loader, client):
    resp = client.put("/api/episodes/missing", json={"id": "missing"})

    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"]


@patch("app.api.episode.load_episode_definition", return_value=_dummy_episode(status="draft"))
def test_episode_play_rejects_unpublished_without_draft_flag(mock_loader, client):
    resp = client.post("/api/episodes/ep1/play")

    assert resp.status_code == 400
    assert "僅允許播放已發布" in resp.json()["detail"]


@patch("app.api.sound.synthesize_tts_audio", new_callable=AsyncMock, return_value={"filename": "sound.wav"})
@patch("app.api.sound.subtitle_manager.set_subtitle", new_callable=AsyncMock, side_effect=ValueError("bad subtitle"))
@patch("app.api.sound.maybe_autoplay", new_callable=AsyncMock, return_value={"status": "queued"})
def test_speak_with_subtitle_value_error(mock_auto, mock_subtitle, mock_tts, client):
    resp = client.post(
        "/api/speak-with-subtitle",
        json={
            "text": "hi",
            "subtitle_text": "hi",
            "subtitle_language": "en",
            "subtitle_duration_seconds": 1,
        },
    )

    assert resp.status_code == 201
    payload = resp.json()
    assert payload["subtitle_error"] == "bad subtitle"
    assert payload["playback"]["status"] == "queued"


@patch("app.api.timeline.load_iframe_timeline_definition", return_value=_dummy_timeline(status="draft"))
def test_timeline_play_requires_published_or_allow_draft(mock_loader, client):
    resp = client.post("/api/iframe-timelines/t1/play")

    assert resp.status_code == 400
    assert "僅允許播放已發布" in resp.json()["detail"]


@patch("app.api.timeline.sanitize_client_id", side_effect=lambda value: value)
@patch("app.api.timeline.load_iframe_timeline_definition", return_value=_dummy_timeline(client_id=None))
def test_timeline_play_requires_target_client(mock_loader, mock_sanitize, client):
    resp = client.post("/api/iframe-timelines/t1/play")

    assert resp.status_code == 400
    assert "target_client_id" in resp.json()["detail"]


