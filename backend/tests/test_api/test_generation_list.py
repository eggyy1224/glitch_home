"""Tests for offspring image listing endpoint."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.config import settings
from app.services.image_cache import image_cache


@pytest.fixture(autouse=True)
def clear_image_cache():
    """Fixture to ensure image_cache is cleared and refreshed for each test."""
    image_cache._images = []  # Clear the internal list
    image_cache._last_refresh = 0.0  # Force refresh on next access
    yield


def test_offspring_images_empty(client, tmp_path, monkeypatch):
    # Use isolated directory to avoid touching real data
    base = tmp_path / "offspring_images_empty"
    monkeypatch.setattr(settings, "offspring_dir", str(base))

    # Force the cache to refresh from the mocked directory
    image_cache.refresh()

    resp = client.get("/api/offspring-images")

    assert resp.status_code == 200
    assert resp.json() == {"images": []}


def test_offspring_images_filters_and_sorts(client, tmp_path, monkeypatch):
    base = tmp_path / "offspring_images"
    base.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "offspring_dir", str(base))
    # Mixed extensions and ordering
    (base / "b.JPG").write_bytes(b"1")
    (base / "a.png").write_bytes(b"2")
    (base / "note.txt").write_bytes(b"text")

    # Force the cache to refresh from the mocked directory
    image_cache.refresh()

    resp = client.get("/api/offspring-images")

    assert resp.status_code == 200
    images = resp.json()["images"]
    assert [img["filename"] for img in images] == ["a.png", "b.JPG"]
    assert all(img["url"].startswith("/generated_images/") for img in images)
