"""Unit tests for filesystem and metadata utilities."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path

from app.config import settings
from app.utils.fs import ensure_dirs
from app.utils.metadata import compute_sha256, utc_now_iso_z, write_metadata


def test_ensure_dirs_creates_nested_directories(tmp_path):
    nested = tmp_path / "level1" / "level2" / "level3"
    ensure_dirs([str(nested)])
    assert nested.exists()
    assert nested.is_dir()


def test_write_metadata_overrides_directory(monkeypatch, tmp_path):
    target_dir = tmp_path / "metadata"
    monkeypatch.setattr(settings, "metadata_dir", str(target_dir))
    payload = {"foo": "bar", "count": 1}
    path = write_metadata(payload, base_name="sample_entry")

    assert Path(path).is_file()
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    assert data == payload
    assert Path(path).parent == target_dir


def test_utc_now_iso_z_format():
    stamp = utc_now_iso_z()
    assert stamp.endswith("Z")
    parsed = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    assert parsed.tzinfo is not None


def test_compute_sha256(tmp_path):
    target_file = tmp_path / "blob.bin"
    blob = b"glitch-home"
    target_file.write_bytes(blob)

    result = compute_sha256(target_file)
    assert result == hashlib.sha256(blob).hexdigest()
