"""Unit tests for image analysis helpers."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest
from PIL import Image

from app.services import image_analysis


def test_load_image_missing_file_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        image_analysis._load_image(str(tmp_path / "missing.png"))


def test_load_image_converts_and_resizes(tmp_path, monkeypatch):
    img_path = tmp_path / "gray.png"
    Image.new("L", (2000, 1000)).save(img_path)
    monkeypatch.setattr(image_analysis.settings, "image_size", 512)

    img = image_analysis._load_image(str(img_path))

    assert img.mode == "RGB"
    assert max(img.size) <= 512  # should be clamped to configured size


def test_analyze_screenshot_without_candidates_raises(tmp_path, monkeypatch):
    img_path = tmp_path / "rgb.png"
    Image.new("RGB", (10, 10)).save(img_path)

    class DummyClient:
        class Models:
            @staticmethod
            def generate_content(*args, **kwargs):
                return SimpleNamespace(candidates=[])

        models = Models()

    monkeypatch.setattr(image_analysis, "get_gemini_client", lambda: DummyClient())

    with pytest.raises(RuntimeError):
        image_analysis.analyze_screenshot(str(img_path))
