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


def test_iter_offspring_images_missing_dir(monkeypatch, tmp_path):
    monkeypatch.setattr(vector_store.settings, "offspring_dir", str(tmp_path / "missing"))

    assert vector_store._iter_offspring_images() is None


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


def test_search_images_by_text_empty_query(monkeypatch):
    vector_store._cached_embed_text.cache_clear()
    monkeypatch.setattr(vector_store, "embed_text", lambda q: [0.1])

    with pytest.raises(ValueError):
        vector_store.search_images_by_text(" ")


def test_search_images_by_image_prefers_cached_embedding(monkeypatch):
    fake_collector = type(
        "FakeCol",
        (),
        {
            "get": lambda self, ids, include=None: {
                "ids": ids,
                "embeddings": [[0.5, 0.6]],
                "metadatas": [[{"foo": "bar"}]],
            },
            "query": lambda self, query_embeddings, n_results, where=None: {
                "ids": [["ghost.png"]],
                "distances": [[0.01]],
                "metadatas": [[{"foo": "bar"}]],
                "where": where,
                "query_embeddings": query_embeddings,
            },
        },
    )()
    monkeypatch.setattr(vector_store, "get_images_collection", lambda: fake_collector)
    monkeypatch.setattr(vector_store, "embed_image", lambda path: (_ for _ in ()).throw(RuntimeError("should not embed")))
    monkeypatch.setattr(vector_store, "embed_image_as_text", lambda path, extra_hint=None: (_ for _ in ()).throw(RuntimeError("should not embed")))

    result = vector_store.search_images_by_image("ghost.png", top_k=1)

    assert result["results"][0]["id"] == "ghost.png"
    assert result["results"][0]["metadata"]["foo"] == "bar"


def test_search_images_by_image_missing_file_and_db(monkeypatch, tmp_path):
    monkeypatch.setattr(vector_store.settings, "offspring_dir", str(tmp_path))
    fake_collector = type(
        "FakeCol",
        (),
        {"get": lambda self, ids, include=None: {"ids": [], "embeddings": []}},
    )()
    monkeypatch.setattr(vector_store, "get_images_collection", lambda: fake_collector)

    with pytest.raises(FileNotFoundError):
        vector_store.search_images_by_image("missing.png")


def test_search_images_by_image_missing_embedding_raises(monkeypatch, tmp_path):
    monkeypatch.setattr(vector_store.settings, "offspring_dir", str(tmp_path))

    class FakeCol:
        def get(self, ids, include=None):
            return {"ids": ids, "embeddings": [None]}

    monkeypatch.setattr(vector_store, "get_images_collection", lambda: FakeCol())

    with pytest.raises(FileNotFoundError):
        vector_store.search_images_by_image("ghost.png")


def test_index_offspring_batch_handles_missing_dir(monkeypatch, tmp_path):
    monkeypatch.setattr(vector_store.settings, "offspring_dir", str(tmp_path / "missing"))

    result = vector_store.index_offspring_batch(batch_size=3, offset=0)

    assert result == {
        "indexed": 0,
        "skipped": 0,
        "errors": 0,
        "results": [],
        "batch_info": {"batch_size": 3, "offset": 0, "total_files": 0, "next_offset": 3},
    }


def test_embed_image_for_search_fallback_uses_prompt(monkeypatch, tmp_path):
    image_path = tmp_path / "sample.png"
    image_path.write_bytes(b"x")
    meta_dir = tmp_path / "meta"
    meta_dir.mkdir()
    (meta_dir / "sample.json").write_text(json.dumps({"prompt": "hint"}), encoding="utf-8")

    monkeypatch.setattr(vector_store.settings, "metadata_dir", str(meta_dir))
    monkeypatch.setattr(vector_store, "embed_image", lambda path: (_ for _ in ()).throw(RuntimeError("fail")))

    received_hint = {}

    def fake_embed_as_text(path, extra_hint=None):
        received_hint["hint"] = extra_hint
        return [0.9]

    monkeypatch.setattr(vector_store, "embed_image_as_text", fake_embed_as_text)

    vec = vector_store._embed_image_for_search(str(image_path))

    assert vec == [0.9]
    assert received_hint["hint"] == "hint"


def test_search_images_by_text_applies_where_clause(monkeypatch):
    vector_store._cached_embed_text.cache_clear()
    monkeypatch.setattr(vector_store, "embed_text", lambda q: [0.1, 0.2])

    captured = {}

    class FakeCol:
        def query(self, query_embeddings, n_results, where=None):
            captured["where"] = where
            return {
                "ids": [["img1"]],
                "distances": [[0.01]],
                "metadatas": [[{"foo": "bar"}]],
            }

    monkeypatch.setattr(vector_store, "get_images_collection", lambda: FakeCol())

    result = vector_store.search_images_by_text("skyline", top_k=1, include_deprecated=False)

    assert captured["where"] == {"deprecated": {"$ne": True}}
    assert result["results"][0]["metadata"]["foo"] == "bar"

    # when include_deprecated=True, where should be None
    result2 = vector_store.search_images_by_text("skyline", top_k=1, include_deprecated=True)
    assert captured["where"] is None
