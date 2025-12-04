from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.api import timeline as timeline_api
from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_play_requires_target_when_missing(monkeypatch, client: TestClient):
    monkeypatch.setattr(
        timeline_api,
        "load_iframe_timeline_definition",
        lambda *_args, **_kwargs: SimpleNamespace(id="t3", client_id=None, status="published", version=1),
    )
    monkeypatch.setattr(timeline_api, "sanitize_client_id", lambda cid: cid or None)

    resp = client.post("/api/iframe-timelines/t3/play")

    assert resp.status_code == 400
    assert "timeline 缺少 client_id" in resp.json()["detail"]


def test_play_allows_draft_with_guard(monkeypatch, client: TestClient):
    ensure_called = {}

    def fake_guard(name):
        ensure_called["called"] = name

    timeline = SimpleNamespace(id="t4", client_id="desk", status="draft", version=2)
    monkeypatch.setattr(timeline_api, "ensure_metadata_write_enabled", fake_guard)
    monkeypatch.setattr(timeline_api, "load_iframe_timeline_definition", lambda *_args, **_kwargs: timeline)
    monkeypatch.setattr(timeline_api, "sanitize_client_id", lambda cid: cid)
    monkeypatch.setattr(timeline_api.realtime_broadcaster, "broadcast_timeline_control", AsyncMock())

    resp = client.post("/api/iframe-timelines/t4/play?allow_draft=true&target_client_id=desk")

    assert resp.status_code == 200
    assert ensure_called["called"] == "iframe_timeline_play_draft"
    options = resp.json()["options"]
    assert options["version"] == 2


@patch("app.api.timeline.publish_iframe_timeline", side_effect=ValueError("版本不符"))
def test_publish_version_conflict_returns_409(_mock_publish, client: TestClient):
    resp = client.post("/api/iframe-timelines/t5/publish")

    assert resp.status_code == 409
    assert "版本不符" in resp.json()["detail"]


def test_create_timeline_requires_dict_body(client: TestClient):
    resp = client.post("/api/iframe-timelines", json=["not", "a", "dict"])

    assert resp.status_code == 422
    assert resp.json()["detail"][0]["type"] == "dict_type"


def test_rollback_requires_version(monkeypatch, client: TestClient):
    monkeypatch.setattr(timeline_api, "rollback_iframe_timeline", lambda *_, **__: None)

    resp = client.post("/api/iframe-timelines/t6/rollback", json={})

    assert resp.status_code == 400
    assert "version 必須提供" in resp.json()["detail"]


def test_stop_requires_target(monkeypatch, client: TestClient):
    monkeypatch.setattr(timeline_api, "sanitize_client_id", lambda cid: cid)

    resp = client.post("/api/iframe-timelines/stop", json={})

    assert resp.status_code == 400
    assert "target_client_id 必須提供" in resp.json()["detail"]
