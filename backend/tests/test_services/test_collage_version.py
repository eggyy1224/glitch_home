"""Unit tests for the collage version generation service."""

from __future__ import annotations

import json
from pathlib import Path
from typing import List

import pytest
from PIL import Image

from app.services.collage_version import (
    average_rect_color,
    color_distance,
    compute_edge_colors,
    compute_tile_luminance,
    generate_collage_version,
    match_tiles_source_cluster,
    match_tiles_greedy,
    match_tiles_luminance,
    match_tiles_random,
    match_tiles_wave,
    match_tiles_weave,
    match_tiles_weave_vertical,
    reassemble_collage,
    reassemble_collage_rotate_90,
    standardize_image,
    tile_image,
)


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


def test_generate_collage_version_no_images_raises():
    with pytest.raises(ValueError, match="至少需要 1 張圖片"):
        generate_collage_version([], rows=2, cols=2, mode="random")


def test_generate_collage_version_rotate_mode_converts_rgba(tmp_path):
    rgba_image = Image.new("RGBA", (16, 16), (10, 20, 30, 255))
    img_path = tmp_path / "rgba.png"
    rgba_image.save(img_path)

    result = generate_collage_version(
        [str(img_path)],
        rows=2,
        cols=2,
        mode="rotate-90",
        allow_self=False,
        resize_w=16,
        format="jpeg",
        return_map=True,
    )

    output = Path(result["output_image_path"])
    assert output.exists()
    assert output.suffix == ".jpeg"
    # rotate-90 uses identity mapping
    assert len(result["tile_mapping"]) == 4


def test_tile_matching_helpers_cover_branches():
    base = Image.new("RGB", (8, 8), (100, 100, 100))
    candidate1 = Image.new("RGB", (8, 8), (110, 110, 110))
    candidate2 = Image.new("RGB", (8, 8), (90, 90, 90))
    base_tiles = tile_image(base, rows=2, cols=2)
    candidates = []
    for idx, img in enumerate((candidate1, candidate2)):
        tiles = tile_image(img, rows=2, cols=2)
        for r in range(2):
            for c in range(2):
                candidates.append((tiles[r * 2 + c], idx, r, c))

    greedy = match_tiles_greedy(base_tiles, candidates, rows=2, cols=2, seed=1)
    random_map = match_tiles_random(base_tiles, candidates, rows=2, cols=2, seed=2)
    wave = match_tiles_wave(base_tiles, candidates, rows=2, cols=2, seed=3)
    luminance = match_tiles_luminance(base_tiles, candidates, rows=2, cols=2, seed=4)

    assert len(greedy) == 4
    assert len(random_map) == 4
    assert len(wave) == 4
    assert len(luminance) == 4

    assert color_distance([], []) > 0
    assert compute_tile_luminance(candidate1.convert("L")) > 0
    edges = compute_edge_colors(candidate1)
    assert set(edges.keys()) == {"top", "bottom", "left", "right", "center"}


def test_weave_and_reassemble_variants(tmp_path):
    base = Image.new("RGB", (12, 12), (10, 20, 30))
    alt = Image.new("RGB", (12, 12), (200, 210, 220))

    base_tiles = tile_image(base, rows=3, cols=3)
    candidate_tiles = []
    for img_idx, img in enumerate((base, alt)):
        tiles = tile_image(img, rows=3, cols=3)
        for r in range(3):
            for c in range(3):
                candidate_tiles.append((tiles[r * 3 + c], img_idx, r, c))

    weave_map = match_tiles_weave(base_tiles, candidate_tiles, rows=3, cols=3, seed=5, num_images=2)
    vertical_map = match_tiles_weave_vertical(base_tiles, candidate_tiles, rows=3, cols=3, seed=6, num_images=2)
    cluster_map = match_tiles_source_cluster(base_tiles, candidate_tiles, rows=3, cols=3, seed=7)

    output = reassemble_collage(
        base,
        candidate_tiles,
        weave_map,
        rows=3,
        cols=3,
        pad_px=1,
        jitter_px=1,
        rotate_deg=90,
        seed=42,
    )
    rotated = reassemble_collage_rotate_90(base, rows=3, cols=3, pad_px=0)

    assert len(weave_map) == 9
    assert len(vertical_map) == 9
    assert len(cluster_map) == 9
    assert output.size[0] > 0 and output.size[1] > 0
    assert rotated.size == base.size


def test_standardize_image_validation_errors(tmp_path):
    img_path = tmp_path / "tiny.png"
    Image.new("RGB", (8, 8)).save(img_path)
    img = Image.open(img_path)

    with pytest.raises(ValueError, match="正整數"):
        standardize_image(img, target_w=16, rows=0, cols=2)

    with pytest.raises(ValueError, match="不相容"):
        standardize_image(img, target_w=8, rows=10, cols=10)


def test_tile_image_and_color_helpers(tmp_path):
    img = Image.new("RGB", (4, 2), (10, 20, 30))

    with pytest.raises(ValueError, match="0 像素"):
        tile_image(img, rows=5, cols=1)

    color = average_rect_color(img, start_x=0, start_y=0, width=0, height=0)
    assert color == [0.0, 0.0, 0.0]
