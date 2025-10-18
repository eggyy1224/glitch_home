from __future__ import annotations

"""Utilities to obtain text/image (multi)modal embeddings via Google GenAI SDK.

This module is intentionally defensive about SDK response shapes to
accommodate minor version differences.
"""

from typing import Any, List, Optional
from PIL import Image, ImageOps

from .gemini_client import get_gemini_client
from ..config import settings


def _normalise_image(img: Image.Image) -> Image.Image:
    """Auto-orient and ensure RGB to avoid format issues."""
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    return img


def _extract_values(resp: Any) -> List[float]:
    """Try to extract a flat embedding vector from various response shapes."""
    # Common shapes observed:
    # - resp.embeddings[0].values
    # - resp.embedding.values
    # - resp.values
    for attr in ("embeddings", "embedding"):
        obj = getattr(resp, attr, None)
        if obj is None:
            continue
        if isinstance(obj, list) and obj:
            first = obj[0]
            vals = getattr(first, "values", None)
            if isinstance(vals, list):
                return [float(x) for x in vals]
        vals = getattr(obj, "values", None)
        if isinstance(vals, list):
            return [float(x) for x in vals]
    vals = getattr(resp, "values", None)
    if isinstance(vals, list):
        return [float(x) for x in vals]
    raise RuntimeError("Unable to extract embedding vector from response")


def is_multimodal_model(model_name: str) -> bool:
    name = (model_name or "").lower()
    return "multimodal" in name or "multi" in name


def embed_text(text: str, *, model: Optional[str] = None) -> List[float]:
    if not text or not str(text).strip():
        raise ValueError("text must be a non-empty string")
    client = get_gemini_client()
    model_name = model or settings.google_text_embedding_model
    payload = str(text)
    # google-genai v0.3.0 使用參數名稱 `contents`
    resp = client.models.embed_content(model=model_name, contents=[payload])
    return _extract_values(resp)


def embed_image(img: Image.Image | str, *, model: Optional[str] = None) -> List[float]:
    """Embed image, with optional direct-image mode (Vertex) else caption fallback.

    流程：
    - 若 settings.enable_image_embedding 為 True，嘗試以 `google_image_embedding_model`
      直接嵌入（僅在 Vertex/支援的模型下有效）。若失敗則回退到 caption→text 嵌入。
    - 若未啟用，直接用 caption→text 嵌入。
    """
    if isinstance(img, str):
        pil = Image.open(img)
    else:
        pil = img
    pil = _normalise_image(pil)

    if settings.enable_image_embedding:
        try:
            client = get_gemini_client()
            model_name = model or settings.google_image_embedding_model
            # 嘗試以單一 Content（單一 image part）嵌入
            resp = client.models.embed_content(model=model_name, contents=[[pil]])
            return _extract_values(resp)
        except Exception:
            # 回退 caption→text
            pass

    return embed_image_as_text(pil)


def embed_multimodal_text_image(text: Optional[str], image: Image.Image | str, *, model: Optional[str] = None) -> List[float]:
    if isinstance(image, str):
        pil = Image.open(image)
    else:
        pil = image
    pil = _normalise_image(pil)
    client = get_gemini_client()
    model_name = model or settings.google_image_embedding_model
    parts: list[Any] = []
    if text and str(text).strip():
        parts.append(str(text))
    parts.append(pil)
    if settings.enable_image_embedding:
        try:
            # 單一 Content（由多個 part 組成）：contents=[parts]
            resp = client.models.embed_content(model=model_name, contents=[parts])
            return _extract_values(resp)
        except Exception:
            pass
    # 回退為：先將 image 轉為描述後，再與文字合併進行 text embedding
    desc = caption_image(pil)
    merged = ((text or "").strip() + ("\n" + desc if desc else "")).strip() or "image"
    return embed_text(merged, model=settings.google_text_embedding_model)


# --- Captioning fallback for image embeddings (text-only space) ---

_CAPTION_PROMPT = (
    "Describe this image in 1-3 concise bullet points focusing on: subject(s), layout, colors/lighting, textures, and style. "
    "Prefer nouns and adjectives over full sentences; avoid opinions and camera jargon."
)


def caption_image(image: Image.Image | str, *, prompt: Optional[str] = None) -> str:
    if isinstance(image, str):
        pil = Image.open(image)
    else:
        pil = image
    pil = _normalise_image(pil)
    client = get_gemini_client()
    # Use the main model (e.g., gemini-2.5-flash-image-preview) to get a short description
    user_prompt = (prompt or _CAPTION_PROMPT).strip()
    resp = client.models.generate_content(model=settings.model_name, contents=[user_prompt, pil])
    candidates = getattr(resp, "candidates", None) or []
    if not candidates:
        return ""
    parts = getattr(getattr(candidates[0], "content", None), "parts", None) or []
    texts = [getattr(p, "text", "").strip() for p in parts if getattr(p, "text", None)]
    return "\n".join([t for t in texts if t])


def embed_image_as_text(image: Image.Image | str, *, extra_hint: Optional[str] = None) -> List[float]:
    """Fallback: caption the image, then use text embedding (text-embedding-004)."""
    desc = caption_image(image)
    combined = (desc + (f"\n{extra_hint}" if extra_hint else "")).strip()
    if not combined:
        combined = extra_hint or "image"
    return embed_text(combined, model=settings.google_text_embedding_model)
