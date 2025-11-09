"""Tests for realtime API endpoints (subtitles, WebSocket)."""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.api
def test_get_subtitles(client: TestClient):
    """Test getting subtitles."""
    response = client.get("/api/subtitles")
    assert response.status_code == 200
    data = response.json()
    assert "subtitle" in data


@pytest.mark.api
def test_get_subtitles_with_client(client: TestClient):
    """Test getting subtitles for specific client."""
    response = client.get("/api/subtitles?client=test_client")
    assert response.status_code == 200
    data = response.json()
    assert "subtitle" in data


@pytest.mark.api
def test_set_subtitles(client: TestClient):
    """Test setting subtitles."""
    response = client.post(
        "/api/subtitles",
        json={
            "text": "測試字幕",
            "language": "zh-TW",
            "duration_seconds": 10
        }
    )
    assert response.status_code == 202
    data = response.json()
    assert "subtitle" in data
    assert data["subtitle"]["text"] == "測試字幕"


@pytest.mark.api
def test_set_subtitles_with_client_id(client: TestClient):
    """Test setting subtitles for specific client."""
    response = client.post(
        "/api/subtitles?target_client_id=test_client",
        json={
            "text": "客戶端專屬字幕",
            "language": "zh-TW"
        }
    )
    assert response.status_code == 202
    data = response.json()
    assert data["subtitle"]["text"] == "客戶端專屬字幕"


@pytest.mark.api
def test_clear_subtitles(client: TestClient):
    """Test clearing subtitles."""
    # First set a subtitle
    client.post(
        "/api/subtitles",
        json={"text": "即將清除", "language": "zh-TW"}
    )
    
    # Then clear it
    response = client.delete("/api/subtitles")
    assert response.status_code == 204


@pytest.mark.api
def test_clear_subtitles_with_client_id(client: TestClient):
    """Test clearing subtitles for specific client."""
    # Set subtitle for specific client
    client.post(
        "/api/subtitles?target_client_id=test_client",
        json={"text": "測試", "language": "zh-TW"}
    )
    
    # Clear it
    response = client.delete("/api/subtitles?target_client_id=test_client")
    assert response.status_code == 204


@pytest.mark.api
def test_set_subtitles_validation(client: TestClient):
    """Test subtitle validation."""
    # Missing text should fail
    response = client.post("/api/subtitles", json={})
    assert response.status_code in [400, 422]


# Note: WebSocket tests require a different approach
# For now, we'll skip WebSocket testing as it requires async test client
# or a separate WebSocket test framework
@pytest.mark.skip(reason="WebSocket tests require async test client")
def test_websocket_connection():
    """Test WebSocket connection."""
    # This would require using websockets library or async test client
    pass

