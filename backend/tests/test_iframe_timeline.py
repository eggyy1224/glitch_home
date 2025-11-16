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
