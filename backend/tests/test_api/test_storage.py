"""Tests for storage-related API endpoints (iframe-config, collage-config, camera-presets)."""

import os
from pathlib import Path
import uuid

import pytest
from fastapi.testclient import TestClient


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
def test_snapshot_iframe_config_creates_file(client: TestClient):
    """Ensure snapshot endpoint stores config on disk."""
    client_id = f"pytest_snapshot_{uuid.uuid4().hex[:6]}"
    snapshot_name = f"snapshot_{uuid.uuid4().hex[:8]}"

    response = client.post(
        "/api/iframe-config/snapshot",
        json={"client_id": client_id, "snapshot_name": snapshot_name},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["client_id"] == client_id
    assert data["snapshot"]["name"] == snapshot_name

    metadata_dir = Path(os.environ["METADATA_DIR"])
    snapshot_path = metadata_dir / "snapshots" / "iframe_config" / client_id / f"{snapshot_name}.json"
    assert snapshot_path.exists()


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

    response = client.get(f"/api/iframe-config/snapshots?client={client_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["client_id"] == client_id
    names = [item["name"] for item in data.get("snapshots", [])]
    assert snapshot_name in names


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
        json={"client_id": client_id, "snapshot_name": snapshot_name},
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
        "target": {"x": 0, "y": 0, "z": 0}
    }
    
    response = client.post("/api/camera-presets", json=preset)
    assert response.status_code == 201
    
    data = response.json()
    assert data["name"] == "test_preset"
    
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
        "target": {"x": 0, "y": 0, "z": 0}
    }
    create_response = client.post("/api/camera-presets", json=preset)
    assert create_response.status_code == 201
    
    # Then delete it
    response = client.delete("/api/camera-presets/temp_preset")
    assert response.status_code == 204


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
