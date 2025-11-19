"""Tests for iframe timeline play/stop APIs."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


def _write_timeline_file(directory: Path, timeline_id: str = "demo", client_id: str = "desktop") -> str:
    payload = {
        "id": timeline_id,
        "title": "Demo timeline",
        "clientId": client_id,
        "loop": False,
        "steps": [
            {
                "snapshot": f"{client_id}/first_snapshot",
                "duration": 5,
                "label": "first",
            },
            {
                "snapshot": f"{client_id}/second_snapshot",
                "duration": 3,
                "label": "second",
            },
        ],
    }
    directory.mkdir(parents=True, exist_ok=True)
    (directory / f"{timeline_id}.json").write_text(json.dumps(payload), encoding="utf-8")
    return timeline_id


@pytest.fixture()
def timeline_dir(mock_settings) -> Path:
    path = Path(mock_settings.metadata_dir) / "timelines" / "iframe"
    path.mkdir(parents=True, exist_ok=True)
    return path


@pytest.mark.api
@patch("app.api.timeline.realtime_broadcaster.broadcast_timeline_control", new_callable=AsyncMock)
def test_play_timeline_broadcasts_control(mock_broadcast: AsyncMock, client: TestClient, timeline_dir: Path) -> None:
    timeline_id = _write_timeline_file(timeline_dir, timeline_id="city_opening", client_id="desktop2")

    response = client.post(
        f"/api/iframe-timelines/{timeline_id}/play",
        json={
            "target_client_id": "desktop2",
            "start_step": 1,
            "auto_play": True,
            "loop_override": True,
            "force_iframe_mode": False,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["timeline_id"] == timeline_id
    assert data["target_client_id"] == "desktop2"
    mock_broadcast.assert_awaited_once()
    args = mock_broadcast.await_args
    assert args.kwargs["action"] == "play"
    assert args.kwargs["timeline_id"] == timeline_id
    assert args.kwargs["target_client_id"] == "desktop2"
    options = args.kwargs["options"]
    assert options["startStep"] == 1
    assert options["loop"] is True
    assert options["forceIframeMode"] is False


@pytest.mark.api
@patch("app.api.timeline.realtime_broadcaster.broadcast_timeline_control", new_callable=AsyncMock)
def test_play_timeline_uses_default_client(mock_broadcast: AsyncMock, client: TestClient, timeline_dir: Path) -> None:
    timeline_id = _write_timeline_file(timeline_dir, timeline_id="loop_intro", client_id="wall_display")

    response = client.post(f"/api/iframe-timelines/{timeline_id}/play", json={})

    assert response.status_code == 200
    payload = response.json()
    assert payload["target_client_id"] == "wall_display"
    mock_broadcast.assert_awaited_once()
    args = mock_broadcast.await_args
    assert args.kwargs["target_client_id"] == "wall_display"


@pytest.mark.api
def test_play_timeline_invalid_client_id_returns_400(client: TestClient, timeline_dir: Path) -> None:
    timeline_id = _write_timeline_file(timeline_dir, timeline_id="invalid_target", client_id="desktop")

    response = client.post(
        f"/api/iframe-timelines/{timeline_id}/play",
        json={"target_client_id": "bad client"},
    )

    assert response.status_code == 400
    assert "target_client_id" in response.text


@pytest.mark.api
def test_stop_timeline_invalid_client_id_returns_400(client: TestClient) -> None:
    response = client.post(
        "/api/iframe-timelines/stop",
        json={"target_client_id": "another bad id"},
    )

    assert response.status_code == 400
    assert "target_client_id" in response.text
