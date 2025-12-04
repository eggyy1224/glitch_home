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


def test_analyze_screenshot_missing_parts_raises(tmp_path, monkeypatch):
    img_path = tmp_path / "rgb.png"
    Image.new("RGB", (5, 5)).save(img_path)

    class DummyClient:
        class Models:
            @staticmethod
            def generate_content(*args, **kwargs):
                return SimpleNamespace(candidates=[SimpleNamespace(content=None, finish_reason="STOP")])

        models = Models()

    monkeypatch.setattr(image_analysis, "get_gemini_client", lambda: DummyClient())
    monkeypatch.setattr(image_analysis, "ensure_analysis_llm_enabled", lambda *_: None)

    with pytest.raises(RuntimeError, match="missing content"):
        image_analysis.analyze_screenshot(str(img_path))


def test_analyze_screenshot_no_text_output(tmp_path, monkeypatch):
    img_path = tmp_path / "rgb.png"
    Image.new("RGB", (5, 5)).save(img_path)

    class DummyClient:
        class Models:
            @staticmethod
            def generate_content(*args, **kwargs):
                empty_part = SimpleNamespace(text="  ")
                content = SimpleNamespace(parts=[empty_part])
                candidate = SimpleNamespace(content=content, finish_reason="DONE")
                return SimpleNamespace(candidates=[candidate])

        models = Models()

    monkeypatch.setattr(image_analysis, "get_gemini_client", lambda: DummyClient())
    monkeypatch.setattr(image_analysis, "ensure_analysis_llm_enabled", lambda *_: None)

    with pytest.raises(RuntimeError, match="no text output"):
        image_analysis.analyze_screenshot(str(img_path))


def test_serialise_safety_returns_empty_when_missing():
    class DummyCandidate:
        safety_ratings: None = None

    assert image_analysis._serialise_safety(DummyCandidate()) == []


def test_analyze_screenshot_success_includes_safety(tmp_path, monkeypatch):
    img_path = tmp_path / "rgb.png"
    Image.new("RGB", (8, 8)).save(img_path)

    class DummySafety:
        def __init__(self, category, probability):
            self.category = category
            self.probability = probability

    class DummyClient:
        class Models:
            @staticmethod
            def generate_content(*args, **kwargs):
                part = SimpleNamespace(text="Summary line")
                safety = DummySafety("SAFE", "LOW")
                candidate = SimpleNamespace(
                    content=SimpleNamespace(parts=[part]),
                    finish_reason="STOP",
                    safety_ratings=[safety],
                )
                return SimpleNamespace(candidates=[candidate])

        models = Models()

    monkeypatch.setattr(image_analysis, "get_gemini_client", lambda: DummyClient())
    monkeypatch.setattr(image_analysis, "ensure_analysis_llm_enabled", lambda *_: None)

    analysis = image_analysis.analyze_screenshot(str(img_path), prompt="  ")

    assert analysis["summary"] == "Summary line"
    assert analysis["segments"] == ["Summary line"]
    assert analysis["safety_ratings"] == [{"category": "SAFE", "probability": "LOW"}]
