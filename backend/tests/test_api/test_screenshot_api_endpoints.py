"""Additional coverage for screenshot-related APIs."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import patch

import pytest

from app.config import settings
from app.services.screenshot_queue import screenshot_request_queue


@pytest.fixture(autouse=True)
def isolate_media_dirs(tmp_path, monkeypatch):
    screenshots = tmp_path / "screenshots"
    sounds = tmp_path / "sounds"
    screenshots.mkdir(parents=True, exist_ok=True)
    sounds.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "screenshot_dir", str(screenshots))
    monkeypatch.setattr(settings, "generated_sounds_dir", str(sounds))


def _create_image(name: str = "shot.png") -> Path:
    path = Path(settings.screenshot_dir) / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"fake")
    return path


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@patch("app.api.screenshot.analyze_screenshot", return_value={"summary": "ok"})
def test_analyze_screenshot_with_image_path(mock_analyze, client):
    image_path = _create_image("analyze.png")

    resp = client.post("/api/analyze-screenshot", json={"image_path": str(image_path)})

    assert resp.status_code == 200
    data = resp.json()
    assert data["image_path"] == str(image_path.resolve())
    assert data["analysis"] == {"summary": "ok"}
    mock_analyze.assert_called_once()


@patch("app.api.screenshot.generate_sound_effect")
def test_sound_effects_with_request_id_includes_metadata(mock_sound, client):
    image_path = _create_image("pending_sound.png")
    mock_sound.return_value = {
        "filename": "loop.mp3",
        "relative_path": "generated_sounds/loop.mp3",
        "output_format": "mp3",
    }

    async def _prepare_request():
        record = await screenshot_request_queue.create_request(metadata={"client": "web"})
        await screenshot_request_queue.mark_completed(
            record["id"],
            {"absolute_path": str(image_path)},
            processed_by="worker-1",
        )
        return record["id"]

    request_id = _run(_prepare_request())

    resp = client.post(
        "/api/sound-effects",
        json={
            "request_id": request_id,
            "prompt": "bright wind",
            "duration_seconds": 1.5,
        },
    )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["request_id"] == request_id
    assert payload["sound"]["filename"] == "loop.mp3"
    assert payload["request_metadata"]["status"] == "completed"
    assert payload["request_metadata"]["sound_effect"]["filename"] == "loop.mp3"
    mock_sound.assert_called_once()


def test_analyze_and_sound_uses_auto_prompt(client):
    image_path = _create_image("bundle.png")
    analysis = {
        "summary": "A sweeping view of the coast.",
        "segments": ["Waves crash", "birds glide"],
    }
    captured_prompt = {"prompt": None}

    with patch("app.api.screenshot.analyze_screenshot", return_value=analysis), patch(
        "app.api.screenshot.generate_sound_effect"
    ) as mock_sound:
        def _fake_sound(**kwargs):
            captured_prompt["prompt"] = kwargs.get("prompt")
            return {"filename": "scene.mp3", "relative_path": "generated_sounds/scene.mp3", "output_format": "mp3"}

        mock_sound.side_effect = _fake_sound

        resp = client.post(
            "/api/screenshot/bundle",
            json={
                "image_path": str(image_path),
                "sound_duration_seconds": 9.0,
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["analysis"] == analysis
    assert "used_prompt" in data
    assert "9.0-second" in data["used_prompt"]
    assert captured_prompt["prompt"] == data["used_prompt"]
