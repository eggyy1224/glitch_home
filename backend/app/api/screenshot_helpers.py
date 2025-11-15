from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException

from ..config import settings
from ..services.screenshot_queue import screenshot_request_queue

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def resolve_screenshot_path(path_str: str | None) -> Path | None:
    if not path_str:
        return None

    raw = Path(path_str)
    candidates: list[Path] = [raw]
    if not raw.is_absolute():
        candidates.append(PROJECT_ROOT / raw)
        candidates.append(Path(settings.screenshot_dir) / raw)
        candidates.append(Path(settings.screenshot_dir) / raw.name)
    seen: set[Path] = set()
    for candidate in candidates:
        try:
            candidate_resolved = candidate.resolve()
        except Exception:
            continue
        if candidate_resolved in seen:
            continue
        seen.add(candidate_resolved)
        if candidate_resolved.is_file():
            return candidate_resolved
    return None


async def resolve_image_and_snapshot(
    image_path: str | None,
    request_id: str | None,
) -> tuple[Path, dict | None]:
    resolved_path: Path | None = None
    snapshot_record: dict | None = None

    if image_path:
        resolved_path = resolve_screenshot_path(image_path)
        if resolved_path is None:
            raise HTTPException(status_code=404, detail="指定的影像檔案不存在")
    elif request_id:
        snapshot_record = await screenshot_request_queue.get_request(request_id)
        if snapshot_record is None:
            raise HTTPException(status_code=404, detail="screenshot request not found")
        result = snapshot_record.get("result") or {}
        candidate_path = result.get("absolute_path") or result.get("relative_path")
        if not candidate_path:
            raise HTTPException(status_code=409, detail="截圖尚未完成或缺少檔案資訊")
        resolved_path = resolve_screenshot_path(candidate_path)
        if resolved_path is None:
            raise HTTPException(status_code=404, detail="截圖檔案不存在或已被移除")
    else:
        raise HTTPException(status_code=400, detail="image_path 或 request_id 必須提供")

    return resolved_path, snapshot_record


def build_auto_sound_prompt(analysis: dict, duration: float) -> str:
    summary = (analysis.get("summary") or "").strip()
    segments = analysis.get("segments") or []

    pieces: list[str] = []
    if summary:
        pieces.append(summary.replace("\n", " ").strip())
    for seg in segments:
        if isinstance(seg, str):
            cleaned = seg.replace("\n", " ").strip()
            if cleaned:
                pieces.append(cleaned)

    if not pieces:
        raise HTTPException(status_code=500, detail="分析結果缺少文字，無法自動產生音效描述")

    combined = " ".join(pieces)
    combined = " ".join(combined.split())

    max_details_len = 320
    if len(combined) > max_details_len:
        combined = combined[:max_details_len].rsplit(" ", 1)[0] + "..."

    prefix = (
        "Create an immersive {duration:.1f}-second soundscape inspired by this scene. "
        "Focus on atmosphere, motion, focal elements, and spatial depth. Details: "
    ).format(duration=duration)

    prompt = prefix + combined
    if len(prompt) > 440:
        overflow = len(prompt) - 440
        trim_target = max(10, len(combined) - overflow - 3)
        combined_trim_raw = combined[:trim_target]
        if " " in combined_trim_raw:
            combined_trim_raw = combined_trim_raw.rsplit(" ", 1)[0]
        combined_trimmed = combined_trim_raw + "..."
        prompt = prefix + combined_trimmed

    return prompt
