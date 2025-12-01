from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
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


def _ensure_script_dir() -> None:
    if not _SCRIPT_DIR.exists():
        _SCRIPT_DIR.mkdir(parents=True, exist_ok=True)


def save_script_definition(payload: dict, script_id: Optional[str] = None) -> Script:
    ensure_metadata_write_enabled("script_definition")
    if not isinstance(payload, dict):
        raise ValueError("payload 必須為 JSON 物件")
    candidate_id = script_id or payload.get("id")
    if not candidate_id:
        raise ValueError("script id 必填")
    safe_id = _sanitize_script_id(candidate_id)
    payload = {**payload, "id": safe_id}
    script = Script.model_validate(payload)

    _ensure_script_dir()
    path = _script_path_for(safe_id)
    with path.open("w", encoding="utf-8") as fp:
        json.dump(script.model_dump(mode="json", by_alias=True), fp, ensure_ascii=False, indent=2)
    return script


def load_script_definition(script_id: str) -> Script:
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


async def _apply_audio_mix(targets: List[ResolvedSnapshotTarget], mix: AudioMix) -> None:
    if not targets or mix is None:
        return
    left_target = targets[0] if len(targets) >= 1 else None
    right_target = targets[1] if len(targets) >= 2 else None

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
        await _apply_audio_mix(targets, audio_mix)


async def _run_script(resolved: ResolvedScript, audio_override: Optional[AudioMix]) -> None:
    try:
        for entry in resolved.entries:
            await _apply_script_entry(entry, audio_override)
            await asyncio.sleep(entry.duration)
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.error("Script %s 執行失敗: %s", resolved.script.id, exc, exc_info=exc)


async def play_script(script: Script, audio_override: Optional[AudioMix] = None) -> ResolvedScript:
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
