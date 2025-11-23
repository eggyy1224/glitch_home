from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.screenshot_queue import screenshot_request_queue


pytestmark = pytest.mark.integration


@pytest.fixture
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
