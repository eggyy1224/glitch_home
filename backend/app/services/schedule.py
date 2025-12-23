from __future__ import annotations

import json
import logging
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from zoneinfo import ZoneInfo

from pydantic import ValidationError

from ..config import settings
from ..models.schedule import Schedule, ScheduleEvent, _normalize_time_str
from .episode import load_episode_definition
from .iframe_config import sanitize_client_id
from .iframe_timeline import _split_snapshot_reference, load_iframe_timeline_definition
from .scene import load_scene_definition
from .script import load_script_definition

logger = logging.getLogger(__name__)

_SCHEDULE_DIR = Path(settings.metadata_dir) / "schedules"
_SCHEDULE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
_DEFAULT_FALLBACK_CLIENT_ID = "scheduler"


@dataclass(frozen=True)
class ScheduleQueueSpec:
    schedule_id: str
    event_id: str
    item_type: str
    target_id: str
    client_id: str
    eta: datetime
    occurs_at: datetime
    payload: Dict[str, Any]
    schedule_key: str


@dataclass(frozen=True)
class ScheduleSkip:
    event_id: str
    reason: str


def _ensure_schedule_dir() -> None:
    _SCHEDULE_DIR.mkdir(parents=True, exist_ok=True)


def _sanitize_schedule_id(value: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError("schedule_id 不可為空白")
    if not _SCHEDULE_ID_PATTERN.fullmatch(cleaned):
        raise ValueError("schedule_id 僅允許字母、數字、底線、連字號")
    return cleaned


def _schedule_path_for(schedule_id: str) -> Path:
    safe_id = _sanitize_schedule_id(schedule_id)
    return _SCHEDULE_DIR / f"{safe_id}.json"


def _timezone(tz_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"timezone 無效：{tz_name}") from exc


def _parse_time(value: str) -> time:
    normalized = _normalize_time_str(value)
    parts = normalized.split(":")
    hour = int(parts[0])
    minute = int(parts[1])
    second = int(parts[2]) if len(parts) > 2 else 0
    return time(hour=hour, minute=minute, second=second)


def _next_occurrence(time_str: str, tz_name: str, *, now: Optional[datetime] = None) -> datetime:
    tz = _timezone(tz_name)
    now_utc = now or datetime.now(timezone.utc)
    local_now = now_utc.astimezone(tz)
    event_time = _parse_time(time_str)
    candidate = datetime.combine(local_now.date(), event_time, tzinfo=tz)
    if candidate <= local_now:
        candidate += timedelta(days=1)
    return candidate


def _schedule_key(schedule_id: str, event_id: str, occurs_at: datetime) -> str:
    return f"{schedule_id}:{event_id}:{occurs_at.date().isoformat()}:{occurs_at.time().isoformat()}"


def _resolve_snapshot_target(target_id: str, client_override: Optional[str]) -> tuple[str, str]:
    cleaned = target_id.strip()
    client_part: Optional[str] = None
    snapshot_name = cleaned
    if "/" in cleaned:
        client_part, snapshot_name = cleaned.split("/", 1)
    resolved_client = sanitize_client_id(client_override or client_part)
    if not resolved_client:
        raise ValueError("snapshot 需要 client_id（可在 target_id 或 client_id 提供）")
    snapshot_name = snapshot_name.strip()
    if not snapshot_name:
        raise ValueError("snapshot 名稱不可為空白")
    return resolved_client, snapshot_name


def _resolve_client_from_timeline(timeline_id: str) -> Optional[str]:
    timeline = load_iframe_timeline_definition(timeline_id)
    if timeline.client_id:
        return sanitize_client_id(timeline.client_id)
    for step in timeline.steps:
        if step.client_id:
            resolved = sanitize_client_id(step.client_id)
            if resolved:
                return resolved
        if step.snapshot and "/" in step.snapshot:
            client_part, _ = step.snapshot.split("/", 1)
            resolved = sanitize_client_id(client_part)
            if resolved:
                return resolved
    return None


def _resolve_client_from_episode(episode_id: str) -> Optional[str]:
    episode = load_episode_definition(episode_id)
    for track in episode.tracks:
        if track.target_client_id:
            resolved = sanitize_client_id(track.target_client_id)
            if resolved:
                return resolved
        try:
            resolved = _resolve_client_from_timeline(track.timeline_id)
            if resolved:
                return resolved
        except Exception:
            continue
    return None


def _resolve_client_from_scene(scene_id: str) -> Optional[str]:
    scene = load_scene_definition(scene_id)
    for client_id in scene.targets.keys():
        resolved = sanitize_client_id(client_id)
        if resolved:
            return resolved
    return None


def _resolve_client_from_script(script_id: str) -> Optional[str]:
    script = load_script_definition(script_id)
    for entry in script.entries:
        if entry.type == "scene" and entry.scene_id:
            try:
                resolved = _resolve_client_from_scene(entry.scene_id)
                if resolved:
                    return resolved
            except Exception:
                continue
        if entry.left_snapshot:
            try:
                client_part, _ = _split_snapshot_reference(entry.left_snapshot, None)
                resolved = sanitize_client_id(client_part)
                if resolved:
                    return resolved
            except Exception:
                pass
        if entry.right_snapshot:
            try:
                client_part, _ = _split_snapshot_reference(entry.right_snapshot, None)
                resolved = sanitize_client_id(client_part)
                if resolved:
                    return resolved
            except Exception:
                pass
    return None


def _resolve_fallback_client() -> str:
    resolved = sanitize_client_id(_DEFAULT_FALLBACK_CLIENT_ID)
    return resolved or "scheduler"


def _resolve_queue_target(event: ScheduleEvent) -> tuple[str, str, str]:
    item_type = event.type
    if item_type == "snapshot":
        client_id, snapshot_name = _resolve_snapshot_target(event.target_id, event.client_id)
        return item_type, client_id, snapshot_name
    if item_type == "timeline":
        client_id = sanitize_client_id(event.client_id) or _resolve_client_from_timeline(event.target_id)
        if not client_id:
            client_id = _resolve_fallback_client()
        return item_type, client_id, event.target_id.strip()
    if item_type == "episode":
        client_id = sanitize_client_id(event.client_id) or _resolve_client_from_episode(event.target_id)
        if not client_id:
            client_id = _resolve_fallback_client()
        return item_type, client_id, event.target_id.strip()
    if item_type == "scene":
        client_id = sanitize_client_id(event.client_id) or _resolve_client_from_scene(event.target_id)
        if not client_id:
            client_id = _resolve_fallback_client()
        return item_type, client_id, event.target_id.strip()
    if item_type == "script":
        client_id = sanitize_client_id(event.client_id) or _resolve_client_from_script(event.target_id)
        if not client_id:
            client_id = _resolve_fallback_client()
        return item_type, client_id, event.target_id.strip()
    raise ValueError(f"不支援的排程類型：{event.type}")


def _with_schedule_payload(
    schedule: Schedule,
    event: ScheduleEvent,
    *,
    occurs_at: datetime,
) -> Dict[str, Any]:
    if not event.id:
        raise ValueError("event_id 缺失")
    payload = dict(event.payload or {})
    schedule_meta = {
        "id": schedule.id,
        "event_id": event.id,
        "time": event.time,
        "timezone": schedule.timezone,
        "repeat": schedule.repeat,
    }
    payload["_schedule"] = schedule_meta
    payload["_schedule_occurs_at"] = occurs_at.isoformat()
    payload["_schedule_key"] = _schedule_key(schedule.id, event.id or "", occurs_at)
    return payload


def list_schedule_definitions() -> List[Dict[str, object]]:
    _ensure_schedule_dir()
    entries: List[Dict[str, object]] = []
    for path in sorted(_SCHEDULE_DIR.glob("*.json")):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            raw.setdefault("id", path.stem)
            raw["id"] = _sanitize_schedule_id(raw["id"])
            schedule = Schedule.model_validate(raw)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            logger.warning("略過 Schedule 檔案 %s：%s", path.name, exc)
            continue
        entries.append(
            {
                "id": schedule.id,
                "title": schedule.title,
                "status": schedule.status,
                "timezone": schedule.timezone,
                "repeat": schedule.repeat,
                "event_count": len(schedule.events),
                "updated_at": schedule.updated_at.isoformat() if schedule.updated_at else None,
            }
        )
    return entries


def load_schedule_definition(schedule_id: str) -> Schedule:
    _ensure_schedule_dir()
    path = _schedule_path_for(schedule_id)
    if not path.exists():
        raise FileNotFoundError(f"schedule 不存在：{schedule_id}")
    raw = json.loads(path.read_text(encoding="utf-8"))
    raw.setdefault("id", schedule_id)
    raw["id"] = _sanitize_schedule_id(raw["id"])
    schedule = Schedule.model_validate(raw)
    _timezone(schedule.timezone)
    return schedule


def _ensure_event_ids(events: Iterable[ScheduleEvent]) -> List[ScheduleEvent]:
    updated: List[ScheduleEvent] = []
    for event in events:
        if event.id:
            updated.append(event)
            continue
        generated = f"evt_{secrets.token_hex(4)}"
        updated.append(event.model_copy(update={"id": generated}))
    return updated


def save_schedule_definition(payload: dict, schedule_id: Optional[str] = None) -> Schedule:
    _ensure_schedule_dir()
    candidate_id = schedule_id or payload.get("id")
    safe_id = _sanitize_schedule_id(candidate_id or "")
    payload = dict(payload)
    payload["id"] = safe_id
    schedule = Schedule.model_validate(payload)
    _timezone(schedule.timezone)
    schedule = schedule.model_copy(update={"events": _ensure_event_ids(schedule.events)})
    now = datetime.now(timezone.utc)
    schedule = schedule.model_copy(update={"updated_at": now})
    path = _schedule_path_for(schedule.id)
    path.write_text(json.dumps(schedule.model_dump(mode="json", by_alias=True), ensure_ascii=False, indent=2), encoding="utf-8")
    return schedule


def delete_schedule_definition(schedule_id: str) -> None:
    path = _schedule_path_for(schedule_id)
    if path.exists():
        path.unlink()


def plan_schedule_deploy(
    schedule: Schedule,
    *,
    now: Optional[datetime] = None,
    stagger_seconds: float = 2.0,
) -> tuple[List[ScheduleQueueSpec], List[ScheduleSkip]]:
    if schedule.repeat != "daily":
        raise ValueError("目前僅支援 daily 排程")
    _timezone(schedule.timezone)
    base_now = now or datetime.now(timezone.utc)
    pending_specs: List[ScheduleQueueSpec] = []
    skipped: List[ScheduleSkip] = []
    for event in schedule.events:
        if not event.enabled:
            skipped.append(ScheduleSkip(event_id=event.id or "", reason="disabled"))
            continue
        if not event.id:
            skipped.append(ScheduleSkip(event_id="", reason="event_id 缺失"))
            continue
        try:
            occurs_at = _next_occurrence(event.time, schedule.timezone, now=base_now)
            item_type, client_id, target_id = _resolve_queue_target(event)
            payload = _with_schedule_payload(schedule, event, occurs_at=occurs_at)
            schedule_key = payload.get("_schedule_key") or _schedule_key(schedule.id, event.id, occurs_at)
            spec = ScheduleQueueSpec(
                schedule_id=schedule.id,
                event_id=event.id,
                item_type=item_type,
                target_id=target_id,
                client_id=client_id,
                eta=occurs_at,
                occurs_at=occurs_at,
                payload=payload,
                schedule_key=str(schedule_key),
            )
            pending_specs.append(spec)
        except Exception as exc:  # noqa: BLE001
            skipped.append(ScheduleSkip(event_id=event.id or "", reason=str(exc)))

    if stagger_seconds > 0 and pending_specs:
        pending_specs = _apply_stagger(pending_specs, stagger_seconds=stagger_seconds)

    return pending_specs, skipped


def _apply_stagger(specs: List[ScheduleQueueSpec], *, stagger_seconds: float) -> List[ScheduleQueueSpec]:
    grouped: Dict[tuple[str, datetime], List[ScheduleQueueSpec]] = {}
    for spec in specs:
        key = (spec.client_id, spec.eta)
        grouped.setdefault(key, []).append(spec)
    updated: List[ScheduleQueueSpec] = []
    for (client_id, eta), items in grouped.items():
        if len(items) <= 1:
            updated.extend(items)
            continue
        items_sorted = sorted(items, key=lambda item: item.event_id)
        for idx, item in enumerate(items_sorted):
            if idx == 0:
                updated.append(item)
                continue
            bumped = item.eta + timedelta(seconds=stagger_seconds * idx)
            payload = dict(item.payload)
            payload["_schedule_eta"] = bumped.isoformat()
            updated.append(
                ScheduleQueueSpec(
                    schedule_id=item.schedule_id,
                    event_id=item.event_id,
                    item_type=item.item_type,
                    target_id=item.target_id,
                    client_id=item.client_id,
                    eta=bumped,
                    occurs_at=item.occurs_at,
                    payload=payload,
                    schedule_key=item.schedule_key,
                )
            )
    return updated


def extract_schedule_ref(payload: Dict[str, Any] | None) -> tuple[str, str] | None:
    if not payload or not isinstance(payload, dict):
        return None
    schedule_meta = payload.get("_schedule")
    if not isinstance(schedule_meta, dict):
        return None
    schedule_id = str(schedule_meta.get("id") or "").strip()
    event_id = str(schedule_meta.get("event_id") or "").strip()
    if not schedule_id or not event_id:
        return None
    return schedule_id, event_id


def build_next_schedule_item(schedule_id: str, event_id: str, *, now: Optional[datetime] = None) -> ScheduleQueueSpec | None:
    try:
        schedule = load_schedule_definition(schedule_id)
    except FileNotFoundError:
        return None
    if schedule.status != "active":
        return None
    target_event = None
    for event in schedule.events:
        if event.id == event_id:
            target_event = event
            break
    if target_event is None or not target_event.enabled:
        return None
    specs, skipped = plan_schedule_deploy(schedule, now=now, stagger_seconds=0)
    for spec in specs:
        if spec.event_id == event_id:
            return spec
    if skipped:
        logger.info("schedule %s event %s skipped: %s", schedule_id, event_id, skipped[0].reason)
    return None
