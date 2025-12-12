"""Tests for storage-related API endpoints (iframe-config, collage-config, camera-presets)."""

import os
import re
from pathlib import Path
import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import settings


@pytest.mark.api
def test_get_iframe_config_default(client: TestClient):
    """Test getting default iframe config."""
    response = client.get("/api/iframe-config")
    assert response.status_code == 200
    data = response.json()
    assert "layout" in data or "panels" in data


@pytest.mark.api
def test_get_iframe_config_with_client(client: TestClient):
    """Test getting iframe config for specific client."""
    response = client.get("/api/iframe-config?client=test_client")
    assert response.status_code == 200
    data = response.json()
    assert "layout" in data or "panels" in data


@pytest.mark.api
def test_put_iframe_config(client: TestClient):
    """Test setting iframe config."""
    config = {
        "layout": "grid",
        "gap": 12,
        "columns": 1,
        "panels": [
            {
                "id": "test",
                "url": "/?test=true",
                "ratio": 1,
                "label": "Test Panel"
            }
        ]
    }
    
    response = client.put("/api/iframe-config", json=config)
    assert response.status_code == 200
    data = response.json()
    assert data["layout"] == "grid"
    assert len(data.get("panels", [])) == 1


@pytest.mark.api
def test_put_iframe_config_validation(client: TestClient):
    """Test iframe config validation."""
    # Invalid payload - FastAPI returns 422 for validation errors
    response = client.put("/api/iframe-config", json="invalid")
    assert response.status_code in [400, 422]


@pytest.mark.api
def test_put_iframe_config_accepts_ancestor_image_with_img_base(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """Ancestor 資產含相對路徑與 img_base 時可保存。"""
    nightwalk_dir = tmp_path / "nightwalk_assets"
    nested_dir = nightwalk_dir / "AI生成靜態影像"
    nested_dir.mkdir(parents=True, exist_ok=True)
    image_rel = "AI生成靜態影像/good.png"
    (nested_dir / "good.png").write_bytes(b"x")

    monkeypatch.setattr(settings, "nightwalk_assets_dir", str(nightwalk_dir))

    payload = {
        "layout": "grid",
        "gap": 4,
        "columns": 1,
        "panels": [
            {
                "id": "ancestor",
                "image": image_rel,
                "url": f"/?static_mode=true&img={image_rel}&img_base=/nightwalk_assets/",
                "ratio": 1,
            }
        ],
    }

    response = client.put("/api/iframe-config", json=payload)
    assert response.status_code == 200
    raw_panel = response.json()["raw"]["panels"][0]
    assert raw_panel["image"] == image_rel


@pytest.mark.api
def test_put_iframe_config_rejects_parent_path_image(client: TestClient):
    """仍阻擋含 .. 的路徑，以避免穿越。"""
    payload = {
        "layout": "grid",
        "gap": 2,
        "columns": 1,
        "panels": [
            {
                "id": "bad",
                "image": "../bad.png",
                "url": "/?static_mode=true&img=../bad.png",
                "ratio": 1,
            }
        ],
    }

    response = client.put("/api/iframe-config", json=payload)
    assert response.status_code in [400, 422]


@pytest.mark.api
def test_put_iframe_config_rejects_img_base_traversal(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """img_base 帶 .. 應被拒絕，避免跳脫資產根目錄。"""
    nightwalk_dir = tmp_path / "nightwalk_assets"
    nightwalk_dir.mkdir(parents=True, exist_ok=True)
    escape_root = tmp_path / "escape"
    escape_root.mkdir(parents=True, exist_ok=True)
    (escape_root / "outside.png").write_bytes(b"x")

    monkeypatch.setattr(settings, "nightwalk_assets_dir", str(nightwalk_dir))

    payload = {
        "layout": "grid",
        "gap": 2,
        "columns": 1,
        "panels": [
            {
                "id": "bad_base",
                "image": "outside.png",
                "url": "/?static_mode=true&img=outside.png&img_base=/nightwalk_assets/../../escape",
                "ratio": 1,
            }
        ],
    }

    response = client.put("/api/iframe-config", json=payload)
    assert response.status_code in [400, 422]


@pytest.mark.api
def test_snapshot_iframe_config_creates_file(client: TestClient):
    """Ensure snapshot endpoint stores config on disk with generated name."""
    client_id = f"pytest_snapshot_{uuid.uuid4().hex[:6]}"
    descriptor = f"before_{uuid.uuid4().hex[:4]}"

    response = client.post(
        "/api/iframe-config/snapshot",
        json={"client_id": client_id, "snapshot_name": descriptor},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["client_id"] == client_id
    generated_name = data["snapshot"].get("name")
    assert re.match(rf"^{client_id}_{descriptor}_\d{{14}}(?:_\d+)?$", generated_name)

    metadata_dir = Path(os.environ["METADATA_DIR"])
    snapshot_path = metadata_dir / "snapshots" / "iframe_config" / client_id / f"{generated_name}.json"
    assert snapshot_path.exists()


@pytest.mark.api
def test_snapshot_iframe_config_without_descriptor(client: TestClient):
    """Snapshot name auto-falls back to global_<timestamp> when descriptor missing."""
    response = client.post("/api/iframe-config/snapshot", json={})
    assert response.status_code == 201
    data = response.json()
    assert data["client_id"] is None
    generated_name = data["snapshot"]["name"]
    assert re.match(r"^global_\d{14}(?:_\d+)?$", generated_name)

    metadata_dir = Path(os.environ["METADATA_DIR"])
    snapshot_path = metadata_dir / "snapshots" / "iframe_config" / "global" / f"{generated_name}.json"
    assert snapshot_path.exists()


@pytest.mark.api
def test_snapshot_iframe_config_handles_duplicate_timestamp(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    """Duplicate base names should gain an auto-increment suffix."""
    client_id = f"pytest_snapshot_dupe_{uuid.uuid4().hex[:4]}"
    descriptor = "scene"
    fixed_timestamp = "20240102030405"
    monkeypatch.setattr(
        "app.services.iframe_config._current_snapshot_timestamp",
        lambda: fixed_timestamp,
    )

    first = client.post(
        "/api/iframe-config/snapshot",
        json={"client_id": client_id, "snapshot_name": descriptor},
    )
    assert first.status_code == 201
    first_name = first.json()["snapshot"]["name"]
    assert first_name == f"{client_id}_{descriptor}_{fixed_timestamp}"

    second = client.post(
        "/api/iframe-config/snapshot",
        json={"client_id": client_id, "snapshot_name": descriptor},
    )
    assert second.status_code == 201
    second_name = second.json()["snapshot"]["name"]
    assert second_name == f"{client_id}_{descriptor}_{fixed_timestamp}_1"


@pytest.mark.api
def test_list_iframe_config_snapshots(client: TestClient):
    """Ensure snapshot listing returns recently created entry."""
    client_id = f"pytest_snapshot_list_{uuid.uuid4().hex[:5]}"
    snapshot_name = f"snapshot_{uuid.uuid4().hex[:8]}"
    create_response = client.post(
        "/api/iframe-config/snapshot",
        json={"client_id": client_id, "snapshot_name": snapshot_name},
    )
    assert create_response.status_code == 201
    created_name = create_response.json()["snapshot"]["name"]

    response = client.get(f"/api/iframe-config/snapshots?client={client_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["client_id"] == client_id
    names = [item["name"] for item in data.get("snapshots", [])]
    assert created_name in names


@pytest.mark.api
def test_restore_iframe_config_snapshot(client: TestClient):
    """Restoring a snapshot should revert iframe config for the client."""
    client_id = f"pytest_restore_{uuid.uuid4().hex[:5]}"
    base_config = {
        "target_client_id": client_id,
        "layout": "grid",
        "gap": 14,
        "columns": 1,
        "panels": [
            {
                "id": "restore_panel",
                "url": "/?mode=base",
                "label": "original",
            }
        ],
    }

    put_response = client.put("/api/iframe-config", json=base_config)
    assert put_response.status_code == 200

    snapshot_name = f"snapshot_{uuid.uuid4().hex[:8]}"
    snapshot_response = client.post(
        "/api/iframe-config/snapshot",
        json={"client_id": client_id, "snapshot_name": snapshot_name},
    )
    assert snapshot_response.status_code == 201
    stored_snapshot_name = snapshot_response.json()["snapshot"]["name"]

    mutated_config = {
        "target_client_id": client_id,
        "layout": "grid",
        "gap": 1,
        "columns": 1,
        "panels": [
            {
                "id": "restore_panel",
                "url": "/?mode=mutated",
                "label": "updated",
            }
        ],
    }
    mutated_response = client.put("/api/iframe-config", json=mutated_config)
    assert mutated_response.status_code == 200
    assert mutated_response.json()["raw"]["gap"] == 1

    restore_response = client.post(
        "/api/iframe-config/restore",
        json={"client_id": client_id, "snapshot_name": stored_snapshot_name},
    )
    assert restore_response.status_code == 200
    payload = restore_response.json()
    assert payload["target_client_id"] == client_id
    assert payload["raw"]["gap"] == base_config["gap"]
    assert payload["raw"]["panels"][0]["label"] == "original"

    final_get = client.get(f"/api/iframe-config?client={client_id}")
    assert final_get.status_code == 200
    assert final_get.json()["raw"]["gap"] == base_config["gap"]


@pytest.mark.api
def test_get_collage_config_default(client: TestClient):
    """Test getting default collage config."""
    response = client.get("/api/collage-config")
    assert response.status_code == 200
    data = response.json()
    assert "config" in data or "images" in data


@pytest.mark.api
def test_get_collage_config_with_client(client: TestClient):
    """Test getting collage config for specific client."""
    response = client.get("/api/collage-config?client=test_client")
    assert response.status_code == 200
    data = response.json()
    assert "config" in data or "images" in data


@pytest.mark.api
def test_put_collage_config(client: TestClient):
    """Test setting collage config."""
    config = {
        "target_client_id": "test_client",
        "images": ["img1.png", "img2.png"],
        "image_count": 2,
        "rows": 10,
        "cols": 10,
        "mix": True,
        "stage_width": 1920,
        "stage_height": 1080,
        "seed": 100
    }
    
    response = client.put("/api/collage-config", json=config)
    assert response.status_code == 200
    data = response.json()
    assert "config" in data or "images" in data


@pytest.mark.api
def test_put_collage_config_validation(client: TestClient):
    """Test collage config validation."""
    # Invalid payload - FastAPI returns 422 for validation errors
    response = client.put("/api/collage-config", json="invalid")
    assert response.status_code in [400, 422]


@pytest.mark.api
def test_list_video_assets_empty_when_missing(client: TestClient, monkeypatch: pytest.MonkeyPatch, temp_dir: Path):
    """When video assets directory is missing, API returns empty list instead of error."""
    monkeypatch.setattr(settings, "video_assets_dir", str(temp_dir / "missing-videos"))
    response = client.get("/api/video-assets")
    assert response.status_code == 200
    assert response.json() == {"videos": []}


@pytest.mark.api
def test_list_video_assets_returns_sorted_urls(client: TestClient, monkeypatch: pytest.MonkeyPatch, temp_dir: Path):
    """API should surface mp4 assets with configured public base URL."""
    video_dir = temp_dir / "videos"
    video_dir.mkdir(parents=True, exist_ok=True)
    for name in ["b.mp4", "a.mp4"]:
        (video_dir / name).write_text("demo", encoding="utf-8")
    (video_dir / "ignore.txt").write_text("nope", encoding="utf-8")
    monkeypatch.setattr(settings, "video_assets_dir", str(video_dir))
    monkeypatch.setattr(settings, "video_assets_public_base", "https://cdn.example.com/videos")

    response = client.get("/api/video-assets")
    assert response.status_code == 200
    assert response.json()["videos"] == [
        {"filename": "a.mp4", "url": "https://cdn.example.com/videos/a.mp4"},
        {"filename": "b.mp4", "url": "https://cdn.example.com/videos/b.mp4"},
    ]


@pytest.mark.api
def test_list_camera_presets(client: TestClient):
    """Test listing camera presets."""
    response = client.get("/api/camera-presets")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.api
def test_save_camera_preset(client: TestClient):
    """Test saving a camera preset."""
    preset = {
        "name": "test_preset",
        "position": {"x": 0, "y": 0, "z": 5},
        "target": {"x": 0, "y": 0, "z": 0},
    }

    response = client.post("/api/camera-presets", json=preset)
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == "test_preset"
    assert data.get("scope") is None

    # Clean up
    client.delete(f"/api/camera-presets/{preset['name']}")


@pytest.mark.api
def test_save_camera_preset_validation(client: TestClient):
    """Test camera preset validation."""
    # Missing required fields
    response = client.post("/api/camera-presets", json={})
    assert response.status_code in [400, 422]


@pytest.mark.api
def test_delete_camera_preset(client: TestClient):
    """Test deleting a camera preset."""
    # First create one
    preset = {
        "name": "temp_preset",
        "position": {"x": 0, "y": 0, "z": 5},
        "target": {"x": 0, "y": 0, "z": 0},
    }
    create_response = client.post("/api/camera-presets", json=preset)
    assert create_response.status_code == 201
    
    # Then delete it
    response = client.delete("/api/camera-presets/temp_preset")
    assert response.status_code == 204


@pytest.mark.api
def test_camera_presets_scoped_by_scope_query(client: TestClient):
    """Scoped camera preset CRUD should not leak across scopes, with legacy entries kept for kinship."""
    kinship_preset = {
        "name": "scoped_kinship",
        "position": {"x": 0, "y": 1, "z": 2},
        "target": {"x": 0, "y": 0, "z": 0},
    }
    exhibition_preset = {
        "name": "scoped_exhibition",
        "position": {"x": 5, "y": 6, "z": 7},
        "target": {"x": 1, "y": 0, "z": -1},
    }
    legacy_preset = {
        "name": "legacy_scope",
        "position": {"x": 1, "y": 2, "z": 3},
        "target": {"x": -1, "y": 0, "z": 1},
    }
    shared_name_kinship = {
        "name": "shared_name",
        "position": {"x": 2, "y": 2, "z": 2},
        "target": {"x": 0, "y": 0, "z": 0},
    }
    shared_name_exhibition = {
        "name": "shared_name",
        "position": {"x": 9, "y": 9, "z": 9},
        "target": {"x": 1, "y": 0, "z": 1},
    }

    client.post("/api/camera-presets", json=kinship_preset, params={"scope": "kinship"})
    client.post("/api/camera-presets", json=exhibition_preset, params={"scope": "exhibition"})
    client.post("/api/camera-presets", json=legacy_preset)
    client.post("/api/camera-presets", json=shared_name_kinship, params={"scope": "kinship"})
    client.post("/api/camera-presets", json=shared_name_exhibition, params={"scope": "exhibition"})

    kinship_list = client.get("/api/camera-presets", params={"scope": "kinship"})
    assert kinship_list.status_code == 200
    kinship_names = [item["name"] for item in kinship_list.json()]
    assert "scoped_kinship" in kinship_names
    assert "scoped_exhibition" not in kinship_names
    assert "legacy_scope" in kinship_names
    kinship_shared = [item for item in kinship_list.json() if item["name"] == "shared_name"]
    assert kinship_shared and kinship_shared[0]["position"]["x"] == 2

    exhibition_list = client.get("/api/camera-presets", params={"scope": "exhibition"})
    assert exhibition_list.status_code == 200
    exhibition_names = [item["name"] for item in exhibition_list.json()]
    assert "scoped_exhibition" in exhibition_names
    assert "scoped_kinship" not in exhibition_names
    assert "legacy_scope" not in exhibition_names
    exhibition_shared = [item for item in exhibition_list.json() if item["name"] == "shared_name"]
    assert exhibition_shared and exhibition_shared[0]["position"]["x"] == 9

    # Update kinship shared name should not overwrite exhibition entry
    updated_shared = {
        "name": "shared_name",
        "position": {"x": 3, "y": 3, "z": 3},
        "target": {"x": 0, "y": 0, "z": 0},
    }
    client.post("/api/camera-presets", json=updated_shared, params={"scope": "kinship"})
    kinship_after_update = client.get("/api/camera-presets", params={"scope": "kinship"}).json()
    kinship_shared_after = [item for item in kinship_after_update if item["name"] == "shared_name"]
    assert kinship_shared_after and kinship_shared_after[0]["position"]["x"] == 3

    exhibition_after_update = client.get("/api/camera-presets", params={"scope": "exhibition"}).json()
    exhibition_shared_after = [item for item in exhibition_after_update if item["name"] == "shared_name"]
    assert exhibition_shared_after and exhibition_shared_after[0]["position"]["x"] == 9

    client.delete("/api/camera-presets/scoped_kinship", params={"scope": "kinship"})
    client.delete("/api/camera-presets/scoped_exhibition", params={"scope": "exhibition"})
    client.delete("/api/camera-presets/legacy_scope")
    client.delete("/api/camera-presets/shared_name", params={"scope": "kinship"})
    client.delete("/api/camera-presets/shared_name", params={"scope": "exhibition"})


@pytest.mark.api
def test_delete_camera_preset_default_scope_does_not_wipe_other_scopes(client: TestClient):
    """Deleting without scope should only target the default (kinship) scope."""
    name = "shared_scope_delete"
    kinship_preset = {
        "name": name,
        "position": {"x": 1, "y": 2, "z": 3},
        "target": {"x": 0, "y": 0, "z": 0},
    }
    exhibition_preset = {
        "name": name,
        "position": {"x": 9, "y": 9, "z": 9},
        "target": {"x": 1, "y": 1, "z": 1},
    }

    create_kinship = client.post("/api/camera-presets", json=kinship_preset)
    assert create_kinship.status_code == 201
    create_exhibition = client.post("/api/camera-presets", json=exhibition_preset, params={"scope": "exhibition"})
    assert create_exhibition.status_code == 201

    delete_response = client.delete(f"/api/camera-presets/{name}")
    assert delete_response.status_code == 204

    kinship_list = client.get("/api/camera-presets", params={"scope": "kinship"})
    assert kinship_list.status_code == 200
    assert name not in [item["name"] for item in kinship_list.json()]

    exhibition_list = client.get("/api/camera-presets", params={"scope": "exhibition"})
    assert exhibition_list.status_code == 200
    assert name in [item["name"] for item in exhibition_list.json()]

    cleanup_exhibition = client.delete(f"/api/camera-presets/{name}", params={"scope": "exhibition"})
    assert cleanup_exhibition.status_code == 204


@pytest.mark.api
def test_delete_camera_preset_not_found(client: TestClient):
    """Test deleting non-existent camera preset."""
    response = client.delete("/api/camera-presets/non_existent_preset")
    assert response.status_code == 404


@pytest.mark.api
def test_delete_camera_preset_invalid_name(client: TestClient):
    """Test deleting camera preset with invalid name."""
    response = client.delete("/api/camera-presets/invalid/name")
    # Invalid name may return 400 or 404 depending on validation
    assert response.status_code in [400, 404]
