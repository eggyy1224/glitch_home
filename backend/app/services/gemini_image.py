import base64
import os
import random
import time
from datetime import datetime
from io import BytesIO
from typing import Tuple, List

from PIL import Image, ImageOps

from ..config import settings
from ..utils.fs import ensure_dirs
from ..utils.metadata import write_metadata
from ..utils.gemini_client import get_gemini_client


def _pick_images_from_genes_pool(count: int) -> List[str]:
    if count < 2:
        raise ValueError("融合張數必須 >= 2")

    pool_dirs: List[str] = getattr(settings, "genes_pool_dirs", [settings.genes_pool_dir])

    all_candidates: List[str] = []
    existing_dirs: List[str] = []
    for pool_dir in pool_dirs:
        if not os.path.isdir(pool_dir):
            continue
        existing_dirs.append(pool_dir)
        for f in os.listdir(pool_dir):
            if f.lower().endswith((".png", ".jpg", ".jpeg")):
                all_candidates.append(os.path.join(pool_dir, f))

    if not existing_dirs:
        raise ValueError(
            "genes_pool directory not found: " + ", ".join(pool_dirs)
        )

    if len(all_candidates) < count:
        raise ValueError(f"基因池總數不足 {count} 張圖像，請補圖或調整資料夾")

    return random.sample(all_candidates, count)


def _read_image(path: str) -> Image.Image:
    return Image.open(path).convert("RGBA")


def _open_prepared_image(path: str) -> Image.Image:
    # Load, auto-orient, convert to RGB, and resize to max dimension settings.image_size
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    # Resize in-place with aspect ratio preserved
    max_side = max(img.size)
    target = max(256, int(settings.image_size))
    if max_side > target:
        img.thumbnail((target, target), Image.Resampling.LANCZOS)
    return img


def _safe_size(path: str) -> str:
    try:
        n = os.path.getsize(path)
    except Exception:
        return "?"
    units = [(1<<30, "GB"), (1<<20, "MB"), (1<<10, "KB")]
    for div, name in units:
        if n >= div:
            return f"{n/div:.2f}{name}"
    return f"{n}B"


def generate_mixed_offspring(count: int = 2) -> dict:
    ensure_dirs([settings.offspring_dir, settings.metadata_dir])

    parents = _pick_images_from_genes_pool(count)

    client = get_gemini_client()

    # Prepare inputs per docs: text prompt + image parts
    prompt = settings.fixed_prompt

    images = [_open_prepared_image(p) for p in parents]

    response = client.models.generate_content(
        model=settings.model_name,
        contents=[prompt, *images],
    )

    # Extract first inline image from response with robust checks
    image_bytes: bytes | None = None
    try:
        candidates = getattr(response, "candidates", None) or []
        if not candidates:
            raise RuntimeError("Gemini 回傳沒有 candidates（可能被安全性或長度限制擋下）")
        first = candidates[0]
        content = getattr(first, "content", None)
        parts = getattr(content, "parts", None) if content is not None else None
        if not parts:
            finish_reason = getattr(first, "finish_reason", None)
            raise RuntimeError(f"Gemini candidate 無 content/parts，finish_reason={finish_reason}")
        for part in parts:
            if getattr(part, "inline_data", None) is not None:
                image_bytes = part.inline_data.data
                break
            # Some SDKs may use camelCase
            if getattr(part, "inlineData", None) is not None:
                image_bytes = part.inlineData.data
                break
        if not image_bytes:
            texts = [getattr(p, "text", "") for p in parts if getattr(p, "text", None)]
            raise RuntimeError(
                "Gemini 回傳未包含影像資料 (inline_data/inlineData 缺失)" +
                (f"；附帶文字：{' '.join(t for t in texts if t)}" if texts else "")
            )
    except Exception as e:
        # Surface helpful diagnostics including number of inputs and their sizes
        sizes = [f"{os.path.basename(p)}={_safe_size(p)}" for p in parents]
        raise RuntimeError(f"解析 Gemini 回傳失敗：{e}. inputs=({len(parents)} images), sizes={sizes}") from e

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"offspring_{timestamp}_{int(time.time()*1000)%1000:03d}.png"
    output_path = os.path.join(settings.offspring_dir, filename)

    with open(output_path, "wb") as f:
        f.write(image_bytes)

    metadata = {
        "parents": [os.path.basename(p) for p in parents],
        "model_name": settings.model_name,
        "prompt": prompt,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "output_image": os.path.basename(output_path),
    }
    metadata_path = write_metadata(metadata, base_name=os.path.splitext(filename)[0])

    return {
        "output_image_path": output_path,
        "metadata_path": metadata_path,
        "parents": metadata["parents"],
        "model_name": settings.model_name,
    }
