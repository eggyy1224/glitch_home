from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from ..config import settings
from ..models.iframe import IframeConfig
from ..models.iframe_timeline import IframeTimeline, IframeTimelineStep
from .iframe_config import (
    config_payload_for_response,
    load_iframe_config_snapshot_config,
    sanitize_client_id,
)


_TIMELINE_DIR = Path(settings.metadata_dir) / "timelines" / "iframe"
_TIMELINE_DIR.mkdir(parents=True, exist_ok=True)

_TIMELINE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


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


def _timeline_path_for(timeline_id: str) -> Path:
    safe_id = _sanitize_timeline_id(timeline_id)
    return _TIMELINE_DIR / f"{safe_id}.json"


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


def load_iframe_timeline_definition(timeline_id: str) -> IframeTimeline:
    path = _timeline_path_for(timeline_id)
    if not path.exists():
        raise FileNotFoundError("timeline 不存在")
    with path.open("r", encoding="utf-8") as fp:
        raw = json.load(fp)
    raw.setdefault("id", timeline_id)
    raw["id"] = _sanitize_timeline_id(raw["id"])
    timeline = IframeTimeline.model_validate(raw)
    return timeline


def list_iframe_timelines(client_id: Optional[str] = None) -> List[Dict[str, object]]:
    sanitized_client = sanitize_client_id(client_id)
    entries: List[Dict[str, object]] = []
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

        def _resolve_timed_text_action(action) -> Optional[Dict[str, object]]:
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

        def _resolve_speech_action(action) -> Optional[Dict[str, object]]:
            if action is None:
                return None
            payload = action.model_dump(exclude_none=True)
            target = sanitize_client_id(action.target_client_id) or fallback_client
            if target:
                payload["target_client_id"] = target
            if payload.get("mode") == "speak_with_subtitle" and not payload.get("subtitle_text"):
                payload["subtitle_text"] = action.subtitle_text or action.text
            return payload

        def _resolve_remote_click_action(action) -> Optional[Dict[str, object]]:
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

        subtitle_payload = _resolve_timed_text_action(step.subtitle)
        caption_payload = _resolve_timed_text_action(step.caption)
        tts_payload = _resolve_speech_action(step.tts)
        remote_click_payloads = None
        if step.remote_clicks:
            remote_click_payloads = []
            for action in step.remote_clicks:
                resolved_click = _resolve_remote_click_action(action)
                if resolved_click:
                    remote_click_payloads.append(resolved_click)
            if not remote_click_payloads:
                remote_click_payloads = None

        unlock_audio_targets = step.unlock_audio_targets or None

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
            )
        )
    return ResolvedIframeTimeline(timeline=timeline, steps=resolved_steps, total_duration=total_duration)
