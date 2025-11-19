from __future__ import annotations

import pytest

from app.services.screenshot_queue import ScreenshotRequestQueue


class FakeClock:
    def __init__(self, start: float = 0.0) -> None:
        self.current = start

    def advance(self, seconds: float) -> None:
        self.current += seconds

    def __call__(self) -> float:
        return self.current


class StubBroadcaster:
    def __init__(self) -> None:
        self.events: list[tuple[dict, str | None]] = []

    async def broadcast(self, message: dict, target_client_id: str | None = None) -> None:
        self.events.append((message, target_client_id))


@pytest.mark.asyncio
async def test_pending_messages_filtered_by_client() -> None:
    queue = ScreenshotRequestQueue(broadcaster=None)

    await queue.create_request({"client_id": "alpha"})
    await queue.create_request({})

    pending_alpha = await queue.list_pending_messages("alpha")
    assert len(pending_alpha) == 2  # alpha sees both targeted and broadcast
    assert any(msg["target_client_id"] == "alpha" for msg in pending_alpha)

    pending_other = await queue.list_pending_messages("beta")
    assert all(msg.get("target_client_id") in (None, "beta") for msg in pending_other)


@pytest.mark.asyncio
async def test_queue_emits_events_via_broadcaster() -> None:
    broadcaster = StubBroadcaster()
    queue = ScreenshotRequestQueue(broadcaster=broadcaster)

    record = await queue.create_request({"client_id": "alpha"})
    assert broadcaster.events[-1][0]["type"] == "screenshot_request"
    assert broadcaster.events[-1][1] == "alpha"

    broadcaster.events.clear()
    result = {"filename": "test.png"}
    await queue.mark_completed(record["id"], result, processed_by="alpha")
    assert broadcaster.events == [({"type": "screenshot_completed", "request_id": record["id"]}, "alpha")]


@pytest.mark.asyncio
async def test_completed_requests_pruned_after_expiration() -> None:
    clock = FakeClock(start=100.0)
    queue = ScreenshotRequestQueue(
        broadcaster=None,
        max_age_seconds=60,
        cleanup_interval_seconds=5,
        time_provider=clock,
    )

    record = await queue.create_request({})
    await queue.mark_completed(record["id"], {"filename": "done.png"})
    assert await queue.get_request(record["id"]) is not None

    clock.advance(61)
    # Trigger cleanup via another action.
    await queue.create_request({})
    assert await queue.get_request(record["id"]) is None


@pytest.mark.asyncio
async def test_queue_enforces_max_entries_and_prefers_finished_records() -> None:
    clock = FakeClock(start=0)
    queue = ScreenshotRequestQueue(
        broadcaster=None,
        max_entries=2,
        max_age_seconds=None,
        cleanup_interval_seconds=None,
        time_provider=clock,
    )

    first = await queue.create_request({})
    clock.advance(1)
    second = await queue.create_request({})
    clock.advance(1)
    await queue.mark_completed(first["id"], {"filename": "done.png"})
    clock.advance(1)
    third = await queue.create_request({})

    # Completed requests should be pruned before pending ones when capacity is exceeded.
    assert await queue.get_request(first["id"]) is None
    assert await queue.get_request(second["id"]) is not None
    assert await queue.get_request(third["id"]) is not None

    clock.advance(1)
    fourth = await queue.create_request({})

    # No finished entries remain, so the oldest pending request should now be removed.
    assert await queue.get_request(second["id"]) is None
    assert await queue.get_request(third["id"]) is not None
    assert await queue.get_request(fourth["id"]) is not None
