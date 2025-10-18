from __future__ import annotations

"""Utilities to obtain text/image (multi)modal embeddings via OpenAI API.

This module uses OpenAI for embeddings (text-embedding-3-small) and vision captions (gpt-4o-mini).
"""

from typing import Any, List, Optional
from PIL import Image, ImageOps
import base64
from io import BytesIO

from openai import OpenAI
from ..config import settings


def _get_openai_client() -> OpenAI:
    """Get or create OpenAI client."""
    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY not configured")
    return OpenAI(api_key=settings.openai_api_key)


def _normalise_image(img: Image.Image) -> Image.Image:
    """Auto-orient and ensure RGB to avoid format issues."""
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    return img


def _image_to_base64(image: Image.Image | str) -> str:
    """Convert PIL image or file path to base64 string."""
    if isinstance(image, str):
        pil = Image.open(image)
    else:
        pil = image
    pil = _normalise_image(pil)
    
    buffer = BytesIO()
    pil.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.standard_b64encode(buffer.getvalue()).decode("utf-8")


def embed_text(text: str, *, model: Optional[str] = None) -> List[float]:
    """Embed text using OpenAI text-embedding-3-small."""
    if not text or not str(text).strip():
        raise ValueError("text must be a non-empty string")
    
    client = _get_openai_client()
    model_name = model or settings.openai_embedding_model
    
    response = client.embeddings.create(
        model=model_name,
        input=str(text)
    )
    
    return response.data[0].embedding


def caption_image(image: Image.Image | str, *, prompt: Optional[str] = None) -> str:
    """Generate image caption using OpenAI gpt-4o-mini."""
    client = _get_openai_client()
    
    image_base64 = _image_to_base64(image)
    
    default_prompt = (
        "Describe this image in 1-3 concise bullet points focusing on: subject(s), layout, colors/lighting, textures, and style. "
        "Prefer nouns and adjectives over full sentences; avoid opinions and camera jargon."
    )
    user_prompt = (prompt or default_prompt).strip()
    
    response = client.chat.completions.create(
        model=settings.openai_vision_model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{image_base64}"}
                    }
                ]
            }
        ],
        max_tokens=200
    )
    
    return response.choices[0].message.content or ""


def embed_image_as_text(image: Image.Image | str, *, extra_hint: Optional[str] = None) -> List[float]:
    """Caption the image, then use text embedding."""
    desc = caption_image(image)
    combined = (desc + (f"\n{extra_hint}" if extra_hint else "")).strip()
    if not combined:
        combined = extra_hint or "image"
    return embed_text(combined, model=settings.openai_embedding_model)


def embed_image(img: Image.Image | str, *, model: Optional[str] = None) -> List[float]:
    """Embed image by captioning and using text embedding."""
    return embed_image_as_text(img)


def embed_multimodal_text_image(text: Optional[str], image: Image.Image | str, *, model: Optional[str] = None) -> List[float]:
    """Embed text + image by combining caption with text, then embedding."""
    desc = caption_image(image)
    combined = ((text or "").strip() + ("\n" + desc if desc else "")).strip() or "image"
    return embed_text(combined, model=settings.openai_embedding_model)
