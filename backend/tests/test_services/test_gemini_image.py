import json
from datetime import datetime
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace

import pytest
from PIL import Image

from app.services import gemini_image


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


def _make_generator(**kwargs) -> gemini_image.GeminiImageGenerator:
    return gemini_image.GeminiImageGenerator(**kwargs)


def test_prepare_inputs_returns_metadata(tmp_path):
    parents = _create_parent_images(tmp_path)
    generator = _make_generator(client=SimpleNamespace())

    images, input_details = generator._prepare_inputs(parents)

    assert len(images) == len(parents)
    assert input_details[0]["name"].startswith("parent_0")
    assert "x" in input_details[0]["dimensions"]


def test_call_gemini_returns_image(tmp_path):
    parents = _create_parent_images(tmp_path)
    fake_client = _fake_response_with_bytes(_make_sample_image_bytes())
    generator = _make_generator(client=fake_client)
    images, details = generator._prepare_inputs(parents)

    result = generator._call_gemini("prompt", images, details)

    assert isinstance(result, Image.Image)


def test_call_gemini_raises_when_no_inline(tmp_path):
    parents = _create_parent_images(tmp_path)
    fake_client = _fake_response_without_inline()
    generator = _make_generator(client=fake_client)
    images, details = generator._prepare_inputs(parents)

    with pytest.raises(RuntimeError) as exc:
        generator._call_gemini("prompt", images, details)

    assert "Gemini 回傳未包含影像資料" in str(exc.value)


def test_resize_image_fit_mode(tmp_path):
    img = Image.new("RGB", (400, 200), (255, 0, 0))
    generator = _make_generator(client=SimpleNamespace())

    resized = generator._resize_image(
        img,
        output_format="png",
        output_width=200,
        output_height=200,
        output_max_side=None,
        resize_mode="fit",
    )

    assert resized.size == (200, 200)


def test_write_output_uses_filename_strategy(monkeypatch, tmp_path):
    parents = _create_parent_images(tmp_path)
    generator = _make_generator(
        client=_fake_response_with_bytes(_make_sample_image_bytes()),
        timestamp_factory=lambda: datetime(2024, 1, 1, 12, 0, 0),
        filename_builder=lambda fmt, ts: f"custom_name.{fmt}",
    )
    monkeypatch.setattr(gemini_image.settings, "offspring_dir", str(tmp_path))
    ensure_dir = Path(tmp_path)
    ensure_dir.mkdir(parents=True, exist_ok=True)

    images, details = generator._prepare_inputs(parents)
    generated = generator._call_gemini("prompt", images, details)
    resized = generator._resize_image(
        generated,
        output_format="png",
        output_width=None,
        output_height=None,
        output_max_side=None,
        resize_mode=None,
    )

    output_path, fmt, width, height = generator._write_output(
        resized,
        output_format="png",
        input_details=details,
    )

    assert Path(output_path).name == "custom_name.png"
    assert fmt == "png"
    assert width == resized.width
    assert height == resized.height
    assert Path(output_path).exists()


def test_build_metadata_contains_expected_fields(tmp_path):
    parents = _create_parent_images(tmp_path)
    generator = _make_generator(client=SimpleNamespace())
    images, details = generator._prepare_inputs(parents)
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


def test_generate_mixed_offspring_v2_writes_outputs(monkeypatch, tmp_path):
    parents = _create_parent_images(tmp_path)
    image_bytes = _make_sample_image_bytes()
    fake_client = _fake_response_with_bytes(image_bytes)
    generator = _make_generator(client=fake_client)
    monkeypatch.setattr(gemini_image.settings, "offspring_dir", str(tmp_path))
    monkeypatch.setattr(gemini_image.settings, "metadata_dir", str(tmp_path / "meta"))

    original_generate = gemini_image._generate_and_store_image

    def _patched_generate(**kwargs):
        return original_generate(generator=generator, **kwargs)

    monkeypatch.setattr(gemini_image, "_generate_and_store_image", _patched_generate)

    result = gemini_image.generate_mixed_offspring_v2(parents=parents, prompt="Test prompt")

    output_path = Path(result["output_image_path"])
    metadata_path = Path(result["metadata_path"])
    assert output_path.exists()
    assert metadata_path.exists()

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    assert metadata["parents_full_paths"] == parents
    assert metadata["output_format"] == "png"
    assert metadata["output_size"]["width"] == result["width"]
    assert metadata["prompt"].startswith("Test prompt")


def test_generate_and_store_image_raises_without_inline(tmp_path):
    parents = _create_parent_images(tmp_path)
    fake_client = _fake_response_without_inline()
    generator = _make_generator(client=fake_client)

    with pytest.raises(RuntimeError) as exc:
        gemini_image._generate_and_store_image(
            parent_paths=parents,
            prompt="No data",
            strength=None,
            output_format="png",
            output_width=None,
            output_height=None,
            output_max_side=None,
            resize_mode=None,
            generator=generator,
        )

    message = str(exc.value)
    assert "Gemini 回傳未包含影像資料" in message
    assert "inputs=(2 images)" in message
    assert "parent_0.png" in message


def test_generate_and_store_image_invalid_output_format(tmp_path):
    parents = _create_parent_images(tmp_path)
    fake_client = _fake_response_with_bytes(_make_sample_image_bytes((0, 255, 0)))
    generator = _make_generator(client=fake_client)

    with pytest.raises(RuntimeError) as exc:
        gemini_image._generate_and_store_image(
            parent_paths=parents,
            prompt="Bad format",
            strength=None,
            output_format="invalid-format",
            output_width=None,
            output_height=None,
            output_max_side=None,
            resize_mode=None,
            generator=generator,
        )

    assert "輸出影像存檔失敗" in str(exc.value)
    assert "inputs=(2 images)" in str(exc.value)
