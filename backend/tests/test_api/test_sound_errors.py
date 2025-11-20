"""Error-path coverage for sound-related APIs."""

from __future__ import annotations

from fastapi import HTTPException
from unittest.mock import patch


@patch("app.api.sound.synthesize_tts_audio", side_effect=HTTPException(status_code=400, detail="bad payload"))
def test_tts_generate_http_exception_passthrough(mock_tts, client):
    resp = client.post("/api/tts", json={"text": "hello"})

    assert resp.status_code == 400
    assert resp.json()["detail"] == "bad payload"


def test_sound_play_missing_file_returns_404(client):
    resp = client.post("/api/sound-play", json={"filename": "missing.mp3"})

    assert resp.status_code == 404
    assert "sound file not found" in resp.json()["detail"]


@patch("app.api.sound.synthesize_tts_audio", side_effect=HTTPException(status_code=500, detail="boom"))
def test_tts_generate_http_exception_500(mock_tts, client):
    resp = client.post("/api/tts", json={"text": "hello"})

    assert resp.status_code == 500
    assert "boom" in resp.json()["detail"]
