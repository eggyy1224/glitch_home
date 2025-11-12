"""Sound effect generation via ElevenLabs Text-to-Sound Effects API."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

from ..config import settings
from ..utils.fs import ensure_dirs
from ..utils.metadata import compute_sha256, write_metadata, utc_now_iso_z


DEFAULT_OUTPUT_FORMAT = "mp3_44100_128"
DEFAULT_MODEL_ID = "eleven_text_to_sound_v2"
ELEVEN_BASE_URL = os.getenv("ELEVENLABS_BASE_URL", "https://api.elevenlabs.io")


def _resolve_audio_extension(output_format: str) -> str:
    codec = (output_format or DEFAULT_OUTPUT_FORMAT).split("_", 1)[0].lower()
    return {
        "mp3": ".mp3",
        "pcm": ".wav",
        "opus": ".opus",
        "ulaw": ".ulaw",
        "alaw": ".alaw",
    }.get(codec, ".mp3")


def _deduplicate_filename(base_name: str, ext: str, directory: Path) -> Path:
    # 僅允許純檔名，避免任何子目錄成分
    safe_base = Path(base_name).name
    resolved_dir = directory.resolve()

    candidate = resolved_dir / f"{safe_base}{ext}"
    if not candidate.exists():
        resolved = candidate.resolve()
        if resolved.parent != resolved_dir:
            raise ValueError("非法輸出路徑：越界目錄")
        return candidate
    suffix = 2
    while True:
        candidate = resolved_dir / f"{safe_base}_{suffix}{ext}"
        if not candidate.exists():
            resolved = candidate.resolve()
            if resolved.parent != resolved_dir:
                raise ValueError("非法輸出路徑：越界目錄")
            return candidate
        suffix += 1


def _resolve_base_name(image_path: str | Path, fallback: Optional[str] = None) -> str:
    try:
        name = Path(image_path).stem
        if name:
            return name
    except Exception:
        pass
    if fallback:
        return fallback
    raise ValueError("無法從截圖檔名推導音效名稱，請提供有效的 image_path 或 fallback 名稱")


def generate_sound_effect(
    *,
    prompt: str,
    image_path: str | Path,
    request_id: Optional[str] = None,
    duration_seconds: Optional[float] = None,
    prompt_influence: Optional[float] = None,
    loop: bool = False,
    model_id: Optional[str] = None,
    output_format: Optional[str] = None,
    timeout: float = 120.0,
) -> Dict[str, Any]:
    """Generate a sound effect using ElevenLabs given a textual description.

    Args:
        prompt: Textual description of the desired sound.
        image_path: Screenshot path used to derive the output filename.
        request_id: Optional screenshot request identifier for bookkeeping.
        duration_seconds: Desired length (0.5-30s). When None ElevenLabs auto-selects.
        prompt_influence: Optional [0,1] influence factor. Defaults to provider default (0.3).
        loop: Whether to request a seamlessly looping sound (supported by specific models).
        model_id: Override for the ElevenLabs sound model.
        output_format: Format string per ElevenLabs (codec_sampleRate_bitrate).
        timeout: Network timeout for the request.

    Returns:
        Dictionary containing metadata about the generated audio file.
    """

    api_key = settings.elevenlabs_api_key
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY 未設定，無法產生音效")

    if not prompt or not prompt.strip():
        raise ValueError("音效描述（prompt）不可為空")

    target_format = output_format or DEFAULT_OUTPUT_FORMAT
    audio_ext = _resolve_audio_extension(target_format)

    output_dir = Path(settings.generated_sounds_dir)
    ensure_dirs([str(output_dir)])

    base_name = _resolve_base_name(image_path, fallback=request_id)
    output_path = _deduplicate_filename(base_name, audio_ext, output_dir)

    payload: Dict[str, Any] = {
        "text": prompt.strip(),
        "model_id": model_id or DEFAULT_MODEL_ID,
    }
    if duration_seconds is not None:
        payload["duration_seconds"] = duration_seconds
    if prompt_influence is not None:
        payload["prompt_influence"] = prompt_influence
    if loop:
        payload["loop"] = True

    params = {"output_format": target_format} if target_format else None

    headers = {
        "xi-api-key": api_key,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
    }

    url = f"{ELEVEN_BASE_URL.rstrip('/')}/v1/sound-generation"

    with httpx.Client(timeout=timeout) as client:
        response = client.post(url, headers=headers, params=params, json=payload)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text
            raise RuntimeError(f"ElevenLabs sound generation 失敗：{exc.response.status_code} {detail}") from exc

        audio_bytes = response.content

    output_path.write_bytes(audio_bytes)

    relative_path: str | None = None
    try:
        relative_path = str(output_path.relative_to(Path(settings.generated_sounds_dir).parent))
    except ValueError:
        relative_path = str(output_path)

    stat = output_path.stat()
    metadata = {
        "kind": "sound_effect",
        "provider": "elevenlabs",
        "created_at": utc_now_iso_z(),
        "prompt": prompt.strip(),
        "image_path": str(image_path),
        "request_id": request_id,
        "model_id": payload["model_id"],
        "duration_seconds": duration_seconds,
        "prompt_influence": prompt_influence,
        "loop": loop,
        "output_format": target_format,
        "output_audio": output_path.name,
        "absolute_path": str(output_path),
        "relative_path": relative_path,
        "size_bytes": stat.st_size,
        "checksum_sha256": compute_sha256(output_path),
    }
    metadata_path = write_metadata(metadata, base_name=output_path.name)

    return {
        "request_id": request_id,
        "prompt": prompt.strip(),
        "model_id": payload["model_id"],
        "output_format": target_format,
        "loop": loop,
        "duration_seconds": duration_seconds,
        "prompt_influence": prompt_influence,
        "filename": output_path.name,
        "absolute_path": str(output_path),
        "relative_path": relative_path,
        "size_bytes": stat.st_size,
        "checksum_sha256": metadata["checksum_sha256"],
        "metadata_path": metadata_path,
    }
