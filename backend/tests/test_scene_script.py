import json
from pathlib import Path

from app.config import settings
from app.services.scene import load_scene_definition, resolve_scene, save_scene_definition
from app.services.script import load_script_definition, resolve_script, save_script_definition


def _write_snapshot(client: str, name: str, payload: dict) -> None:
    base = Path(settings.metadata_dir) / "snapshots" / "iframe_config" / client
    base.mkdir(parents=True, exist_ok=True)
    (base / f"{name}.json").write_text(json.dumps(payload), encoding="utf-8")


def test_resolve_scene_targets():
    metadata_dir = Path(settings.metadata_dir)
    scene_dir = metadata_dir / "scenes"
    scene_dir.mkdir(parents=True, exist_ok=True)

    snapshot_payload = {
        "layout": "grid",
        "gap": 8,
        "columns": 2,
        "panels": [{"id": "a", "url": "/?img=a.png", "ratio": 1}],
    }
    _write_snapshot("left_client", "stage_left", snapshot_payload)
    _write_snapshot("right_client", "stage_right", snapshot_payload)

    scene_payload = {
        "id": "demo_scene",
        "title": "雙螢幕測試",
        "targets": {
            "left_client": "stage_left",
            "right_client": "right_client/stage_right",
        },
        "audio_mix": {"left": 1.0, "right": 0.5, "mode": "left-dominant"},
    }
    save_scene_definition(scene_payload)

    scene = load_scene_definition("demo_scene")
    resolved = resolve_scene(scene)
    assert len(resolved.targets) == 2
    snapshots = {t.client_id: t.snapshot for t in resolved.targets}
    assert snapshots["left_client"] == "left_client/stage_left"
    assert snapshots["right_client"] == "right_client/stage_right"
    assert resolved.scene.audio_mix is not None
    assert resolved.scene.audio_mix.left == 1.0


def test_resolve_script_snapshot_pair():
    metadata_dir = Path(settings.metadata_dir)
    script_dir = metadata_dir / "scripts"
    script_dir.mkdir(parents=True, exist_ok=True)

    snapshot_payload = {"layout": "grid", "gap": 4, "columns": 1, "panels": [{"id": "p", "url": "/?img=p.png"}]}
    _write_snapshot("left", "snap_l", snapshot_payload)
    _write_snapshot("right", "snap_r", snapshot_payload)

    script_payload = {
        "id": "demo_script",
        "title": "Snapshot Pair",
        "entries": [
            {
                "type": "snapshot_pair",
                "left_snapshot": "left/snap_l",
                "right_snapshot": "right/snap_r",
                "duration": 1.5,
            }
        ],
    }
    save_script_definition(script_payload)
    script = load_script_definition("demo_script")
    resolved = resolve_script(script)

    assert resolved.total_duration == 1.5
    assert resolved.entries[0].left is not None
    assert resolved.entries[0].right is not None
    assert resolved.entries[0].left.snapshot == "left/snap_l"
    assert resolved.entries[0].right.snapshot == "right/snap_r"

