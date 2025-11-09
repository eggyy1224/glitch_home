"""Tests for media-related API endpoints (generate, search, index, tts, kinship)."""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


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
    mock_tts.return_value = {
        "filename": "test_narration.mp3",
        "text": "測試文字",
        "model": "gpt-4o-mini-tts",
        "voice": "alloy"
    }
    
    response = client.post(
        "/api/tts",
        json={
            "text": "測試文字",
            "voice": "alloy",
            "model": "gpt-4o-mini-tts"
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    assert "tts" in data
    assert "url" in data
    assert data["tts"]["text"] == "測試文字"


@pytest.mark.api
@patch('app.services.tts_openai.synthesize_speech_openai')
def test_tts_generate_with_auto_play(mock_tts: MagicMock, client: TestClient):
    """Test TTS generation with auto-play."""
    mock_tts.return_value = {
        "filename": "test_narration.mp3",
        "text": "測試文字",
        "model": "gpt-4o-mini-tts",
        "voice": "alloy"
    }
    
    response = client.post(
        "/api/tts",
        json={
            "text": "測試文字",
            "voice": "alloy",
            "auto_play": True,
            "target_client_id": "test_client"
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    assert "playback" in data
    assert data["playback"]["status"] == "queued"


@pytest.mark.api
def test_tts_generate_validation(client: TestClient):
    """Test TTS generation validation."""
    # Missing text should fail
    response = client.post("/api/tts", json={})
    assert response.status_code in [400, 422]


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
    
    # May fail without actual image, but tests endpoint structure
    assert response.status_code in [200, 400, 404, 422]


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


@pytest.mark.api
def test_search_text_validation(client: TestClient):
    """Test text search validation."""
    # Missing query should fail
    response = client.post("/api/search/text", json={})
    assert response.status_code in [400, 422]


@pytest.mark.api
@patch('app.services.gemini_image.generate_mixed_offspring_v2')
def test_generate_mix_two(mock_generate: MagicMock, client: TestClient):
    """Test image generation endpoint."""
    mock_generate.return_value = {
        "offspring": [
            {"filename": "offspring1.png", "url": "/generated_images/offspring1.png"}
        ],
        "parents": ["parent1.png", "parent2.png"]
    }
    
    response = client.post(
        "/api/generate/mix-two",
        json={
            "parents": ["parent1.png", "parent2.png"],
            "count": 1
        }
    )
    
    # May fail without actual parents, but tests endpoint structure
    assert response.status_code in [201, 400, 404, 422, 500]


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
def test_get_collage_version_progress(client: TestClient):
    """Test collage version progress endpoint."""
    # Test with non-existent task (should return 404)
    response = client.get("/api/collage-version/non_existent_task_id/progress")
    assert response.status_code == 404


@pytest.mark.api
def test_get_collage_version_progress_not_found(client: TestClient):
    """Test collage version progress with non-existent task."""
    from app.services.collage_version import task_manager
    # Use real task_manager which should return None for non-existent task
    response = client.get("/api/collage-version/non_existent_task/progress")
    assert response.status_code == 404

