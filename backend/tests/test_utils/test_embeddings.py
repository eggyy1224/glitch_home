"""Tests for OpenAI embeddings and caption utilities."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from PIL import Image

from app.utils import embeddings


@pytest.fixture
def mock_openai_client(monkeypatch):
    client = MagicMock()
    client.embeddings.create.return_value = SimpleNamespace(
        data=[SimpleNamespace(embedding=[0.1, 0.2, 0.3])]
    )
    client.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="• desc line"))]
    )
    monkeypatch.setattr(embeddings, "_get_openai_client", lambda: client)
    return client


def test_embed_text_validates_input():
    with pytest.raises(ValueError, match="non-empty string"):
        embeddings.embed_text("  ")


def test_embed_text_uses_client(mock_openai_client):
    result = embeddings.embed_text("hello world", model="custom-model")
    assert result == [0.1, 0.2, 0.3]
    mock_openai_client.embeddings.create.assert_called_once_with(
        model="custom-model",
        input="hello world",
    )


def test_caption_image_uses_custom_prompt(mock_openai_client):
    img = Image.new("RGB", (4, 4), "white")
    text = embeddings.caption_image(img, prompt="briefly describe")
    assert "desc" in text
    args, kwargs = mock_openai_client.chat.completions.create.call_args
    assert kwargs["model"] == embeddings.settings.openai_vision_model
    prompt_block = kwargs["messages"][0]["content"][0]
    assert prompt_block["text"] == "briefly describe"


def test_get_openai_client_requires_api_key(monkeypatch):
    monkeypatch.setattr(embeddings.settings, "openai_api_key", None)
    with pytest.raises(ValueError, match="OPENAI_API_KEY"):
        embeddings._get_openai_client()


def test_embed_image_as_text_combines_caption_and_hint(monkeypatch):
    monkeypatch.setattr(embeddings, "caption_image", lambda image: "desc text")
    captured = {}

    def fake_embed_text(text: str, *, model: str | None = None):
        captured["text"] = text
        captured["model"] = model
        return [0.9]

    monkeypatch.setattr(embeddings, "embed_text", fake_embed_text)

    output = embeddings.embed_image_as_text("any.png", extra_hint="hint")
    assert output == [0.9]
    assert captured["text"] == "desc text\nhint"


def test_embed_image_as_text_fallback_with_empty_caption(monkeypatch):
    monkeypatch.setattr(embeddings, "caption_image", lambda image: "")
    captured = {}

    def fake_embed_text(text: str, *, model: str | None = None):
        captured["text"] = text
        return [0.8]

    monkeypatch.setattr(embeddings, "embed_text", fake_embed_text)
    embeddings.embed_image_as_text("any.png", extra_hint="")
    assert captured["text"] == "image"


def test_embed_multimodal_text_image_combines_inputs(monkeypatch):
    monkeypatch.setattr(embeddings, "caption_image", lambda image: "visual")
    captured = {}

    def fake_embed_text(text: str, *, model: str | None = None):
        captured["text"] = text
        return [0.7]

    monkeypatch.setattr(embeddings, "embed_text", fake_embed_text)
    result = embeddings.embed_multimodal_text_image("textual", "img.png")
    assert result == [0.7]
    assert captured["text"] == "textual\nvisual"


def test_embed_image_uses_embed_image_as_text(monkeypatch):
    monkeypatch.setattr(embeddings, "embed_image_as_text", lambda img: ["ok"])
    assert embeddings.embed_image("whatever.png") == ["ok"]
