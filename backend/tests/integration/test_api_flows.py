from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.screenshot_queue import screenshot_request_queue


pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def async_client():
    await app.router.startup()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    await app.router.shutdown()


@pytest.fixture
def sample_png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
        b"\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\n"
        b"IDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.mark.asyncio
async def test_collage_and_iframe_configs_roundtrip(async_client: AsyncClient) -> None:
    client_id = "viewer_integration"

    collage_payload = {
        "target_client_id": client_id,
        "images": ["offspring_a.png"],
        "image_count": 1,
        "rows": 6,
        "cols": 5,
        "mix": True,
        "stage_width": 640,
        "stage_height": 480,
        "seed": 42,
    }
    resp = await async_client.put("/api/collage-config", json=collage_payload)
    assert resp.status_code == 200
    created = resp.json()
    assert created["source"] == "client"
    assert created["target_client_id"] == client_id
    assert created["config"]["image_count"] == 1
    assert created["config"]["rows"] == 6
    assert created["config"]["cols"] == 5
    assert created["config"]["mix"] is True
    assert created["updated_at"] is not None

    fetched = await async_client.get(f"/api/collage-config?client={client_id}")
    assert fetched.status_code == 200
    fetched_json = fetched.json()
    assert fetched_json["source"] == "client"
    assert fetched_json["target_client_id"] == client_id
    assert fetched_json["config"]["images"] == ["offspring_a.png"]

    iframe_payload = {
        "target_client_id": client_id,
        "layout": "grid",
        "gap": 8,
        "columns": 2,
        "panels": [
            {"id": "panel_left", "url": "/?client=left", "ratio": 1.2, "label": "Left"},
            {"id": "panel_right", "url": "/?client=right&slide_mode=true", "ratio": 0.8, "label": "Right"},
        ],
    }
    resp = await async_client.put("/api/iframe-config", json=iframe_payload)
    assert resp.status_code == 200
    iframe_created = resp.json()
    assert iframe_created["target_client_id"] == client_id
    assert iframe_created["layout"] == "grid"
    assert iframe_created["columns"] == 2
    assert len(iframe_created["panels"]) == 2
    assert {panel["id"] for panel in iframe_created["panels"]} == {"panel_left", "panel_right"}

    iframe_fetched = await async_client.get(f"/api/iframe-config?client={client_id}")
    assert iframe_fetched.status_code == 200
    iframe_fetched_json = iframe_fetched.json()
    assert iframe_fetched_json["target_client_id"] == client_id
    assert iframe_fetched_json["layout"] == "grid"
    assert len(iframe_fetched_json["panels"]) == 2
    panel_by_id = {panel["id"]: panel for panel in iframe_fetched_json["panels"]}
    assert panel_by_id["panel_left"]["src"].startswith("/")
    assert panel_by_id["panel_right"]["src"].startswith("/")


@pytest.mark.asyncio
async def test_screenshot_request_lifecycle_and_bundle(
    async_client: AsyncClient,
    tmp_path: Path,
    sample_png_bytes: bytes,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    create_resp = await async_client.post("/api/screenshots/request", json={"client_id": "display-1", "label": "flow"})
    assert create_resp.status_code == 202
    record = create_resp.json()
    request_id = record["id"]
    assert record["status"] == "pending"

    pending_resp = await async_client.get(f"/api/screenshots/{request_id}")
    assert pending_resp.status_code == 200
    assert pending_resp.json()["status"] == "pending"

    upload_path = tmp_path / "upload.png"
    upload_path.write_bytes(sample_png_bytes)
    files = {"file": ("upload.png", upload_path.read_bytes(), "image/png")}
    data = {"request_id": request_id, "client_id": "worker-1"}
    upload_resp = await async_client.post("/api/screenshots", files=files, data=data)
    assert upload_resp.status_code == 201
    upload_json = upload_resp.json()
    assert upload_json["status"] == "completed"
    assert Path(upload_json["absolute_path"]).is_file()

    def fake_analyze(path: str, prompt: str | None = None) -> dict:
        return {"summary": "Calm coast", "segments": ["waves", "horizon line"]}

    def fake_sound_effect(**kwargs) -> dict:
        return {"filename": "scene.mp3", "relative_path": "generated_sounds/scene.mp3", "output_format": "mp3"}

    monkeypatch.setattr("app.api.screenshot.analyze_screenshot", fake_analyze)
    monkeypatch.setattr("app.api.screenshot.generate_sound_effect", fake_sound_effect)

    bundle_resp = await async_client.post(
        "/api/screenshot/bundle",
        json={"request_id": request_id, "sound_duration_seconds": 2.5},
    )
    assert bundle_resp.status_code == 200
    bundle_json = bundle_resp.json()
    assert bundle_json["analysis"]["summary"] == "Calm coast"
    assert bundle_json["sound"]["filename"] == "scene.mp3"
    assert bundle_json["request_id"] == request_id
    assert bundle_json["request_metadata"]["status"] == "completed"

    queue_record = await screenshot_request_queue.get_request(request_id)
    assert queue_record is not None
    assert queue_record.get("sound_effect", {}).get("filename") == "scene.mp3"


@pytest.mark.asyncio
async def test_subtitles_and_captions_flow(async_client: AsyncClient) -> None:
    subtitle_resp = await async_client.post(
        "/api/subtitles",
        params={"target_client_id": "display-alpha"},
        json={"text": "字幕測試", "language": "zh-TW", "duration_seconds": 3},
    )
    assert subtitle_resp.status_code == 202
    get_subtitle = await async_client.get("/api/subtitles", params={"client": "display-alpha"})
    assert get_subtitle.status_code == 200
    assert get_subtitle.json()["subtitle"]["text"] == "字幕測試"

    clear_subtitle = await async_client.delete("/api/subtitles", params={"target_client_id": "display-alpha"})
    assert clear_subtitle.status_code == 204
    cleared = await async_client.get("/api/subtitles", params={"client": "display-alpha"})
    assert cleared.status_code == 200
    assert cleared.json().get("subtitle") is None

    caption_resp = await async_client.post(
        "/api/captions",
        params={"target_client_id": "display-beta"},
        json={"text": "標題測試", "language": "zh-TW"},
    )
    assert caption_resp.status_code == 202
    get_caption = await async_client.get("/api/captions", params={"client": "display-beta"})
    assert get_caption.status_code == 200
    assert get_caption.json()["caption"]["text"] == "標題測試"

    clear_caption = await async_client.delete("/api/captions", params={"target_client_id": "display-beta"})
    assert clear_caption.status_code == 204
    cleared_caption = await async_client.get("/api/captions", params={"client": "display-beta"})
    assert cleared_caption.status_code == 200
    assert cleared_caption.json().get("caption") is None


@pytest.mark.asyncio
async def test_screenshot_fail_and_status(async_client: AsyncClient) -> None:
    create_resp = await async_client.post("/api/screenshots/request", json={"client_id": "display-err"})
    assert create_resp.status_code == 202
    request_id = create_resp.json()["id"]

    fail_resp = await async_client.post(
        f"/api/screenshots/{request_id}/fail",
        json={"error": "worker crash", "client_id": "display-err"},
    )
    assert fail_resp.status_code == 200
    assert fail_resp.json()["status"] == "failed"
    assert fail_resp.json()["error"] == "worker crash"

    status_resp = await async_client.get(f"/api/screenshots/{request_id}")
    assert status_resp.status_code == 200
    status_json = status_resp.json()
    assert status_json["status"] == "failed"
    assert status_json["error"] == "worker crash"


@pytest.mark.asyncio
async def test_sound_effects_with_request_metadata(
    async_client: AsyncClient,
    tmp_path: Path,
    sample_png_bytes: bytes,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    create_resp = await async_client.post("/api/screenshots/request", json={"client_id": "display-sound"})
    assert create_resp.status_code == 202
    request_id = create_resp.json()["id"]

    image_path = tmp_path / "sound.png"
    image_path.write_bytes(sample_png_bytes)
    await screenshot_request_queue.mark_completed(
        request_id,
        {"absolute_path": str(image_path)},
        processed_by="worker-sound",
    )

    def fake_sound_effect(**kwargs) -> dict:
        return {"filename": "fx.mp3", "relative_path": "generated_sounds/fx.mp3", "output_format": "mp3"}

    monkeypatch.setattr("app.api.screenshot.generate_sound_effect", fake_sound_effect)

    sound_resp = await async_client.post(
        "/api/sound-effects",
        json={
            "request_id": request_id,
            "prompt": "風聲",
            "duration_seconds": 1.2,
        },
    )
    assert sound_resp.status_code == 200
    payload = sound_resp.json()
    assert payload["sound"]["filename"] == "fx.mp3"
    assert payload["request_id"] == request_id
    assert payload["request_metadata"]["status"] == "completed"
    assert payload["request_metadata"]["sound_effect"]["filename"] == "fx.mp3"


@pytest.mark.asyncio
async def test_iframe_snapshot_restore_flow(async_client: AsyncClient) -> None:
    client_id = "snap-client"
    base_payload = {
        "target_client_id": client_id,
        "layout": "horizontal",
        "gap": 4,
        "columns": 3,
        "panels": [
            {"id": "p1", "url": "/a?mode=one", "ratio": 1.0},
            {"id": "p2", "url": "/b?mode=two", "ratio": 1.0},
        ],
    }

    set_resp = await async_client.put("/api/iframe-config", json=base_payload)
    assert set_resp.status_code == 200

    snapshot_resp = await async_client.post(
        "/api/iframe-config/snapshot",
        json={"client_id": client_id, "snapshot_name": "int-test"},
    )
    assert snapshot_resp.status_code == 201
    snapshot_name = snapshot_resp.json()["snapshot"]["name"]

    modified_payload = {**base_payload, "panels": [{"id": "p3", "url": "/c?mode=three", "ratio": 1.0}]}
    update_resp = await async_client.put("/api/iframe-config", json=modified_payload)
    assert update_resp.status_code == 200
    assert len(update_resp.json()["panels"]) == 1

    restore_resp = await async_client.post(
        "/api/iframe-config/restore",
        json={"client_id": client_id, "snapshot_name": snapshot_name},
    )
    assert restore_resp.status_code == 200
    restored = restore_resp.json()
    assert restored["target_client_id"] == client_id
    assert restored["layout"] == "horizontal"
    panel_ids = [p["id"] for p in restored["panels"]]
    assert panel_ids == ["p1", "p2"]

    list_resp = await async_client.get("/api/iframe-config/snapshots", params={"client": client_id})
    assert list_resp.status_code == 200
    assert any(s["name"] == snapshot_name for s in list_resp.json()["snapshots"])


@pytest.mark.asyncio
async def test_camera_preset_crud(async_client: AsyncClient) -> None:
    preset_body = {
        "name": "preset-int",
        "position": {"x": 1.0, "y": 2.0, "z": 3.0},
        "target": {"x": 0.0, "y": 0.0, "z": -1.0},
    }
    create_resp = await async_client.post("/api/camera-presets", json=preset_body)
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["name"] == "preset-int"

    list_resp = await async_client.get("/api/camera-presets")
    assert list_resp.status_code == 200
    names = [item["name"] for item in list_resp.json()]
    assert "preset-int" in names

    delete_resp = await async_client.delete("/api/camera-presets/preset-int")
    assert delete_resp.status_code == 204

    delete_again = await async_client.delete("/api/camera-presets/preset-int")
    assert delete_again.status_code == 404


@pytest.mark.asyncio
async def test_remote_controls_validation_and_success(async_client: AsyncClient) -> None:
    bad_click = await async_client.post("/api/remote-click", json={})
    assert bad_click.status_code == 422 or bad_click.status_code == 400

    good_click = await async_client.post(
        "/api/remote-click",
        json={"selector": ".video", "x": 10, "y": 20},
        params={"target_client_id": "rc-client"},
    )
    assert good_click.status_code == 200
    assert good_click.json()["status"] == "queued"

    bad_video = await async_client.post("/api/video-control", json={"action": "set_volume"})
    assert bad_video.status_code in (400, 422)

    good_video = await async_client.post(
        "/api/video-control",
        json={"action": "play", "client_id": "rc-client"},
    )
    assert good_video.status_code == 200
    assert good_video.json()["status"] == "queued"
