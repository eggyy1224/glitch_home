import pytest

from app.services.iframe_timeline import save_iframe_timeline_definition
from pathlib import Path
import shutil


def _make_timeline(timeline_id: str, client_id: str) -> None:
    payload = {
        "id": timeline_id,
        "title": f"title-{timeline_id}",
        "clientId": client_id,
        "steps": [
            {"snapshot": f"{client_id}/snap_a", "duration": 1.0},
            {"snapshot": f"{client_id}/snap_b", "duration": 1.5},
        ],
    }
    save_iframe_timeline_definition(payload)


def test_episode_crud_and_play(client):
    _make_timeline("t1", "c1")
    _make_timeline("t2", "c2")

    create_payload = {
        "id": "ep_demo",
        "title": "示範 Episode",
        "tracks": [
            {"timelineId": "t1", "targetClientId": "c1"},
            {"timelineId": "t2", "targetClientId": "c2", "loopOverride": True, "startStep": 1},
        ],
    }
    resp = client.post("/api/episodes", json=create_payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()["episode"]
    assert data["id"] == "ep_demo"
    assert data["track_count"] == 2

    list_resp = client.get("/api/episodes")
    assert list_resp.status_code == 200
    assert len(list_resp.json()["episodes"]) == 1

    raw_resp = client.get("/api/episodes/ep_demo?resolve=false")
    assert raw_resp.status_code == 200
    assert raw_resp.json()["episode"]["tracks"][0]["timelineId"] == "t1"

    update_resp = client.put("/api/episodes/ep_demo", json={**create_payload, "title": "更新後"})
    assert update_resp.status_code == 200
    assert update_resp.json()["episode"]["title"] == "更新後"

    clone_resp = client.post("/api/episodes/ep_demo/clone", json={"new_id": "ep_copy"})
    assert clone_resp.status_code == 201
    assert clone_resp.json()["episode"]["id"] == "ep_copy"

    play_resp = client.post(
        "/api/episodes/ep_demo/play",
        json={"target_client_map": {"t2": "c2_override"}, "command_id_prefix": "cmd_ep"},
    )
    assert play_resp.status_code == 200
    play_data = play_resp.json()
    assert play_data["status"] == "queued"
    assert len(play_data["tracks"]) == 2
    overrides = {track["timeline_id"]: track for track in play_data["tracks"]}
    assert overrides["t2"]["target_client_id"] == "c2_override"
    assert overrides["t1"]["options"]["commandId"].startswith("cmd_ep:")

    del1 = client.delete("/api/episodes/ep_demo")
    del2 = client.delete("/api/episodes/ep_copy")
    assert del1.status_code == 200
    assert del2.status_code == 200


def test_update_missing_episode_returns_404(client):
    payload = {
        "id": "missing_ep",
        "title": "should fail",
        "tracks": [{"timelineId": "t1", "targetClientId": "c1"}],
    }
    resp = client.put("/api/episodes/missing_ep", json=payload)
    assert resp.status_code == 404


def test_create_resolution_failure_does_not_persist(client, tmp_path, monkeypatch):
    from app.config import settings

    episodes_dir = Path(settings.metadata_dir) / "episodes"
    shutil.rmtree(episodes_dir, ignore_errors=True)
    episodes_dir.mkdir(parents=True, exist_ok=True)
    episodes_path = episodes_dir / "ep_bad.json"

    payload = {
        "id": "ep_bad",
        "title": "broken",
        "tracks": [{"timelineId": "missing_timeline", "targetClientId": "c1"}],
    }
    resp = client.post("/api/episodes", json=payload)
    assert resp.status_code == 404

    assert not episodes_path.exists()


def test_update_resolution_failure_does_not_change_file(client, tmp_path, monkeypatch):
    from app.config import settings

    episodes_dir = Path(settings.metadata_dir) / "episodes"
    shutil.rmtree(episodes_dir, ignore_errors=True)
    episodes_dir.mkdir(parents=True, exist_ok=True)

    _make_timeline("t1", "c1")
    create_payload = {
        "id": "ep_ok",
        "title": "good",
        "tracks": [{"timelineId": "t1", "targetClientId": "c1"}],
    }
    ok_resp = client.post("/api/episodes", json=create_payload)
    assert ok_resp.status_code == 201

    # attempt to update with bad timeline, expect 404 and original file intact
    bad_update = {
        "id": "ep_ok",
        "title": "bad",
        "tracks": [{"timelineId": "missing_timeline", "targetClientId": "c1"}],
    }
    resp = client.put("/api/episodes/ep_ok", json=bad_update)
    assert resp.status_code == 404

    episode_file = Path(settings.metadata_dir) / "episodes" / "ep_ok.json"
    assert episode_file.exists()
    content = episode_file.read_text(encoding="utf-8")
    assert "missing_timeline" not in content


def test_clone_resolution_failure_does_not_persist(client):
    from app.config import settings

    episodes_dir = Path(settings.metadata_dir) / "episodes"
    timelines_dir = Path(settings.metadata_dir) / "timelines" / "iframe"
    shutil.rmtree(episodes_dir, ignore_errors=True)
    shutil.rmtree(timelines_dir, ignore_errors=True)
    episodes_dir.mkdir(parents=True, exist_ok=True)
    timelines_dir.mkdir(parents=True, exist_ok=True)

    _make_timeline("t1", "c1")
    create_payload = {
        "id": "ep_source",
        "title": "source",
        "tracks": [{"timelineId": "t1", "targetClientId": "c1"}],
    }
    ok_resp = client.post("/api/episodes", json=create_payload)
    assert ok_resp.status_code == 201

    # remove the timeline so clone resolution will fail
    target_timeline = timelines_dir / "t1.json"
    if target_timeline.exists():
        target_timeline.unlink()

    resp = client.post("/api/episodes/ep_source/clone", json={"new_id": "ep_clone"})
    assert resp.status_code == 404

    clone_path = episodes_dir / "ep_clone.json"
    assert not clone_path.exists()
    # source file should remain
    assert (episodes_dir / "ep_source.json").exists()
