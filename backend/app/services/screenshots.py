"""Utilities for persisting uploaded scene screenshots."""

from __future__ import annotations

import secrets
import shutil
from datetime import datetime
from pathlib import Path

from fastapi import UploadFile

from ..config import settings


_CONTENT_TYPE_EXTENSION_MAP: dict[str, str] = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
}

_FALLBACK_EXTENSIONS: set[str] = {".png", ".jpg", ".jpeg"}


def _resolve_extension(upload: UploadFile) -> str:
    """Pick a safe file extension for the upload based on content type or filename."""

    if upload.content_type:
        ext = _CONTENT_TYPE_EXTENSION_MAP.get(upload.content_type.lower())
        if ext:
            return ext

    if upload.filename:
        suffix = Path(upload.filename).suffix.lower()
        if suffix in _FALLBACK_EXTENSIONS:
            return ".jpg" if suffix == ".jpeg" else suffix

    raise ValueError("Unsupported screenshot file type")


def save_screenshot(upload: UploadFile) -> dict[str, str]:
    """Persist the uploaded screenshot and return basic metadata."""

    destination_dir = Path(settings.screenshot_dir).expanduser().resolve()
    destination_dir.mkdir(parents=True, exist_ok=True)

    extension = _resolve_extension(upload)
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    token = secrets.token_hex(4)
    filename = f"scene_{timestamp}_{token}{extension}"
    full_path = destination_dir / filename

    upload.file.seek(0)
    with full_path.open("wb") as f:
        shutil.copyfileobj(upload.file, f)

    project_root = destination_dir.parent
    try:
        relative_path = str(full_path.relative_to(project_root))
    except ValueError:
        relative_path = str(full_path)

    return {
        "filename": filename,
        "original_filename": upload.filename,  # 新增：保存原始檔案名稱
        "absolute_path": str(full_path),
        "relative_path": relative_path,
    }
