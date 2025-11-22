from __future__ import annotations

import json
import re
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import ValidationError

from ..config import settings
from ..models.episode import Episode
from .iframe_config import sanitize_client_id
from .iframe_timeline import load_iframe_timeline_definition, sanitize_timeline_id
from .realtime_bus import realtime_broadcaster


logger = logging.getLogger(__name__)


_EPISODE_DIR = Path(settings.metadata_dir) / "episodes"

_EPISODE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


@dataclass
class ResolvedEpisodeTrack:
    timeline_id: str
    timeline_title: str
    target_client_id: str
    start_at: Optional[float]
    step_count: int
    options: Dict[str, object]

    def to_payload(self) -> Dict[str, object]:
        payload: Dict[str, object] = {
            "timeline_id": self.timeline_id,
            "timeline_title": self.timeline_title,
            "target_client_id": self.target_client_id,
            "step_count": self.step_count,
            "options": self.options,
        }
        if self.start_at is not None:
            payload["start_at"] = self.start_at
        return payload


@dataclass
class ResolvedEpisode:
    episode: Episode
    tracks: List[ResolvedEpisodeTrack]

    def to_payload(self) -> Dict[str, object]:
        return {
            "id": self.episode.id,
            "title": self.episode.title,
            "description": self.episode.description,
            "tags": self.episode.tags,
            "track_count": len(self.tracks),
            "tracks": [track.to_payload() for track in self.tracks],
        }


def _sanitize_episode_id(value: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError("episode_id 不可為空白")
    if not _EPISODE_ID_PATTERN.fullmatch(cleaned):
        raise ValueError("episode_id 僅允許字母、數字、底線、連字號")
    return cleaned


def sanitize_episode_id(value: str) -> str:
    """Public helper for validating episode ids."""

    return _sanitize_episode_id(value)


def _episode_path_for(episode_id: str) -> Path:
    safe_id = _sanitize_episode_id(episode_id)
    return _EPISODE_DIR / f"{safe_id}.json"


def _ensure_episode_dir() -> None:
    if not _EPISODE_DIR.exists():
        _EPISODE_DIR.mkdir(parents=True, exist_ok=True)


def save_episode_definition(payload: dict, episode_id: Optional[str] = None) -> Episode:
    if not isinstance(payload, dict):
        raise ValueError("payload 必須為 JSON 物件")
    candidate_id = episode_id or payload.get("id")
    if not candidate_id:
        raise ValueError("episode id 必填")
    safe_id = _sanitize_episode_id(candidate_id)

    payload = {**payload, "id": safe_id}
    episode = Episode.model_validate(payload)

    _ensure_episode_dir()
    path = _episode_path_for(safe_id)
    with path.open("w", encoding="utf-8") as fp:
        json.dump(episode.model_dump(mode="json", by_alias=True), fp, ensure_ascii=False, indent=2)
    return episode


def load_episode_definition(episode_id: str) -> Episode:
    path = _episode_path_for(episode_id)
    if not path.exists():
        raise FileNotFoundError("episode 不存在")
    with path.open("r", encoding="utf-8") as fp:
        raw = json.load(fp)
    raw.setdefault("id", episode_id)
    raw["id"] = _sanitize_episode_id(raw["id"])
    return Episode.model_validate(raw)


def delete_episode_definition(episode_id: str) -> None:
    path = _episode_path_for(episode_id)
    if not path.exists():
        raise FileNotFoundError("episode 不存在")
    path.unlink()


def clone_episode_definition(source_id: str, new_id: str) -> Episode:
    source = load_episode_definition(source_id)
    payload = source.model_dump(mode="json")
    payload["id"] = _sanitize_episode_id(new_id)
    return save_episode_definition(payload)


def list_episodes() -> List[Dict[str, object]]:
    entries: List[Dict[str, object]] = []
    for path in sorted(_EPISODE_DIR.glob("*.json")):
        try:
            with path.open("r", encoding="utf-8") as fp:
                raw = json.load(fp)
            raw.setdefault("id", path.stem)
            raw["id"] = _sanitize_episode_id(raw["id"])
            episode = Episode.model_validate(raw)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            logger.warning("略過 Episode 檔案 %s：%s", path.name, exc)
            continue
        clients: List[str] = []
        for track in episode.tracks:
            client = track.target_client_id
            if client and client not in clients:
                clients.append(client)
        entries.append(
            {
                "id": episode.id,
                "title": episode.title,
                "track_count": len(episode.tracks),
                "clients": clients,
                "tags": episode.tags,
            }
        )
    return entries


def resolve_episode(
    episode: Episode,
    target_client_map: Optional[Dict[str, str]] = None,
    auto_play_override: Optional[bool] = None,
    force_iframe_mode: Optional[bool] = None,
    command_id_prefix: Optional[str] = None,
) -> ResolvedEpisode:
    target_client_map = target_client_map or {}
    sanitized_map: Dict[str, str] = {}
    for timeline_id, client_id in target_client_map.items():
        try:
            key = sanitize_timeline_id(timeline_id)
            value = sanitize_client_id(client_id)
            if value:
                sanitized_map[key] = value
        except Exception:
            continue

    resolved_tracks: List[ResolvedEpisodeTrack] = []
    for track in episode.tracks:
        timeline = load_iframe_timeline_definition(track.timeline_id)
        mapped_client = sanitized_map.get(timeline.id)
        target_client = mapped_client or track.target_client_id or timeline.client_id
        resolved_target = sanitize_client_id(target_client)
        if not resolved_target:
            raise ValueError(f"track {timeline.id} 缺少 target_client_id，請在 track 或 timeline 定義提供")

        auto_play = bool(auto_play_override) if auto_play_override is not None else bool(track.auto_play)
        force_mode = force_iframe_mode if force_iframe_mode is not None else track.force_iframe_mode
        options: Dict[str, object] = {
            "autoPlay": auto_play,
        }
        if force_mode is not None:
            options["forceIframeMode"] = bool(force_mode)
        if track.start_step is not None:
            options["startStep"] = max(0, int(track.start_step))
        if track.loop_override is not None:
            options["loop"] = bool(track.loop_override)
        if track.start_at is not None:
            options["startAt"] = max(0.0, float(track.start_at))

        if command_id_prefix:
            options["commandId"] = f"{command_id_prefix}:{timeline.id}"

        resolved_tracks.append(
            ResolvedEpisodeTrack(
                timeline_id=timeline.id,
                timeline_title=timeline.title,
                target_client_id=resolved_target,
                start_at=options.get("startAt"),
                step_count=len(timeline.steps),
                options=options,
            )
        )

    return ResolvedEpisode(episode=episode, tracks=resolved_tracks)


async def play_episode(
    episode: Episode,
    target_client_map: Optional[Dict[str, str]] = None,
    auto_play_override: Optional[bool] = None,
    force_iframe_mode: Optional[bool] = None,
    command_id_prefix: Optional[str] = None,
) -> ResolvedEpisode:
    resolved = resolve_episode(
        episode,
        target_client_map=target_client_map,
        auto_play_override=auto_play_override,
        force_iframe_mode=force_iframe_mode,
        command_id_prefix=command_id_prefix,
    )

    for track in resolved.tracks:
        await realtime_broadcaster.broadcast_timeline_control(
            action="play",
            timeline_id=track.timeline_id,
            target_client_id=track.target_client_id,
            options=track.options,
        )

    return resolved
