"""Tests for realtime API endpoints (clients, subtitles, captions)."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.mark.api
def test_get_health(client: TestClient):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.api
def test_list_clients(client: TestClient):
    """Test listing clients endpoint."""
    response = client.get("/api/clients")
    assert response.status_code == 200
    data = response.json()
    assert "clients" in data
    assert isinstance(data["clients"], list)


@pytest.mark.api
def test_set_caption_basic(client: TestClient):
    """Test basic caption setting."""
    response = client.post(
        "/api/captions",
        json={
            "text": "圖像系譜學",
            "language": "zh-TW",
            "duration_seconds": 10
        }
    )
    assert response.status_code == 202
    data = response.json()
    assert "caption" in data
    assert data["caption"]["text"] == "圖像系譜學"
    assert data["caption"]["language"] == "zh-TW"


@pytest.mark.api
def test_set_caption_minimal(client: TestClient):
    """Test setting caption with minimal parameters."""
    response = client.post(
        "/api/captions",
        json={"text": "測試"}
    )
    assert response.status_code == 202
    data = response.json()
    assert "caption" in data
    assert data["caption"]["text"] == "測試"


@pytest.mark.api
def test_get_caption(client: TestClient):
    """Test getting caption."""
    # First set a caption
    client.post(
        "/api/captions",
        json={"text": "測試文字", "language": "zh-TW"}
    )
    
    # Then get it
    response = client.get("/api/captions")
    assert response.status_code == 200
    data = response.json()
    assert "caption" in data
    assert data["caption"]["text"] == "測試文字"


@pytest.mark.api
def test_get_caption_with_client_id(client: TestClient):
    """Test getting caption for specific client."""
    # Set caption for specific client
    client.post(
        "/api/captions?target_client_id=test_client",
        json={"text": "客戶端專屬", "language": "zh-TW"}
    )
    
    # Get caption for that client
    response = client.get("/api/captions?client=test_client")
    assert response.status_code == 200
    data = response.json()
    assert "caption" in data
    assert data["caption"]["text"] == "客戶端專屬"


@pytest.mark.api
def test_set_caption_with_client_id(client: TestClient):
    """Test setting caption for specific client."""
    response = client.post(
        "/api/captions?target_client_id=display_1",
        json={
            "text": "左屏幕",
            "language": "zh-TW",
            "duration_seconds": 5
        }
    )
    assert response.status_code == 202
    data = response.json()
    assert data["caption"]["text"] == "左屏幕"


@pytest.mark.api
def test_clear_caption(client: TestClient):
    """Test clearing caption."""
    # First set a caption
    client.post(
        "/api/captions",
        json={"text": "即將清除", "language": "zh-TW"}
    )
    
    # Verify it exists
    response = client.get("/api/captions")
    assert response.status_code == 200
    assert response.json()["caption"]["text"] == "即將清除"
    
    # Clear it
    response = client.delete("/api/captions")
    assert response.status_code == 204
    
    # Verify it's cleared (should return None or empty)
    response = client.get("/api/captions")
    assert response.status_code == 200
    caption = response.json().get("caption")
    assert caption is None or caption.get("text") is None


@pytest.mark.api
def test_clear_caption_with_client_id(client: TestClient):
    """Test clearing caption for specific client."""
    # Set caption for specific client
    client.post(
        "/api/captions?target_client_id=test_client",
        json={"text": "測試", "language": "zh-TW"}
    )
    
    # Clear it
    response = client.delete("/api/captions?target_client_id=test_client")
    assert response.status_code == 204


@pytest.mark.api
def test_set_caption_validation(client: TestClient):
    """Test caption validation."""
    # Missing text should fail
    response = client.post("/api/captions", json={})
    # Should return 422 (validation error) or 400
    assert response.status_code in [400, 422]


@pytest.mark.api
def test_multiple_captions_sequence(client: TestClient):
    """Test setting multiple captions in sequence."""
    captions = [
        "圖像系譜學",
        "邁向視覺探索",
        "連接過去與現在",
        "藝術與技術的融合"
    ]
    
    for caption_text in captions:
        response = client.post(
            "/api/captions",
            json={
                "text": caption_text,
                "language": "zh-TW",
                "duration_seconds": 5
            }
        )
        assert response.status_code == 202
        data = response.json()
        assert data["caption"]["text"] == caption_text


@pytest.mark.api
@patch("app.services.realtime_bus.realtime_broadcaster.broadcast_remote_click", new_callable=AsyncMock)
def test_remote_click_selector_payload(mock_broadcast: AsyncMock, client: TestClient) -> None:
    """Remote click endpoint should forward cleaned selector payload to broadcaster."""
    response = client.post(
        "/api/remote-click",
        json={"selector": ".video-mode-container"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "queued"

    mock_broadcast.assert_awaited_once()
    await_args = mock_broadcast.await_args
    assert await_args.args[0] == {"selector": ".video-mode-container"}
    assert await_args.kwargs["target_client_id"] is None


@pytest.mark.api
@patch("app.services.realtime_bus.realtime_broadcaster.broadcast_remote_click", new_callable=AsyncMock)
def test_remote_click_target_priority(mock_broadcast: AsyncMock, client: TestClient) -> None:
    """Query target_client_id should override body client_id alias resolution."""
    response = client.post(
        "/api/remote-click?target_client_id=display-wall",
        json={
            "selector": ".video-mode",
            "target": "video",
            "client_id": "sidecar",
        },
    )
    assert response.status_code == 200
    payload = mock_broadcast.await_args.args[0]
    assert payload == {"selector": ".video-mode", "target": "video"}
    assert mock_broadcast.await_args.kwargs["target_client_id"] == "display-wall"


@pytest.mark.api
def test_remote_click_validation_requires_target(client: TestClient) -> None:
    """Remote click request must include selector, target, or full coordinates."""
    response = client.post(
        "/api/remote-click",
        json={"selector": "   ", "x": 100},
    )
    # Missing usable selector/target and incomplete coordinates => validation error
    assert response.status_code == 422


@pytest.mark.api
@patch("app.services.realtime_bus.realtime_broadcaster.broadcast_unlock_audio", new_callable=AsyncMock)
def test_unlock_audio_endpoint(mock_broadcast: AsyncMock, client: TestClient) -> None:
    """POST /api/unlock-audio should enqueue unlock broadcast for provided client."""
    response = client.post("/api/unlock-audio?target_client_id=display-main")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"

    mock_broadcast.assert_awaited_once()
    assert mock_broadcast.await_args.kwargs["target_client_id"] == "display-main"
