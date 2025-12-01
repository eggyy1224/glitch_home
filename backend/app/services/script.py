from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import ValidationError

from ..config import settings
from ..models.iframe import IframeConfig
from ..models.scene import AudioMix
from ..models.script import Script, ScriptEntry
from ..utils.permissions import ensure_metadata_write_enabled
from .iframe_config import config_payload_for_response, load_iframe_config_snapshot_config, sanitize_client_id
from .iframe_timeline import _split_snapshot_reference
from .scene import (
    ResolvedScene,
    play_scene,
    resolve_scene,
    load_scene_definition,
)
from .realtime_bus import realtime_broadcaster

logger = logging.getLogger(__name__)

_SCRIPT_DIR = Path(settings.metadata_dir) / "scripts"
_SCRIPT_HISTORY_DIR = Path(settings.metadata_dir) / "history" / "scripts"
_SCRIPT_HISTORY_LIMIT = 200
_SCRIPT_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
_running_scripts: Dict[str, asyncio.Task[None]] = {}


@dataclass
class ResolvedSnapshotTarget:
    client_id: str
    snapshot: str
    config: IframeConfig

    def to_payload(self) -> Dict[str, object]:
        return {
            "client_id": self.client_id,
            "snapshot": self.snapshot,
            "config": config_payload_for_response(self.config, self.client_id),
        }


@dataclass
class ResolvedScriptEntry:
    entry: ScriptEntry
    index: int
    duration: float
    scene: Optional[ResolvedScene] = None
    left: Optional[ResolvedSnapshotTarget] = None
    right: Optional[ResolvedSnapshotTarget] = None

    def to_payload(self) -> Dict[str, object]:
        payload: Dict[str, object] = {
            "index": self.index,
            "type": self.entry.type,
            "duration": self.duration,
            "notes": self.entry.notes,
        }
        if self.entry.audio_override:
            payload["audio_override"] = self.entry.audio_override.model_dump(mode="json")
        if self.scene:
            payload["scene"] = self.scene.to_payload()
        if self.left:
            payload["left_snapshot"] = self.left.to_payload()
        if self.right:
            payload["right_snapshot"] = self.right.to_payload()
        return payload


@dataclass
class ResolvedScript:
    script: Script
    entries: List[ResolvedScriptEntry]
    total_duration: float

    def to_payload(self) -> Dict[str, object]:
        return {
            "id": self.script.id,
            "title": self.script.title,
            "entry_count": len(self.entries),
            "total_duration": self.total_duration,
            "entries": [entry.to_payload() for entry in self.entries],
            "tags": self.script.tags,
            "description": self.script.description,
            "notes": self.script.notes,
        }


def _sanitize_script_id(value: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError("script_id 不可為空白")
    if not _SCRIPT_ID_PATTERN.fullmatch(cleaned):
        raise ValueError("script_id 僅允許字母、數字、底線、連字號")
    return cleaned


def sanitize_script_id(value: str) -> str:
    """Public helper for validating script ids."""

    return _sanitize_script_id(value)


def _script_path_for(script_id: str) -> Path:
    safe_id = _sanitize_script_id(script_id)
    return _SCRIPT_DIR / f"{safe_id}.json"


def _script_history_dir_for(script_id: str) -> Path:
    safe_id = _sanitize_script_id(script_id)
    return _SCRIPT_HISTORY_DIR / safe_id


def _script_version_path(script_id: str, version: int) -> Path:
    return _script_history_dir_for(script_id) / f"version-{version:04d}.json"


def _ensure_script_dir() -> None:
    if not _SCRIPT_DIR.exists():
        _SCRIPT_DIR.mkdir(parents=True, exist_ok=True)
    if not _SCRIPT_HISTORY_DIR.exists():
        _SCRIPT_HISTORY_DIR.mkdir(parents=True, exist_ok=True)


def _write_script_history(script: Script) -> None:
    history_dir = _script_history_dir_for(script.id)
    history_dir.mkdir(parents=True, exist_ok=True)
    version_path = _script_version_path(script.id, script.version)
    with version_path.open("w", encoding="utf-8") as fp:
        json.dump(script.model_dump(mode="json", by_alias=True), fp, ensure_ascii=False, indent=2)
    versions = sorted(history_dir.glob("version-*.json"))
    if _SCRIPT_HISTORY_LIMIT and len(versions) > _SCRIPT_HISTORY_LIMIT:
        excess = len(versions) - _SCRIPT_HISTORY_LIMIT
        for old_path in versions[:excess]:
            try:
                old_path.unlink()
            except OSError:
                logger.warning("清理舊 Script 版本失敗：%s", old_path)


def save_script_definition(payload: dict, script_id: Optional[str] = None, expected_version: int | None = None) -> Script:
    ensure_metadata_write_enabled("script_definition")
    if not isinstance(payload, dict):
        raise ValueError("payload 必須為 JSON 物件")
    candidate_id = script_id or payload.get("id")
    if not candidate_id:
        raise ValueError("script id 必填")
    safe_id = _sanitize_script_id(candidate_id)
    payload = {**payload, "id": safe_id}

    existing: Script | None = None
    path = _script_path_for(safe_id)
    if path.exists():
        try:
            existing = load_script_definition(safe_id)
        except Exception:  # noqa: BLE001
            existing = None

    if expected_version is not None and existing is not None and existing.version != expected_version:
        raise ValueError("版本不符，請重新載入後再試")

    base_version = expected_version if expected_version is not None else (existing.version if existing else 0)
    payload_version = payload.get("version")
    next_version = max(int(payload_version) if payload_version else 0, base_version + 1)

    now = datetime.now(timezone.utc)
    payload.setdefault("created_at", existing.created_at if existing else now)
    payload["updated_at"] = now
    payload.setdefault("status", payload.get("status") or (existing.status if existing else "published"))
    payload["version"] = next_version

    script = Script.model_validate(payload)

    _ensure_script_dir()
    with path.open("w", encoding="utf-8") as fp:
        json.dump(script.model_dump(mode="json", by_alias=True), fp, ensure_ascii=False, indent=2)
    _write_script_history(script)
    return script


def load_script_definition(script_id: str, version: int | None = None) -> Script:
    if version is not None:
        version_path = _script_version_path(script_id, int(version))
        if not version_path.exists():
            raise FileNotFoundError("script 指定版本不存在")
        with version_path.open("r", encoding="utf-8") as fp:
            raw = json.load(fp)
        raw.setdefault("id", script_id)
        raw["id"] = _sanitize_script_id(raw["id"])
        return Script.model_validate(raw)
    path = _script_path_for(script_id)
    if not path.exists():
        raise FileNotFoundError("script 不存在")
    with path.open("r", encoding="utf-8") as fp:
        raw = json.load(fp)
    raw.setdefault("id", script_id)
    raw["id"] = _sanitize_script_id(raw["id"])
    return Script.model_validate(raw)


def delete_script_definition(script_id: str) -> None:
    ensure_metadata_write_enabled("script_delete")
    path = _script_path_for(script_id)
    if not path.exists():
        raise FileNotFoundError("script 不存在")
    path.unlink()


def clone_script_definition(source_id: str, new_id: str) -> Script:
    ensure_metadata_write_enabled("script_clone")
    source = load_script_definition(source_id)
    payload = source.model_dump(mode="json")
    payload["id"] = _sanitize_script_id(new_id)
    return save_script_definition(payload)


def list_scripts() -> List[Dict[str, object]]:
    entries: List[Dict[str, object]] = []
    _ensure_script_dir()
    for path in sorted(_SCRIPT_DIR.glob("*.json")):
        try:
            with path.open("r", encoding="utf-8") as fp:
                raw = json.load(fp)
            raw.setdefault("id", path.stem)
            raw["id"] = _sanitize_script_id(raw["id"])
            script = Script.model_validate(raw)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            logger.warning("略過 Script 檔案 %s：%s", path.name, exc)
            continue
        entries.append(
            {
                "id": script.id,
                "title": script.title,
                "entry_count": len(script.entries),
                "tags": script.tags,
                "version": script.version,
                "status": script.status,
                "updated_at": script.updated_at.isoformat() if script.updated_at else None,
            }
        )
    return entries


def _resolve_snapshot_target(snapshot_ref: str) -> ResolvedSnapshotTarget:
    client, name = _split_snapshot_reference(snapshot_ref, None)
    snapshot_client = sanitize_client_id(client)
    if not snapshot_client:
        raise ValueError("snapshot 參考缺少 client_id")
    config = load_iframe_config_snapshot_config(snapshot_client, name)
    return ResolvedSnapshotTarget(client_id=snapshot_client, snapshot=f"{snapshot_client}/{name}", config=config)


def resolve_script(script: Script) -> ResolvedScript:
    resolved_entries: List[ResolvedScriptEntry] = []
    cursor = 0.0
    for idx, entry in enumerate(script.entries):
        resolved_entry = ResolvedScriptEntry(entry=entry, index=idx, duration=entry.duration)
        if entry.type == "scene":
            scene = load_scene_definition(entry.scene_id or "")
            resolved_entry.scene = resolve_scene(scene)
        else:
            if entry.left_snapshot:
                resolved_entry.left = _resolve_snapshot_target(entry.left_snapshot)
            if entry.right_snapshot:
                resolved_entry.right = _resolve_snapshot_target(entry.right_snapshot)
            if not resolved_entry.left and not resolved_entry.right:
                raise ValueError(f"entry {idx} 缺少 snapshot_pair 設定")
        cursor += entry.duration
        resolved_entries.append(resolved_entry)
    return ResolvedScript(script=script, entries=resolved_entries, total_duration=cursor)


async def _apply_snapshot_target(target: ResolvedSnapshotTarget) -> None:
    payload = config_payload_for_response(target.config, target.client_id)
    await realtime_broadcaster.broadcast_iframe_config(payload, target_client_id=target.client_id)


async def _apply_audio_mix(
    left_target: ResolvedSnapshotTarget | None,
    right_target: ResolvedSnapshotTarget | None,
    mix: AudioMix,
) -> None:
    if mix is None:
        return

    async def _send_volume(target: ResolvedSnapshotTarget, volume: Optional[float]) -> None:
        if volume is None:
            return
        payload = {"action": "set_volume", "volume": max(0.0, min(1.0, float(volume))), "target_client_id": target.client_id}
        await realtime_broadcaster.broadcast_video_control(payload, target_client_id=target.client_id)

    tasks: List[asyncio.Task[None]] = []
    if left_target:
        tasks.append(asyncio.create_task(_send_volume(left_target, mix.left)))
    if right_target:
        tasks.append(asyncio.create_task(_send_volume(right_target, mix.right)))

    if mix.muted is not None:
        for target in (t for t in (left_target, right_target) if t is not None):
            payload = {"action": "set_muted", "muted": bool(mix.muted), "target_client_id": target.client_id}
            tasks.append(asyncio.create_task(realtime_broadcaster.broadcast_video_control(payload, target_client_id=target.client_id)))

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def _apply_script_entry(entry: ResolvedScriptEntry, global_audio_override: Optional[AudioMix]) -> None:
    audio_mix = entry.entry.audio_override or global_audio_override
    if entry.scene:
        scene_model = entry.scene.scene
        await play_scene(scene_model, audio_override=audio_mix)
        return

    targets = [target for target in (entry.left, entry.right) if target is not None]
    for target in targets:
        await _apply_snapshot_target(target)
    if audio_mix:
        await _apply_audio_mix(entry.left, entry.right, audio_mix)


async def _run_script(resolved: ResolvedScript, audio_override: Optional[AudioMix]) -> None:
    try:
        for entry in resolved.entries:
            await _apply_script_entry(entry, audio_override)
            await asyncio.sleep(entry.duration)
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.error("Script %s 執行失敗: %s", resolved.script.id, exc, exc_info=exc)


async def play_script(script: Script, audio_override: Optional[AudioMix] = None, *, allow_draft: bool = False) -> ResolvedScript:
    if not allow_draft and script.status != "published":
        raise ValueError("僅允許播放已發布的 script")
    resolved = resolve_script(script)
    existing = _running_scripts.get(script.id)
    if existing:
        existing.cancel()
    task = asyncio.create_task(_run_script(resolved, audio_override))
    _running_scripts[script.id] = task

    def _cleanup(_):
        _running_scripts.pop(script.id, None)

    task.add_done_callback(_cleanup)
    return resolved


def stop_script(script_id: str) -> bool:
    task = _running_scripts.pop(script_id, None)
    if task is None:
        return False
    task.cancel()
    return True


def list_script_versions(script_id: str) -> List[Dict[str, object]]:
    versions: List[Dict[str, object]] = []
    history_dir = _script_history_dir_for(script_id)
    if not history_dir.exists():
        return versions
    for path in sorted(history_dir.glob("version-*.json")):
        try:
            with path.open("r", encoding="utf-8") as fp:
                raw = json.load(fp)
            raw.setdefault("id", script_id)
            raw["id"] = _sanitize_script_id(raw["id"])
            script = Script.model_validate(raw)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            logger.warning("略過 Script 版本檔案 %s：%s", path.name, exc)
            continue
        versions.append(
            {
                "version": script.version,
                "status": script.status,
                "created_at": script.created_at.isoformat() if script.created_at else None,
                "updated_at": script.updated_at.isoformat() if script.updated_at else None,
                "published_at": script.published_at.isoformat() if script.published_at else None,
                "published_by": script.published_by,
            }
        )
    return versions


def publish_script(script_id: str, *, publish_as: str | None = None, expected_version: int | None = None) -> Script:
    ensure_metadata_write_enabled("script_publish")
    base = load_script_definition(script_id)
    if expected_version is not None and base.version != expected_version:
        raise ValueError("版本不符，請重新載入後再試")
    # 發布前驗證引用
    resolve_script(base)
    now = datetime.now(timezone.utc)
    payload = base.model_dump(mode="json", by_alias=True)
    payload["status"] = "published"
    payload["published_at"] = now
    payload["published_by"] = publish_as or base.published_by
    payload["updated_at"] = now
    return save_script_definition(payload, script_id=script_id, expected_version=base.version)


def rollback_script(script_id: str, target_version: int, *, publish_as: str | None = None, expected_version: int | None = None) -> Script:
    ensure_metadata_write_enabled("script_rollback")
    current = load_script_definition(script_id)
    if expected_version is not None and current.version != expected_version:
        raise ValueError("版本不符，請重新載入後再試")
    target = load_script_definition(script_id, version=target_version)
    resolve_script(target)
    now = datetime.now(timezone.utc)
    payload = target.model_dump(mode="json", by_alias=True)
    payload["status"] = "published"
    payload["published_at"] = now
    payload["published_by"] = publish_as or target.published_by
    payload["updated_at"] = now
    return save_script_definition(payload, script_id=script_id, expected_version=current.version)
