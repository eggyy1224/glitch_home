from __future__ import annotations

import json
import mimetypes
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from fastapi import HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse

from ..config import settings
from ..services.screenshot_requests import screenshot_requests_manager
from ..services.tts_openai import synthesize_speech_openai

ALLOWED_SOUND_EXTS = {".mp3", ".wav", ".opus", ".ulaw", ".alaw", ".aac", ".flac"}


def _format_iso(ts: float) -> str:
    try:
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    except Exception:
        return datetime.utcfromtimestamp(ts).isoformat() + "Z"


def list_sound_files(with_metadata: bool) -> list[dict]:
    directory = Path(settings.generated_sounds_dir)
    if not directory.exists():
        return []

    metadata_dir = Path(settings.metadata_dir)
    files: list[dict] = []
    for path in sorted(directory.iterdir()):
        if not path.is_file() or path.suffix.lower() not in ALLOWED_SOUND_EXTS:
            continue
        stat = path.stat()
        entry: dict = {
            "filename": path.name,
            "url": f"/api/sound-files/{quote(path.name)}",
            "size": stat.st_size,
            "modified_at": _format_iso(stat.st_mtime),
        }
        if with_metadata:
            meta_candidates = [
                metadata_dir / f"{path.stem}.json",
                metadata_dir / f"{path.name}.json",
            ]
            for meta_path in meta_candidates:
                if not meta_path.exists():
                    continue
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        metadata = json.load(f)
                except Exception:
                    continue
                if metadata.get("output_audio") == path.name:
                    entry["metadata"] = metadata
                    entry["metadata_path"] = str(meta_path)
                    break
        files.append(entry)

    return files


def sanitize_sound_filename(filename: str | None) -> str:
    safe_name = os.path.basename(filename or "")
    if not safe_name:
        raise HTTPException(status_code=400, detail="invalid filename")
    return safe_name


def get_sound_file_path(filename: str | None) -> Path:
    safe_name = sanitize_sound_filename(filename)
    path = Path(settings.generated_sounds_dir) / safe_name
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="sound file not found")
    return path


def build_sound_url(request: Request, filename: str) -> str:
    safe_name = sanitize_sound_filename(filename)
    return str(request.url_for("api_sound_file", filename=safe_name))


async def maybe_autoplay(filename: str, url: str, auto_play: bool, target_client_id: str | None) -> dict | None:
    if not auto_play:
        return None
    safe_name = sanitize_sound_filename(filename)
    await screenshot_requests_manager.broadcast_sound_play(safe_name, url, target_client_id)
    return {"status": "queued", "target_client_id": target_client_id}


async def synthesize_tts_audio(
    *,
    text: str,
    instructions: str | None,
    voice: str | None,
    model: str | None,
    output_format: str | None,
    filename_base: str | None,
    speed: float | None,
) -> dict:
    try:
        return await run_in_threadpool(
            synthesize_speech_openai,
            text=text,
            instructions=instructions,
            voice=voice,
            model=model,
            output_format=output_format,
            filename_base=filename_base,
            speed=speed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def file_response_for_sound(filename: str) -> FileResponse:
    path = get_sound_file_path(filename)
    media_type, _ = mimetypes.guess_type(str(path))
    return FileResponse(path, media_type=media_type or "audio/mpeg", filename=path.name)
