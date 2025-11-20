"""Error-path coverage for storage-related endpoints."""

from __future__ import annotations

from unittest.mock import patch


@patch("app.api.storage.save_iframe_config_snapshot", side_effect=ValueError("no config"))
def test_snapshot_iframe_config_value_error(mock_save, client):
    resp = client.post("/api/iframe-config/snapshot", json={"snapshot_name": "s1"})
    assert resp.status_code == 400
    assert "no config" in resp.json()["detail"]


@patch("app.api.storage.restore_iframe_config_snapshot", side_effect=FileNotFoundError("missing snap"))
def test_restore_iframe_config_not_found(mock_restore, client):
    resp = client.post("/api/iframe-config/restore", json={"snapshot_name": "missing", "client_id": "c"})
    assert resp.status_code == 404
    assert "missing snap" in resp.json()["detail"]


@patch("app.api.storage.load_iframe_config_snapshot_payload", side_effect=FileNotFoundError("no file"))
def test_get_iframe_snapshot_not_found(mock_load, client):
    resp = client.get("/api/iframe-config/snapshots/cli/snap1")
    assert resp.status_code == 404
    assert "no file" in resp.json()["detail"]


@patch("app.api.storage.clone_iframe_config_snapshot", side_effect=FileNotFoundError("gone"))
def test_clone_iframe_snapshot_not_found(mock_clone, client):
    resp = client.post("/api/iframe-config/snapshots/a/b/clone", json={"target_client": "x"})
    assert resp.status_code == 404
    assert "gone" in resp.json()["detail"]
