from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from pydantic import ValidationError

from ..config import settings
from ..models.iframe import IframeConfig
from ..models.iframe_timeline import (
    IframeTimeline,
    IframeTimelineStep,
    TimelineRemoteClickAction,
    TimelineSpeechAction,
    TimelineTimedTextAction,
    TimelineVideoControlAction,
)
from ..utils.permissions import ensure_metadata_write_enabled
from .iframe_config import (
    config_payload_for_response,
    load_iframe_config_snapshot_config,
    sanitize_client_id,
)


_TIMELINE_DIR = Path(settings.metadata_dir) / "timelines" / "iframe"
_TIMELINE_HISTORY_DIR = Path(settings.metadata_dir) / "history" / "timelines" / "iframe"
_TIMELINE_HISTORY_LIMIT = 200

_TIMELINE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")

logger = logging.getLogger(__name__)


@dataclass
class ResolvedIframeTimelineStep:
    index: int
    start_at: float
    duration: float
    step: IframeTimelineStep
    client_id: Optional[str]
    config: IframeConfig
    subtitle: Optional[Dict[str, object]] = None
    caption: Optional[Dict[str, object]] = None
    tts: Optional[Dict[str, object]] = None
    remote_clicks: Optional[List[Dict[str, object]]] = None
    unlock_audio_targets: Optional[List[str]] = None
    video_controls: Optional[List[Dict[str, object]]] = None

    def to_payload(self) -> Dict[str, object]:
        payload: Dict[str, object] = {
            "index": self.index,
            "at": self.start_at,
            "duration": self.duration,
            "snapshot": self.step.snapshot,
            "label": self.step.label,
            "client_id": self.client_id,
            "config": config_payload_for_response(self.config, self.client_id),
            "subtitle": self.subtitle,
            "caption": self.caption,
            "tts": self.tts,
            "remote_clicks": self.remote_clicks,
            "unlock_audio_targets": self.unlock_audio_targets,
            "video_controls": self.video_controls,
        }
        return {k: v for k, v in payload.items() if v is not None}


@dataclass
class ResolvedIframeTimeline:
    timeline: IframeTimeline
    steps: List[ResolvedIframeTimelineStep]
    total_duration: float

    def to_payload(self) -> Dict[str, object]:
        return {
            "id": self.timeline.id,
            "title": self.timeline.title,
            "client_id": self.timeline.client_id,
            "loop": self.timeline.loop,
            "step_count": len(self.steps),
            "total_duration": self.total_duration,
            "steps": [step.to_payload() for step in self.steps],
        }


def _sanitize_timeline_id(value: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError("timeline_id 不可為空白")
    if not _TIMELINE_ID_PATTERN.fullmatch(cleaned):
        raise ValueError("timeline_id 僅允許字母、數字、底線、連字號")
    return cleaned


def sanitize_timeline_id(value: str) -> str:
    """Public helper for validating timeline ids."""

    return _sanitize_timeline_id(value)


def _timeline_path_for(timeline_id: str) -> Path:
    safe_id = _sanitize_timeline_id(timeline_id)
    return _TIMELINE_DIR / f"{safe_id}.json"


def _timeline_history_dir_for(timeline_id: str) -> Path:
    safe_id = _sanitize_timeline_id(timeline_id)
    return _TIMELINE_HISTORY_DIR / safe_id


def _timeline_version_path(timeline_id: str, version: int) -> Path:
    return _timeline_history_dir_for(timeline_id) / f"version-{version:04d}.json"


def _ensure_timeline_dir() -> None:
    _TIMELINE_DIR.mkdir(parents=True, exist_ok=True)
    _TIMELINE_HISTORY_DIR.mkdir(parents=True, exist_ok=True)


def _write_timeline_history(timeline: IframeTimeline) -> None:
    history_dir = _timeline_history_dir_for(timeline.id)
    history_dir.mkdir(parents=True, exist_ok=True)
    version_path = _timeline_version_path(timeline.id, timeline.version)
    with version_path.open("w", encoding="utf-8") as fp:
        json.dump(timeline.model_dump(mode="json", by_alias=True), fp, ensure_ascii=False, indent=2)
    versions = sorted(history_dir.glob("version-*.json"))
    if _TIMELINE_HISTORY_LIMIT and len(versions) > _TIMELINE_HISTORY_LIMIT:
        excess = len(versions) - _TIMELINE_HISTORY_LIMIT
        for old_path in versions[:excess]:
            try:
                old_path.unlink()
            except OSError:
                logger.warning("清理舊 Timeline 版本失敗：%s", old_path)


def _maybe_backfill_timeline_history(timeline: IframeTimeline) -> None:
    version_path = _timeline_version_path(timeline.id, timeline.version)
    if version_path.exists():
        return
    try:
        _write_timeline_history(timeline)
    except Exception as exc:  # noqa: BLE001
        logger.warning("補寫 Timeline 版本歷史失敗 %s v%s：%s", timeline.id, timeline.version, exc)


def save_iframe_timeline_definition(
    payload: dict, timeline_id: Optional[str] = None, expected_version: int | None = None
) -> IframeTimeline:
    ensure_metadata_write_enabled("iframe_timeline")
    if not isinstance(payload, dict):
        raise ValueError("payload 必須為 JSON 物件")

    candidate_id = timeline_id or payload.get("id")
    if not candidate_id:
        raise ValueError("timeline id 必填")
    safe_id = _sanitize_timeline_id(candidate_id)

    payload = {**payload, "id": safe_id}

    existing: IframeTimeline | None = None
    path = _timeline_path_for(safe_id)
    if path.exists():
        try:
            existing = load_iframe_timeline_definition(safe_id)
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

    timeline = IframeTimeline.model_validate(payload)

    _ensure_timeline_dir()
    with path.open("w", encoding="utf-8") as fp:
        json.dump(timeline.model_dump(mode="json", by_alias=True), fp, ensure_ascii=False, indent=2)
    _write_timeline_history(timeline)
    return timeline


def delete_iframe_timeline_definition(timeline_id: str) -> None:
    ensure_metadata_write_enabled("iframe_timeline_delete")
    path = _timeline_path_for(timeline_id)
    if not path.exists():
        raise FileNotFoundError("timeline 不存在")
    path.unlink()


def clone_iframe_timeline_definition(
    source_id: str, new_id: str, target_client_id: Optional[str] = None
) -> IframeTimeline:
    ensure_metadata_write_enabled("iframe_timeline_clone")
    source = load_iframe_timeline_definition(source_id)
    payload = source.model_dump(mode="json")
    payload["id"] = _sanitize_timeline_id(new_id)

    if target_client_id:
        target_clean = sanitize_client_id(target_client_id)
        payload["clientId"] = target_clean
        payload.pop("client_id", None)
        steps = payload.get("steps") or []
        for step in steps:
            snapshot_value = step.get("snapshot")
            if isinstance(snapshot_value, str) and "/" in snapshot_value:
                _, snap_name = snapshot_value.split("/", 1)
                step["snapshot"] = f"{target_clean}/{snap_name}"
            step_client = step.get("clientId")
            if step_client is None or step_client == source.client_id:
                step["clientId"] = target_clean
            step.pop("client_id", None)

    return save_iframe_timeline_definition(payload)


def _split_snapshot_reference(value: str, default_client: Optional[str]) -> Tuple[Optional[str], str]:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("snapshot 參考不可為空白")
    if "/" in cleaned:
        client_part, snapshot_name = cleaned.split("/", 1)
        client_part = client_part.strip() or None
        snapshot_name = snapshot_name.strip()
        if not snapshot_name:
            raise ValueError("snapshot 名稱不可為空白")
        return client_part, snapshot_name
    if default_client is None:
        raise ValueError("timeline 缺少 client_id，無法解析 snapshot")
    return default_client, cleaned


def resolve_timed_text_action(
    action: TimelineTimedTextAction | None, fallback_client: Optional[str]
) -> Optional[Dict[str, object]]:
    if action is None:
        return None
    payload = action.model_dump(exclude_none=True)
    target = sanitize_client_id(action.target_client_id) or fallback_client
    if target:
        payload["target_client_id"] = target
    if payload.get("clear"):
        payload.pop("text", None)
        payload.pop("language", None)
        payload.pop("duration_seconds", None)
    else:
        payload.pop("clear", None)
        payload["text"] = action.text
    if not payload.get("clear"):
        payload.pop("clear", None)
    return payload


def resolve_speech_action(
    action: TimelineSpeechAction | None, fallback_client: Optional[str]
) -> Optional[Dict[str, object]]:
    if action is None:
        return None
    payload = action.model_dump(exclude_none=True)
    target = sanitize_client_id(action.target_client_id) or fallback_client
    if target:
        payload["target_client_id"] = target
    if payload.get("mode") == "speak_with_subtitle" and not payload.get("subtitle_text"):
        payload["subtitle_text"] = action.subtitle_text or action.text
    return payload


def resolve_remote_click_action(
    action: TimelineRemoteClickAction | None, fallback_client: Optional[str]
) -> Optional[Dict[str, object]]:
    if action is None:
        return None
    payload: Dict[str, object] = {}
    if action.selector:
        payload["selector"] = action.selector
    if action.target_selector:
        payload["target"] = action.target_selector
    if action.x is not None:
        payload["x"] = action.x
    if action.y is not None:
        payload["y"] = action.y
    offset = action.offset_seconds
    if offset is not None:
        payload["offset_seconds"] = max(0.0, float(offset))
    if action.label:
        payload["label"] = action.label
    target = sanitize_client_id(action.target_client_id) or fallback_client
    if target:
        payload["target_client_id"] = target
    if not (
        payload.get("selector")
        or payload.get("target")
        or ("x" in payload and "y" in payload)
    ):
        raise ValueError("remote_click 缺少 selector/target 或 x/y 座標")
    return payload


def resolve_video_control_action(
    action: TimelineVideoControlAction | None, fallback_client: Optional[str]
) -> Optional[Dict[str, object]]:
    if action is None:
        return None
    payload: Dict[str, object] = {"action": action.action}
    if action.volume is not None:
        payload["volume"] = max(0.0, min(1.0, float(action.volume)))
    if action.muted is not None:
        payload["muted"] = bool(action.muted)
    if action.time is not None:
        payload["time"] = max(0.0, float(action.time))
    if action.speed is not None:
        payload["speed"] = max(0.25, min(4.0, float(action.speed)))
    offset = action.offset_seconds
    if offset is not None:
        payload["offset_seconds"] = max(0.0, float(offset))
    target = sanitize_client_id(action.target_client_id) or fallback_client
    if target:
        payload["target_client_id"] = target
    return payload


def load_iframe_timeline_definition(timeline_id: str, version: int | None = None) -> IframeTimeline:
    if version is not None:
        version_path = _timeline_version_path(timeline_id, int(version))
        if not version_path.exists():
            raise FileNotFoundError("timeline 指定版本不存在")
        with version_path.open("r", encoding="utf-8") as fp:
            raw = json.load(fp)
        raw.setdefault("id", timeline_id)
        raw["id"] = _sanitize_timeline_id(raw["id"])
        return IframeTimeline.model_validate(raw)
    path = _timeline_path_for(timeline_id)
    if not path.exists():
        raise FileNotFoundError("timeline 不存在")
    with path.open("r", encoding="utf-8") as fp:
        raw = json.load(fp)
    raw.setdefault("id", timeline_id)
    raw["id"] = _sanitize_timeline_id(raw["id"])
    timeline = IframeTimeline.model_validate(raw)
    _maybe_backfill_timeline_history(timeline)
    return timeline


def list_iframe_timelines(client_id: Optional[str] = None) -> List[Dict[str, object]]:
    sanitized_client = sanitize_client_id(client_id)
    entries: List[Dict[str, object]] = []
    _ensure_timeline_dir()
    for path in sorted(_TIMELINE_DIR.glob("*.json")):
        try:
            with path.open("r", encoding="utf-8") as fp:
                raw = json.load(fp)
            raw.setdefault("id", path.stem)
            raw["id"] = _sanitize_timeline_id(raw["id"])
            timeline = IframeTimeline.model_validate(raw)
        except Exception:
            continue
        if sanitized_client and timeline.client_id != sanitized_client:
            continue
        estimated_duration = sum(max(step.duration, 0.0) for step in timeline.steps)
        entries.append(
            {
                "id": timeline.id,
                "title": timeline.title,
                "client_id": timeline.client_id,
                "step_count": len(timeline.steps),
                "estimated_duration": estimated_duration,
                "loop": timeline.loop,
                "version": timeline.version,
                "status": timeline.status,
                "updated_at": timeline.updated_at.isoformat() if timeline.updated_at else None,
            }
        )
    return entries


def resolve_iframe_timeline(timeline: IframeTimeline) -> ResolvedIframeTimeline:
    if not timeline.steps:
        raise ValueError("timeline 至少需要一個 step")
    default_client = sanitize_client_id(timeline.client_id)
    resolved_steps: List[ResolvedIframeTimelineStep] = []
    cursor = 0.0
    total_duration = 0.0
    for index, step in enumerate(timeline.steps):
        step_client_override = sanitize_client_id(step.client_id)
        split_default_client = step_client_override or default_client
        client_override, snapshot_name = _split_snapshot_reference(step.snapshot, split_default_client)
        client_for_step = step_client_override or sanitize_client_id(client_override)
        config = load_iframe_config_snapshot_config(client_for_step, snapshot_name)

        fallback_client = step_client_override or client_for_step

        subtitle_payload = resolve_timed_text_action(step.subtitle, fallback_client)
        caption_payload = resolve_timed_text_action(step.caption, fallback_client)
        tts_payload = resolve_speech_action(step.tts, fallback_client)
        remote_click_payloads = None
        if step.remote_clicks:
            remote_click_payloads = []
            for action in step.remote_clicks:
                resolved_click = resolve_remote_click_action(action, fallback_client)
                if resolved_click:
                    remote_click_payloads.append(resolved_click)
            if not remote_click_payloads:
                remote_click_payloads = None

        video_control_payloads = None
        if step.video_controls:
            video_control_payloads = []
            for action in step.video_controls:
                resolved_control = resolve_video_control_action(action, fallback_client)
                if resolved_control:
                    video_control_payloads.append(resolved_control)
            if not video_control_payloads:
                video_control_payloads = None

        unlock_audio_targets = None
        if step.unlock_audio_targets:
            validated_targets = []
            for target in step.unlock_audio_targets:
                sanitized_target = sanitize_client_id(target)
                if sanitized_target:
                    validated_targets.append(sanitized_target)
            if validated_targets:
                unlock_audio_targets = validated_targets

        start_at = step.at if step.at is not None else cursor
        cursor = start_at + step.duration
        total_duration = max(total_duration, cursor)
        resolved_steps.append(
            ResolvedIframeTimelineStep(
                index=index,
                start_at=start_at,
                duration=step.duration,
                step=step,
                client_id=client_for_step,
                config=config,
                subtitle=subtitle_payload,
                caption=caption_payload,
                tts=tts_payload,
                remote_clicks=remote_click_payloads,
                unlock_audio_targets=unlock_audio_targets,
                video_controls=video_control_payloads,
            )
        )
    return ResolvedIframeTimeline(timeline=timeline, steps=resolved_steps, total_duration=total_duration)


def list_iframe_timeline_versions(timeline_id: str) -> List[Dict[str, object]]:
    versions: List[Dict[str, object]] = []
    history_dir = _timeline_history_dir_for(timeline_id)
    if not history_dir.exists():
        return versions
    for path in sorted(history_dir.glob("version-*.json")):
        try:
            with path.open("r", encoding="utf-8") as fp:
                raw = json.load(fp)
            raw.setdefault("id", timeline_id)
            raw["id"] = _sanitize_timeline_id(raw["id"])
            timeline = IframeTimeline.model_validate(raw)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            logger.warning("略過 Timeline 版本檔案 %s：%s", path.name, exc)
            continue
        versions.append(
            {
                "version": timeline.version,
                "status": timeline.status,
                "created_at": timeline.created_at.isoformat() if timeline.created_at else None,
                "updated_at": timeline.updated_at.isoformat() if timeline.updated_at else None,
                "published_at": timeline.published_at.isoformat() if timeline.published_at else None,
                "published_by": timeline.published_by,
            }
        )
    return versions


def publish_iframe_timeline(
    timeline_id: str, *, publish_as: str | None = None, expected_version: int | None = None
) -> IframeTimeline:
    ensure_metadata_write_enabled("iframe_timeline_publish")
    base = load_iframe_timeline_definition(timeline_id)
    if expected_version is not None and base.version != expected_version:
        raise ValueError("版本不符，請重新載入後再試")
    resolve_iframe_timeline(base)
    now = datetime.now(timezone.utc)
    payload = base.model_dump(mode="json", by_alias=True)
    payload["status"] = "published"
    payload["published_at"] = now
    payload["published_by"] = publish_as or base.published_by
    payload["updated_at"] = now
    return save_iframe_timeline_definition(payload, timeline_id=timeline_id, expected_version=base.version)


def rollback_iframe_timeline(
    timeline_id: str, target_version: int, *, publish_as: str | None = None, expected_version: int | None = None
) -> IframeTimeline:
    ensure_metadata_write_enabled("iframe_timeline_rollback")
    current = load_iframe_timeline_definition(timeline_id)
    if expected_version is not None and current.version != expected_version:
        raise ValueError("版本不符，請重新載入後再試")
    target = load_iframe_timeline_definition(timeline_id, version=target_version)
    resolve_iframe_timeline(target)
    now = datetime.now(timezone.utc)
    payload = target.model_dump(mode="json", by_alias=True)
    payload["status"] = "published"
    payload["published_at"] = now
    payload["published_by"] = publish_as or target.published_by
    payload["updated_at"] = now
    return save_iframe_timeline_definition(payload, timeline_id=timeline_id, expected_version=current.version)
