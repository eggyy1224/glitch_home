import json
from pathlib import Path

from app.config import settings
from app.services.iframe_timeline import (
    load_iframe_timeline_definition,
    resolve_iframe_timeline,
)


def test_resolve_demo_timeline():
    metadata_dir = Path(settings.metadata_dir)
    timeline_dir = metadata_dir / "timelines" / "iframe"
    snapshot_dir = metadata_dir / "snapshots" / "iframe_config" / "demo_client"
    timeline_dir.mkdir(parents=True, exist_ok=True)
    snapshot_dir.mkdir(parents=True, exist_ok=True)

    snapshot_payload = {
        "layout": "grid",
        "gap": 16,
        "columns": 2,
        "panels": [
            {"id": "a", "url": "/?img=test_a.png", "ratio": 1},
            {"id": "b", "url": "/?img=test_b.png", "ratio": 1},
        ],
    }
    (snapshot_dir / "stage_01.json").write_text(json.dumps(snapshot_payload), encoding="utf-8")
    (snapshot_dir / "stage_02.json").write_text(
        json.dumps({**snapshot_payload, "gap": 8, "columns": 3}),
        encoding="utf-8",
    )

    timeline_payload = {
        "id": "demo_opening",
        "title": "Demo Opening",
        "clientId": "demo_client",
        "steps": [
            {"snapshot": "demo_client/stage_01", "duration": 5},
            {"snapshot": "demo_client/stage_02", "duration": 7},
        ],
    }
    (timeline_dir / "demo_opening.json").write_text(json.dumps(timeline_payload), encoding="utf-8")

    timeline = load_iframe_timeline_definition("demo_opening")
    resolved = resolve_iframe_timeline(timeline)
    payload = resolved.to_payload()

    assert payload["id"] == "demo_opening"
    assert payload["step_count"] == 2
    assert payload["total_duration"] == 12
    assert len(payload["steps"]) == 2
    first_step = payload["steps"][0]
    assert first_step["snapshot"] == "demo_client/stage_01"
    assert first_step["config"]["layout"] == "grid"
    assert first_step["config"]["panels"][0]["src"].startswith("/")


def test_resolve_timeline_with_per_step_clients():
    metadata_dir = Path(settings.metadata_dir)
    timeline_dir = metadata_dir / "timelines" / "iframe"
    client_a_snapshot_dir = metadata_dir / "snapshots" / "iframe_config" / "client_a"
    client_b_snapshot_dir = metadata_dir / "snapshots" / "iframe_config" / "client_b"
    timeline_dir.mkdir(parents=True, exist_ok=True)
    client_a_snapshot_dir.mkdir(parents=True, exist_ok=True)
    client_b_snapshot_dir.mkdir(parents=True, exist_ok=True)

    client_a_snapshot = {
        "layout": "grid",
        "gap": 10,
        "columns": 2,
        "panels": [
            {"id": "a1", "url": "/?img=a1.png", "ratio": 1},
            {"id": "a2", "url": "/?img=a2.png", "ratio": 1},
        ],
    }
    client_b_snapshot = {
        "layout": "vertical",
        "gap": 4,
        "columns": 1,
        "panels": [
            {"id": "b1", "url": "/?img=b1.png", "ratio": 1},
        ],
    }
    (client_a_snapshot_dir / "stage_a.json").write_text(json.dumps(client_a_snapshot), encoding="utf-8")
    (client_b_snapshot_dir / "stage_b.json").write_text(json.dumps(client_b_snapshot), encoding="utf-8")

    timeline_payload = {
        "id": "per_step_demo",
        "title": "Per Step Clients",
        "steps": [
            {"snapshot": "stage_a", "duration": 3, "clientId": "client_a"},
            {"snapshot": "stage_b", "duration": 6, "clientId": "client_b"},
        ],
    }
    (timeline_dir / "per_step_demo.json").write_text(json.dumps(timeline_payload), encoding="utf-8")

    timeline = load_iframe_timeline_definition("per_step_demo")
    resolved = resolve_iframe_timeline(timeline)
    payload = resolved.to_payload()

    assert payload["client_id"] is None
    assert payload["total_duration"] == 9
    assert len(payload["steps"]) == 2
    first_step = payload["steps"][0]
    second_step = payload["steps"][1]
    assert first_step["client_id"] == "client_a"
    assert first_step["config"]["columns"] == 2
    assert second_step["client_id"] == "client_b"
    assert second_step["config"]["layout"] == "vertical"


def test_resolve_timeline_with_actions():
    metadata_dir = Path(settings.metadata_dir)
    timeline_dir = metadata_dir / "timelines" / "iframe"
    snapshot_dir = metadata_dir / "snapshots" / "iframe_config" / "action_client"
    timeline_dir.mkdir(parents=True, exist_ok=True)
    snapshot_dir.mkdir(parents=True, exist_ok=True)

    snapshot_payload = {
        "layout": "grid",
        "gap": 4,
        "columns": 1,
        "panels": [{"id": "solo", "url": "/?img=solo.png", "ratio": 1}],
    }
    (snapshot_dir / "stage_action.json").write_text(json.dumps(snapshot_payload), encoding="utf-8")

    timeline_payload = {
        "id": "actions_demo",
        "title": "Actions Demo",
        "clientId": "action_client",
        "steps": [
            {
                "snapshot": "stage_action",
                "duration": 6,
                "subtitle": {
                    "text": "字幕測試",
                    "language": "zh-TW",
                    "duration_seconds": 5,
                },
                "caption": {
                    "clear": True,
                },
                "tts": {
                    "mode": "speak_with_subtitle",
                    "text": "大家好，歡迎收看",
                    "auto_play": False,
                },
            }
        ],
    }
    (timeline_dir / "actions_demo.json").write_text(json.dumps(timeline_payload), encoding="utf-8")

    timeline = load_iframe_timeline_definition("actions_demo")
    resolved = resolve_iframe_timeline(timeline)
    payload = resolved.to_payload()

    assert payload["step_count"] == 1
    step = payload["steps"][0]
    assert step["subtitle"]["text"] == "字幕測試"
    assert step["subtitle"]["target_client_id"] == "action_client"
    assert step["caption"]["clear"] is True
    assert "text" not in step["caption"]
    assert step["tts"]["mode"] == "speak_with_subtitle"
    assert step["tts"]["subtitle_text"] == "大家好，歡迎收看"
    assert step["tts"]["target_client_id"] == "action_client"
