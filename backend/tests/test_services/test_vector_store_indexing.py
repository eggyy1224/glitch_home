from pathlib import Path
from typing import List

import pytest

from app.services import vector_store


@pytest.fixture(autouse=True)
def _isolated_offspring_dir(tmp_path, monkeypatch):
    """Point settings.offspring_dir to a temp directory for each test."""
    temp_dir = tmp_path / "offspring"
    temp_dir.mkdir()
    monkeypatch.setattr(vector_store.settings, "offspring_dir", str(temp_dir))
    yield temp_dir


def _create_files(names: List[str]) -> None:
    offspring_dir = Path(vector_store.settings.offspring_dir)
    offspring_dir.mkdir(parents=True, exist_ok=True)
    for name in names:
        (offspring_dir / name).write_bytes(b"test")


def test_sweep_and_index_offspring_structure(monkeypatch):
    _create_files(["b.jpg", "a.png", "ignore.txt"])

    calls = []

    def fake_index(name: str, *, force: bool):
        calls.append((name, force))
        status = "indexed" if name == "a.png" else "exists"
        return {"id": name, "status": status}

    monkeypatch.setattr(vector_store, "index_offspring_image", fake_index)

    result = vector_store.sweep_and_index_offspring(force=True)

    assert result == {
        "indexed": 1,
        "skipped": 1,
        "errors": 0,
        "results": [
            {"id": "a.png", "status": "indexed"},
            {"id": "b.jpg", "status": "exists"},
        ],
    }
    assert calls == [("a.png", True), ("b.jpg", True)]


def test_index_offspring_batch_structure(monkeypatch):
    _create_files(["b.jpg", "c.jpeg", "a.png"])

    def fake_index(name: str, *, force: bool):
        if name == "b.jpg":
            raise RuntimeError("boom")
        return {"id": name, "status": "indexed"}

    monkeypatch.setattr(vector_store, "index_offspring_image", fake_index)

    result = vector_store.index_offspring_batch(batch_size=2, offset=1)

    assert result["indexed"] == 1
    assert result["skipped"] == 0
    assert result["errors"] == 1
    assert result["results"] == [
        {"id": "b.jpg", "status": "error", "error": "boom"},
        {"id": "c.jpeg", "status": "indexed"},
    ]
    assert result["batch_info"] == {
        "batch_size": 2,
        "offset": 1,
        "total_files": 3,
        "next_offset": 3,
    }
