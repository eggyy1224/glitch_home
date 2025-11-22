import json
import logging
import shutil
from pathlib import Path

import pytest

from app.config import settings
from app.services.episode import list_episodes


def _reset_episodes_dir() -> Path:
    episodes_dir = Path(settings.metadata_dir) / "episodes"
    shutil.rmtree(episodes_dir, ignore_errors=True)
    episodes_dir.mkdir(parents=True, exist_ok=True)
    return episodes_dir


def _write_episode(path: Path, episode_id: str = "ep_ok") -> None:
    payload = {
        "id": episode_id,
        "title": "標題",
        "tracks": [
            {
                "timelineId": "t1",
            }
        ],
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_list_episodes_logs_corrupt_json(caplog):
    episodes_dir = _reset_episodes_dir()
    caplog.set_level(logging.WARNING)

    bad_file = episodes_dir / "broken.json"
    bad_file.write_text("{this is not valid json}", encoding="utf-8")

    good_file = episodes_dir / "good.json"
    _write_episode(good_file, episode_id="ep_valid")

    entries = list_episodes()

    assert len(entries) == 1
    assert entries[0]["id"] == "ep_valid"
    assert any("broken.json" in record.message for record in caplog.records)


def test_list_episodes_raises_on_unexpected_error(monkeypatch):
    episodes_dir = _reset_episodes_dir()

    blocked = episodes_dir / "locked.json"
    blocked.touch()
    _write_episode(episodes_dir / "z_good.json", episode_id="ep_after")

    original_open = Path.open

    def fake_open(self, *args, **kwargs):  # type: ignore[override]
        if self == blocked:
            raise PermissionError("permission denied")
        return original_open(self, *args, **kwargs)

    monkeypatch.setattr(Path, "open", fake_open)

    with pytest.raises(PermissionError):
        list_episodes()
