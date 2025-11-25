from __future__ import annotations

import asyncio
import logging
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Dict, Iterable, List, Optional

from ..models.episode import Episode
from .episode import load_episode_definition, play_episode
from .iframe_config import (
    config_payload_for_response as iframe_config_payload_for_response,
    restore_iframe_config_snapshot,
    sanitize_client_id,
)
from .iframe_timeline import (
    load_iframe_timeline_definition,
    resolve_iframe_timeline,
    sanitize_timeline_id,
)
from .realtime_bus import RealtimeBroadcaster, realtime_broadcaster

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _normalize_priority(value: int | None) -> int:
    if value is None:
        return 0
    return int(value)


def _normalize_eta(value: float | int | str | datetime | None) -> datetime:
    """Accept seconds-from-now, ISO string, timestamp, or datetime."""

    now = _utcnow()
    if value is None:
        return now
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc)
    if isinstance(value, (int, float)):
        # Treat numeric as offset seconds.
        return now + timedelta(seconds=float(value))
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
            return parsed.astimezone(timezone.utc)
        except Exception as exc:  # noqa: BLE001
            raise ValueError("eta 需要 ISO8601 時間字串或秒數") from exc
    raise ValueError("eta 格式不支援")


@dataclass
class QueueItem:
    id: str
    client_id: str
    item_type: str
    target_id: str
    eta: datetime
    priority: int = 0
    status: str = "pending"
    retries: int = 0
    attempts: int = 0
    created_at: datetime = field(default_factory=_utcnow)
    updated_at: datetime = field(default_factory=_utcnow)
    error_message: str | None = None
    payload: Dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "client_id": self.client_id,
            "type": self.item_type,
            "target_id": self.target_id,
            "eta": _iso(self.eta),
            "priority": self.priority,
            "status": self.status,
            "retries": self.retries,
            "attempts": self.attempts,
            "created_at": _iso(self.created_at),
            "updated_at": _iso(self.updated_at),
            "error_message": self.error_message,
            "payload": self.payload or {},
        }


@dataclass
class ClientStateRecord:
    client_id: str
    last_heartbeat: datetime | None = None
    current_item: Dict[str, Any] | None = None
    last_completed_item: Dict[str, Any] | None = None
    errors: List[str] = field(default_factory=list)
    queue_size: int = 0
    status_hint: str | None = None

    def as_dict(self, offline_after_seconds: float) -> Dict[str, Any]:
        now = _utcnow()
        status = "offline"
        if self.last_heartbeat:
            delta = (now - self.last_heartbeat).total_seconds()
            if delta <= offline_after_seconds:
                if self.status_hint:
                    status = self.status_hint
                elif self.current_item:
                    status = "busy"
                elif self.queue_size > 0:
                    status = "idle"
                else:
                    status = "online"

        payload: Dict[str, Any] = {
            "client_id": self.client_id,
            "status": status,
            "last_heartbeat": _iso(self.last_heartbeat),
            "current_item": self.current_item,
            "queue_size": self.queue_size,
            "errors": list(self.errors),
        }
        if self.last_completed_item:
            payload["last_completed_item"] = self.last_completed_item
        return payload


class ClientStateStore:
    """Track per-client heartbeat and execution state."""

    def __init__(
        self,
        *,
        offline_after_seconds: float = 10.0,
        max_errors: int = 20,
    ) -> None:
        self._lock = asyncio.Lock()
        self._states: Dict[str, ClientStateRecord] = {}
        self._offline_after_seconds = offline_after_seconds
        self._max_errors = max_errors

    async def _get_or_create(self, client_id: str) -> ClientStateRecord:
        async with self._lock:
            record = self._states.get(client_id)
            if record is None:
                record = ClientStateRecord(client_id=client_id)
                self._states[client_id] = record
            return record

    async def record_heartbeat(self, client_id: str | None) -> Dict[str, Any]:
        cleaned = sanitize_client_id(client_id)
        if not cleaned:
            raise ValueError("client_id 必須提供")
        record = await self._get_or_create(cleaned)
        async with self._lock:
            record.last_heartbeat = _utcnow()
            record.status_hint = None
            snapshot = record.as_dict(self._offline_after_seconds)
        return snapshot

    async def set_queue_size(self, client_id: str, size: int) -> None:
        record = await self._get_or_create(client_id)
        async with self._lock:
            record.queue_size = max(0, int(size))

    async def mark_running(self, item: QueueItem) -> Dict[str, Any]:
        record = await self._get_or_create(item.client_id)
        running_payload = {
            "queue_item_id": item.id,
            "type": item.item_type,
            "target_id": item.target_id,
            "started_at": _iso(_utcnow()),
            "status": "running",
        }
        async with self._lock:
            record.current_item = running_payload
            record.status_hint = "busy"
            snapshot = record.as_dict(self._offline_after_seconds)
        return snapshot

    async def mark_completed(self, item: QueueItem) -> Dict[str, Any]:
        record = await self._get_or_create(item.client_id)
        completed_payload = {
            "queue_item_id": item.id,
            "type": item.item_type,
            "target_id": item.target_id,
            "status": item.status,
            "finished_at": _iso(_utcnow()),
            "error_message": item.error_message,
        }
        async with self._lock:
            record.last_completed_item = completed_payload
            record.current_item = None
            record.status_hint = None
            snapshot = record.as_dict(self._offline_after_seconds)
        return snapshot

    async def add_error(self, client_id: str, message: str) -> None:
        record = await self._get_or_create(client_id)
        async with self._lock:
            record.errors.append(message)
            if len(record.errors) > self._max_errors:
                record.errors = record.errors[-self._max_errors :]

    async def clear_errors(self, client_id: str) -> None:
        record = await self._get_or_create(client_id)
        async with self._lock:
            record.errors.clear()

    async def clear_current_item(self, client_id: str) -> None:
        record = await self._get_or_create(client_id)
        async with self._lock:
            record.current_item = None
            record.status_hint = None

    async def snapshot(self) -> List[Dict[str, Any]]:
        async with self._lock:
            records = list(self._states.values())
            payload = [rec.as_dict(self._offline_after_seconds) for rec in records]
        payload.sort(key=lambda item: item["client_id"])
        return payload

    async def state_for(self, client_id: str) -> Dict[str, Any] | None:
        async with self._lock:
            record = self._states.get(client_id)
            if record is None:
                return None
            return record.as_dict(self._offline_after_seconds)


class ClientQueueManager:
    """In-memory queue per client with simple worker coroutine."""

    SUPPORTED_TYPES = {"snapshot", "timeline", "episode"}

    def __init__(
        self,
        state_store: ClientStateStore,
        broadcaster: RealtimeBroadcaster | None = None,
        *,
        retry_backoff_seconds: float = 2.0,
        auto_start_workers: bool = True,
    ) -> None:
        self._lock = asyncio.Lock()
        self._items: Dict[str, QueueItem] = {}
        self._queue_by_client: Dict[str, List[str]] = {}
        self._workers: Dict[str, asyncio.Task[None]] = {}
        self._state_store = state_store
        self._broadcaster = broadcaster
        self._retry_backoff_seconds = retry_backoff_seconds
        self._auto_start_workers = auto_start_workers
        self._executor: Callable[[QueueItem], Awaitable[None]] = self._default_executor

    def set_executor(self, executor: Callable[[QueueItem], Awaitable[None]]) -> None:
        self._executor = executor

    async def enqueue(
        self,
        *,
        client_id: str,
        item_type: str,
        target_id: str,
        eta: float | int | str | datetime | None = None,
        priority: int | None = None,
        retries: int | None = None,
        payload: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        cleaned_client = sanitize_client_id(client_id)
        if not cleaned_client:
            raise ValueError("client_id 必須提供")
        normalized_type = (item_type or "").strip().lower()
        if normalized_type not in self.SUPPORTED_TYPES:
            raise ValueError(f"不支援的佇列類型：{item_type}")
        sanitized_target = (target_id or "").strip()
        if not sanitized_target:
            raise ValueError("target_id 必須提供")

        safe_eta = _normalize_eta(eta)
        safe_priority = _normalize_priority(priority)
        item_id = secrets.token_hex(8)
        queue_item = QueueItem(
            id=item_id,
            client_id=cleaned_client,
            item_type=normalized_type,
            target_id=sanitized_target,
            eta=safe_eta,
            priority=safe_priority,
            retries=max(0, int(retries or 0)),
            payload=dict(payload or {}),
        )

        async with self._lock:
            self._items[item_id] = queue_item
            queue = self._queue_by_client.setdefault(cleaned_client, [])
            queue.append(item_id)
            pending_count = self._pending_count_locked(cleaned_client)

        await self._state_store.set_queue_size(cleaned_client, pending_count)
        await self._broadcast_state(cleaned_client)
        self._ensure_worker(cleaned_client)
        logger.info(
            "Enqueued item %s for client %s type=%s target=%s priority=%s eta=%s",
            item_id,
            cleaned_client,
            normalized_type,
            sanitized_target,
            safe_priority,
            _iso(safe_eta),
        )
        return queue_item.as_dict()

    async def list_queue(
        self,
        client_id: str,
        *,
        status_filter: str | Iterable[str] | None = None,
        page: int = 1,
        limit: int = 50,
    ) -> Dict[str, Any]:
        cleaned_client = sanitize_client_id(client_id)
        if not cleaned_client:
            raise ValueError("client_id 必須提供")

        normalized_filters: set[str] | None = None
        if status_filter:
            if isinstance(status_filter, str):
                parts = [part.strip().lower() for part in status_filter.split(",") if part.strip()]
                normalized_filters = set(parts)
            else:
                normalized_filters = {str(value).strip().lower() for value in status_filter}
        async with self._lock:
            queue_ids = list(self._queue_by_client.get(cleaned_client, []))
            items = [self._items[item_id] for item_id in queue_ids if item_id in self._items]

        sorted_items = sorted(
            items,
            key=lambda item: (-item.priority, item.eta, item.created_at),
        )
        if normalized_filters is not None:
            sorted_items = [item for item in sorted_items if item.status in normalized_filters]

        safe_limit = max(1, min(int(limit), 200))
        safe_page = max(1, int(page))
        start = (safe_page - 1) * safe_limit
        end = start + safe_limit
        slice_items = sorted_items[start:end]
        return {
            "client_id": cleaned_client,
            "items": [item.as_dict() for item in slice_items],
            "page": safe_page,
            "limit": safe_limit,
            "total": len(sorted_items),
        }

    async def cancel_items(self, ids: Iterable[str]) -> List[Dict[str, Any]]:
        affected_clients: set[str] = set()
        canceled: List[Dict[str, Any]] = []
        running_items: list[QueueItem] = []
        async with self._lock:
            for raw_id in ids:
                item_id = (raw_id or "").strip()
                if not item_id:
                    continue
                item = self._items.get(item_id)
                if item is None:
                    continue
                if item.status not in {"pending", "running"}:
                    continue
                if item.status == "running":
                    running_items.append(item)
                item.status = "canceled"
                item.updated_at = _utcnow()
                affected_clients.add(item.client_id)
                canceled.append(item.as_dict())
            for client_id in affected_clients:
                self._compact_queue_locked(client_id)
        for item in running_items:
            try:
                await self._stop_running_item(item)
            except Exception as exc:  # noqa: BLE001
                logger.warning("強制停止 queue item %s 失敗: %s", item.id, exc)
            await self._state_store.mark_completed(item)
        await self._recompute_and_broadcast(affected_clients)
        return canceled

    async def delay_items(
        self,
        ids: Iterable[str],
        *,
        delta_seconds: float | int | None = None,
        eta: float | int | str | datetime | None = None,
    ) -> List[Dict[str, Any]]:
        if delta_seconds is None and eta is None:
            raise ValueError("必須提供 delta_seconds 或 eta")
        affected_clients: set[str] = set()
        delayed: List[Dict[str, Any]] = []
        async with self._lock:
            for raw_id in ids:
                item_id = (raw_id or "").strip()
                if not item_id:
                    continue
                item = self._items.get(item_id)
                if item is None or item.status != "pending":
                    continue
                new_eta = _normalize_eta(eta)
                if delta_seconds is not None:
                    new_eta = item.eta + timedelta(seconds=float(delta_seconds))
                item.eta = new_eta
                item.updated_at = _utcnow()
                affected_clients.add(item.client_id)
                delayed.append(item.as_dict())
        await self._recompute_and_broadcast(affected_clients)
        return delayed

    async def move_items(
        self,
        ids: Iterable[str],
        *,
        priority: int | None = None,
        position: str | None = None,
    ) -> List[Dict[str, Any]]:
        normalized_position = (position or "").strip().lower() if position else None
        if priority is None and normalized_position is None:
            raise ValueError("必須提供 priority 或 position")
        affected_clients: set[str] = set()
        moved: List[Dict[str, Any]] = []
        async with self._lock:
            selected_by_client: dict[str, list[QueueItem]] = {}
            for raw_id in ids:
                item_id = (raw_id or "").strip()
                if not item_id:
                    continue
                item = self._items.get(item_id)
                if item is None or item.status != "pending":
                    continue
                if priority is not None:
                    item.priority = _normalize_priority(priority)
                affected_clients.add(item.client_id)
                moved.append(item.as_dict())
                selected_by_client.setdefault(item.client_id, []).append(item)

            for client_id, selected_items in selected_by_client.items():
                pending_items = [
                    self._items[item_id]
                    for item_id in self._queue_by_client.get(client_id, [])
                    if item_id in self._items and self._items[item_id].status == "pending"
                ]
                other_items = [item for item in pending_items if item not in selected_items]

                if normalized_position in {"front", "head"}:
                    base = max((item.priority for item in other_items), default=0)
                    for index, item in enumerate(selected_items):
                        item.priority = base + (len(selected_items) - index)
                        item.updated_at = _utcnow()
                elif normalized_position in {"back", "tail"}:
                    base = min((item.priority for item in other_items), default=0)
                    for index, item in enumerate(selected_items):
                        item.priority = base - (index + 1)
                        item.updated_at = _utcnow()
        await self._recompute_and_broadcast(affected_clients)
        return moved

    async def _stop_running_item(self, item: QueueItem) -> None:
        """Best-effort stop for running timeline/episode items."""

        if item.item_type == "timeline":
            await realtime_broadcaster.broadcast_timeline_control(
                action="stop",
                timeline_id=item.target_id,
                target_client_id=item.client_id,
                options={"releaseControl": True},
            )
        elif item.item_type == "episode":
            await realtime_broadcaster.broadcast_timeline_control(
                action="stop",
                timeline_id=None,
                target_client_id=item.client_id,
                options={"releaseControl": True},
            )

    async def _recompute_and_broadcast(self, clients: Iterable[str]) -> None:
        unique_clients = {cid for cid in clients if cid}
        for client_id in unique_clients:
            async with self._lock:
                pending_count = self._pending_count_locked(client_id)
            await self._state_store.set_queue_size(client_id, pending_count)
            await self._broadcast_state(client_id)

    def _pending_count_locked(self, client_id: str) -> int:
        queue = self._queue_by_client.get(client_id, [])
        return sum(1 for item_id in queue if self._items.get(item_id) and self._items[item_id].status == "pending")

    def _compact_queue_locked(self, client_id: str) -> None:
        queue = self._queue_by_client.get(client_id)
        if queue is None:
            return
        filtered = [item_id for item_id in queue if self._items.get(item_id) and self._items[item_id].status in {"pending", "running"}]
        if filtered:
            self._queue_by_client[client_id] = filtered
        else:
            self._queue_by_client.pop(client_id, None)

    def _ensure_worker(self, client_id: str) -> None:
        if not self._auto_start_workers:
            return
        if client_id in self._workers:
            task = self._workers[client_id]
            if not task.done():
                return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        task = loop.create_task(self._worker_loop(client_id))
        self._workers[client_id] = task

    async def _worker_loop(self, client_id: str) -> None:
        try:
            while True:
                next_item = await self._next_item(client_id)
                if next_item is None:
                    async with self._lock:
                        self._compact_queue_locked(client_id)
                    await self._state_store.set_queue_size(client_id, 0)
                    await self._broadcast_state(client_id)
                    return
                now = _utcnow()
                if next_item.eta > now:
                    await asyncio.sleep((next_item.eta - now).total_seconds())
                    continue
                await self._execute_item(next_item)
        except asyncio.CancelledError:
            return

    async def _next_item(self, client_id: str) -> QueueItem | None:
        async with self._lock:
            queue_ids = self._queue_by_client.get(client_id, [])
            pending_items = [
                self._items[item_id]
                for item_id in queue_ids
                if item_id in self._items and self._items[item_id].status == "pending"
            ]
        if not pending_items:
            return None
        return min(
            pending_items,
            key=lambda item: (-item.priority, item.eta, item.created_at),
        )

    async def _execute_item(self, item: QueueItem) -> None:
        item.status = "running"
        item.updated_at = _utcnow()
        await self._state_store.mark_running(item)
        await self._broadcast_state(item.client_id)
        error_message: str | None = None
        try:
            await self._executor(item)
            item.status = "done"
            item.error_message = None
            logger.info(
                "Queue item %s completed for client %s type=%s target=%s",
                item.id,
                item.client_id,
                item.item_type,
                item.target_id,
            )
        except Exception as exc:  # noqa: BLE001
            item.attempts += 1
            error_message = str(exc)
            item.error_message = error_message
            if item.attempts <= item.retries:
                backoff = max(self._retry_backoff_seconds, 0.5) * item.attempts
                item.status = "pending"
                item.eta = _utcnow() + timedelta(seconds=backoff)
                logger.warning(
                    "Queue item %s failed (attempt %s/%s), retry in %.2fs: %s",
                    item.id,
                    item.attempts,
                    item.retries,
                    backoff,
                    exc,
                    exc_info=exc,
                )
            else:
                item.status = "failed"
                logger.error(
                    "Queue item %s failed after %s attempts: %s",
                    item.id,
                    item.attempts,
                    exc,
                    exc_info=exc,
                )
        finally:
            item.updated_at = _utcnow()
            async with self._lock:
                self._compact_queue_locked(item.client_id)
                pending_count = self._pending_count_locked(item.client_id)
            await self._state_store.set_queue_size(item.client_id, pending_count)
            if item.status in {"done", "failed", "canceled"}:
                await self._state_store.mark_completed(item)
            else:
                await self._state_store.clear_current_item(item.client_id)
            if error_message:
                await self._state_store.add_error(item.client_id, error_message)
            await self._broadcast_state(item.client_id)

    async def _broadcast_state(self, client_id: str) -> None:
        if self._broadcaster is None:
            return
        state = await self._state_store.state_for(client_id)
        if state is None:
            return
        queue_snapshot = await self.list_queue(client_id, limit=20)
        payload = {
            "client_id": client_id,
            "state": state,
            "queue": queue_snapshot.get("items", []),
        }
        await self._broadcaster.broadcast_client_state(payload)

    async def _default_executor(self, item: QueueItem) -> None:
        if item.item_type == "snapshot":
            await self._execute_snapshot(item)
        elif item.item_type == "timeline":
            await self._execute_timeline(item)
        elif item.item_type == "episode":
            await self._execute_episode(item)
        else:
            raise ValueError(f"未知的佇列類型：{item.item_type}")

    async def _execute_snapshot(self, item: QueueItem) -> None:
        config, target_client_id = restore_iframe_config_snapshot(item.client_id, item.target_id)
        payload = iframe_config_payload_for_response(config, target_client_id)
        await realtime_broadcaster.broadcast_iframe_config(payload, target_client_id=target_client_id)

    async def _execute_timeline(self, item: QueueItem) -> None:
        timeline = load_iframe_timeline_definition(item.target_id)
        resolved_timeline = resolve_iframe_timeline(timeline)
        target_from_payload = item.payload.get("target_client_id") if isinstance(item.payload, dict) else None
        resolved_target = sanitize_client_id(target_from_payload) or sanitize_client_id(resolved_timeline.client_id)
        if not resolved_target:
            raise ValueError("timeline 缺少 target_client_id，請在 payload 或 timeline 定義提供")

        options: Dict[str, object] = {
            "autoPlay": item.payload.get("auto_play", True) if isinstance(item.payload, dict) else True,
            "forceIframeMode": item.payload.get("force_iframe_mode", True) if isinstance(item.payload, dict) else True,
        }
        if isinstance(item.payload, dict):
            if item.payload.get("start_step") is not None:
                options["startStep"] = max(0, int(item.payload["start_step"]))
            if item.payload.get("loop_override") is not None:
                options["loop"] = bool(item.payload["loop_override"])
            if item.payload.get("command_id"):
                options["commandId"] = str(item.payload["command_id"]).strip()

        await realtime_broadcaster.broadcast_timeline_control(
            action="play",
            timeline_id=resolved_timeline.id,
            target_client_id=resolved_target,
            options=options,
        )

    async def _execute_episode(self, item: QueueItem) -> None:
        episode: Episode = load_episode_definition(item.target_id)
        payload = item.payload if isinstance(item.payload, dict) else {}
        target_map = payload.get("target_client_map")
        if target_map and isinstance(target_map, dict):
            safe_map = {}
            for timeline_id, client in target_map.items():
                try:
                    safe_map[sanitize_timeline_id(timeline_id)] = sanitize_client_id(client) or ""
                except ValueError:
                    continue
            target_map = {k: v for k, v in safe_map.items() if v}
        else:
            target_map = None

        resolved = await play_episode(
            episode,
            target_client_map=target_map,
            auto_play_override=payload.get("auto_play_override"),
            force_iframe_mode=payload.get("force_iframe_mode"),
            command_id_prefix=payload.get("command_id_prefix"),
        )
        logger.info(
            "Episode %s dispatched (%s tracks)",
            episode.id,
            len(resolved.tracks),
        )


client_state_store = ClientStateStore()
client_queue_manager = ClientQueueManager(client_state_store, realtime_broadcaster)
