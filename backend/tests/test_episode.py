import json
from pathlib import Path

import pytest

from app.config import settings
from app.services.episode import list_episodes, load_episode_definition, resolve_episode


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _prepare_episode_fixture(
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
        "gap": 12,
        "columns": 2,
        "panels": [
            {"id": "left", "url": "/?img=left.png", "ratio": 1.0},
            {"id": "right", "url": "/?img=right.png", "ratio": 1.0},
        ],
    }
    _write_json(snapshot_dir / "stage_one.json", snapshot_payload)
    _write_json(
        snapshot_dir / "stage_two.json",
        {**snapshot_payload, "gap": 8, "columns": 3},
    )

    timeline_payload = {
        "id": timeline_id,
        "title": f"{timeline_id} title",
        "clientId": client_id,
        "steps": [
            {"snapshot": f"{client_id}/stage_one", "duration": 5},
            {"snapshot": f"{client_id}/stage_two", "duration": 7},
        ],
    }
    _write_json(timeline_dir / f"{timeline_id}.json", timeline_payload)

    episode_payload = {
        "id": episode_id,
        "title": f"{episode_id} title",
        "description": "demo",
        "tags": ["demo"],
        "timelineId": timeline_id,
        "assets": {"images": ["demo.png"], "audio": ["demo.mp3"]},
        "clientsLayout": {client_id: {"role": "primary"}},
        "meta": {"version": "v1", "status": "published"},
    }
    _write_json(episode_dir / f"{episode_id}.json", episode_payload)


def test_load_and_resolve_episode_payload():
    episode_id = "episode_demo_unit"
    timeline_id = "episode_demo_timeline"
    client_id = "episode_demo_client"
    _prepare_episode_fixture(episode_id, timeline_id, client_id)

    episode = load_episode_definition(episode_id)
    assert episode.id == episode_id
    assert episode.timeline_id == timeline_id
    assert episode.meta.status.value == "published"

    resolved = resolve_episode(episode)
    payload = resolved.to_payload()
    assert payload["id"] == episode_id
    assert payload["timeline"]["id"] == timeline_id
    assert payload["assets"]["images"] == ["demo.png"]
    assert payload["meta"]["status"] == "published"
    assert payload["timeline"]["step_count"] == 2


def test_list_episodes_supports_client_filter():
    first_episode = "episode_client_a"
    second_episode = "episode_client_b"
    _prepare_episode_fixture(first_episode, "timeline_a", "client_a")
    _prepare_episode_fixture(second_episode, "timeline_b", "client_b")

    episodes = list_episodes()
    ids = {entry["id"] for entry in episodes}
    assert first_episode in ids
    assert second_episode in ids

    filtered = list_episodes("client_a")
    assert len(filtered) == 1
    assert filtered[0]["id"] == first_episode

    assert list_episodes("client_z") == []

    with pytest.raises(ValueError):
        list_episodes("invalid client!")
