import pytest

from app.services.iframe_timeline import save_iframe_timeline_definition


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
