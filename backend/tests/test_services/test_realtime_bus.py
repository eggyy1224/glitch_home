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
