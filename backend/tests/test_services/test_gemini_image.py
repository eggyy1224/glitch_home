from datetime import datetime
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from typing import Optional

import pytest
from PIL import Image

from app.services import gemini_image
from app.services.image_outputs import DefaultImagePreprocessor, LocalOutputWriter


def _fake_response_with_bytes(image_bytes: bytes) -> SimpleNamespace:
    part = SimpleNamespace(
        inline_data=SimpleNamespace(data=image_bytes),
        inlineData=None,
        text=None,
    )
    candidate = SimpleNamespace(content=SimpleNamespace(parts=[part]), finish_reason=None)
    models = SimpleNamespace(
        generate_content=lambda **_: SimpleNamespace(candidates=[candidate])
    )
    return SimpleNamespace(models=models)


def _fake_response_without_inline() -> SimpleNamespace:
    part = SimpleNamespace(inline_data=None, inlineData=None, text="just text")
    candidate = SimpleNamespace(content=SimpleNamespace(parts=[part]), finish_reason="STOP")
    models = SimpleNamespace(
        generate_content=lambda **_: SimpleNamespace(candidates=[candidate])
    )
    return SimpleNamespace(models=models)


def _make_sample_image_bytes(color=(255, 0, 0)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (32, 32), color).save(buf, format="PNG")
    return buf.getvalue()


def _create_parent_images(tmp_path: Path, count: int = 2) -> list[str]:
    parents: list[str] = []
    for idx in range(count):
        path = tmp_path / f"parent_{idx}.png"
        Image.new("RGB", (16 + idx, 16 + idx), (idx * 40, 0, 0)).save(path)
        parents.append(str(path))
    return parents


def test_call_gemini_returns_image():
    fake_client = _fake_response_with_bytes(_make_sample_image_bytes())
    generator = gemini_image.GeminiImageGenerator(client=fake_client)

    sample_image = Image.new("RGB", (16, 16), (255, 0, 0))
    details = [
        {
            "name": "parent.png",
            "path": "parent.png",
            "dimensions": "16x16",
            "file_size": "1KB",
        }
    ]

    result = generator._call_gemini("prompt", [sample_image], details)

    assert isinstance(result, Image.Image)


def test_call_gemini_raises_when_no_inline():
    fake_client = _fake_response_without_inline()
    generator = gemini_image.GeminiImageGenerator(client=fake_client)

    sample_image = Image.new("RGB", (16, 16), (255, 0, 0))
    details = [
        {
            "name": "parent.png",
            "path": "parent.png",
            "dimensions": "16x16",
            "file_size": "1KB",
        }
    ]

    with pytest.raises(RuntimeError) as exc:
        generator._call_gemini("prompt", [sample_image], details)

    assert "Gemini 回傳未包含影像資料" in str(exc.value)


def test_build_metadata_contains_expected_fields(tmp_path):
    parents = _create_parent_images(tmp_path)
    preprocessor = DefaultImagePreprocessor()
    images, details = preprocessor.prepare(parents)
    generator = gemini_image.GeminiImageGenerator(client=SimpleNamespace())
    dummy_path = tmp_path / "output.png"
    dummy_path.write_bytes(_make_sample_image_bytes())

    metadata = generator._build_metadata(
        parent_paths=parents,
        input_details=details,
        prompt="prompt",
        strength=0.5,
        fmt="png",
        width=32,
        height=32,
        output_path=str(dummy_path),
    )

    assert metadata["output_format"] == "png"
    assert metadata["output_size"] == {"width": 32, "height": 32}
    assert metadata["parents_full_paths"] == parents


class _StubParentSelector:
    def __init__(self, resolved: list[str]):
        self._resolved = resolved
        self.calls: list[tuple[Optional[list[str]], Optional[int]]] = []

    def select(self, *, parents=None, count=None):  # type: ignore[override]
        self.calls.append((parents, count))
        return self._resolved


class _StubPreprocessor:
    def prepare(self, parent_paths):  # type: ignore[override]
        self.received = parent_paths
        return [Image.new("RGB", (8, 8), (0, 255, 0))], [
            {
                "name": "parent.png",
                "path": parent_paths[0],
                "dimensions": "8x8",
                "file_size": "1KB",
            }
        ]


class _StubOutputWriter:
    def __init__(self, tmp_path: Path):
        self.tmp_path = tmp_path
        self.received_images: list[Image.Image] = []

    def write(self, img, **kwargs):  # type: ignore[override]
        self.received_images.append(img)
        out_path = self.tmp_path / "offspring.png"
        img.save(out_path)
        return str(out_path), "png", img.width, img.height


def test_generate_uses_injected_services(monkeypatch, tmp_path):
    parents = ["p0.png", "p1.png"]
    parent_selector = _StubParentSelector(parents)
    preprocessor = _StubPreprocessor()
    output_writer = _StubOutputWriter(tmp_path)
    fake_client = _fake_response_with_bytes(_make_sample_image_bytes())

    monkeypatch.setattr(gemini_image.settings, "offspring_dir", str(tmp_path / "offspring"))
    monkeypatch.setattr(gemini_image.settings, "metadata_dir", str(tmp_path / "meta"))

    generator = gemini_image.GeminiImageGenerator(
        client=fake_client,
        parent_selector=parent_selector,
        image_preprocessor=preprocessor,
        output_writer=output_writer,
    )

    result = generator.generate(parents=parents, prompt="Hello")

    assert parent_selector.calls[0] == (parents, None)
    assert preprocessor.received == parents
    assert Path(result["output_image_path"]).exists()
    assert Path(result["metadata_path"]).exists()
    assert result["parents_full_paths"] == parents


def test_generate_mixed_offspring_v2_writes_outputs(monkeypatch, tmp_path):
    parents = _create_parent_images(tmp_path)
    image_bytes = _make_sample_image_bytes()
    fake_client = _fake_response_with_bytes(image_bytes)
    monkeypatch.setattr(gemini_image.settings, "offspring_dir", str(tmp_path))
    monkeypatch.setattr(gemini_image.settings, "metadata_dir", str(tmp_path / "meta"))

    parent_selector = _StubParentSelector(parents)
    writer = LocalOutputWriter(
        output_dir=str(tmp_path),
        timestamp_factory=lambda: datetime(2024, 1, 1, 12, 0, 0),
        filename_builder=lambda fmt, ts: f"custom.{fmt}",
    )
    generator = gemini_image.GeminiImageGenerator(
        client=fake_client,
        parent_selector=parent_selector,
        image_preprocessor=DefaultImagePreprocessor(),
        output_writer=writer,
    )

    monkeypatch.setattr(gemini_image, "GeminiImageGenerator", lambda: generator)

    result = gemini_image.generate_mixed_offspring_v2(parents=parents, prompt="Test prompt")

    output_path = Path(result["output_image_path"])
    metadata_path = Path(result["metadata_path"])
    assert output_path.exists()
    assert metadata_path.exists()
