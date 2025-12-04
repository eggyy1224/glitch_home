from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from PIL import Image
from pathlib import Path
from unittest.mock import AsyncMock

from app.config import settings
from app.main import app


pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def async_client():
    await app.router.startup()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    await app.router.shutdown()


@pytest.fixture
def parent_images(tmp_path: Path) -> list[Path]:
    parents: list[Path] = []
    for idx in range(2):
        path = tmp_path / f"parent_{idx}.png"
        image = Image.new("RGB", (2, 2), color=(idx * 40, 20, 200))
        image.save(path, format="PNG")
        parents.append(path)
    return parents


@pytest.mark.asyncio
async def test_generate_to_timeline_playback(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    parent_images: list[Path],
) -> None:
    parent_paths = [str(path) for path in parent_images]

    def fake_call_gemini(self, prompt, images, input_details):  # noqa: ANN001
        return Image.new("RGB", (1, 1), color=(255, 0, 0))

    monkeypatch.setattr(
        "app.services.gemini_image.GeminiImageGenerator._call_gemini",
        fake_call_gemini,
    )
    monkeypatch.setattr(
        "app.services.genes_pool.FilesystemParentSelector.select",
        lambda self, parents=None, count=None: parent_paths,  # noqa: ARG005
    )

    generate_resp = await async_client.post(
        "/api/generate/mix-two",
        json={"parents": ["parent_a.png", "parent_b.png"], "prompt": "integration"},
    )
    assert generate_resp.status_code == 201
    generate_payload = generate_resp.json()
    output_path = Path(generate_payload["output_image_path"])
    metadata_path = Path(generate_payload["metadata_path"])

    assert output_path.is_file()
    assert metadata_path.is_file()
    assert output_path.parent.resolve() == Path(settings.offspring_dir).resolve()
    assert metadata_path.parent.resolve() == Path(settings.metadata_dir).resolve()

    list_resp = await async_client.get("/api/offspring-images")
    assert list_resp.status_code == 200
    images = list_resp.json()["images"]
    assert any(item["filename"] == output_path.name for item in images)

    client_id = "integration-client"
    snapshot_name = "generated-shot"
    config_payload = {
        "target_client_id": client_id,
        "layout": "grid",
        "gap": 4,
        "columns": 1,
        "panels": [
            {
                "id": "panel-generated",
                "image": output_path.name,
                "ratio": 1.0,
            }
        ],
    }
    config_resp = await async_client.put("/api/iframe-config", json=config_payload)
    assert config_resp.status_code == 200

    snapshot_resp = await async_client.post(
        "/api/iframe-config/snapshot",
        json={"client_id": client_id, "snapshot_name": snapshot_name},
    )
    assert snapshot_resp.status_code == 201
    snapshot_created = snapshot_resp.json()["snapshot"]["name"]

    timeline_payload = {
        "id": "generate-playback",
        "title": "Generate to playback",
        "clientId": client_id,
        "loop": False,
        "steps": [
            {
                "snapshot": snapshot_created,
                "duration": 2.5,
                "label": "show generated",
            }
        ],
    }
    timeline_resp = await async_client.post("/api/iframe-timelines", json=timeline_payload)
    assert timeline_resp.status_code == 201
    timeline_data = timeline_resp.json()["timeline"]
    timeline_raw = await async_client.get(
        f"/api/iframe-timelines/{timeline_data['id']}", params={"resolve": False}
    )
    assert timeline_raw.status_code == 200
    timeline_version = timeline_raw.json()["timeline"]["version"]

    broadcast_mock = AsyncMock()
    monkeypatch.setattr(
        "app.services.realtime_bus.realtime_broadcaster.broadcast_timeline_control",
        broadcast_mock,
    )

    play_resp = await async_client.post(
        f"/api/iframe-timelines/{timeline_data['id']}/play",
        json={
            "target_client_id": client_id,
            "loop_override": True,
            "start_step": 0,
        },
    )
    assert play_resp.status_code == 200
    play_payload = play_resp.json()
    assert play_payload["status"] == "queued"
    assert play_payload["timeline_id"] == timeline_data["id"]
    assert play_payload["target_client_id"] == client_id
    options = play_payload["options"]
    assert options.get("loop") is True
    assert options.get("startStep") == 0
    assert options.get("version") == timeline_version

    broadcast_mock.assert_awaited_once_with(
        action="play",
        timeline_id=timeline_data["id"],
        target_client_id=client_id,
        options=options,
    )
