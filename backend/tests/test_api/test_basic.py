"""Tests for basic API endpoints (health, clients)."""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.api
def test_health_endpoint(client: TestClient):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.api
def test_list_clients_endpoint(client: TestClient):
    """Test listing clients endpoint."""
    response = client.get("/api/clients")
    assert response.status_code == 200
    data = response.json()
    assert "clients" in data
    assert isinstance(data["clients"], list)
    
    # Each client should have expected fields
    for client_info in data["clients"]:
        assert "client_id" in client_info
        assert "connections" in client_info
        assert isinstance(client_info["connections"], int)

