from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def _minimal_config(url: str = "/") -> dict:
    return {
        "layout": "grid",
        "gap": 0,
        "columns": 1,
        "panels": [
            {
                "id": "p1",
                "url": url,
                "params": {},
                "ratio": 1,
            }
        ],
    }


def test_snapshot_put_get_delete_and_clone(client: TestClient) -> None:
    client_id = "pytest_snapshot_cli"
    name = "scene_a"
    payload = _minimal_config("/demo")

    put_resp = client.put(f"/api/iframe-config/snapshots/{client_id}/{name}", json=payload)
    assert put_resp.status_code == 200
    data = put_resp.json()
    assert data["snapshot"]["name"] == name

    get_resp = client.get(f"/api/iframe-config/snapshots/{client_id}/{name}")
    assert get_resp.status_code == 200
    got = get_resp.json()
    assert got["raw"]["panels"][0]["url"] == "/demo"

    clone_resp = client.post(
        f"/api/iframe-config/snapshots/{client_id}/{name}/clone",
        json={"target_client": "pytest_snapshot_clone", "target_name": "scene_b"},
    )
    assert clone_resp.status_code == 201
    clone_path = Path(os.environ["METADATA_DIR"]) / "snapshots" / "iframe_config" / "pytest_snapshot_clone" / "scene_b.json"
    assert clone_path.exists()

    delete_resp = client.delete(f"/api/iframe-config/snapshots/{client_id}/{name}")
    assert delete_resp.status_code == 200
    original_path = Path(os.environ["METADATA_DIR"]) / "snapshots" / "iframe_config" / client_id / f"{name}.json"
    assert not original_path.exists()


def test_timeline_create_update_delete_and_clone(client: TestClient) -> None:
    timeline_id = "pytest_timeline_demo"
    client_id = "wall"
    snap_a = "first_snap"
    snap_b = "second_snap"

    for snap in (snap_a, snap_b):
        resp = client.put(f"/api/iframe-config/snapshots/{client_id}/{snap}", json=_minimal_config(f"/{snap}"))
        assert resp.status_code == 200

    payload = {
        "id": timeline_id,
        "title": "Demo timeline",
        "clientId": client_id,
        "loop": False,
        "steps": [
            {"snapshot": f"{client_id}/{snap_a}", "duration": 3, "label": "first"},
            {"snapshot": f"{client_id}/{snap_b}", "duration": 2, "label": "second"},
        ],
    }

    create_resp = client.post("/api/iframe-timelines", json=payload)
    assert create_resp.status_code == 201
    assert create_resp.json()["timeline"]["id"] == timeline_id

    update_resp = client.put(
        f"/api/iframe-timelines/{timeline_id}",
        json={**payload, "title": "Updated"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["timeline"]["title"] == "Updated"

    clone_resp = client.post(
        f"/api/iframe-timelines/{timeline_id}/clone?resolve=false",
        json={"new_id": "pytest_timeline_clone", "target_client_id": "mirror"},
    )
    assert clone_resp.status_code == 201
    cloned = clone_resp.json()["timeline"]
    assert cloned["id"] == "pytest_timeline_clone"
    client_value = cloned.get("clientId") or cloned.get("client_id")
    assert client_value == "mirror"
    first_snapshot = cloned.get("steps", [{}])[0].get("snapshot")
    assert first_snapshot and first_snapshot.startswith("mirror/")

    delete_resp = client.delete(f"/api/iframe-timelines/{timeline_id}")
    assert delete_resp.status_code == 200
    timeline_path = Path(os.environ["METADATA_DIR"]) / "timelines" / "iframe" / f"{timeline_id}.json"
    assert not timeline_path.exists()
