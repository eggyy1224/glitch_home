import asyncio

import pytest

from app.services.realtime_bus import RealtimeBroadcaster


class DummyWebSocket:
    def __init__(
        self,
        fail_times: int = 0,
        exception: Exception | None = None,
        delay: float = 0.0,
    ) -> None:
        self.accepted = False
        self.sent_messages: list[dict] = []
        self.fail_times = fail_times
        self.exception = exception or RuntimeError("send failed")
        self.attempts = 0
        self.delay = delay

    async def accept(self) -> None:  # pragma: no cover - trivial
        self.accepted = True

    async def send_json(self, message: dict) -> None:
        self.attempts += 1
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.fail_times > 0:
            self.fail_times -= 1
            raise self.exception
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
    ws = DummyWebSocket(fail_times=1)

    await broadcaster.add_connection(ws)
    await broadcaster.register_client(ws, "alpha")

    await broadcaster.broadcast({"type": "test"}, target_client_id="alpha")

    clients = await broadcaster.list_clients()
    assert clients == []


@pytest.mark.asyncio
async def test_broadcast_remote_click_payload_includes_target() -> None:
    broadcaster = RealtimeBroadcaster()
    ws_alpha = DummyWebSocket()
    ws_beta = DummyWebSocket()

    await broadcaster.add_connection(ws_alpha)
    await broadcaster.add_connection(ws_beta)
    await broadcaster.register_client(ws_alpha, "alpha")
    await broadcaster.register_client(ws_beta, "beta")

    click_payload = {"selector": ".video-playback", "x": 120.0, "y": 64.0}
    await broadcaster.broadcast_remote_click(click_payload, target_client_id="alpha")

    assert ws_alpha.sent_messages == [
        {
            "type": "remote_click",
            "selector": ".video-playback",
            "x": 120.0,
            "y": 64.0,
            "target_client_id": "alpha",
        }
    ]
    assert ws_beta.sent_messages == []


@pytest.mark.asyncio
async def test_broadcast_unlock_audio_includes_target_flag() -> None:
    broadcaster = RealtimeBroadcaster()
    ws_alpha = DummyWebSocket()
    ws_beta = DummyWebSocket()

    await broadcaster.add_connection(ws_alpha)
    await broadcaster.add_connection(ws_beta)
    await broadcaster.register_client(ws_alpha, "display")
    await broadcaster.register_client(ws_beta, "control")

    await broadcaster.broadcast_unlock_audio(target_client_id="control")

    assert ws_alpha.sent_messages == []
    assert ws_beta.sent_messages == [
        {
            "type": "unlock_audio",
            "target_client_id": "control",
        }
    ]


@pytest.mark.asyncio
async def test_broadcast_video_control_includes_target() -> None:
    broadcaster = RealtimeBroadcaster()
    ws_alpha = DummyWebSocket()
    ws_beta = DummyWebSocket()

    await broadcaster.add_connection(ws_alpha)
    await broadcaster.add_connection(ws_beta)
    await broadcaster.register_client(ws_alpha, "alpha")
    await broadcaster.register_client(ws_beta, "beta")

    payload = {"action": "mute"}
    await broadcaster.broadcast_video_control(payload, target_client_id="beta")

    assert ws_alpha.sent_messages == []
    assert ws_beta.sent_messages == [
        {
            "type": "video_control",
            "action": "mute",
            "target_client_id": "beta",
        }
    ]


@pytest.mark.asyncio
async def test_retryable_send_logs_and_succeeds_on_retry(caplog: pytest.LogCaptureFixture) -> None:
    broadcaster = RealtimeBroadcaster()
    ws = DummyWebSocket(fail_times=1, exception=asyncio.TimeoutError("temporary timeout"))

    await broadcaster.add_connection(ws)
    await broadcaster.register_client(ws, "client-123")

    caplog.set_level("WARNING")
    status = await broadcaster._send(ws, {"type": "test", "value": 1})

    assert status is True
    assert ws.sent_messages == [{"type": "test", "value": 1}]
    assert "Retryable WebSocket send_json failure for client client-123" in caplog.text


@pytest.mark.asyncio
async def test_non_retryable_send_logs_and_returns_false(caplog: pytest.LogCaptureFixture) -> None:
    broadcaster = RealtimeBroadcaster()
    ws = DummyWebSocket(fail_times=1, exception=RuntimeError("fatal send failure"))

    await broadcaster.add_connection(ws)
    await broadcaster.register_client(ws, None)

    caplog.set_level("WARNING")
    status = await broadcaster._send(ws, {"type": "test"})

    assert status is False
    assert ws.sent_messages == []
    clients = await broadcaster.list_clients()
    assert clients == []
    assert "Non-retryable WebSocket send_json failure for client None" in caplog.text


@pytest.mark.asyncio
async def test_slow_client_timeout_does_not_block_broadcast() -> None:
    broadcaster = RealtimeBroadcaster(send_timeout=0.05)
    fast_ws = DummyWebSocket()
    slow_ws = DummyWebSocket(delay=0.2)

    await broadcaster.add_connection(fast_ws)
    await broadcaster.add_connection(slow_ws)
    await broadcaster.register_client(fast_ws, "fast")
    await broadcaster.register_client(slow_ws, "slow")

    payload = {"type": "test", "value": "broadcast"}

    await asyncio.wait_for(broadcaster.broadcast(payload), timeout=0.15)

    assert fast_ws.sent_messages == [payload]
    clients = await broadcaster.list_clients()
    assert clients == [{"client_id": "fast", "connections": 1}]
