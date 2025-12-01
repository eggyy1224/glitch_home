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
from ..models.scene import AudioMix, Scene
from ..utils.permissions import ensure_metadata_write_enabled
from .iframe_config import (
    config_payload_for_response,
    load_iframe_config_snapshot_config,
    sanitize_client_id,
)
from .iframe_timeline import _split_snapshot_reference
from .realtime_bus import realtime_broadcaster

logger = logging.getLogger(__name__)

_SCENE_DIR = Path(settings.metadata_dir) / "scenes"
_SCENE_HISTORY_DIR = Path(settings.metadata_dir) / "history" / "scenes"
_SCENE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


@dataclass
class ResolvedSceneTarget:
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
class ResolvedScene:
    scene: Scene
    targets: List[ResolvedSceneTarget]

    def to_payload(self) -> Dict[str, object]:
        return {
            "id": self.scene.id,
            "title": self.scene.title,
            "targets": [target.to_payload() for target in self.targets],
            "audio_mix": self.scene.audio_mix.model_dump(mode="json") if self.scene.audio_mix else None,
            "tags": self.scene.tags,
            "description": self.scene.description,
            "notes": self.scene.notes,
        }


def _sanitize_scene_id(value: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError("scene_id 不可為空白")
    if not _SCENE_ID_PATTERN.fullmatch(cleaned):
        raise ValueError("scene_id 僅允許字母、數字、底線、連字號")
    return cleaned


def sanitize_scene_id(value: str) -> str:
    """Public helper for validating scene ids."""

    return _sanitize_scene_id(value)


def _scene_path_for(scene_id: str) -> Path:
    safe_id = _sanitize_scene_id(scene_id)
    return _SCENE_DIR / f"{safe_id}.json"


def _scene_history_dir_for(scene_id: str) -> Path:
    safe_id = _sanitize_scene_id(scene_id)
    return _SCENE_HISTORY_DIR / safe_id


def _scene_version_path(scene_id: str, version: int) -> Path:
    history_dir = _scene_history_dir_for(scene_id)
    return history_dir / f"version-{version:04d}.json"


def _ensure_scene_dir() -> None:
    if not _SCENE_DIR.exists():
        _SCENE_DIR.mkdir(parents=True, exist_ok=True)
    if not _SCENE_HISTORY_DIR.exists():
        _SCENE_HISTORY_DIR.mkdir(parents=True, exist_ok=True)


def _write_scene_history(scene: Scene) -> None:
    history_dir = _scene_history_dir_for(scene.id)
    history_dir.mkdir(parents=True, exist_ok=True)
    version_path = _scene_version_path(scene.id, scene.version)
    with version_path.open("w", encoding="utf-8") as fp:
        json.dump(scene.model_dump(mode="json", by_alias=True), fp, ensure_ascii=False, indent=2)


def save_scene_definition(payload: dict, scene_id: Optional[str] = None, expected_version: int | None = None) -> Scene:
    ensure_metadata_write_enabled("scene_definition")
    if not isinstance(payload, dict):
        raise ValueError("payload 必須為 JSON 物件")
    candidate_id = scene_id or payload.get("id")
    if not candidate_id:
        raise ValueError("scene id 必填")
    safe_id = _sanitize_scene_id(candidate_id)

    payload = {**payload, "id": safe_id}

    existing: Scene | None = None
    path = _scene_path_for(safe_id)
    if path.exists():
        try:
            existing = load_scene_definition(safe_id)
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

    scene = Scene.model_validate(payload)

    _ensure_scene_dir()
    with path.open("w", encoding="utf-8") as fp:
        json.dump(scene.model_dump(mode="json", by_alias=True), fp, ensure_ascii=False, indent=2)
    _write_scene_history(scene)
    return scene


def load_scene_definition(scene_id: str, version: int | None = None) -> Scene:
    if version is not None:
        version_path = _scene_version_path(scene_id, int(version))
        if not version_path.exists():
            raise FileNotFoundError("scene 指定版本不存在")
        with version_path.open("r", encoding="utf-8") as fp:
            raw = json.load(fp)
        raw.setdefault("id", scene_id)
        raw["id"] = _sanitize_scene_id(raw["id"])
        return Scene.model_validate(raw)
    path = _scene_path_for(scene_id)
    if not path.exists():
        raise FileNotFoundError("scene 不存在")
    with path.open("r", encoding="utf-8") as fp:
        raw = json.load(fp)
    raw.setdefault("id", scene_id)
    raw["id"] = _sanitize_scene_id(raw["id"])
    return Scene.model_validate(raw)


def delete_scene_definition(scene_id: str) -> None:
    ensure_metadata_write_enabled("scene_delete")
    path = _scene_path_for(scene_id)
    if not path.exists():
        raise FileNotFoundError("scene 不存在")
    path.unlink()


def clone_scene_definition(source_id: str, new_id: str) -> Scene:
    ensure_metadata_write_enabled("scene_clone")
    source = load_scene_definition(source_id)
    payload = source.model_dump(mode="json")
    payload["id"] = _sanitize_scene_id(new_id)
    return save_scene_definition(payload)


def list_scenes() -> List[Dict[str, object]]:
    entries: List[Dict[str, object]] = []
    _ensure_scene_dir()
    for path in sorted(_SCENE_DIR.glob("*.json")):
        try:
            with path.open("r", encoding="utf-8") as fp:
                raw = json.load(fp)
            raw.setdefault("id", path.stem)
            raw["id"] = _sanitize_scene_id(raw["id"])
            scene = Scene.model_validate(raw)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            logger.warning("略過 Scene 檔案 %s：%s", path.name, exc)
            continue
        client_count = len(scene.targets)
        entries.append(
            {
                "id": scene.id,
                "title": scene.title,
                "client_count": client_count,
                "tags": scene.tags,
                "version": scene.version,
                "status": scene.status,
                "updated_at": scene.updated_at.isoformat() if scene.updated_at else None,
            }
        )
    return entries


def resolve_scene(scene: Scene) -> ResolvedScene:
    resolved_targets: List[ResolvedSceneTarget] = []
    for raw_client, snapshot_ref in scene.targets.items():
        target_client = sanitize_client_id(raw_client)
        if not target_client:
            raise ValueError("target client_id 不可為空白")
        ref_client, snapshot_name = _split_snapshot_reference(snapshot_ref, target_client)
        snapshot_client = sanitize_client_id(ref_client)
        if not snapshot_client:
            raise ValueError("snapshot 參考缺少 client_id")
        config = load_iframe_config_snapshot_config(snapshot_client, snapshot_name)
        resolved_targets.append(
            ResolvedSceneTarget(
                client_id=snapshot_client,
                snapshot=f"{snapshot_client}/{snapshot_name}",
                config=config,
            )
        )
    return ResolvedScene(scene=scene, targets=resolved_targets)


async def _apply_audio_mix(targets: List[ResolvedSceneTarget], mix: AudioMix) -> None:
    if not targets or mix is None:
        return
    left_target = targets[0] if len(targets) >= 1 else None
    right_target = targets[1] if len(targets) >= 2 else None

    async def _send_volume(target: ResolvedSceneTarget, volume: Optional[float]) -> None:
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


async def play_scene(scene: Scene, audio_override: Optional[AudioMix] = None, *, allow_draft: bool = False) -> ResolvedScene:
    if not allow_draft and scene.status != "published":
        raise ValueError("僅允許播放已發布的 scene")
    resolved = resolve_scene(scene)
    for target in resolved.targets:
        payload = config_payload_for_response(target.config, target.client_id)
        await realtime_broadcaster.broadcast_iframe_config(payload, target_client_id=target.client_id)
    mix = audio_override or scene.audio_mix
    if mix:
        await _apply_audio_mix(resolved.targets, mix)
    return resolved


def list_scene_versions(scene_id: str) -> List[Dict[str, object]]:
    versions: List[Dict[str, object]] = []
    history_dir = _scene_history_dir_for(scene_id)
    if not history_dir.exists():
        return versions
    for path in sorted(history_dir.glob("version-*.json")):
        try:
            with path.open("r", encoding="utf-8") as fp:
                raw = json.load(fp)
            raw.setdefault("id", scene_id)
            raw["id"] = _sanitize_scene_id(raw["id"])
            scene = Scene.model_validate(raw)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            logger.warning("略過 Scene 版本檔案 %s：%s", path.name, exc)
            continue
        versions.append(
            {
                "version": scene.version,
                "status": scene.status,
                "created_at": scene.created_at.isoformat() if scene.created_at else None,
                "updated_at": scene.updated_at.isoformat() if scene.updated_at else None,
                "published_at": scene.published_at.isoformat() if scene.published_at else None,
                "published_by": scene.published_by,
            }
        )
    return versions


def publish_scene(scene_id: str, *, publish_as: str | None = None, expected_version: int | None = None) -> Scene:
    ensure_metadata_write_enabled("scene_publish")
    base = load_scene_definition(scene_id)
    if expected_version is not None and base.version != expected_version:
        raise ValueError("版本不符，請重新載入後再試")
    now = datetime.now(timezone.utc)
    payload = base.model_dump(mode="json", by_alias=True)
    payload["status"] = "published"
    payload["published_at"] = now
    payload["published_by"] = publish_as or base.published_by
    payload["updated_at"] = now
    return save_scene_definition(payload, scene_id=scene_id, expected_version=base.version)


def rollback_scene(scene_id: str, target_version: int, *, publish_as: str | None = None, expected_version: int | None = None) -> Scene:
    ensure_metadata_write_enabled("scene_rollback")
    current = load_scene_definition(scene_id)
    if expected_version is not None and current.version != expected_version:
        raise ValueError("版本不符，請重新載入後再試")
    target = load_scene_definition(scene_id, version=target_version)
    now = datetime.now(timezone.utc)
    payload = target.model_dump(mode="json", by_alias=True)
    payload["status"] = "published"
    payload["published_at"] = now
    payload["published_by"] = publish_as or target.published_by
    payload["updated_at"] = now
    return save_scene_definition(payload, scene_id=scene_id, expected_version=current.version)
