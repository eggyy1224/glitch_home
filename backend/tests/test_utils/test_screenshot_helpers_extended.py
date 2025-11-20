"""Extended coverage for screenshot helper utilities."""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.api.screenshot_helpers import (
    build_auto_sound_prompt,
    resolve_image_and_snapshot,
    resolve_screenshot_path,
)
from app.config import settings
from app.services.screenshot_queue import screenshot_request_queue


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def test_resolve_screenshot_path_prefers_settings_dir(monkeypatch, tmp_path):
    base = tmp_path / "shots"
    base.mkdir(parents=True, exist_ok=True)
    target = base / "view.png"
    target.write_text("x")
    monkeypatch.setattr(settings, "screenshot_dir", str(base))

    resolved = resolve_screenshot_path("view.png")

    assert resolved == target.resolve()
    # Absolute path should still resolve
    assert resolve_screenshot_path(str(target)) == target.resolve()


def test_resolve_screenshot_path_missing_returns_none(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "screenshot_dir", str(tmp_path / "missing-root"))
    assert resolve_screenshot_path("does_not_exist.png") is None
    assert resolve_screenshot_path(None) is None


@pytest.mark.asyncio
async def test_resolve_image_and_snapshot_requires_source():
    with pytest.raises(HTTPException) as exc:
        await resolve_image_and_snapshot(None, None)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_resolve_image_and_snapshot_pending_request_without_result():
    record = await screenshot_request_queue.create_request()
    with pytest.raises(HTTPException) as exc:
        await resolve_image_and_snapshot(None, record["id"])
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_resolve_image_and_snapshot_missing_file(tmp_path):
    missing = tmp_path / "ghost.png"
    record = await screenshot_request_queue.create_request()
    await screenshot_request_queue.mark_completed(record["id"], {"absolute_path": str(missing)})

    with pytest.raises(HTTPException) as exc:
        await resolve_image_and_snapshot(None, record["id"])
    assert exc.value.status_code == 404


def test_build_auto_sound_prompt_requires_text():
    with pytest.raises(HTTPException) as exc:
        build_auto_sound_prompt({}, 5.0)
    assert exc.value.status_code == 500


def test_build_auto_sound_prompt_trims_long_text():
    long_summary = "a" * 600
    prompt = build_auto_sound_prompt({"summary": long_summary, "segments": []}, 12.5)
    assert len(prompt) <= 440
    assert prompt.endswith("...")
