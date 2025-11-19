"""Tests for ElevenLabs sound effect utility."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest

from app.services import sound_effects


class DummyResponse:
    def __init__(self, content: bytes = b"audio-bytes"):
        self.content = content
        self.status_code = 200
        self.text = "ok"

    def raise_for_status(self):
        return None


class DummyClient:
    def __init__(self):
        self.requests: list[dict] = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def post(self, url, headers=None, params=None, json=None):
        self.requests.append(
            {"url": url, "headers": headers, "params": params, "json": json}
        )
        return DummyResponse()


def test_resolve_audio_extension_variants():
    assert sound_effects._resolve_audio_extension("mp3_44100_128") == ".mp3"
    assert sound_effects._resolve_audio_extension("PCM") == ".wav"
    assert sound_effects._resolve_audio_extension("opus") == ".opus"
    assert sound_effects._resolve_audio_extension("unknown") == ".mp3"


def test_deduplicate_filename_increments(tmp_path):
    base_dir = tmp_path / "sounds"
    base_dir.mkdir()
    (base_dir / "scene.mp3").write_bytes(b"1")
    path = sound_effects._deduplicate_filename("scene", ".mp3", base_dir)
    assert path.name == "scene_2.mp3"


def test_resolve_base_name_with_fallback():
    assert sound_effects._resolve_base_name("foo/bar.png") == "bar"
    assert sound_effects._resolve_base_name(Path("img.jpeg")) == "img"
    assert sound_effects._resolve_base_name("", fallback="alt") == "alt"
    assert sound_effects._resolve_base_name(123, fallback="alt2") == "alt2"
    with pytest.raises(ValueError):
        sound_effects._resolve_base_name("", fallback=None)


def test_generate_sound_effect_success(monkeypatch, tmp_path):
    sounds_dir = tmp_path / "generated_sounds"
    metadata_dir = tmp_path / "metadata"
    monkeypatch.setattr(sound_effects.settings, "generated_sounds_dir", str(sounds_dir))
    monkeypatch.setattr(sound_effects.settings, "metadata_dir", str(metadata_dir))
    monkeypatch.setattr(sound_effects.settings, "elevenlabs_api_key", "key")

    created_clients: list[DummyClient] = []

    def fake_client(*args, **kwargs):
        client = DummyClient()
        created_clients.append(client)
        return client

    monkeypatch.setattr(sound_effects.httpx, "Client", fake_client)

    payload = sound_effects.generate_sound_effect(
        prompt="wind in bamboo",
        image_path=str(tmp_path / "scene.png"),
        request_id="req-1",
        duration_seconds=2.5,
        prompt_influence=0.5,
        loop=True,
        output_format="mp3_44100_128",
    )

    assert payload["filename"].endswith(".mp3")
    assert Path(payload["absolute_path"]).exists()
    assert Path(payload["metadata_path"]).exists()

    client = created_clients[0]
    assert client.requests[0]["json"]["text"] == "wind in bamboo"
    assert client.requests[0]["params"]["output_format"] == "mp3_44100_128"


def test_generate_sound_effect_requires_api_key(monkeypatch):
    monkeypatch.setattr(sound_effects.settings, "elevenlabs_api_key", None)
    with pytest.raises(RuntimeError):
        sound_effects.generate_sound_effect(prompt="piano", image_path="scene.png")


def test_generate_sound_effect_http_error(monkeypatch, tmp_path):
    sounds_dir = tmp_path / "generated_sounds"
    metadata_dir = tmp_path / "metadata"
    monkeypatch.setattr(sound_effects.settings, "generated_sounds_dir", str(sounds_dir))
    monkeypatch.setattr(sound_effects.settings, "metadata_dir", str(metadata_dir))
    monkeypatch.setattr(sound_effects.settings, "elevenlabs_api_key", "key")

    class ErrorClient:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, headers=None, params=None, json=None):
            response = httpx.Response(400, request=httpx.Request("POST", url), text="bad")

            class _Resp:
                def __init__(self, resp):
                    self._resp = resp
                    self.text = resp.text
                    self.status_code = resp.status_code

                def raise_for_status(self):
                    raise httpx.HTTPStatusError(
                        "bad", request=self._resp.request, response=self._resp
                    )

                @property
                def content(self):
                    return b""

            return _Resp(response)

    monkeypatch.setattr(sound_effects.httpx, "Client", lambda *a, **k: ErrorClient())

    with pytest.raises(RuntimeError, match="失敗"):
        sound_effects.generate_sound_effect(prompt="storm", image_path="scene.png")
