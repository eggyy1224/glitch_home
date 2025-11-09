"""Pytest configuration and shared fixtures."""

import os
import tempfile
from pathlib import Path
from typing import Generator

# CRITICAL: Set environment variables BEFORE any imports that use settings
# This ensures all modules use the mocked settings
_temp_test_dir = tempfile.mkdtemp()
_temp_path = Path(_temp_test_dir)

os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")
os.environ.setdefault("ELEVENLABS_API_KEY", "test-elevenlabs-key")
os.environ.setdefault("OFFSPRING_DIR", str(_temp_path / "offspring_images"))
os.environ.setdefault("METADATA_DIR", str(_temp_path / "metadata"))
os.environ.setdefault("SCREENSHOT_DIR", str(_temp_path / "screen_shots"))
os.environ.setdefault("GENERATED_SOUNDS_DIR", str(_temp_path / "generated_sounds"))
os.environ.setdefault("CHROMA_DB_PATH", str(_temp_path / "chroma_db"))

# Create directories
(_temp_path / "offspring_images").mkdir(parents=True)
(_temp_path / "metadata").mkdir(parents=True)
(_temp_path / "screen_shots").mkdir(parents=True)
(_temp_path / "generated_sounds").mkdir(parents=True)
(_temp_path / "chroma_db").mkdir(parents=True)

# Now import app after settings are mocked
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
def mock_settings() -> Settings:
    """Create mock settings for testing (for direct Settings access)."""
    # Settings are already mocked at module level, but this provides
    # a fixture for tests that need direct Settings access
    return Settings()


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
