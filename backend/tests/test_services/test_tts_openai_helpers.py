"""Unit tests for TTS helper utilities."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services import tts_openai


def test_resolve_audio_extension_map_and_default():
    assert tts_openai._resolve_audio_extension("wav") == ".wav"
    # Unknown formats fall back to mp3
    assert tts_openai._resolve_audio_extension("weird") == ".mp3"
    assert tts_openai._resolve_audio_extension(None) == ".mp3"


def test_sanitize_base_filename_strips_path_and_invalid_chars():
    assert tts_openai._sanitize_base_filename("../../etc/passwd") == "passwd"
    assert tts_openai._sanitize_base_filename("weird/..") == ""
    long_name = "a" * 150
    assert len(tts_openai._sanitize_base_filename(long_name)) == 120


def test_deduplicate_filename_prevents_traversal(tmp_path):
    out_dir = tmp_path / "sounds"
    out_dir.mkdir()
    # First call uses original name
    first = tts_openai._deduplicate_filename("voice", ".mp3", out_dir)
    assert first == (out_dir / "voice.mp3")
    first.write_text("x")
    # Next call increments suffix
    second = tts_openai._deduplicate_filename("voice", ".mp3", out_dir)
    assert second.name == "voice_2.mp3"
    # Directory traversal input is normalised back into target directory
    third = tts_openai._deduplicate_filename("../voice", ".mp3", out_dir)
    assert third.parent == out_dir


def test_synthesize_speech_openai_rejects_empty_text(monkeypatch):
    monkeypatch.setattr(tts_openai.settings, "openai_api_key", "dummy")
    with pytest.raises(ValueError):
        tts_openai.synthesize_speech_openai(text="  ")
