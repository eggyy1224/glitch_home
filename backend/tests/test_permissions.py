import pytest
from fastapi.testclient import TestClient

from app.config import settings


@pytest.mark.api
def test_generation_guard_returns_403(monkeypatch, client: TestClient):
    monkeypatch.setattr(settings, "enable_generation", False)
    monkeypatch.setattr(settings, "app_mode", "DISPLAY")

    response = client.post("/api/generate/mix-two")

    assert response.status_code == 403
    payload = response.json()["detail"]
    assert payload["feature"] == "generation"
    assert payload["app_mode"] == "DISPLAY"
    assert "APP_MODE=DISPLAY" in payload["message"]


@pytest.mark.api
def test_metadata_guard_blocks_write(monkeypatch, client: TestClient):
    monkeypatch.setattr(settings, "enable_metadata_write", False)
    monkeypatch.setattr(settings, "app_mode", "DISPLAY")

    response = client.put("/api/iframe-config", json={"layout": "grid", "columns": 1, "panels": []})

    assert response.status_code == 403
    payload = response.json()["detail"]
    assert payload["feature"] == "metadata_write"
    assert payload["app_mode"] == "DISPLAY"


@pytest.mark.api
def test_asset_guard_blocks_tts(monkeypatch, client: TestClient):
    monkeypatch.setattr(settings, "enable_asset_write", False)
    monkeypatch.setattr(settings, "app_mode", "DISPLAY")
    # 保持分析旗標為真以確保阻擋源自資產寫入
    monkeypatch.setattr(settings, "enable_analysis_llm", True)

    response = client.post("/api/tts", json={"text": "test"})

    assert response.status_code == 403
    payload = response.json()["detail"]
    assert payload["feature"] == "asset_write"
    assert payload["app_mode"] == "DISPLAY"


@pytest.mark.api
def test_index_rebuild_guard(monkeypatch, client: TestClient):
    monkeypatch.setattr(settings, "enable_index_rebuild", False)
    monkeypatch.setattr(settings, "app_mode", "CONSOLE")

    response = client.post("/api/kinship/rebuild")

    assert response.status_code == 403
    payload = response.json()["detail"]
    assert payload["feature"] == "index_rebuild"
    assert payload["app_mode"] == "CONSOLE"
