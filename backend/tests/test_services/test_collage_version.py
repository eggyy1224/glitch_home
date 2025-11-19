"""Unit tests for the collage version generation service."""

from __future__ import annotations

import json
from pathlib import Path
from typing import List

import pytest
from PIL import Image

from app.services.collage_version import generate_collage_version


@pytest.fixture
def collage_source_images(temp_dir) -> List[str]:
    """Create small sample images for collage tests."""
    colors = [(255, 0, 0), (0, 255, 0), (0, 0, 255)]
    paths: List[str] = []
    for idx, color in enumerate(colors):
        img = Image.new("RGB", (48, 48), color)
        out_path = temp_dir / f"collage_source_{idx}.png"
        img.save(out_path)
        paths.append(str(out_path))
    return paths


def test_generate_collage_version_success(collage_source_images):
    """End-to-end happy path covering IO, metadata, and progress callback."""
    progress_updates = []

    def _record(progress: int, stage: str, message: str):
        progress_updates.append((progress, stage, message))

    result = generate_collage_version(
        collage_source_images[:2],
        rows=2,
        cols=2,
        mode="random",
        allow_self=False,
        resize_w=64,
        pad_px=0,
        jitter_px=0,
        rotate_deg=0,
        format="png",
        quality=90,
        seed=123,
        return_map=True,
        progress_callback=_record,
    )

    output_path = Path(result["output_image_path"])
    metadata_path = Path(result["metadata_path"])
    assert output_path.exists()
    assert metadata_path.exists()
    assert result["output_image"].endswith(".png")
    assert result["parents"] == [Path(p).name for p in collage_source_images[:2]]
    assert result["width"] > 0 and result["height"] > 0
    assert len(result["tile_mapping"]) == 4
    assert progress_updates[0][1] == "loading"
    assert progress_updates[-1][0] == 100

    metadata = json.loads(metadata_path.read_text())
    assert metadata["generation_type"] == "collage"
    assert metadata["collage_params"]["mode"] == "random"
    assert metadata["tile_mapping"] == result["tile_mapping"]


def test_generate_collage_version_requires_two_images(collage_source_images):
    """Raise descriptive error when only one source image is provided."""
    with pytest.raises(ValueError, match="單張圖片且 allow_self=false 時無法生成拼貼"):
        generate_collage_version(
            [collage_source_images[0]],
            rows=2,
            cols=2,
            mode="random",
            allow_self=False,
            resize_w=64,
        )


def test_generate_collage_version_invalid_mode(collage_source_images):
    """Unknown mode should bubble up as ValueError."""
    with pytest.raises(ValueError, match="未知的 mode"):
        generate_collage_version(
            collage_source_images[:2],
            rows=2,
            cols=2,
            mode="mystery-mode",
            allow_self=True,
            resize_w=64,
        )
