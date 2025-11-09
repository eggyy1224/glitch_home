"""Pytest configuration and shared fixtures."""

import os
import tempfile
from pathlib import Path
from typing import Generator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import Settings


@pytest.fixture
def client() -> TestClient:
    """FastAPI test client."""
    # TestClient API changed in different versions
    # Try both initialization methods for compatibility
    try:
        return TestClient(app)
    except TypeError:
        # Fallback for older versions that use app= keyword
        return TestClient(app=app)


@pytest.fixture
def temp_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def mock_settings(monkeypatch) -> Settings:
    """Create mock settings for testing."""
    # Create temporary directories
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        
        # Mock environment variables
        monkeypatch.setenv("GEMINI_API_KEY", "test-gemini-key")
        monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
        monkeypatch.setenv("ELEVENLABS_API_KEY", "test-elevenlabs-key")
        monkeypatch.setenv("OFFSPRING_DIR", str(tmp_path / "offspring_images"))
        monkeypatch.setenv("METADATA_DIR", str(tmp_path / "metadata"))
        monkeypatch.setenv("SCREENSHOT_DIR", str(tmp_path / "screen_shots"))
        monkeypatch.setenv("GENERATED_SOUNDS_DIR", str(tmp_path / "generated_sounds"))
        monkeypatch.setenv("CHROMA_DB_PATH", str(tmp_path / "chroma_db"))
        
        # Create directories
        (tmp_path / "offspring_images").mkdir(parents=True)
        (tmp_path / "metadata").mkdir(parents=True)
        (tmp_path / "screen_shots").mkdir(parents=True)
        (tmp_path / "generated_sounds").mkdir(parents=True)
        (tmp_path / "chroma_db").mkdir(parents=True)
        
        # Create new settings instance with mocked env
        settings = Settings()
        yield settings


@pytest.fixture
def sample_image_path(temp_dir: Path) -> Path:
    """Create a sample image file for testing."""
    # Create a minimal valid PNG file (1x1 pixel)
    png_data = (
        b'\x89PNG\r\n\x1a\n'
        b'\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde'
        b'\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\n'
        b'IDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
    )
    image_path = temp_dir / "test_image.png"
    image_path.write_bytes(png_data)
    return image_path
