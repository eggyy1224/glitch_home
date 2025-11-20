"""Additional validation coverage for realtime endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.api
def test_remote_click_missing_coordinates(client):
    # y missing -> pydantic validation 422
    resp = client.post("/api/remote-click", json={"x": 10})
    assert resp.status_code == 422


@pytest.mark.api
def test_video_control_missing_required_fields(client):
    # set_volume without volume should trigger validation error
    resp = client.post("/api/video-control", json={"action": "set_volume"})
    assert resp.status_code == 422


@pytest.mark.api
def test_stop_iframe_timeline_requires_target(client):
    resp = client.post("/api/iframe-timelines/stop", json={})
    assert resp.status_code == 400
    assert "target_client_id 必須提供" in resp.json()["detail"]


@pytest.mark.api
@patch("app.api.timeline.load_iframe_timeline_definition")
def test_play_iframe_timeline_missing_target_returns_400(mock_load, client):
    class DummyTimeline:
        id = "demo"
        client_id = None

    mock_load.return_value = DummyTimeline()

    resp = client.post("/api/iframe-timelines/demo/play", json={})

    assert resp.status_code == 400
    assert "timeline 缺少 client_id" in resp.json()["detail"]
    mock_load.assert_called_once_with("demo")
