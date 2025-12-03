import asyncio
from datetime import timedelta
from types import SimpleNamespace
from typing import Callable

import pytest

from app.services import client_queue
from app.services.client_queue import ClientQueueManager, ClientStateStore, QueueItem, _utcnow


async def _wait_until(predicate: Callable[[], bool], timeout: float = 1.0, interval: float = 0.01) -> None:
    end = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < end:
        if predicate():
            return
        await asyncio.sleep(interval)
    raise AssertionError("condition not met within timeout")


@pytest.mark.asyncio
async def test_enqueue_and_state_snapshot() -> None:
    state_store = ClientStateStore(offline_after_seconds=100.0)
    queue_manager = ClientQueueManager(state_store, broadcaster=None, auto_start_workers=False)

    await queue_manager.enqueue(client_id="alpha", item_type="snapshot", target_id="snap-a")
    queue = await queue_manager.list_queue("alpha")
    assert queue["total"] == 1
    state = await state_store.state_for("alpha")
    assert state is not None
    assert state["queue_size"] == 1
    assert state["status"] == "offline"  # 尚未收到 heartbeat


@pytest.mark.asyncio
async def test_worker_executes_and_marks_done() -> None:
    state_store = ClientStateStore(offline_after_seconds=100.0)
    queue_manager = ClientQueueManager(state_store, broadcaster=None, retry_backoff_seconds=0.01)

    executed: list[str] = []

    async def fake_executor(item) -> None:
        executed.append(item.target_id)

    queue_manager.set_executor(fake_executor)
    await queue_manager.enqueue(client_id="beta", item_type="snapshot", target_id="snap-b")

    await _wait_until(lambda: len(executed) == 1)
    queue = await queue_manager.list_queue("beta")
    assert queue["total"] == 0
    state = await state_store.state_for("beta")
    assert state is not None
    assert state.get("last_completed_item", {}).get("status") == "done"


@pytest.mark.asyncio
async def test_retry_on_failure_then_success() -> None:
    state_store = ClientStateStore(offline_after_seconds=100.0)
    queue_manager = ClientQueueManager(state_store, broadcaster=None, retry_backoff_seconds=0.01)

    attempts = 0

    async def flaky_executor(item) -> None:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("fail once")

    queue_manager.set_executor(flaky_executor)
    await queue_manager.enqueue(client_id="gamma", item_type="snapshot", target_id="snap-c", retries=1)

    await _wait_until(lambda: attempts >= 2)
    state = await state_store.state_for("gamma")
    assert state is not None
    assert state.get("last_completed_item", {}).get("status") == "done"
    assert state.get("errors")


@pytest.mark.asyncio
async def test_move_and_delay_update_queue_order() -> None:
    state_store = ClientStateStore(offline_after_seconds=100.0)
    queue_manager = ClientQueueManager(state_store, broadcaster=None, auto_start_workers=False)

    first = await queue_manager.enqueue(client_id="delta", item_type="snapshot", target_id="snap-d1", priority=0)
    second = await queue_manager.enqueue(client_id="delta", item_type="snapshot", target_id="snap-d2", priority=1)

    await queue_manager.move_items([first["id"]], priority=5)
    await queue_manager.delay_items([second["id"]], delta_seconds=10)

    queue = await queue_manager.list_queue("delta")
    assert queue["total"] == 2
    assert queue["items"][0]["target_id"] == "snap-d1"
    assert queue["items"][1]["target_id"] == "snap-d2"
    assert queue["items"][1]["eta"] is not None


@pytest.mark.asyncio
async def test_move_front_and_back_only_affects_selected_items() -> None:
    state_store = ClientStateStore(offline_after_seconds=100.0)
    queue_manager = ClientQueueManager(state_store, broadcaster=None, auto_start_workers=False)

    a = await queue_manager.enqueue(client_id="epsilon", item_type="snapshot", target_id="snap-e1")
    b = await queue_manager.enqueue(client_id="epsilon", item_type="snapshot", target_id="snap-e2")
    c = await queue_manager.enqueue(client_id="epsilon", item_type="snapshot", target_id="snap-e3")

    await queue_manager.move_items([b["id"]], position="front")
    queue = await queue_manager.list_queue("epsilon")
    assert queue["items"][0]["target_id"] == "snap-e2"
    assert queue["items"][1]["target_id"] in {"snap-e1", "snap-e3"}

    await queue_manager.move_items([c["id"]], position="back")
    queue_after = await queue_manager.list_queue("epsilon")
    assert queue_after["items"][-1]["target_id"] == "snap-e3"


@pytest.mark.asyncio
async def test_cancel_running_invokes_stop_and_clears_state() -> None:
    state_store = ClientStateStore(offline_after_seconds=100.0)
    queue_manager = ClientQueueManager(state_store, broadcaster=None, auto_start_workers=False)

    stop_calls: list[str] = []

    async def fake_stop(item) -> None:
        stop_calls.append(item.target_id)

    queue_manager._stop_running_item = fake_stop  # type: ignore[attr-defined]

    item_data = await queue_manager.enqueue(client_id="zeta", item_type="timeline", target_id="tl-1")
    async with queue_manager._lock:  # type: ignore[attr-defined]
        item_obj = queue_manager._items[item_data["id"]]  # type: ignore[attr-defined]
        item_obj.status = "running"
    await state_store.mark_running(item_obj)

    await queue_manager.cancel_items([item_data["id"]])

    assert stop_calls == ["tl-1"]
    state = await state_store.state_for("zeta")
    assert state is not None
    assert state["current_item"] is None
    assert state.get("last_completed_item", {}).get("status") == "canceled"


class _FakeBroadcaster:
    def __init__(self) -> None:
        self.timeline_controls: list[dict[str, object]] = []
        self.video_controls: list[dict[str, object]] = []
        self.client_states: list[dict[str, object]] = []

    async def broadcast_timeline_control(
        self,
        *,
        action,
        timeline_id,
        target_client_id,
        options,
    ) -> None:  # type: ignore[override]
        self.timeline_controls.append(
            {
                "action": action,
                "timeline_id": timeline_id,
                "target_client_id": target_client_id,
                "options": options,
            }
        )

    async def broadcast_video_control(self, payload, target_client_id=None) -> None:  # type: ignore[override]
        self.video_controls.append({"payload": payload, "target_client_id": target_client_id})

    async def broadcast_client_state(self, payload) -> None:  # type: ignore[override]
        self.client_states.append(payload)


@pytest.mark.asyncio
async def test_cancel_running_waits_for_stop_result(monkeypatch) -> None:
    state_store = ClientStateStore(offline_after_seconds=100.0)
    queue_manager = ClientQueueManager(state_store, broadcaster=None, auto_start_workers=False)

    started = asyncio.Event()
    resume = asyncio.Event()

    async def slow_stop(_item):
        started.set()
        await resume.wait()

    queue_manager._stop_running_item = slow_stop  # type: ignore[attr-defined]

    item_data = await queue_manager.enqueue(client_id="waiter", item_type="timeline", target_id="tl-wait")
    async with queue_manager._lock:  # type: ignore[attr-defined]
        item_obj = queue_manager._items[item_data["id"]]  # type: ignore[attr-defined]
        item_obj.status = "running"
    await state_store.mark_running(item_obj)

    cancel_task = asyncio.create_task(queue_manager.cancel_items([item_data["id"]]))

    await started.wait()
    mid_state = await state_store.state_for("waiter")
    assert mid_state is not None
    assert mid_state.get("current_item") is not None

    resume.set()
    await cancel_task

    final_state = await state_store.state_for("waiter")
    assert final_state is not None
    assert final_state.get("current_item") is None
    assert final_state.get("last_completed_item", {}).get("status") == "canceled"


@pytest.mark.asyncio
async def test_cancel_running_dispatches_type_specific_stop(monkeypatch) -> None:
    broadcaster = _FakeBroadcaster()
    stopped_scripts: list[str] = []

    def fake_stop_script(script_id: str) -> bool:
        stopped_scripts.append(script_id)
        return True

    monkeypatch.setattr(client_queue, "stop_script", fake_stop_script)

    state_store = ClientStateStore(offline_after_seconds=100.0)
    queue_manager = ClientQueueManager(state_store, broadcaster=broadcaster, auto_start_workers=False)

    async def _prepare_running(item_type: str, target_id: str, client_id: str) -> str:
        queued = await queue_manager.enqueue(client_id=client_id, item_type=item_type, target_id=target_id)
        async with queue_manager._lock:  # type: ignore[attr-defined]
            obj = queue_manager._items[queued["id"]]  # type: ignore[attr-defined]
            obj.status = "running"
        await state_store.mark_running(obj)
        return queued["id"]

    snap_id = await _prepare_running("snapshot", "snap-stop", "viewer")
    scene_id = await _prepare_running("scene", "scene-stop", "viewer")
    script_id = await _prepare_running("script", "script-stop", "player")

    await queue_manager.cancel_items([snap_id, scene_id, script_id])

    actions = {(item["action"], item.get("timeline_id"), item.get("target_client_id")) for item in broadcaster.timeline_controls}
    assert ("stop", None, "viewer") in actions
    assert ("stop", None, "player") in actions
    assert any(
        payload.get("action") == "stop" and payload.get("target_client_id") == "viewer"
        for payload in (entry["payload"] for entry in broadcaster.video_controls)
    )
    assert "script-stop" in stopped_scripts


@pytest.mark.asyncio
async def test_wait_for_wake_honors_pre_set_event() -> None:
    state_store = ClientStateStore(offline_after_seconds=100.0)
    queue_manager = ClientQueueManager(state_store, broadcaster=None, auto_start_workers=False)

    queue_manager._wake_events["omega"] = asyncio.Event()  # type: ignore[attr-defined]
    queue_manager._wake_events["omega"].set()  # type: ignore[attr-defined]

    start = asyncio.get_event_loop().time()
    await queue_manager._wait_for_wake_or_time("omega", _utcnow() + timedelta(seconds=5))  # type: ignore[attr-defined]
    elapsed = asyncio.get_event_loop().time() - start
    assert elapsed < 0.2


@pytest.mark.asyncio
async def test_completed_items_removed_from_store() -> None:
    state_store = ClientStateStore(offline_after_seconds=100.0)
    queue_manager = ClientQueueManager(state_store, broadcaster=None, retry_backoff_seconds=0.01)

    queue_manager.set_executor(asyncio.sleep)
    await queue_manager.enqueue(client_id="theta", item_type="snapshot", target_id="snap-t1")

    await _wait_until(lambda: not queue_manager._items, timeout=2.0)  # type: ignore[attr-defined]
    assert len(queue_manager._items) == 0  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_ready_items_precede_future_high_priority() -> None:
    state_store = ClientStateStore(offline_after_seconds=100.0)
    queue_manager = ClientQueueManager(state_store, broadcaster=None, retry_backoff_seconds=0.01)

    executed: list[str] = []

    async def fake_executor(item) -> None:
        executed.append(item.target_id)

    queue_manager.set_executor(fake_executor)

    # enqueue a future high-priority job, then a ready lower-priority job
    await queue_manager.enqueue(client_id="iota", item_type="snapshot", target_id="future", eta=0.5, priority=10)
    await queue_manager.enqueue(client_id="iota", item_type="snapshot", target_id="ready", eta=0, priority=0)

    await _wait_until(lambda: len(executed) >= 2, timeout=2.0)

    assert executed[0] == "ready"
    assert set(executed) == {"future", "ready"}


@pytest.mark.asyncio
async def test_future_items_follow_earliest_eta_over_priority() -> None:
    state_store = ClientStateStore(offline_after_seconds=100.0)
    queue_manager = ClientQueueManager(state_store, broadcaster=None, retry_backoff_seconds=0.01)

    executed: list[str] = []

    async def fake_executor(item) -> None:
        executed.append(item.target_id)

    queue_manager.set_executor(fake_executor)

    await queue_manager.enqueue(client_id="eta", item_type="snapshot", target_id="later-high", eta=0.6, priority=10)
    await queue_manager.enqueue(client_id="eta", item_type="snapshot", target_id="sooner-low", eta=0.1, priority=0)

    await _wait_until(lambda: len(executed) >= 2, timeout=2.0)

    assert executed[0] == "sooner-low"
    assert set(executed) == {"later-high", "sooner-low"}


@pytest.mark.asyncio
async def test_timeline_defaults_to_queue_client_when_no_override(monkeypatch) -> None:
    captured: dict[str, str] = {}

    def fake_load(_timeline_id):
        return object()

    def fake_resolve(_timeline_obj):
        return SimpleNamespace(
            timeline=SimpleNamespace(id="tl-one", client_id="timeline-default"),
            steps=[SimpleNamespace(client_id="step-default")],
        )

    class FakeBroadcaster:
        async def broadcast_timeline_control(self, *, action, timeline_id, target_client_id, options):  # type: ignore[override]
            captured["action"] = action
            captured["timeline_id"] = timeline_id
            captured["target_client_id"] = target_client_id
            captured["options"] = options

    monkeypatch.setattr(client_queue, "load_iframe_timeline_definition", fake_load)
    monkeypatch.setattr(client_queue, "resolve_iframe_timeline", fake_resolve)
    monkeypatch.setattr(client_queue, "realtime_broadcaster", FakeBroadcaster())

    state_store = ClientStateStore(offline_after_seconds=100.0)
    queue_manager = ClientQueueManager(state_store, broadcaster=None, auto_start_workers=False)

    item = QueueItem(
        id="q1",
        client_id="wall-2",
        item_type="timeline",
        target_id="tl-one",
        eta=_utcnow(),
        priority=0,
    )

    await queue_manager._execute_timeline(item)

    assert captured["target_client_id"] == "wall-2"
    assert captured["timeline_id"] == "tl-one"
