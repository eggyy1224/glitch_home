import asyncio
from datetime import timedelta
from typing import Callable

import pytest

from app.services.client_queue import ClientQueueManager, ClientStateStore, _utcnow


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
