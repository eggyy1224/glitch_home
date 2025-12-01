import json

from fastapi.testclient import TestClient


def _write_snapshot(client: str, name: str, metadata_dir: str) -> None:
    from pathlib import Path

    payload = {
        "layout": "grid",
        "gap": 0,
        "columns": 1,
        "panels": [{"id": "p1", "url": "/?img=test.png", "ratio": 1}],
    }
    base = Path(metadata_dir) / "snapshots" / "iframe_config" / client
    base.mkdir(parents=True, exist_ok=True)
    (base / f"{name}.json").write_text(json.dumps(payload), encoding="utf-8")


def test_scene_api_invalid_snapshot_returns_error(client: TestClient):
    body = {
        "id": "bad_scene",
        "title": "invalid",
        "targets": {"client_a": "missing_snapshot"},
    }
    resp = client.post("/api/scenes", json=body)
    assert resp.status_code in (400, 404)
    data = resp.json()
    assert "snapshot" in str(data.get("detail", "")).lower()


def test_script_api_invalid_scene_reference_returns_error(client: TestClient):
    body = {
        "id": "bad_script",
        "entries": [{"type": "scene", "scene_id": "missing_scene", "duration": 1}],
    }
    resp = client.post("/api/scripts", json=body)
    assert resp.status_code in {400, 404}


def test_scene_and_script_create_and_play(client: TestClient, mock_settings):
    # Arrange snapshots
    _write_snapshot("left_client", "snap_a", mock_settings.metadata_dir)
    _write_snapshot("right_client", "snap_b", mock_settings.metadata_dir)

    scene_body = {
        "id": "good_scene",
        "title": "ok",
        "targets": {
            "left_client": "left_client/snap_a",
            "right_client": "right_client/snap_b",
        },
        "audio_mix": {"left": 0.0, "right": 0.0, "mode": "balanced"},
    }
    scene_resp = client.post("/api/scenes", json=scene_body)
    assert scene_resp.status_code == 201, scene_resp.text
    scene_play = client.post("/api/scenes/good_scene/play", json={"audio_override": {"muted": True}})
    assert scene_play.status_code == 200, scene_play.text

    script_body = {
        "id": "good_script",
        "title": "ok",
        "entries": [
            {"type": "scene", "scene_id": "good_scene", "duration": 1},
        ],
    }
    script_resp = client.post("/api/scripts", json=script_body)
    assert script_resp.status_code == 201, script_resp.text
    script_play = client.post("/api/scripts/good_script/play")
    assert script_play.status_code == 200, script_play.text
