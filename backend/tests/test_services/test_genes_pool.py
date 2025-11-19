import os

import pytest

from app.services.genes_pool import FilesystemParentSelector


def _make_image(path: os.PathLike[str]) -> None:
    from PIL import Image

    Image.new("RGB", (10, 10), (255, 0, 0)).save(path)


def test_select_samples_from_pool(tmp_path):
    pool_dir = tmp_path / "pool"
    pool_dir.mkdir()
    img_paths = []
    for idx in range(3):
        path = pool_dir / f"img_{idx}.png"
        _make_image(path)
        img_paths.append(str(path))

    selector = FilesystemParentSelector(
        pool_dirs=[str(pool_dir)],
        offspring_dir=str(tmp_path / "offspring"),
        sampler=lambda candidates, count: candidates[:count],
    )

    selected = selector.select(count=2)

    assert len(selected) == 2
    assert len(set(selected)) == 2
    assert set(selected).issubset(set(img_paths))


def test_select_resolves_relative_and_absolute(tmp_path):
    pool_dir = tmp_path / "pool"
    offspring_dir = tmp_path / "offspring"
    pool_dir.mkdir()
    offspring_dir.mkdir()
    pool_image = pool_dir / "pool_parent.png"
    offspring_image = offspring_dir / "offspring_parent.png"
    _make_image(pool_image)
    _make_image(offspring_image)

    selector = FilesystemParentSelector(
        pool_dirs=[str(pool_dir)], offspring_dir=str(offspring_dir)
    )

    resolved = selector.select(parents=[os.path.basename(pool_image), str(offspring_image)])

    assert resolved[0] == str(pool_image)
    assert resolved[1] == str(offspring_image)


def test_select_raises_when_dirs_missing(tmp_path):
    selector = FilesystemParentSelector(
        pool_dirs=[str(tmp_path / "missing1")],
        offspring_dir=str(tmp_path / "offspring"),
    )

    with pytest.raises(ValueError):
        selector.select(count=2)
