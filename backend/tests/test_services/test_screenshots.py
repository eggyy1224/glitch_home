"""Tests for screenshot upload utilities."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest
from types import SimpleNamespace

from app.services import screenshots


def _make_upload(filename: str, content_type: str | None, payload: bytes):
    return SimpleNamespace(
        filename=filename,
        content_type=content_type,
        file=BytesIO(payload),
    )


def test_resolve_extension_by_content_type():
    upload = _make_upload("ignored.bin", "image/png", b"")
    assert screenshots._resolve_extension(upload) == ".png"


def test_resolve_extension_fallback_and_normalization():
    upload = _make_upload("picture.JPEG", None, b"")
    assert screenshots._resolve_extension(upload) == ".jpg"


def test_resolve_extension_invalid_upload():
    upload = _make_upload("note.txt", "text/plain", b"")
    with pytest.raises(ValueError, match="Unsupported screenshot"):
        screenshots._resolve_extension(upload)


def test_save_screenshot_persists_file(monkeypatch, tmp_path):
    target_dir = tmp_path / "screen_shots"
    monkeypatch.setattr(screenshots.settings, "screenshot_dir", str(target_dir))

    upload = _make_upload("scene.png", "image/png", b"pixel-data")
    result = screenshots.save_screenshot(upload)

    absolute = Path(result["absolute_path"])
    assert absolute.exists()
    assert absolute.read_bytes() == b"pixel-data"
    assert result["filename"].startswith("scene_")
    assert result["original_filename"] == "scene.png"
    assert result["relative_path"].startswith("screen_shots/")
    assert absolute.parent == target_dir
