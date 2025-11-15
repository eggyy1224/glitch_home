import pytest

from app.services.realtime_bus import RealtimeBroadcaster


class DummyWebSocket:
    def __init__(self, should_fail: bool = False) -> None:
        self.accepted = False
        self.sent_messages: list[dict] = []
        self.should_fail = should_fail

    async def accept(self) -> None:  # pragma: no cover - trivial
        self.accepted = True

    async def send_json(self, message: dict) -> None:
        if self.should_fail:
            raise RuntimeError("send failed")
        self.sent_messages.append(message)


@pytest.mark.asyncio
async def test_broadcast_filters_target_client() -> None:
    broadcaster = RealtimeBroadcaster()
    ws_alpha = DummyWebSocket()
    ws_beta = DummyWebSocket()

    await broadcaster.add_connection(ws_alpha)
    await broadcaster.add_connection(ws_beta)
    await broadcaster.register_client(ws_alpha, "alpha")
    await broadcaster.register_client(ws_beta, "beta")

    payload = {"type": "test", "value": 1}
    await broadcaster.broadcast(payload, target_client_id="alpha")

    assert ws_alpha.sent_messages == [payload]
    assert ws_beta.sent_messages == []


@pytest.mark.asyncio
async def test_failed_send_removes_connection() -> None:
    broadcaster = RealtimeBroadcaster()
    ws = DummyWebSocket(should_fail=True)

    await broadcaster.add_connection(ws)
    await broadcaster.register_client(ws, "alpha")

    await broadcaster.broadcast({"type": "test"}, target_client_id="alpha")

    clients = await broadcaster.list_clients()
    assert clients == []
