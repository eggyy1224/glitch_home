import json
from pathlib import Path

import pytest

from app.config import settings
from app.services import iframe_config as iframe_config_module
from app.services.scene import (
    load_scene_definition,
    publish_scene,
    rollback_scene,
    save_scene_definition,
)
from app.services.script import (
    load_script_definition,
    publish_script,
    rollback_script,
    save_script_definition,
)


def _write_snapshot(base_dir: Path, client: str, name: str, payload: dict) -> None:
    base = base_dir / "snapshots" / "iframe_config" / client
    base.mkdir(parents=True, exist_ok=True)
    (base / f"{name}.json").write_text(json.dumps(payload), encoding="utf-8")


def _patch_metadata(monkeypatch, base_dir: Path):
    monkeypatch.setattr(settings, "metadata_dir", str(base_dir))
    # Update module-level paths computed at import time
    from app.services import scene as scene_module
    from app.services import script as script_module

    monkeypatch.setattr(scene_module, "_SCENE_DIR", base_dir / "scenes")
    monkeypatch.setattr(scene_module, "_SCENE_HISTORY_DIR", base_dir / "history" / "scenes")
    monkeypatch.setattr(script_module, "_SCRIPT_DIR", base_dir / "scripts")
    monkeypatch.setattr(script_module, "_SCRIPT_HISTORY_DIR", base_dir / "history" / "scripts")
    monkeypatch.setattr(iframe_config_module, "_SNAPSHOT_BASE_DIR", base_dir / "snapshots" / "iframe_config")


def _basic_snapshot_payload() -> dict:
    return {"layout": "grid", "gap": 4, "columns": 1, "panels": [{"id": "p", "url": "/?img=p.png"}]}


@pytest.mark.api
def test_publish_scene_validates_and_increments_version(tmp_path: Path, monkeypatch):
    metadata_dir = tmp_path / "metadata"
    _patch_metadata(monkeypatch, metadata_dir)
    payload = _basic_snapshot_payload()
    _write_snapshot(metadata_dir, "left", "snap_l", payload)

    scene_payload = {
        "id": "demo_scene",
        "status": "draft",
        "targets": {"left": "left/snap_l"},
    }
    saved = save_scene_definition(scene_payload)
    assert saved.version == 1
    published = publish_scene("demo_scene", publish_as="tester", expected_version=saved.version)
    assert published.status == "published"
    assert published.version == 2
    history_path = metadata_dir / "history" / "scenes" / "demo_scene" / "version-0002.json"
    assert history_path.exists()


@pytest.mark.api
def test_publish_scene_missing_reference_raises(tmp_path: Path, monkeypatch):
    metadata_dir = tmp_path / "metadata"
    _patch_metadata(monkeypatch, metadata_dir)
    scene_payload = {
        "id": "broken_scene",
        "status": "draft",
        "targets": {"left": "left/missing"},
    }
    saved = save_scene_definition(scene_payload)
    with pytest.raises(FileNotFoundError):
        publish_scene("broken_scene", expected_version=saved.version)


@pytest.mark.api
def test_rollback_scene_creates_new_version(tmp_path: Path, monkeypatch):
    metadata_dir = tmp_path / "metadata"
    _patch_metadata(monkeypatch, metadata_dir)
    payload = _basic_snapshot_payload()
    _write_snapshot(metadata_dir, "left", "v1", payload)
    _write_snapshot(metadata_dir, "left", "v2", payload)

    scene_payload = {"id": "roll_scene", "status": "draft", "targets": {"left": "left/v1"}}
    saved_v1 = save_scene_definition(scene_payload)
    # new version with different target
    scene_payload["targets"] = {"left": "left/v2"}
    saved_v2 = save_scene_definition(scene_payload, expected_version=saved_v1.version)
    rolled = rollback_scene("roll_scene", target_version=saved_v1.version, expected_version=saved_v2.version)
    assert rolled.version == saved_v2.version + 1
    assert rolled.targets["left"] == "left/v1"
    assert rolled.status == "published"


@pytest.mark.api
def test_publish_script_validates_and_increments(tmp_path: Path, monkeypatch):
    metadata_dir = tmp_path / "metadata"
    _patch_metadata(monkeypatch, metadata_dir)
    payload = _basic_snapshot_payload()
    _write_snapshot(metadata_dir, "left", "snap_l", payload)

    script_payload = {
        "id": "demo_script",
        "status": "draft",
        "entries": [{"type": "snapshot_pair", "left_snapshot": "left/snap_l", "duration": 1.0}],
    }
    saved = save_script_definition(script_payload)
    assert saved.version == 1
    published = publish_script("demo_script", publish_as="tester", expected_version=saved.version)
    assert published.status == "published"
    assert published.version == 2
    history_path = metadata_dir / "history" / "scripts" / "demo_script" / "version-0002.json"
    assert history_path.exists()


@pytest.mark.api
def test_publish_script_missing_reference_raises(tmp_path: Path, monkeypatch):
    metadata_dir = tmp_path / "metadata"
    _patch_metadata(monkeypatch, metadata_dir)
    script_payload = {
        "id": "broken_script",
        "status": "draft",
        "entries": [{"type": "snapshot_pair", "left_snapshot": "left/missing", "duration": 1.0}],
    }
    saved = save_script_definition(script_payload)
    with pytest.raises(FileNotFoundError):
        publish_script("broken_script", expected_version=saved.version)


@pytest.mark.api
def test_rollback_script_creates_new_version(tmp_path: Path, monkeypatch):
    metadata_dir = tmp_path / "metadata"
    _patch_metadata(monkeypatch, metadata_dir)
    payload = _basic_snapshot_payload()
    _write_snapshot(metadata_dir, "left", "v1", payload)
    _write_snapshot(metadata_dir, "left", "v2", payload)

    script_payload = {
        "id": "roll_script",
        "status": "draft",
        "entries": [{"type": "snapshot_pair", "left_snapshot": "left/v1", "duration": 1.0}],
    }
    saved_v1 = save_script_definition(script_payload)
    script_payload["entries"] = [{"type": "snapshot_pair", "left_snapshot": "left/v2", "duration": 1.0}]
    saved_v2 = save_script_definition(script_payload, expected_version=saved_v1.version)
    rolled = rollback_script("roll_script", target_version=saved_v1.version, expected_version=saved_v2.version)
    assert rolled.version == saved_v2.version + 1
    entries = load_script_definition("roll_script", version=rolled.version).entries
    assert entries[0].left_snapshot == "left/v1"
    assert rolled.status == "published"
