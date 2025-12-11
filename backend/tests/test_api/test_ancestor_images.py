from __future__ import annotations

from pathlib import Path

import pytest

from app.config import settings
from app.services.nightwalk_image_cache import nightwalk_image_cache


@pytest.fixture(autouse=True)
def clear_nightwalk_cache():
    """Ensure cache is refreshed each test."""
    nightwalk_image_cache._images = []  # type: ignore[attr-defined]
    nightwalk_image_cache._last_refresh = 0.0  # type: ignore[attr-defined]
    yield


def test_ancestor_images_empty(client, tmp_path, monkeypatch):
    base = tmp_path / "nightwalk_assets_empty"
    monkeypatch.setattr(settings, "nightwalk_assets_dir", str(base))

    nightwalk_image_cache.refresh()

    resp = client.get("/api/ancestor-images")
    assert resp.status_code == 200
    assert resp.json() == {"images": []}


def test_ancestor_images_filters_and_encodes(client, tmp_path, monkeypatch):
    base = tmp_path / "nightwalk_assets"
    target_dir = base / "攝影圖像"
    target_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "nightwalk_assets_dir", str(base))

    (target_dir / "DSCF0001.JPG").write_bytes(b"a")
    (target_dir / "offspring_legacy.png").write_bytes(b"b")
    nested_dir = target_dir / "子資料夾"
    nested_dir.mkdir(parents=True, exist_ok=True)
    (nested_dir / "tree photo 01.jpeg").write_bytes(b"c")
    spacelive_dir = base / "spacelive"
    spacelive_dir.mkdir(parents=True, exist_ok=True)
    (spacelive_dir / "should_ignore.jpg").write_bytes(b"x")

    nightwalk_image_cache.refresh()

    resp = client.get("/api/ancestor-images")

    assert resp.status_code == 200
    payload = resp.json()
    names = [item["relative_path"] for item in payload["images"]]
    assert names == ["攝影圖像/DSCF0001.JPG", "攝影圖像/子資料夾/tree photo 01.jpeg"]
    urls = [item["url"] for item in payload["images"]]
    assert urls == [
        "/nightwalk_assets/%E6%94%9D%E5%BD%B1%E5%9C%96%E5%83%8F/DSCF0001.JPG",
        "/nightwalk_assets/%E6%94%9D%E5%BD%B1%E5%9C%96%E5%83%8F/%E5%AD%90%E8%B3%87%E6%96%99%E5%A4%BE/tree%20photo%2001.jpeg",
    ]
    assert all("spacelive" not in name for name in names)
