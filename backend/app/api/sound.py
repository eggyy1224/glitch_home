from __future__ import annotations

from fastapi import APIRouter, Query, Request

from ..models.schemas import SoundPlayRequest, SpeakWithSubtitleRequest, TTSRequest
from ..services.realtime_bus import realtime_broadcaster
from ..services.subtitles import subtitle_manager
from .sound_helpers import (
    build_sound_url,
    file_response_for_sound,
    get_sound_file_path,
    list_sound_files,
    maybe_autoplay,
    sanitize_sound_filename,
    synthesize_tts_audio,
)

router = APIRouter()


@router.get("/api/sound-files")
def api_sound_files(
    with_metadata: bool = Query(
        False, description="Include metadata (if available) for each sound file."
    )
) -> dict:
    return {"files": list_sound_files(with_metadata)}


@router.get("/api/sound-files/{filename}", name="api_sound_file")
def api_sound_file(filename: str):
    return file_response_for_sound(filename)


@router.post("/api/sound-play", status_code=202)
async def api_sound_play(body: SoundPlayRequest, request: Request) -> dict:
    path = get_sound_file_path(body.filename)
    url = build_sound_url(request, path.name)
    await realtime_broadcaster.broadcast_sound_play(path.name, url, body.target_client_id)
    return {"status": "queued", "filename": path.name, "url": url}


@router.post("/api/tts", status_code=201)
async def api_tts_generate(body: TTSRequest, request: Request) -> dict:
    result = await synthesize_tts_audio(
        text=body.text,
        instructions=body.instructions,
        voice=body.voice,
        model=body.model,
        output_format=body.output_format,
        filename_base=body.filename_base,
        speed=body.speed,
    )

    safe_name = sanitize_sound_filename(result.get("filename"))
    url = build_sound_url(request, safe_name)
    payload = {
        "tts": result,
        "url": url,
    }

    playback = await maybe_autoplay(safe_name, url, body.auto_play, body.target_client_id)
    if playback:
        payload["playback"] = playback

    return payload


@router.post("/api/speak-with-subtitle", status_code=201)
async def api_speak_with_subtitle(body: SpeakWithSubtitleRequest, request: Request) -> dict:
    """Generate TTS audio and set subtitle simultaneously."""
    tts_result = await synthesize_tts_audio(
        text=body.text,
        instructions=body.instructions,
        voice=body.voice,
        model=body.model,
        output_format=body.output_format,
        filename_base=body.filename_base,
        speed=body.speed,
    )

    safe_name = sanitize_sound_filename(tts_result.get("filename"))
    url = build_sound_url(request, safe_name)

    subtitle_text = body.subtitle_text if body.subtitle_text else body.text
    subtitle_result = None
    subtitle_error = None

    try:
        subtitle_result = await subtitle_manager.set_subtitle(
            subtitle_text,
            language=body.subtitle_language,
            duration_seconds=body.subtitle_duration_seconds,
            target_client_id=body.target_client_id,
        )
        await realtime_broadcaster.broadcast_subtitle(
            subtitle_result, target_client_id=body.target_client_id
        )
    except ValueError as exc:
        subtitle_error = str(exc)
    except Exception as exc:  # noqa: BLE001
        subtitle_error = f"Subtitle error: {str(exc)}"

    payload = {
        "tts": tts_result,
        "url": url,
    }

    if subtitle_result:
        payload["subtitle"] = subtitle_result
    elif subtitle_error:
        payload["subtitle_error"] = subtitle_error

    playback = await maybe_autoplay(safe_name, url, body.auto_play, body.target_client_id)
    if playback:
        payload["playback"] = playback

    return payload
