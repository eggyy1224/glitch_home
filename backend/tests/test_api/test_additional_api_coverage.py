from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.mark.api
@patch("app.api.scene.list_scenes", return_value=["scene-a"])
@patch("app.api.scene.load_scene_definition")
@patch("app.api.scene.resolve_scene")
def test_scene_list_and_detail_success(mock_resolve, mock_load, _mock_list, client: TestClient):
    mock_load.return_value = SimpleNamespace(id="scene-a", version=3)

    class Resolved:
        def to_payload(self):
            return {"id": "scene-a", "resolved": True}

    mock_resolve.return_value = Resolved()

    list_resp = client.get("/api/scenes")
    assert list_resp.status_code == 200
    assert list_resp.json()["scenes"] == ["scene-a"]

    detail_resp = client.get("/api/scenes/scene-a")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["scene"] == {"id": "scene-a", "resolved": True}


@pytest.mark.api
@patch("app.api.scene.load_scene_definition", side_effect=FileNotFoundError("scene missing"))
def test_scene_detail_not_found(mock_load, client: TestClient):
    resp = client.get("/api/scenes/missing")
    assert resp.status_code == 404
    assert "missing" in resp.json()["detail"]
    mock_load.assert_called_once()


@pytest.mark.api
@patch("app.api.scene.resolve_scene", side_effect=FileNotFoundError("snapshot not found"))
def test_scene_create_missing_snapshot_returns_error(mock_resolve, client: TestClient):
    body = {"id": "s1", "title": "t", "targets": {"c1": "snap"}}
    resp = client.post("/api/scenes", json=body)
    assert resp.status_code == 404
    assert "snapshot" in resp.json()["detail"]
    mock_resolve.assert_called_once()


@pytest.mark.api
@patch("app.api.scene.play_scene", side_effect=ValueError("未發布"))
@patch("app.api.scene.load_scene_definition", return_value=SimpleNamespace(id="draft_scene", version=1))
def test_scene_play_unpublished_returns_400(_mock_load, _mock_play, client: TestClient):
    resp = client.post("/api/scenes/draft_scene/play")
    assert resp.status_code == 400
    assert "未發布" in resp.json()["detail"]


@pytest.mark.api
@patch("app.api.scene.load_scene_definition", return_value=SimpleNamespace(id="audio", version=1))
def test_scene_play_invalid_audio_override_returns_400(_mock_load, client: TestClient):
    resp = client.post("/api/scenes/audio/play", json={"audio_override": {"mode": "balanced", "left": 2}})
    assert resp.status_code == 400


@pytest.mark.api
@patch("app.api.script.resolve_script", side_effect=FileNotFoundError("ref missing"))
@patch("app.api.script.load_script_definition", return_value=SimpleNamespace(id="s1", version=1))
def test_script_detail_missing_reference_returns_404(_mock_load, _mock_resolve, client: TestClient):
    resp = client.get("/api/scripts/s1")
    assert resp.status_code == 404
    assert "ref" in resp.json()["detail"]


@pytest.mark.api
@patch("app.api.script.load_script_definition", return_value=SimpleNamespace(id="draft", version=1))
@patch("app.api.script.play_script", side_effect=ValueError("未發布"))
def test_script_play_unpublished_returns_400(_mock_play, _mock_load, client: TestClient):
    resp = client.post("/api/scripts/draft/play")
    assert resp.status_code == 400
    assert "未發布" in resp.json()["detail"]


@pytest.mark.api
@patch("app.api.script.publish_script", side_effect=ValueError("版本不符"))
def test_script_publish_version_conflict_returns_409(mock_publish, client: TestClient):
    resp = client.post("/api/scripts/s1/publish")
    assert resp.status_code == 409
    assert "版本" in resp.json()["detail"]
    mock_publish.assert_called_once_with("s1", publish_as=None, expected_version=None)


@pytest.mark.api
@patch("app.api.script.rollback_script", side_effect=ValueError("版本不符"))
def test_script_rollback_version_conflict_returns_409(mock_rollback, client: TestClient):
    resp = client.post("/api/scripts/s1/rollback", json={"version": 2})
    assert resp.status_code == 409
    assert "版本" in resp.json()["detail"]
    mock_rollback.assert_called_once()


@pytest.mark.api
@patch("app.api.script.play_script", new_callable=AsyncMock)
@patch("app.api.script.load_script_definition", return_value=SimpleNamespace(id="valid", version=1))
def test_script_play_missing_body_still_requires_valid_payload(_mock_load, mock_play, client: TestClient):
    resp = client.post("/api/scripts/valid/play", json={"audio_override": {"mode": "balanced", "left": -1}})
    assert resp.status_code == 400
    mock_play.assert_not_awaited()


@pytest.mark.api
@patch("app.api.script.rollback_script")
def test_script_rollback_missing_body_returns_422(mock_rollback, client: TestClient):
    resp = client.post("/api/scripts/s1/rollback")
    assert resp.status_code == 422
    mock_rollback.assert_not_called()


@pytest.mark.api
@patch("app.api.episode.load_episode_definition", side_effect=FileNotFoundError("episode not found"))
def test_episode_update_missing_file_returns_404(mock_load, client: TestClient):
    resp = client.put("/api/episodes/missing", json={"title": "x"})
    assert resp.status_code == 404
    mock_load.assert_called_once_with("missing")


@pytest.mark.api
@patch("app.api.episode.load_episode_definition", return_value=SimpleNamespace(id="draft", status="draft"))
def test_episode_play_unpublished_returns_400(_mock_load, client: TestClient):
    resp = client.post("/api/episodes/draft/play")
    assert resp.status_code == 400
    assert "僅允許播放已發布" in resp.json()["detail"]


@pytest.mark.api
@patch("app.api.episode.Episode.model_validate", return_value=SimpleNamespace(id="ep1", status="published", model_dump=lambda *_, **__: {}))
@patch("app.api.episode.resolve_episode", side_effect=Exception("parse failed"))
@patch("app.api.episode.load_episode_definition", return_value=SimpleNamespace(id="ep1", status="published"))
def test_episode_update_resolution_failure_returns_500(_mock_load, _mock_resolve, _mock_validate, client: TestClient):
    resp = client.put("/api/episodes/ep1", json={"title": "bad"})
    assert resp.status_code == 500
    assert "parse failed" in resp.json()["detail"]


@pytest.mark.api
@patch("app.api.episode.play_episode", side_effect=FileNotFoundError("missing track"))
@patch("app.api.episode.load_episode_definition", return_value=SimpleNamespace(id="ep2", status="published"))
def test_episode_play_missing_file_returns_404(_mock_load, _mock_play, client: TestClient):
    resp = client.post("/api/episodes/ep2/play")
    assert resp.status_code == 404
    assert "missing" in resp.json()["detail"]


@pytest.mark.api
@patch("app.api.timeline.load_iframe_timeline_definition", return_value=SimpleNamespace(id="t1", client_id=None, status="draft"))
def test_timeline_play_draft_without_allow_flag_returns_400(_mock_load, client: TestClient):
    resp = client.post("/api/iframe-timelines/t1/play", json={"target_client_id": "desk"})
    assert resp.status_code == 400
    assert "僅允許播放已發布" in resp.json()["detail"]


@pytest.mark.api
@patch("app.api.timeline.realtime_broadcaster.broadcast_timeline_control", new_callable=AsyncMock)
@patch("app.api.timeline.load_iframe_timeline_definition", return_value=SimpleNamespace(id="t2", client_id="desk", status="published"))
def test_timeline_stop_invalid_client_id_returns_400(_mock_load, _mock_broadcast, client: TestClient):
    resp = client.post("/api/iframe-timelines/stop", json={"target_client_id": "bad client"})
    assert resp.status_code == 400
    assert "target_client_id" in resp.text


@pytest.mark.api
@patch("app.api.realtime.subtitle_manager.set_subtitle", side_effect=ValueError("invalid target"))
def test_realtime_set_subtitle_invalid_target_returns_400(_mock_set, client: TestClient):
    resp = client.post(
        "/api/subtitles",
        json={"text": "hi", "language": "en", "duration_seconds": 1, "target_client_id": "bad client"},
    )
    assert resp.status_code == 400
    assert "invalid" in resp.json()["detail"]


@pytest.mark.api
@patch("app.api.realtime.caption_manager.set_caption", side_effect=ValueError("missing client"))
def test_realtime_set_caption_invalid_target_returns_400(_mock_set, client: TestClient):
    resp = client.post(
        "/api/captions",
        json={"text": "hi", "language": "en", "duration_seconds": 1, "target_client_id": ""},
    )
    assert resp.status_code == 400
    assert "missing" in resp.json()["detail"]


@pytest.mark.api
def test_remote_click_empty_payload_returns_422(client: TestClient):
    resp = client.post("/api/remote-click", json={})
    assert resp.status_code == 422


@pytest.mark.api
def test_video_control_invalid_speed_validation(client: TestClient):
    resp = client.post("/api/video-control", json={"action": "set_speed", "speed": 5})
    assert resp.status_code == 422


@pytest.mark.api
def test_video_control_invalid_volume_validation(client: TestClient):
    resp = client.post("/api/video-control", json={"action": "set_volume", "volume": -1})
    assert resp.status_code == 422


@pytest.mark.api
def test_subtitle_clear_idempotent(client: TestClient):
    first = client.delete("/api/subtitles")
    second = client.delete("/api/subtitles")
    assert first.status_code == 204
    assert second.status_code == 204


@pytest.mark.api
def test_caption_clear_idempotent(client: TestClient):
    first = client.delete("/api/captions")
    second = client.delete("/api/captions")
    assert first.status_code == 204
    assert second.status_code == 204


@pytest.mark.api
def test_scene_crud_and_publish_flows(monkeypatch, client: TestClient):
    from app.api import scene as scene_api
    payload = {"id": "scene_crud", "title": "title", "targets": {"c1": "snap1"}}
    scene_model = scene_api.Scene.model_validate(payload)

    def _resolved(_scene):
        return SimpleNamespace(to_payload=lambda: {"id": _scene.id, "resolved": True}, targets=["a", "b"])

    monkeypatch.setattr(scene_api, "resolve_scene", _resolved)
    monkeypatch.setattr(scene_api, "save_scene_definition", lambda *_, **__: scene_model)
    monkeypatch.setattr(scene_api, "load_scene_definition", lambda *_args, **_kwargs: scene_model)
    monkeypatch.setattr(scene_api, "clone_scene_definition", lambda *_args, **_kwargs: scene_model)
    monkeypatch.setattr(scene_api, "list_scene_versions", lambda *_args, **_kwargs: [1, 2])
    monkeypatch.setattr(scene_api, "publish_scene", lambda *_args, **_kwargs: scene_model)
    monkeypatch.setattr(scene_api, "rollback_scene", lambda *_args, **_kwargs: scene_model)

    create_resp = client.post("/api/scenes", json=payload)
    assert create_resp.status_code == 201
    update_resp = client.put("/api/scenes/scene_crud", json=payload)
    assert update_resp.status_code == 200
    clone_resp = client.post("/api/scenes/scene_crud/clone", json={"new_id": "scene_clone"})
    assert clone_resp.status_code == 201
    versions_resp = client.get("/api/scenes/scene_crud/versions")
    assert versions_resp.status_code == 200
    publish_resp = client.post("/api/scenes/scene_crud/publish", json={"publish_as": "alias"})
    assert publish_resp.status_code == 200
    rollback_resp = client.post("/api/scenes/scene_crud/rollback", json={"version": 1})
    assert rollback_resp.status_code == 200


@pytest.mark.api
def test_script_crud_and_versioning(monkeypatch, client: TestClient):
    from app.api import script as script_api

    body = {
        "id": "script_crud",
        "title": "title",
        "entries": [{"type": "scene", "scene_id": "scene_crud", "duration": 1}],
    }
    script_model = script_api.Script.model_validate(body)

    monkeypatch.setattr(script_api, "resolve_script", lambda _script: SimpleNamespace(to_payload=lambda: {"id": _script.id}))
    monkeypatch.setattr(script_api, "save_script_definition", lambda *_, **__: script_model)
    monkeypatch.setattr(script_api, "load_script_definition", lambda *_args, **_kwargs: script_model)
    monkeypatch.setattr(script_api, "clone_script_definition", lambda *_args, **_kwargs: script_model)
    monkeypatch.setattr(script_api, "list_script_versions", lambda *_args, **_kwargs: [1, 2, 3])
    monkeypatch.setattr(script_api, "publish_script", lambda *_args, **_kwargs: script_model)
    monkeypatch.setattr(script_api, "rollback_script", lambda *_args, **_kwargs: script_model)

    create_resp = client.post("/api/scripts", json=body)
    assert create_resp.status_code == 201
    update_resp = client.put("/api/scripts/script_crud", json=body)
    assert update_resp.status_code == 200
    clone_resp = client.post("/api/scripts/script_crud/clone", json={"new_id": "script_clone"})
    assert clone_resp.status_code == 201
    versions_resp = client.get("/api/scripts/script_crud/versions")
    assert versions_resp.status_code == 200
    publish_resp = client.post("/api/scripts/script_crud/publish", json={"publish_as": "alias"})
    assert publish_resp.status_code == 200
    rollback_resp = client.post("/api/scripts/script_crud/rollback", json={"version": 2})
    assert rollback_resp.status_code == 200


@pytest.mark.api
def test_episode_clone_and_play_branches(monkeypatch, client: TestClient):
    from app.api import episode as episode_api

    class DummyEpisode:
        def __init__(self, eid: str = "episode1"):
            self.id = eid
            self.status = "published"
            self.version = 1

        def model_dump(self, mode=None, by_alias=None):
            return {"id": self.id, "tracks": []}

    dummy_episode = DummyEpisode()
    monkeypatch.setattr(episode_api, "Episode", SimpleNamespace(model_validate=lambda *_args, **_kwargs: dummy_episode))
    monkeypatch.setattr(episode_api, "resolve_episode", lambda _ep: SimpleNamespace(to_payload=lambda: {"id": _ep.id}))
    monkeypatch.setattr(episode_api, "save_episode_definition", lambda *_, **__: dummy_episode)
    monkeypatch.setattr(episode_api, "load_episode_definition", lambda *_args, **_kwargs: dummy_episode)
    monkeypatch.setattr(episode_api, "delete_episode_definition", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(episode_api, "publish_episode", lambda *_args, **_kwargs: dummy_episode)
    monkeypatch.setattr(episode_api, "rollback_episode", lambda *_args, **_kwargs: dummy_episode)
    monkeypatch.setattr(
        episode_api,
        "play_episode",
        AsyncMock(return_value=SimpleNamespace(tracks=[SimpleNamespace(to_payload=lambda: {"id": "t1"})])),
    )

    body = {"id": "episode1", "title": "title", "tracks": []}
    create_resp = client.post("/api/episodes", json=body)
    assert create_resp.status_code == 201
    update_resp = client.put("/api/episodes/episode1", json=body)
    assert update_resp.status_code == 200
    clone_resp = client.post("/api/episodes/episode1/clone", json={"new_id": "ep_clone"})
    assert clone_resp.status_code == 201
    publish_resp = client.post("/api/episodes/episode1/publish")
    assert publish_resp.status_code == 200
    rollback_resp = client.post("/api/episodes/episode1/rollback", json={"version": 1})
    assert rollback_resp.status_code == 200
    play_resp = client.post("/api/episodes/episode1/play")
    assert play_resp.status_code == 200
    delete_resp = client.delete("/api/episodes/episode1")
    assert delete_resp.status_code == 200


@pytest.mark.api
def test_timeline_create_publish_and_rollback(monkeypatch, client: TestClient):
    from app.api import timeline as timeline_api

    class DummyTimeline:
        def __init__(self, tid: str = "timeline1"):
            self.id = tid
            self.client_id = "desk"
            self.version = 1

        def model_dump(self, mode=None, by_alias=None):
            return {"id": self.id, "clientId": self.client_id, "steps": []}

        def to_payload(self):
            return {"id": self.id, "clientId": self.client_id, "steps": []}

    dummy_timeline = DummyTimeline()
    monkeypatch.setattr(timeline_api, "IframeTimeline", SimpleNamespace(model_validate=lambda *_args, **_kwargs: dummy_timeline))
    monkeypatch.setattr(timeline_api, "resolve_iframe_timeline", lambda _tl: dummy_timeline)
    monkeypatch.setattr(timeline_api, "save_iframe_timeline_definition", lambda *_, **__: dummy_timeline)
    monkeypatch.setattr(timeline_api, "load_iframe_timeline_definition", lambda *_args, **_kwargs: dummy_timeline)
    monkeypatch.setattr(timeline_api, "publish_iframe_timeline", lambda *_args, **_kwargs: dummy_timeline)
    monkeypatch.setattr(timeline_api, "rollback_iframe_timeline", lambda *_args, **_kwargs: dummy_timeline)
    monkeypatch.setattr(timeline_api, "list_iframe_timeline_versions", lambda *_args, **_kwargs: [1, 2])
    monkeypatch.setattr(timeline_api, "delete_iframe_timeline_definition", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(timeline_api.realtime_broadcaster, "broadcast_timeline_control", AsyncMock())

    body = {"id": "timeline1", "clientId": "desk", "steps": []}
    create_resp = client.post("/api/iframe-timelines", json=body)
    assert create_resp.status_code == 201
    update_resp = client.put("/api/iframe-timelines/timeline1", json=body)
    assert update_resp.status_code == 200
    versions_resp = client.get("/api/iframe-timelines/timeline1/versions")
    assert versions_resp.status_code == 200
    publish_resp = client.post("/api/iframe-timelines/timeline1/publish")
    assert publish_resp.status_code == 200
    rollback_resp = client.post("/api/iframe-timelines/timeline1/rollback", json={"version": 1})
    assert rollback_resp.status_code == 200
    delete_resp = client.delete("/api/iframe-timelines/timeline1")
    assert delete_resp.status_code == 200


@pytest.mark.api
def test_realtime_screenshot_endpoints(monkeypatch, client: TestClient):
    from app.api import realtime as realtime_api

    fake_record = {"id": "req1", "status": "pending"}
    monkeypatch.setattr(realtime_api.screenshot_request_queue, "create_request", AsyncMock(return_value=fake_record))
    monkeypatch.setattr(realtime_api.screenshot_request_queue, "get_request", AsyncMock(return_value=None))
    monkeypatch.setattr(realtime_api.screenshot_request_queue, "mark_failed", AsyncMock(return_value=None))

    create_resp = client.post("/api/screenshots/request", json={"meta": True})
    assert create_resp.status_code == 202
    missing_resp = client.get("/api/screenshots/missing")
    assert missing_resp.status_code == 404
    fail_resp = client.post("/api/screenshots/missing/fail", json={"error": "bad"})
    assert fail_resp.status_code == 404
