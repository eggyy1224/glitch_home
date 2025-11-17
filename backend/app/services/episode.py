from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Set

from ..config import settings
from ..models.episode import Episode
from .iframe_config import sanitize_client_id
from .iframe_timeline import (
    IframeTimeline,
    ResolvedIframeTimeline,
    load_iframe_timeline_definition,
    resolve_iframe_timeline,
)

_EPISODE_DIR = Path(settings.metadata_dir) / "episodes"
_EPISODE_DIR.mkdir(parents=True, exist_ok=True)

_EPISODE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


def _sanitize_episode_id(value: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError("episode_id 不可為空白")
    if not _EPISODE_ID_PATTERN.fullmatch(cleaned):
        raise ValueError("episode_id 僅允許字母、數字、底線、連字號")
    return cleaned


def _episode_path_for(episode_id: str) -> Path:
    safe_id = _sanitize_episode_id(episode_id)
    return _EPISODE_DIR / f"{safe_id}.json"


def _load_episode_payload(path: Path) -> Dict[str, object]:
    with path.open("r", encoding="utf-8") as fp:
        payload = json.load(fp)
    if "id" not in payload:
        payload["id"] = path.stem
    else:
        payload["id"] = _sanitize_episode_id(str(payload["id"]))
    return payload


def load_episode_definition(episode_id: str) -> Episode:
    path = _episode_path_for(episode_id)
    if not path.exists():
        raise FileNotFoundError("episode 不存在")
    payload = _load_episode_payload(path)
    episode = Episode.model_validate(payload)
    return episode


def _clients_from_layout(layout: Optional[Dict[str, object]]) -> Set[str]:
    if not isinstance(layout, dict):
        return set()
    clients: Set[str] = set()
    for key, value in layout.items():
        if isinstance(key, str):
            try:
                sanitized_key = sanitize_client_id(key)
            except ValueError:
                sanitized_key = None
            if sanitized_key:
                clients.add(sanitized_key)
        if isinstance(value, dict):
            for nested_key in ("client", "client_id", "clientId"):
                nested_value = value.get(nested_key)
                if isinstance(nested_value, str):
                    try:
                        sanitized_value = sanitize_client_id(nested_value)
                    except ValueError:
                        continue
                    if sanitized_value:
                        clients.add(sanitized_value)
    return clients


def _clients_from_timeline(timeline: Optional[IframeTimeline]) -> Set[str]:
    if timeline is None:
        return set()
    clients: Set[str] = set()
    try:
        if timeline.client_id:
            sanitized = sanitize_client_id(timeline.client_id)
            if sanitized:
                clients.add(sanitized)
    except ValueError:
        pass
    for step in timeline.steps:
        try:
            if step.client_id:
                sanitized_step_client = sanitize_client_id(step.client_id)
                if sanitized_step_client:
                    clients.add(sanitized_step_client)
        except ValueError:
            continue
        if "/" in step.snapshot:
            snapshot_client, _ = step.snapshot.split("/", 1)
            try:
                sanitized_snapshot_client = sanitize_client_id(snapshot_client)
            except ValueError:
                continue
            if sanitized_snapshot_client:
                clients.add(sanitized_snapshot_client)
    return clients


def list_episodes(client: Optional[str] = None) -> List[Dict[str, object]]:
    sanitized_client = sanitize_client_id(client) if client else None
    entries: List[Dict[str, object]] = []
    for path in sorted(_EPISODE_DIR.glob("*.json")):
        try:
            payload = _load_episode_payload(path)
            episode = Episode.model_validate(payload)
        except Exception:
            continue

        timeline: Optional[IframeTimeline] = None
        try:
            timeline = load_iframe_timeline_definition(episode.timeline_id)
        except Exception:
            timeline = None

        clients = _clients_from_layout(episode.clients_layout)
        clients.update(_clients_from_timeline(timeline))

        if sanitized_client and sanitized_client not in clients:
            continue

        entries.append(
            {
                "id": episode.id,
                "title": episode.title,
                "description": episode.description,
                "tags": episode.tags,
                "timeline_id": episode.timeline_id,
                "clients": sorted(clients),
                "status": episode.meta.status.value,
            }
        )
    return entries


@dataclass
class ResolvedEpisode:
    episode: Episode
    timeline: ResolvedIframeTimeline

    def to_payload(self) -> Dict[str, object]:
        payload = self.episode.model_dump(exclude_none=True, by_alias=True)
        payload["timeline"] = self.timeline.to_payload()
        payload["assets"] = self.episode.assets
        payload["meta"] = self.episode.meta.model_dump(exclude_none=True, by_alias=True)
        return payload


def resolve_episode(episode: Episode) -> ResolvedEpisode:
    timeline = load_iframe_timeline_definition(episode.timeline_id)
    resolved_timeline = resolve_iframe_timeline(timeline)
    return ResolvedEpisode(episode=episode, timeline=resolved_timeline)
