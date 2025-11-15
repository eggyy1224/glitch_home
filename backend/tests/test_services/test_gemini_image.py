import json
from io import BytesIO
from types import SimpleNamespace
from pathlib import Path

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


def test_generate_mixed_offspring_v2_writes_outputs(monkeypatch, tmp_path):
    parents = _create_parent_images(tmp_path)
    image_bytes = _make_sample_image_bytes()
    fake_client = _fake_response_with_bytes(image_bytes)
    monkeypatch.setattr(gemini_image, "get_gemini_client", lambda: fake_client)

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


def test_helper_raises_when_no_inline_data(monkeypatch, tmp_path):
    parents = _create_parent_images(tmp_path)
    fake_client = _fake_response_without_inline()
    monkeypatch.setattr(gemini_image, "get_gemini_client", lambda: fake_client)

    with pytest.raises(RuntimeError) as exc:
        gemini_image._generate_and_store_image(  # type: ignore[attr-defined]
            parent_paths=parents,
            prompt="No data",
            strength=None,
            output_format="png",
            output_width=None,
            output_height=None,
            output_max_side=None,
            resize_mode=None,
        )

    message = str(exc.value)
    assert "Gemini 回傳未包含影像資料" in message
    assert "inputs=(2 images)" in message
    assert "parent_0.png" in message


def test_helper_invalid_output_format(monkeypatch, tmp_path):
    parents = _create_parent_images(tmp_path)
    fake_client = _fake_response_with_bytes(_make_sample_image_bytes((0, 255, 0)))
    monkeypatch.setattr(gemini_image, "get_gemini_client", lambda: fake_client)

    with pytest.raises(RuntimeError) as exc:
        gemini_image._generate_and_store_image(  # type: ignore[attr-defined]
            parent_paths=parents,
            prompt="Bad format",
            strength=None,
            output_format="invalid-format",
            output_width=None,
            output_height=None,
            output_max_side=None,
            resize_mode=None,
        )

    assert "輸出影像存檔失敗" in str(exc.value)
    assert "inputs=(2 images)" in str(exc.value)
