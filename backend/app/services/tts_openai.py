"""Text-to-Speech via OpenAI Audio API.

This module provides a small helper to synthesize narration audio using
OpenAI's TTS models (default: gpt-4o-mini-tts) and store the result under
`backend/generated_sounds/`, returning metadata compatible with the existing
sound file serving endpoints.
"""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
import re

import httpx

from ..config import settings
from ..utils.fs import ensure_dirs
from ..utils.metadata import compute_sha256, write_metadata, utc_now_iso_z


DEFAULT_TTS_MODEL = "gpt-4o-mini-tts"
DEFAULT_VOICE = "alloy"
DEFAULT_FORMAT = "mp3"  # mp3|wav|opus|aac|flac (OpenAI-supported)


def _utc_compact_timestamp() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%S")


def _resolve_audio_extension(fmt: str) -> str:
    mapping = {
        "mp3": ".mp3",
        "wav": ".wav",
        "opus": ".opus",
        "aac": ".aac",
        "flac": ".flac",
    }
    key = (fmt or DEFAULT_FORMAT).lower().strip()
    return mapping.get(key, ".mp3")


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
        alt = resolved_dir / f"{safe_base}_{suffix}{ext}"
        if not alt.exists():
            resolved = alt.resolve()
            if resolved.parent != resolved_dir:
                raise ValueError("非法輸出路徑：越界目錄")
            return alt
        suffix += 1


def _sanitize_base_filename(name: str | None) -> str:
    """將外部提供的 filename_base 正規化為安全的檔名基底。

    規則：
    - 僅取最後一段檔名（去除所有路徑成分）
    - 僅允許 [A-Za-z0-9._-]，其餘改為底線
    - 去除前導 '.' 以避免隱藏檔與 '.'、'..' 特例
    - 截斷長度（120 字元）
    - 若清理後為空字串，回傳空字串以便呼叫端落回隨機名稱
    """
    if not name:
        return ""
    # 去除路徑成分
    cleaned = Path(str(name)).name
    # 移除 NUL 與不可見字元
    cleaned = cleaned.replace("\x00", "")
    # 僅允許安全字元
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", cleaned)
    # 避免隱藏檔或 '.'、'..'
    cleaned = cleaned.lstrip('.')
    # 長度限制
    if len(cleaned) > 120:
        cleaned = cleaned[:120]
    return cleaned


def synthesize_speech_openai(
    *,
    text: str,
    instructions: Optional[str] = None,
    voice: Optional[str] = None,
    model: Optional[str] = None,
    output_format: Optional[str] = None,
    filename_base: Optional[str] = None,
    speed: Optional[float] = None,
    timeout: float = 120.0,
) -> Dict[str, Any]:
    """Synthesize narration audio using OpenAI TTS and save it to disk.

    Args:
        text: The narration/script to speak.
        voice: OpenAI TTS voice (e.g., "alloy").
        model: TTS model (default: gpt-4o-mini-tts).
        output_format: One of mp3|wav|opus|aac|flac. Defaults to mp3.
        filename_base: Optional base for output filename.
        timeout: Network timeout in seconds.

    Returns:
        Metadata dict including filename, absolute_path, relative_path, model, voice, and format.
    """

    api_key = settings.openai_api_key
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY 未設定，無法進行 TTS")

    cleaned = (text or "").strip()
    if not cleaned:
        raise ValueError("TTS 文本不可為空")

    target_model = (model or getattr(settings, "openai_tts_model", None) or DEFAULT_TTS_MODEL).strip()
    tts_voice = (voice or getattr(settings, "openai_tts_voice", None) or DEFAULT_VOICE).strip()
    fmt = (output_format or getattr(settings, "openai_tts_format", None) or DEFAULT_FORMAT).strip().lower()
    audio_ext = _resolve_audio_extension(fmt)

    out_dir = Path(settings.generated_sounds_dir)
    ensure_dirs([str(out_dir)])

    base = _sanitize_base_filename(filename_base)
    if not base:
        ts = _utc_compact_timestamp()
        rand = secrets.token_hex(4)
        base = f"narration_{ts}_{rand}"

    output_path = _deduplicate_filename(base, audio_ext, out_dir)

    # Prefer the classic Audio Speech endpoint for simplicity and stability.
    api_base = os.getenv("OPENAI_API_BASE", "https://api.openai.com")
    url = f"{api_base.rstrip('/')}/v1/audio/speech"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload: Dict[str, Any] = {
        "model": target_model,
        "voice": tts_voice,
        "input": cleaned,
        "format": fmt,
    }
    send_instructions = bool(instructions and instructions.strip())
    if send_instructions:
        payload["instructions"] = instructions.strip()
    if isinstance(speed, (int, float)):
        payload["speed"] = float(speed)

    with httpx.Client(timeout=timeout) as client:
        resp = client.post(url, headers=headers, json=payload)
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            detail = exc.response.text
            # 若 instructions 造成 4xx，嘗試移除後回退一次
            if 400 <= status < 500 and send_instructions:
                txt = (detail or "").lower()
                if "instruction" in txt or "unknown field" in txt or "invalid" in txt:
                    payload_no_instr = dict(payload)
                    payload_no_instr.pop("instructions", None)
                    resp2 = client.post(url, headers=headers, json=payload_no_instr)
                    try:
                        resp2.raise_for_status()
                    except httpx.HTTPStatusError as exc2:
                        st2 = exc2.response.status_code
                        dt2 = exc2.response.text
                        if 400 <= st2 < 500:
                            raise ValueError(f"OpenAI TTS 請求無效：{st2} {dt2}") from exc2
                        raise RuntimeError(f"OpenAI TTS 失敗：{st2} {dt2}") from exc2
                    audio_bytes = resp2.content
                else:
                    # 其他 4xx 錯誤
                    raise ValueError(f"OpenAI TTS 請求無效：{status} {detail}") from exc
            else:
                # 非 4xx 或沒有 instructions 的情況
                if 400 <= status < 500:
                    raise ValueError(f"OpenAI TTS 請求無效：{status} {detail}") from exc
                raise RuntimeError(f"OpenAI TTS 失敗：{status} {detail}") from exc
        else:
            audio_bytes = resp.content

    output_path.write_bytes(audio_bytes)

    try:
        relative_path = str(output_path.relative_to(Path(settings.generated_sounds_dir).parent))
    except ValueError:
        relative_path = str(output_path)

    stat = output_path.stat()
    metadata = {
        "kind": "tts",
        "provider": "openai",
        "created_at": utc_now_iso_z(),
        "text": cleaned,
        "instructions": payload.get("instructions"),
        "model": target_model,
        "voice": tts_voice,
        "format": fmt,
        "speed": payload.get("speed"),
        "output_audio": output_path.name,
        "absolute_path": str(output_path),
        "relative_path": relative_path,
        "size_bytes": stat.st_size,
        "checksum_sha256": compute_sha256(output_path),
    }
    metadata_path = write_metadata(metadata, base_name=output_path.name)

    return {
        "text": cleaned,
        "instructions": payload.get("instructions"),
        "model": target_model,
        "voice": tts_voice,
        "format": fmt,
        "speed": payload.get("speed"),
        "filename": output_path.name,
        "absolute_path": str(output_path),
        "relative_path": relative_path,
        "size_bytes": stat.st_size,
        "checksum_sha256": metadata["checksum_sha256"],
        "metadata_path": metadata_path,
    }
