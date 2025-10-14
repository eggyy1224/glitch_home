"""Screenshot analysis via Gemini 2.5 Flash."""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from PIL import Image, ImageOps

from ..config import settings
from ..utils.gemini_client import get_gemini_client


DEFAULT_ANALYSIS_PROMPT = (
    "You are analysing a rendered 3D scene captured from an interactive application. "
    "Provide a concise but information-dense summary that covers: key subjects, layout, depth cues, "
    "dominant colours or lighting, and any notable motion or mood that could inspire sound design. "
    "Use bullet points when helpful."
)


def _load_image(path: str) -> Image.Image:
    if not os.path.isfile(path):
        raise FileNotFoundError(f"screenshot not found: {path}")
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    # Gemini accepts reasonably large inputs, but we clamp to avoid extremely large uploads.
    max_side = max(img.size)
    target = max(512, int(getattr(settings, "image_size", 1024)))
    if max_side > target:
        img.thumbnail((target, target), Image.Resampling.LANCZOS)
    return img


def _collect_text_parts(parts: List[Any]) -> List[str]:
    texts: List[str] = []
    for part in parts:
        text = getattr(part, "text", None)
        if text:
            cleaned = text.strip()
            if cleaned:
                texts.append(cleaned)
    return texts


def _serialise_safety(candidate: Any) -> List[Dict[str, Any]]:
    ratings = getattr(candidate, "safety_ratings", None)
    if not ratings:
        return []
    serialised: List[Dict[str, Any]] = []
    for rating in ratings:
        category = getattr(rating, "category", None)
        probability = getattr(rating, "probability", None)
        serialised.append({
            "category": category,
            "probability": probability,
        })
    return serialised


def analyze_screenshot(image_path: str, prompt: Optional[str] = None) -> Dict[str, Any]:
    """Analyse a screenshot image using Gemini 2.5 Flash.

    Args:
        image_path: Absolute or relative path to the screenshot file.
        prompt: Optional custom instructions sent alongside the image.

    Returns:
        Dictionary containing generated summary text, raw segments, safety metadata, and timestamps.
    """

    img = _load_image(image_path)
    client = get_gemini_client()

    user_prompt = prompt.strip() if prompt and prompt.strip() else DEFAULT_ANALYSIS_PROMPT

    response = client.models.generate_content(
        model=settings.model_name,
        contents=[user_prompt, img],
    )

    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        raise RuntimeError("Gemini analysis returned no candidates")

    primary = candidates[0]
    content = getattr(primary, "content", None)
    parts = getattr(content, "parts", None) if content is not None else None
    if not parts:
        finish_reason = getattr(primary, "finish_reason", None)
        raise RuntimeError(f"Gemini analysis candidate missing content; finish_reason={finish_reason}")

    text_segments = _collect_text_parts(parts)
    if not text_segments:
        raise RuntimeError("Gemini analysis response contained no text output")

    summary = "\n".join(text_segments)

    analysis = {
        "summary": summary,
        "segments": text_segments,
        "model": settings.model_name,
        "prompt": user_prompt,
        "image": os.path.abspath(image_path),
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "finish_reason": getattr(primary, "finish_reason", None),
        "safety_ratings": _serialise_safety(primary),
    }

    return analysis

