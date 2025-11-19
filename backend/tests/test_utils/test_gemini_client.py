"""Tests for Gemini client helper."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.utils import gemini_client


def _reset_client() -> None:
    gemini_client._client = None


@pytest.fixture(autouse=True)
def _cleanup_client():
    _reset_client()
    yield
    _reset_client()


def test_gemini_client_prefers_primary_api_key(monkeypatch):
    monkeypatch.setattr(gemini_client.settings, "gemini_api_key", "gemini-key")
    monkeypatch.setattr(gemini_client.settings, "genai_use_vertex", False)

    with patch("app.utils.gemini_client.genai.Client") as mock_client:
        instance = object()
        mock_client.return_value = instance
        client = gemini_client.get_gemini_client()
        assert client is instance
        mock_client.assert_called_once_with(api_key="gemini-key")

        second = gemini_client.get_gemini_client()
        assert second is instance
        mock_client.assert_called_once()  # cached


def test_gemini_client_falls_back_to_google_key(monkeypatch):
    monkeypatch.setattr(gemini_client.settings, "gemini_api_key", None)
    monkeypatch.setattr(gemini_client.settings, "genai_use_vertex", False)
    monkeypatch.setenv("GOOGLE_API_KEY", "google-key")

    with patch("app.utils.gemini_client.genai.Client") as mock_client:
        mock_client.return_value = object()
        gemini_client.get_gemini_client()
        mock_client.assert_called_once_with(api_key="google-key")


def test_gemini_client_vertex_configuration(monkeypatch):
    monkeypatch.setattr(gemini_client.settings, "gemini_api_key", "ignored")
    monkeypatch.setattr(gemini_client.settings, "genai_use_vertex", True)
    monkeypatch.setattr(gemini_client.settings, "vertex_project", "proj")
    monkeypatch.setattr(gemini_client.settings, "vertex_location", "loc")

    with patch("app.utils.gemini_client.genai.Client") as mock_client:
        mock_client.return_value = object()
        gemini_client.get_gemini_client()
        mock_client.assert_called_once_with(vertexai=True, project="proj", location="loc")


def test_gemini_client_vertex_without_project(monkeypatch):
    monkeypatch.setattr(gemini_client.settings, "gemini_api_key", "ignored")
    monkeypatch.setattr(gemini_client.settings, "genai_use_vertex", True)
    monkeypatch.setattr(gemini_client.settings, "vertex_project", None)
    monkeypatch.setattr(gemini_client.settings, "vertex_location", None)

    with patch("app.utils.gemini_client.genai.Client") as mock_client:
        mock_client.return_value = object()
        gemini_client.get_gemini_client()
        mock_client.assert_called_once_with(vertexai=True)
