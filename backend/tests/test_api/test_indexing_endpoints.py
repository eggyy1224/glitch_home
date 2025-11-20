"""API-level tests for indexing routes."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException


@patch("app.api.indexing.vector_store.index_offspring_batch", return_value={"ok": True})
def test_index_batch_success(mock_index, client):
    resp = client.post("/api/index/batch", json={"batch_size": 10, "offset": 0, "force": False})

    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    mock_index.assert_called_once_with(batch_size=10, offset=0, force=False)


@patch("app.api.indexing.vector_store.index_offspring_batch", side_effect=RuntimeError("boom"))
def test_index_batch_error(mock_index, client):
    resp = client.post("/api/index/batch", json={"batch_size": 1, "offset": 0, "force": True})

    assert resp.status_code == 500
    assert "boom" in resp.json()["detail"]
    mock_index.assert_called_once()


@patch("app.api.indexing.vector_store.mark_deprecated_images", return_value={"marked": 1})
def test_mark_deprecated_success(mock_mark, client):
    resp = client.post("/api/index/mark-deprecated")

    assert resp.status_code == 200
    assert resp.json() == {"marked": 1}
    mock_mark.assert_called_once_with()


@patch("app.api.indexing.vector_store.mark_deprecated_images", side_effect=Exception("fail"))
def test_mark_deprecated_error(mock_mark, client):
    resp = client.post("/api/index/mark-deprecated")

    assert resp.status_code == 500
    assert "fail" in resp.json()["detail"]
    mock_mark.assert_called_once()


@patch("app.api.indexing.vector_store.sweep_and_index_offspring", side_effect=RuntimeError("down"))
def test_index_offspring_bubbles_server_error(mock_index, client):
    resp = client.post("/api/index/offspring", json={"limit": 2})

    assert resp.status_code == 500
    assert "down" in resp.json()["detail"]
    mock_index.assert_called_once()


@patch("app.api.indexing.vector_store.index_offspring_image", side_effect=FileNotFoundError("missing.png"))
def test_index_one_image_missing_file(mock_index, client):
    resp = client.post("/api/index/image", json={"basename": "missing.png"})

    assert resp.status_code == 404
    assert "missing.png" in resp.json()["detail"]
    mock_index.assert_called_once_with("missing.png", force=False)


@patch("app.api.indexing.vector_store.search_images_by_image", side_effect=FileNotFoundError("nope.png"))
def test_search_image_missing_file(mock_search, client):
    resp = client.post("/api/search/image", json={"image_path": "nope.png"})

    assert resp.status_code == 400
    assert "圖像不存在" in resp.json()["detail"]
    mock_search.assert_called_once()
