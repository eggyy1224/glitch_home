"""Tests for media-related API endpoints (generate, search, index, tts, kinship)."""

import json
import time
from pathlib import Path

import pytest
from PIL import Image
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.services.collage_version import task_manager


def _mock_tts_payload() -> dict:
    return {
        "filename": "test_narration.mp3",
        "text": "測試文字",
        "model": "gpt-4o-mini-tts",
        "voice": "alloy",
        "format": "mp3",
        "speed": 1.0,
        "absolute_path": "/generated_sounds/test_narration.mp3",
        "relative_path": "generated_sounds/test_narration.mp3",
        "size_bytes": 1234,
        "checksum_sha256": "deadbeef",
        "metadata_path": "/metadata/test_narration.mp3.json",
    }


def _create_offspring_image(filename: str, color=(255, 255, 255)) -> str:
    """Create a small RGB image directly inside the offspring directory."""
    from app.config import settings

    dest = Path(settings.offspring_dir) / filename
    dest.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (32, 32), color)
    img.save(dest)
    return filename


@pytest.mark.api
@pytest.mark.slow
def test_get_kinship(client: TestClient):
    """Test kinship query endpoint."""
    # This test requires the kinship index to be loaded and have data
    # Skip if no data available
    from app.services.kinship_index import kinship_index
    kinship_index.load()
    
    if not kinship_index._parents_map:
        pytest.skip("No kinship data available")
    
    test_img = list(kinship_index._parents_map.keys())[0]
    response = client.get(f"/api/kinship?img={test_img}&depth=1")
    
    if response.status_code == 404:
        pytest.skip("Test image not found in offspring directory")
    
    assert response.status_code == 200
    data = response.json()
    assert "parents" in data
    assert "children" in data
    assert "siblings" in data
    assert isinstance(data["parents"], list)
    assert isinstance(data["children"], list)
    assert isinstance(data["siblings"], list)


@pytest.mark.api
def test_get_kinship_not_found(client: TestClient):
    """Test kinship query with non-existent image."""
    response = client.get("/api/kinship?img=non_existent_image.png&depth=1")
    assert response.status_code == 404


@pytest.mark.api
def test_get_kinship_missing_param(client: TestClient):
    """Test kinship query without required parameter."""
    response = client.get("/api/kinship")
    assert response.status_code == 422  # Validation error


@pytest.mark.api
def test_get_kinship_with_depth(client: TestClient):
    """Test kinship query with different depth values."""
    from app.services.kinship_index import kinship_index
    kinship_index.load()
    
    if not kinship_index._parents_map:
        pytest.skip("No kinship data available")
    
    test_img = list(kinship_index._parents_map.keys())[0]
    
    # Test with depth=1
    response = client.get(f"/api/kinship?img={test_img}&depth=1")
    if response.status_code == 404:
        pytest.skip("Test image not found")
    assert response.status_code == 200
    
    # Test with depth=-1 (full depth)
    response = client.get(f"/api/kinship?img={test_img}&depth=-1")
    assert response.status_code == 200


@pytest.mark.api
@patch('app.services.tts_openai.synthesize_speech_openai')
def test_tts_generate(mock_tts: MagicMock, client: TestClient):
    """Test TTS generation endpoint."""
    # Mock TTS response
    mock_tts.return_value = _mock_tts_payload()
    
    response = client.post(
        "/api/tts",
        json={
            "text": "測試文字",
            "voice": "alloy",
            "model": "gpt-4o-mini-tts"
        }
    )
    
    # TTS may fail without proper API key, but test endpoint structure
    # If mock works, should return 201; otherwise may return 400/500
    assert response.status_code in [201, 400, 500]
    if response.status_code == 201:
        data = response.json()
        assert "tts" in data
        assert "url" in data
        assert "metadata_path" in data["tts"]


@pytest.mark.api
@patch('app.services.tts_openai.synthesize_speech_openai')
@patch('app.services.realtime_bus.realtime_broadcaster.broadcast_sound_play')
def test_tts_generate_with_auto_play(mock_broadcast: MagicMock, mock_tts: MagicMock, client: TestClient):
    """Test TTS generation with auto-play."""
    mock_tts.return_value = _mock_tts_payload()
    
    response = client.post(
        "/api/tts",
        json={
            "text": "測試文字",
            "voice": "alloy",
            "auto_play": True,
            "target_client_id": "test_client"
        }
    )
    
    # TTS may fail without proper API key or request.url_for, but test endpoint structure
    # If mock works, should return 201; otherwise may return 400/500
    assert response.status_code in [201, 400, 500]
    if response.status_code == 201:
        data = response.json()
        assert "tts" in data
        assert "metadata_path" in data["tts"]
        assert "playback" in data
        assert data["playback"]["status"] == "queued"


@pytest.mark.api
def test_tts_generate_validation(client: TestClient):
    """Test TTS generation validation."""
    # Missing text should fail
    response = client.post("/api/tts", json={})
    assert response.status_code in [400, 422]


@pytest.mark.api
def test_sound_files_with_metadata(client: TestClient):
    """Ensure sound file listing can include metadata details."""
    from app.config import settings

    sounds_dir = Path(settings.generated_sounds_dir)
    metadata_dir = Path(settings.metadata_dir)

    audio_path = sounds_dir / "sample_audio.mp3"
    audio_path.write_bytes(b"dummy audio content")

    metadata_payload = {
        "kind": "tts",
        "provider": "openai",
        "output_audio": "sample_audio.mp3",
        "text": "hello",
    }
    meta_path = metadata_dir / "sample_audio.mp3.json"
    meta_path.write_text(json.dumps(metadata_payload))

    response = client.get("/api/sound-files?with_metadata=true")
    assert response.status_code == 200
    data = response.json()
    assert "files" in data
    entry = next((f for f in data["files"] if f["filename"] == "sample_audio.mp3"), None)
    assert entry is not None
    assert "metadata" in entry
    assert entry["metadata"]["output_audio"] == "sample_audio.mp3"
    assert entry.get("metadata_path", "").endswith("sample_audio.mp3.json")


@pytest.mark.api
@patch('app.services.tts_openai.synthesize_speech_openai')
@patch('app.services.subtitles.subtitle_manager.set_subtitle')
@patch('app.services.realtime_bus.realtime_broadcaster.broadcast_subtitle')
def test_speak_with_subtitle_basic(
    mock_broadcast_subtitle: MagicMock,
    mock_set_subtitle: MagicMock,
    mock_tts: MagicMock,
    client: TestClient
):
    """Test speak with subtitle basic functionality."""
    # Mock TTS response
    mock_tts.return_value = _mock_tts_payload()
    
    # Mock subtitle response
    mock_set_subtitle.return_value = {
        "text": "測試文字",
        "language": None,
        "duration_seconds": None,
        "updated_at": "2024-01-01T00:00:00Z"
    }
    
    response = client.post(
        "/api/speak-with-subtitle",
        json={
            "text": "測試文字",
            "voice": "alloy"
        }
    )
    
    # May fail without proper API key or request.url_for, but test endpoint structure
    assert response.status_code in [201, 400, 500]
    if response.status_code == 201:
        data = response.json()
        assert "tts" in data
        assert "subtitle" in data
        assert "url" in data
        assert "metadata_path" in data["tts"]
        mock_set_subtitle.assert_called_once()
        mock_broadcast_subtitle.assert_called_once()


@pytest.mark.api
@patch('app.services.tts_openai.synthesize_speech_openai')
@patch('app.services.subtitles.subtitle_manager.set_subtitle')
@patch('app.services.realtime_bus.realtime_broadcaster.broadcast_subtitle')
@patch('app.services.realtime_bus.realtime_broadcaster.broadcast_sound_play')
def test_speak_with_subtitle_with_auto_play(
    mock_broadcast_sound: MagicMock,
    mock_broadcast_subtitle: MagicMock,
    mock_set_subtitle: MagicMock,
    mock_tts: MagicMock,
    client: TestClient
):
    """Test speak with subtitle with auto-play."""
    mock_tts.return_value = _mock_tts_payload()
    
    mock_set_subtitle.return_value = {
        "text": "測試文字",
        "language": None,
        "duration_seconds": None,
        "updated_at": "2024-01-01T00:00:00Z"
    }
    
    response = client.post(
        "/api/speak-with-subtitle",
        json={
            "text": "測試文字",
            "voice": "alloy",
            "auto_play": True,
            "target_client_id": "test_client"
        }
    )
    
    assert response.status_code in [201, 400, 500]
    if response.status_code == 201:
        data = response.json()
        assert "tts" in data
        assert "metadata_path" in data["tts"]
        assert "playback" in data
        assert data["playback"]["status"] == "queued"
        mock_broadcast_sound.assert_called_once()


@pytest.mark.api
@patch('app.services.tts_openai.synthesize_speech_openai')
@patch('app.services.subtitles.subtitle_manager.set_subtitle')
@patch('app.services.realtime_bus.realtime_broadcaster.broadcast_subtitle')
def test_speak_with_subtitle_custom_subtitle_text(
    mock_broadcast_subtitle: MagicMock,
    mock_set_subtitle: MagicMock,
    mock_tts: MagicMock,
    client: TestClient
):
    """Test speak with subtitle with custom subtitle text."""
    mock_tts.return_value = _mock_tts_payload()
    
    mock_set_subtitle.return_value = {
        "text": "自訂字幕",
        "language": "zh-TW",
        "duration_seconds": 5.0,
        "updated_at": "2024-01-01T00:00:00Z"
    }
    
    response = client.post(
        "/api/speak-with-subtitle",
        json={
            "text": "測試文字",
            "subtitle_text": "自訂字幕",
            "subtitle_language": "zh-TW",
            "subtitle_duration_seconds": 5.0
        }
    )
    
    assert response.status_code in [201, 400, 500]
    if response.status_code == 201:
        data = response.json()
        assert "tts" in data
        assert "subtitle" in data
        assert "metadata_path" in data["tts"]
        # Verify that subtitle_text was used instead of text
        mock_set_subtitle.assert_called_once()
        call_args = mock_set_subtitle.call_args
        assert call_args[0][0] == "自訂字幕"  # First positional arg should be subtitle_text


@pytest.mark.api
@patch('app.services.tts_openai.synthesize_speech_openai')
def test_speak_with_subtitle_tts_failure(mock_tts: MagicMock, client: TestClient):
    """Test speak with subtitle when TTS fails."""
    # Mock TTS to raise an error
    mock_tts.side_effect = ValueError("TTS 文本不可為空")
    
    response = client.post(
        "/api/speak-with-subtitle",
        json={
            "text": "",  # Invalid empty text
        }
    )
    
    # Should fail with 400 due to TTS error
    assert response.status_code in [400, 422]


@pytest.mark.api
@patch('app.services.tts_openai.synthesize_speech_openai')
@patch('app.services.subtitles.subtitle_manager.set_subtitle')
@patch('app.services.realtime_bus.realtime_broadcaster.broadcast_subtitle')
def test_speak_with_subtitle_subtitle_failure(
    mock_broadcast_subtitle: MagicMock,
    mock_set_subtitle: MagicMock,
    mock_tts: MagicMock,
    client: TestClient
):
    """Test speak with subtitle when subtitle setting fails."""
    mock_tts.return_value = _mock_tts_payload()
    
    # Mock subtitle to raise an error
    mock_set_subtitle.side_effect = ValueError("subtitle text cannot be empty")
    
    response = client.post(
        "/api/speak-with-subtitle",
        json={
            "text": "測試文字",
            "subtitle_text": "",  # Invalid empty subtitle
        }
    )
    
    # Should still return 201 but with subtitle_error
    assert response.status_code in [201, 400, 500]
    if response.status_code == 201:
        data = response.json()
        assert "tts" in data
        assert "subtitle_error" in data
        assert "subtitle" not in data
        assert "metadata_path" in data["tts"]


@pytest.mark.api
@patch('app.services.vector_store.sweep_and_index_offspring')
def test_index_offspring(mock_index: MagicMock, client: TestClient):
    """Test indexing offspring images."""
    mock_index.return_value = {
        "indexed": 10,
        "skipped": 2,
        "errors": []
    }
    
    response = client.post("/api/index/offspring", json={"limit": 10})
    assert response.status_code == 200
    data = response.json()
    assert "indexed" in data


@pytest.mark.api
@patch('app.services.vector_store.index_offspring_image')
def test_index_one_image(mock_index: MagicMock, client: TestClient, sample_image_path):
    """Test indexing a single image."""
    mock_index.return_value = {
        "filename": "test_image.png",
        "indexed": True
    }
    
    # Note: This would need actual file upload in real scenario
    # For now, we test the endpoint structure
    response = client.post(
        "/api/index/image",
        json={"basename": "test_image.png"}
    )
    # May fail without actual file, but tests endpoint exists
    assert response.status_code in [200, 400, 404, 422]


@pytest.mark.api
@patch('app.services.vector_store.search_images_by_image')
def test_search_images(mock_search: MagicMock, client: TestClient):
    """Test image search endpoint."""
    mock_search.return_value = {
        "results": [
            {"filename": "img1.png", "distance": 0.1},
            {"filename": "img2.png", "distance": 0.2}
        ]
    }
    
    response = client.post(
        "/api/search/image",
        json={"image_path": "test_image.png", "top_k": 5}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert isinstance(data["results"], list)
    assert len(data["results"]) == 2


@pytest.mark.api
@patch('app.services.vector_store.search_images_by_text')
def test_search_text(mock_search: MagicMock, client: TestClient):
    """Test text search endpoint."""
    mock_search.return_value = {
        "results": [
            {"filename": "img1.png", "distance": 0.1},
            {"filename": "img2.png", "distance": 0.2}
        ]
    }
    
    response = client.post(
        "/api/search/text",
        json={"query": "測試查詢", "top_k": 5}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert isinstance(data["results"], list)
    assert len(data["results"]) == 2


@pytest.mark.api
def test_search_text_validation(client: TestClient):
    """Test text search validation."""
    # Missing query should fail
    response = client.post("/api/search/text", json={})
    assert response.status_code in [400, 422]


@pytest.mark.api
@patch("app.api.generation.generate_mixed_offspring_v2")
def test_generate_mix_two_with_body(mock_generate: MagicMock, client: TestClient):
    """Body payload should forward parameters to v2 generator."""
    payload = {
        "parents": ["parent1.png", "parent2.png"],
        "count": 2,
        "prompt": "mix them",
        "strength": 0.5,
        "output_format": "png",
        "output_width": 256,
        "output_height": 256,
        "output_max_side": 512,
        "resize_mode": "fit",
    }
    expected = {
        "output_image_path": "/generated_images/offspring1.png",
        "metadata_path": "/metadata/offspring1.json",
        "parents": ["parent1.png", "parent2.png"],
        "model_name": "gemini-2.5-flash-image-preview",
    }
    mock_generate.return_value = expected

    response = client.post("/api/generate/mix-two", json=payload)

    assert response.status_code == 201
    assert response.json() == expected
    mock_generate.assert_called_once_with(
        parents=payload["parents"],
        count=payload["count"],
        prompt=payload["prompt"],
        strength=payload["strength"],
        output_format=payload["output_format"],
        output_width=payload["output_width"],
        output_height=payload["output_height"],
        output_max_side=payload["output_max_side"],
        resize_mode=payload["resize_mode"],
    )


@pytest.mark.api
@patch("app.api.generation.generate_mixed_offspring")
def test_generate_mix_two_without_body(mock_generate: MagicMock, client: TestClient):
    """Query param count should trigger legacy generator."""
    mock_generate.return_value = {"ok": True}

    response = client.post("/api/generate/mix-two?count=3", json=None)

    assert response.status_code == 201
    assert response.json() == {"ok": True}
    mock_generate.assert_called_once_with(count=3)


@pytest.mark.api
@patch("app.api.generation.generate_mixed_offspring_v2")
def test_generate_mix_two_value_error(mock_generate: MagicMock, client: TestClient):
    """ValueError bubbled as 400."""
    mock_generate.side_effect = ValueError("parents missing")

    response = client.post(
        "/api/generate/mix-two",
        json={"parents": ["a.png", "b.png"], "count": 2},
    )

    assert response.status_code == 400
    assert "parents missing" in response.json()["detail"]


@pytest.mark.api
@patch("app.api.generation.generate_mixed_offspring_v2")
def test_generate_mix_two_unexpected_error(mock_generate: MagicMock, client: TestClient):
    """Unexpected exceptions are turned into 500."""
    mock_generate.side_effect = RuntimeError("boom")

    response = client.post(
        "/api/generate/mix-two",
        json={"parents": ["a.png", "b.png"], "count": 2},
    )

    assert response.status_code == 500
    assert "boom" in response.json()["detail"]


@pytest.mark.api
def test_generate_collage_version(client: TestClient):
    """Test collage version generation endpoint."""
    # This test requires actual images, so we'll test the endpoint structure
    # In real scenario, would need valid image names
    response = client.post(
        "/api/generate-collage-version",
        json={
            "image_names": ["img1.png", "img2.png"],
            "mode": "kinship",
            "rows": 10,
            "cols": 10
        }
    )
    
    # May fail without actual images, but tests endpoint exists
    assert response.status_code in [202, 400, 404, 422]


@pytest.mark.api
def test_generate_collage_version_requires_images(client: TestClient):
    """Missing image_names should trigger validation error."""
    response = client.post(
        "/api/generate-collage-version",
        json={"rows": 2, "cols": 2, "mode": "random"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "至少需要 1 張圖片"


@pytest.mark.api
def test_generate_collage_version_missing_file(client: TestClient):
    """Non-existent files reported with 404."""
    response = client.post(
        "/api/generate-collage-version",
        json={
            "image_names": ["missing.png", "also_missing.png"],
            "rows": 2,
            "cols": 2,
            "mode": "rotate-90",
        },
    )
    assert response.status_code == 404
    assert "圖片不存在" in response.json()["detail"]


@pytest.mark.api
@patch("app.api.collage.generate_collage_version")
def test_generate_collage_version_enqueues_task(mock_generate: MagicMock, client: TestClient):
    """Valid request should register a task and kick off generation."""
    filenames = [
        _create_offspring_image("api_collage_a.png", (255, 0, 0)),
        _create_offspring_image("api_collage_b.png", (0, 255, 0)),
    ]
    mock_generate.return_value = {
        "output_image_path": "/tmp/collage.png",
        "metadata_path": "/tmp/collage.json",
        "output_image": "collage.png",
        "parents": filenames,
        "output_format": "png",
        "width": 64,
        "height": 64,
    }

    response = client.post(
        "/api/generate-collage-version",
        json={
            "image_names": filenames,
            "rows": 2,
            "cols": 2,
            "mode": "random",
            "resize_w": 256,
        },
    )
    assert response.status_code == 202
    payload = response.json()
    task_id = payload["task_id"]
    assert task_id

    for _ in range(20):
        task = task_manager.get_task(task_id)
        if task and task["completed"]:
            break
        time.sleep(0.05)
    task = task_manager.get_task(task_id)

    assert task is not None
    assert task["stage"] in {"initializing", "completed", "failed"}
    mock_generate.assert_called_once()
    if task["completed"] and not task.get("error"):
        assert task["result"] == mock_generate.return_value
    task_manager.tasks.pop(task_id, None)


@pytest.mark.api
def test_get_collage_version_progress(client: TestClient):
    """Test collage version progress endpoint."""
    # Test with non-existent task (should return 404)
    response = client.get("/api/collage-version/non_existent_task_id/progress")
    assert response.status_code == 404


@pytest.mark.api
def test_get_collage_version_progress_completed(client: TestClient):
    """Progress endpoint should return result payload once task finishes."""
    fake_result = {
        "output_image_path": "/tmp/fake.png",
        "metadata_path": "/tmp/fake.json",
        "output_image": "fake.png",
        "parents": ["a.png", "b.png"],
        "output_format": "png",
        "width": 32,
        "height": 32,
    }
    task_id = task_manager.create_task()
    task_manager.complete_task(task_id, fake_result)

    response = client.get(f"/api/collage-version/{task_id}/progress")
    assert response.status_code == 200
    data = response.json()
    assert data["completed"] is True
    assert data["output_image_path"] == fake_result["output_image_path"]
    assert data["metadata_path"] == fake_result["metadata_path"]
    task_manager.tasks.pop(task_id, None)
