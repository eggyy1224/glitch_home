import base64
import os
import random
import time
from datetime import datetime
from io import BytesIO
from typing import Tuple, List, Optional

from PIL import Image, ImageOps

from ..config import settings
from ..utils.fs import ensure_dirs
from ..utils.metadata import write_metadata
from ..utils.gemini_client import get_gemini_client
from ..models.schemas import GenerateMixTwoRequest


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


def _resolve_parent_paths(explicit: List[str]) -> List[str]:
    """Resolve provided parent file identifiers to absolute paths.

    Accepts either absolute paths, relative paths under configured genes_pool_dirs,
    or basenames that exist under these directories. Returns a list of absolute
    paths in the same order as input. Raises ValueError if any cannot be resolved
    or is not an image file.
    """
    pool_dirs: List[str] = getattr(settings, "genes_pool_dirs", [settings.genes_pool_dir])
    resolved: List[str] = []
    for item in explicit:
        candidate_paths: List[str] = []
        # Absolute path
        if os.path.isabs(item) and os.path.isfile(item):
            candidate_paths.append(item)
        # Try interpret as relative under each pool dir
        for d in pool_dirs:
            p = os.path.join(d, item)
            if os.path.isfile(p):
                candidate_paths.append(p)
        # If still not found, try search by basename
        base = os.path.basename(item)
        if not candidate_paths:
            for d in pool_dirs:
                try:
                    for f in os.listdir(d):
                        if f == base:
                            p = os.path.join(d, f)
                            if os.path.isfile(p):
                                candidate_paths.append(p)
                                break
                except FileNotFoundError:
                    continue
        if not candidate_paths:
            raise ValueError(f"指定的父圖無法解析：{item}")
        # Prefer the first found (respecting dirs order)
        chosen = candidate_paths[0]
        if not chosen.lower().endswith((".png", ".jpg", ".jpeg")):
            raise ValueError(f"父圖格式不支援（需 png/jpg）：{item}")
        resolved.append(chosen)
    return resolved


def generate_mixed_offspring_v2(
    *,
    parents: Optional[List[str]] = None,
    count: int | None = None,
    prompt: Optional[str] = None,
    strength: Optional[float] = None,
    output_format: Optional[str] = None,
    output_width: Optional[int] = None,
    output_height: Optional[int] = None,
    output_max_side: Optional[int] = None,
    resize_mode: Optional[str] = None,
) -> dict:
    """Expanded image generation with explicit parents, prompt, strength and output options.

    Backward-compatible defaults match previous behavior when all args are None.
    """
    ensure_dirs([settings.offspring_dir, settings.metadata_dir])

    if parents and len(parents) < 2:
        raise ValueError("父圖至少需要 2 張")

    # Resolve parents or sample
    if parents:
        resolved_parents = _resolve_parent_paths(parents)
    else:
        sample_count = count if (count and count >= 2) else 2
        resolved_parents = _pick_images_from_genes_pool(sample_count)

    client = get_gemini_client()

    # Build prompt
    final_prompt = prompt.strip() if (prompt and prompt.strip()) else settings.fixed_prompt
    if strength is not None:
        # Hint-based control; true model-native parameter may be integrated later
        s = max(0.0, min(1.0, float(strength)))
        final_prompt = (
            final_prompt
            + f"\n[Guidance] Use the provided images as references with an image-to-image transformation strength ≈ {s:.2f} (0=loose, 1=strict)."
        )

    images = [_open_prepared_image(p) for p in resolved_parents]

    response = client.models.generate_content(
        model=settings.model_name,
        contents=[final_prompt, *images],
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
            if getattr(part, "inlineData", None) is not None:
                image_bytes = part.inlineData.data
                break
        if not image_bytes:
            texts = [getattr(p, "text", "") for p in parts if getattr(p, "text", None)]
            raise RuntimeError(
                "Gemini 回傳未包含影像資料 (inline_data/inlineData 缺失)"
                + (f"；附帶文字：{' '.join(t for t in texts if t)}" if texts else "")
            )
    except Exception as e:
        sizes = [f"{os.path.basename(p)}={_safe_size(p)}" for p in resolved_parents]
        raise RuntimeError(
            f"解析 Gemini 回傳失敗：{e}. inputs=({len(resolved_parents)} images), sizes={sizes}"
        ) from e

    # Decode returned image for post-processing
    try:
        img = Image.open(BytesIO(image_bytes))
    except Exception as e:
        raise RuntimeError(f"無法解析生成影像：{e}") from e

    # Apply output resizing (preserve aspect ratio by default; avoid stretch)
    target_w = output_width
    target_h = output_height
    max_side = output_max_side
    if target_w and target_h:
        w = int(target_w)
        h = int(target_h)
        mode = (resize_mode or 'cover').lower()
        if mode == 'fit':
            # Fit into the target box while preserving aspect ratio; then pad
            fitted = ImageOps.contain(img, (w, h), Image.Resampling.LANCZOS)
            if fitted.size != (w, h):
                pad_color = (0, 0, 0, 0) if (output_format or 'png').lower() in ('png',) and fitted.mode in ('RGBA', 'LA') else (0, 0, 0)
                canvas_mode = 'RGBA' if isinstance(pad_color, tuple) and len(pad_color) == 4 else 'RGB'
                if fitted.mode != canvas_mode:
                    fitted = fitted.convert(canvas_mode)
                canvas = Image.new(canvas_mode, (w, h), pad_color)
                ox = (w - fitted.width) // 2
                oy = (h - fitted.height) // 2
                canvas.paste(fitted, (ox, oy))
                img = canvas
            else:
                img = fitted
        else:
            # Fill target by cropping overflow (centered)
            img = ImageOps.fit(img, (w, h), Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    elif target_w and not target_h:
        w = int(target_w)
        h = max(1, round(w * img.height / img.width))
        img = img.resize((w, h), Image.Resampling.LANCZOS)
    elif target_h and not target_w:
        h = int(target_h)
        w = max(1, round(h * img.width / img.height))
        img = img.resize((w, h), Image.Resampling.LANCZOS)
    elif max_side:
        ms = int(max(1, max_side))
        orig_w, orig_h = img.size
        scale = ms / max(orig_w, orig_h)
        if scale < 1.0:
            new_w = max(1, round(orig_w * scale))
            new_h = max(1, round(orig_h * scale))
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Normalize format
    fmt = (output_format or "png").lower()
    if fmt == "jpg":
        fmt = "jpeg"

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"offspring_{timestamp}_{int(time.time()*1000)%1000:03d}.{fmt}"
    output_path = os.path.join(settings.offspring_dir, filename)

    # Re-encode to requested format
    try:
        params = {}
        if fmt == "jpeg":
            params |= {"quality": 95}
            if img.mode in ("RGBA", "LA"):
                img = img.convert("RGB")
        img.save(output_path, format=fmt.upper(), **params)
    except Exception as e:
        raise RuntimeError(f"輸出影像存檔失敗：{e}") from e

    width, height = img.size

    metadata = {
        "parents": [os.path.basename(p) for p in resolved_parents],
        "parents_full_paths": resolved_parents,
        "model_name": settings.model_name,
        "prompt": final_prompt,
        "strength": strength,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "output_image": os.path.basename(output_path),
        "output_format": fmt,
        "output_size": {"width": width, "height": height},
    }
    metadata_path = write_metadata(metadata, base_name=os.path.splitext(filename)[0])

    return {
        "output_image_path": output_path,
        "metadata_path": metadata_path,
        "parents": metadata["parents"],
        "model_name": settings.model_name,
        "output_format": fmt,
        "width": width,
        "height": height,
    }
