import json
from pathlib import Path

from app.config import settings


def _prepare_episode_metadata(
    episode_id: str,
    timeline_id: str,
    client_id: str,
) -> None:
    metadata_dir = Path(settings.metadata_dir)
    snapshot_dir = metadata_dir / "snapshots" / "iframe_config" / client_id
    timeline_dir = metadata_dir / "timelines" / "iframe"
    episode_dir = metadata_dir / "episodes"

    snapshot_payload = {
        "layout": "grid",
        "gap": 10,
        "columns": 2,
        "panels": [{"id": "main", "url": "/?img=api.png", "ratio": 1.0}],
    }
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    (snapshot_dir / "api_stage.json").write_text(json.dumps(snapshot_payload), encoding="utf-8")

    timeline_dir.mkdir(parents=True, exist_ok=True)
    timeline_payload = {
        "id": timeline_id,
        "title": "API Demo timeline",
        "clientId": client_id,
        "steps": [
            {"snapshot": f"{client_id}/api_stage", "duration": 4},
        ],
    }
    (timeline_dir / f"{timeline_id}.json").write_text(json.dumps(timeline_payload), encoding="utf-8")

    episode_dir.mkdir(parents=True, exist_ok=True)
    episode_payload = {
        "id": episode_id,
        "title": "Episode API Demo",
        "tags": ["api"],
        "timelineId": timeline_id,
        "clientsLayout": {client_id: {"role": "api"}},
        "assets": {"audio": ["api.mp3"]},
    }
    (episode_dir / f"{episode_id}.json").write_text(json.dumps(episode_payload), encoding="utf-8")


def test_episode_endpoints(client):
    episode_id = "api_episode_demo"
    timeline_id = "api_episode_timeline"
    client_id = "api_client"
    _prepare_episode_metadata(episode_id, timeline_id, client_id)

    resp = client.get("/api/episodes")
    assert resp.status_code == 200
    data = resp.json()
    ids = {item["id"] for item in data["episodes"]}
    assert episode_id in ids

    resp_detail = client.get(f"/api/episodes/{episode_id}")
    assert resp_detail.status_code == 200
    episode_payload = resp_detail.json()["episode"]
    assert episode_payload["id"] == episode_id
    assert episode_payload["timeline"]["id"] == timeline_id
    assert episode_payload["timeline"]["steps"][0]["snapshot"].startswith(client_id)

    resp_missing = client.get("/api/episodes/not_exist")
    assert resp_missing.status_code == 404
