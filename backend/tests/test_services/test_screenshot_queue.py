from __future__ import annotations

import pytest

from app.services.screenshot_queue import ScreenshotRequestQueue


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
