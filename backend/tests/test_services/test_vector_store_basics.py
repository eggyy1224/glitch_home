"""Lightweight coverage for vector_store helpers without real Chroma."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services import vector_store


def test_mark_deprecated_images_missing_dir_returns_message(monkeypatch, tmp_path):
    monkeypatch.setattr(vector_store.settings, "offspring_dir", str(tmp_path / "nope"))
    result = vector_store.mark_deprecated_images()
    assert result["message"] == "deprecated 目錄不存在"
    assert result["marked"] == 0


def test_iter_offspring_images_limit_zero(monkeypatch, tmp_path):
    base = tmp_path / "offs"
    base.mkdir()
    (base / "a.png").write_bytes(b"x")
    monkeypatch.setattr(vector_store.settings, "offspring_dir", str(base))

    assert vector_store._iter_offspring_images(limit=0) == []


def test_index_offspring_image_skips_existing(monkeypatch, tmp_path):
    base = tmp_path / "offs"
    base.mkdir()
    (base / "img.png").write_bytes(b"x")
    monkeypatch.setattr(vector_store.settings, "offspring_dir", str(base))

    class FakeCollection:
        def get(self, ids):
            return {"ids": ["img.png"]}

    monkeypatch.setattr(vector_store, "get_images_collection", lambda: FakeCollection())

    result = vector_store.index_offspring_image("img.png")
    assert result["status"] == "exists"


def test_index_offspring_image_fallback_to_embed_image_as_text(monkeypatch, tmp_path):
    base = tmp_path / "offs"
    meta_dir = tmp_path / "meta"
    base.mkdir()
    meta_dir.mkdir()
    img = base / "color.png"
    img.write_bytes(b"x")
    meta_payload = {"prompt": "abc"}
    (meta_dir / "color.json").write_text(json.dumps(meta_payload), encoding="utf-8")

    monkeypatch.setattr(vector_store.settings, "offspring_dir", str(base))
    monkeypatch.setattr(vector_store.settings, "metadata_dir", str(meta_dir))

    monkeypatch.setattr(vector_store, "get_images_collection", lambda: type(
        "FakeCol",
        (),
        {
            "get": lambda self, ids, include=None: {"ids": []},
            "upsert": lambda self, ids, embeddings, metadatas, documents=None: None,
        },
    )())

    monkeypatch.setattr(vector_store, "embed_image", lambda path: (_ for _ in ()).throw(RuntimeError("no image")))
    monkeypatch.setattr(vector_store, "embed_image_as_text", lambda path, extra_hint=None: [0.1, 0.2])

    result = vector_store.index_offspring_image("color.png", force=True)
    assert result["status"] == "indexed"
    assert result["dim"] == 2
    assert result["fallback"] == "embed_image_as_text"
    assert "no image" in result["embedding_error"]


def test_index_offspring_image_reports_metadata_parse_error(monkeypatch, tmp_path):
    base = tmp_path / "offs"
    meta_dir = tmp_path / "meta"
    base.mkdir()
    meta_dir.mkdir()
    img = base / "broken_meta.png"
    img.write_bytes(b"x")
    (meta_dir / "broken_meta.json").write_text("{not json}", encoding="utf-8")

    monkeypatch.setattr(vector_store.settings, "offspring_dir", str(base))
    monkeypatch.setattr(vector_store.settings, "metadata_dir", str(meta_dir))

    class FakeCol:
        def get(self, ids):
            return {"ids": []}

        def upsert(self, ids, embeddings, metadatas, documents=None):
            self.called = True

    monkeypatch.setattr(vector_store, "get_images_collection", lambda: FakeCol())
    monkeypatch.setattr(vector_store, "embed_image", lambda path: [0.3, 0.4])

    stats = vector_store._index_files([img], force=True)
    assert stats["errors"] == 0
    result = stats["results"][0]
    assert result["status"] == "indexed"
    assert "metadata_error" in result
    assert "failed to parse" in result["metadata_error"]


def test_index_files_surface_embedding_failures(monkeypatch, tmp_path):
    base = tmp_path / "offs"
    meta_dir = tmp_path / "meta"
    base.mkdir()
    meta_dir.mkdir()
    img = base / "bad_embed.png"
    img.write_bytes(b"x")

    monkeypatch.setattr(vector_store.settings, "offspring_dir", str(base))
    monkeypatch.setattr(vector_store.settings, "metadata_dir", str(meta_dir))

    class FakeCol:
        def get(self, ids, include=None):
            return {"ids": []}

    monkeypatch.setattr(vector_store, "get_images_collection", lambda: FakeCol())
    monkeypatch.setattr(vector_store, "embed_image", lambda path: (_ for _ in ()).throw(ValueError("primary fail")))
    monkeypatch.setattr(
        vector_store,
        "embed_image_as_text",
        lambda path, extra_hint=None: (_ for _ in ()).throw(RuntimeError("fallback fail")),
    )

    stats = vector_store._index_files([img], force=True)

    assert stats["errors"] == 1
    result = stats["results"][0]
    assert result["status"] == "error"
    assert "primary fail" in result["error"]
    assert "fallback fail" in result["error"]
