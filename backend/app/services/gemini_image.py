import base64
import os
import random
import time
from datetime import datetime
from io import BytesIO
from typing import Callable, List, Optional, Tuple

from PIL import Image, ImageOps

from ..config import settings
from ..utils.fs import ensure_dirs
from ..utils.metadata import write_metadata
from ..utils.gemini_client import get_gemini_client

TimestampFactory = Callable[[], datetime]
FilenameBuilder = Callable[[str, datetime], str]

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


def _format_input_diagnostics(inputs: List[dict]) -> str:
    details = ", ".join(
        f"{item['name']}[{item['dimensions']}, {item['file_size']}]" for item in inputs
    )
    return f" inputs=({len(inputs)} images); details=[{details}]"


def _default_filename_builder(fmt: str, timestamp: datetime) -> str:
    base = timestamp.strftime("%Y%m%d_%H%M%S")
    suffix = int(time.time() * 1000) % 1000
    return f"offspring_{base}_{suffix:03d}.{fmt}"


class GeminiImageGenerator:
    def __init__(
        self,
        *,
        client=None,
        timestamp_factory: TimestampFactory | None = None,
        filename_builder: FilenameBuilder | None = None,
    ) -> None:
        self._client = client
        self._timestamp_factory: TimestampFactory = timestamp_factory or datetime.now
        self._filename_builder: FilenameBuilder = filename_builder or _default_filename_builder

    @property
    def client(self):
        if self._client is None:
            self._client = get_gemini_client()
        return self._client

    def generate(
        self,
        *,
        parent_paths: List[str],
        prompt: str,
        strength: Optional[float] = None,
        output_format: Optional[str] = None,
        output_width: Optional[int] = None,
        output_height: Optional[int] = None,
        output_max_side: Optional[int] = None,
        resize_mode: Optional[str] = None,
    ) -> dict:
        ensure_dirs([settings.offspring_dir, settings.metadata_dir])

        if len(parent_paths) < 2:
            raise ValueError("父圖至少需要 2 張")

        images, input_details = self._prepare_inputs(parent_paths)
        generated_image = self._call_gemini(prompt, images, input_details)
        resized = self._resize_image(
            generated_image,
            output_format=output_format,
            output_width=output_width,
            output_height=output_height,
            output_max_side=output_max_side,
            resize_mode=resize_mode,
        )
        output_path, fmt, width, height = self._write_output(
            resized,
            output_format=output_format,
            input_details=input_details,
        )
        metadata = self._build_metadata(
            parent_paths=parent_paths,
            input_details=input_details,
            prompt=prompt,
            strength=strength,
            fmt=fmt,
            width=width,
            height=height,
            output_path=output_path,
        )
        metadata_path = write_metadata(
            metadata, base_name=os.path.splitext(os.path.basename(output_path))[0]
        )

        return {
            "output_image_path": output_path,
            "metadata_path": metadata_path,
            "parents": metadata["parents"],
            "parents_full_paths": parent_paths,
            "model_name": settings.model_name,
            "output_format": fmt,
            "width": width,
            "height": height,
            "prompt": prompt,
            "strength": strength,
        }

    def _prepare_inputs(self, parent_paths: List[str]) -> Tuple[List[Image.Image], List[dict]]:
        images: List[Image.Image] = []
        input_details: List[dict] = []
        for path in parent_paths:
            img = _open_prepared_image(path)
            images.append(img)
            input_details.append(
                {
                    "path": path,
                    "name": os.path.basename(path),
                    "file_size": _safe_size(path),
                    "dimensions": f"{img.width}x{img.height}",
                }
            )
        return images, input_details

    def _call_gemini(
        self,
        prompt: str,
        images: List[Image.Image],
        input_details: List[dict],
    ) -> Image.Image:
        try:
            response = self.client.models.generate_content(
                model=settings.model_name,
                contents=[prompt, *images],
            )
        except Exception as e:
            raise RuntimeError(
                f"呼叫 Gemini 產生影像失敗：{e}{_format_input_diagnostics(input_details)}"
            ) from e

        image_bytes: bytes | None = None
        try:
            candidates = getattr(response, "candidates", None) or []
            if not candidates:
                raise RuntimeError(
                    "Gemini 回傳沒有 candidates（可能被安全性或長度限制擋下）"
                )
            first = candidates[0]
            content = getattr(first, "content", None)
            parts = getattr(content, "parts", None) if content is not None else None
            if not parts:
                finish_reason = getattr(first, "finish_reason", None)
                raise RuntimeError(
                    f"Gemini candidate 無 content/parts，finish_reason={finish_reason}"
                )
            for part in parts:
                inline = getattr(part, "inline_data", None)
                camel_inline = getattr(part, "inlineData", None)
                if inline is not None and getattr(inline, "data", None) is not None:
                    image_bytes = inline.data
                    break
                if camel_inline is not None and getattr(camel_inline, "data", None) is not None:
                    image_bytes = camel_inline.data
                    break
            if not image_bytes:
                texts = [getattr(p, "text", "") for p in parts if getattr(p, "text", None)]
                extra = f"；附帶文字：{' '.join(t for t in texts if t)}" if texts else ""
                raise RuntimeError(
                    "Gemini 回傳未包含影像資料 (inline_data/inlineData 缺失)" + extra
                )
        except Exception as e:
            raise RuntimeError(
                f"解析 Gemini 回傳失敗：{e}{_format_input_diagnostics(input_details)}"
            ) from e

        if isinstance(image_bytes, str):
            try:
                image_bytes = base64.b64decode(image_bytes)
            except Exception:
                image_bytes = image_bytes.encode("utf-8")
        elif isinstance(image_bytes, memoryview):
            image_bytes = image_bytes.tobytes()
        elif isinstance(image_bytes, bytearray):
            image_bytes = bytes(image_bytes)

        try:
            return Image.open(BytesIO(image_bytes))
        except Exception as e:
            raise RuntimeError(
                f"無法解析生成影像：{e}{_format_input_diagnostics(input_details)}"
            ) from e

    def _resize_image(
        self,
        img: Image.Image,
        *,
        output_format: Optional[str],
        output_width: Optional[int],
        output_height: Optional[int],
        output_max_side: Optional[int],
        resize_mode: Optional[str],
    ) -> Image.Image:
        target_w = output_width
        target_h = output_height
        max_side = output_max_side
        fmt = (output_format or "png").lower()

        if target_w and target_h:
            w = int(target_w)
            h = int(target_h)
            mode = (resize_mode or "cover").lower()
            if mode == "fit":
                fitted = ImageOps.contain(img, (w, h), Image.Resampling.LANCZOS)
                if fitted.size != (w, h):
                    pad_color = (
                        (0, 0, 0, 0)
                        if fmt in ("png",)
                        and fitted.mode in ("RGBA", "LA")
                        else (0, 0, 0)
                    )
                    canvas_mode = (
                        "RGBA"
                        if isinstance(pad_color, tuple) and len(pad_color) == 4
                        else "RGB"
                    )
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
                img = ImageOps.fit(
                    img,
                    (w, h),
                    Image.Resampling.LANCZOS,
                    centering=(0.5, 0.5),
                )
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
        return img

    def _write_output(
        self,
        img: Image.Image,
        *,
        output_format: Optional[str],
        input_details: List[dict],
    ) -> Tuple[str, str, int, int]:
        fmt = (output_format or "png").lower()
        if fmt == "jpg":
            fmt = "jpeg"

        timestamp = self._timestamp_factory()
        filename = self._filename_builder(fmt, timestamp)
        output_path = os.path.join(settings.offspring_dir, filename)

        try:
            params = {}
            save_img = img
            if fmt == "jpeg":
                params |= {"quality": 95}
                if save_img.mode in ("RGBA", "LA"):
                    save_img = save_img.convert("RGB")
            save_img.save(output_path, format=fmt.upper(), **params)
        except Exception as e:
            raise RuntimeError(
                f"輸出影像存檔失敗：{e}{_format_input_diagnostics(input_details)}"
            ) from e

        width, height = img.size
        return output_path, fmt, width, height

    def _build_metadata(
        self,
        *,
        parent_paths: List[str],
        input_details: List[dict],
        prompt: str,
        strength: Optional[float],
        fmt: str,
        width: int,
        height: int,
        output_path: str,
    ) -> dict:
        return {
            "parents": [detail["name"] for detail in input_details],
            "parents_full_paths": parent_paths,
            "input_details": input_details,
            "model_name": settings.model_name,
            "prompt": prompt,
            "strength": strength,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "output_image": os.path.basename(output_path),
            "output_format": fmt,
            "output_size": {"width": width, "height": height},
        }


def _generate_and_store_image(
    *,
    parent_paths: List[str],
    prompt: str,
    strength: Optional[float] = None,
    output_format: Optional[str] = None,
    output_width: Optional[int] = None,
    output_height: Optional[int] = None,
    output_max_side: Optional[int] = None,
    resize_mode: Optional[str] = None,
    generator: Optional[GeminiImageGenerator] = None,
) -> dict:
    generator = generator or GeminiImageGenerator()
    return generator.generate(
        parent_paths=parent_paths,
        prompt=prompt,
        strength=strength,
        output_format=output_format,
        output_width=output_width,
        output_height=output_height,
        output_max_side=output_max_side,
        resize_mode=resize_mode,
    )


def generate_mixed_offspring(count: int = 2) -> dict:
    parents = _pick_images_from_genes_pool(count)
    prompt = settings.fixed_prompt

    result = _generate_and_store_image(
        parent_paths=parents,
        prompt=prompt,
        strength=None,
        output_format="png",
        output_width=None,
        output_height=None,
        output_max_side=None,
        resize_mode=None,
    )

    return {
        "output_image_path": result["output_image_path"],
        "metadata_path": result["metadata_path"],
        "parents": result["parents"],
        "model_name": result["model_name"],
    }


def _resolve_parent_paths(explicit: List[str]) -> List[str]:
    """Resolve provided parent file identifiers to absolute paths.

    Accepts either absolute paths, relative paths under configured genes_pool_dirs,
    or basenames that exist under these directories or offspring_dir. Returns a list of absolute
    paths in the same order as input. Raises ValueError if any cannot be resolved
    or is not an image file.
    """
    pool_dirs: List[str] = getattr(settings, "genes_pool_dirs", [settings.genes_pool_dir])
    # Also search in offspring_dir for images selected from the frontend
    search_dirs = pool_dirs + [settings.offspring_dir]
    resolved: List[str] = []
    for item in explicit:
        candidate_paths: List[str] = []
        # Absolute path
        if os.path.isabs(item) and os.path.isfile(item):
            candidate_paths.append(item)
        # Try interpret as relative under each search dir
        for d in search_dirs:
            p = os.path.join(d, item)
            if os.path.isfile(p):
                candidate_paths.append(p)
        # If still not found, try search by basename
        base = os.path.basename(item)
        if not candidate_paths:
            for d in search_dirs:
                try:
                    if not os.path.isdir(d):
                        continue
                    for f in os.listdir(d):
                        if f == base:
                            p = os.path.join(d, f)
                            if os.path.isfile(p):
                                candidate_paths.append(p)
                                break
                except (FileNotFoundError, PermissionError) as e:
                    continue
        if not candidate_paths:
            # Provide more helpful error message
            searched_dirs_str = ", ".join([str(d) for d in search_dirs])
            raise ValueError(
                f"指定的父圖無法解析：{item}。已搜尋目錄：{searched_dirs_str}"
            )
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
    if parents and len(parents) < 2:
        raise ValueError("父圖至少需要 2 張")

    # Resolve parents or sample
    if parents:
        resolved_parents = _resolve_parent_paths(parents)
    else:
        sample_count = count if (count and count >= 2) else 2
        resolved_parents = _pick_images_from_genes_pool(sample_count)

    # Build prompt
    final_prompt = prompt.strip() if (prompt and prompt.strip()) else settings.fixed_prompt
    if strength is not None:
        # Hint-based control; true model-native parameter may be integrated later
        s = max(0.0, min(1.0, float(strength)))
        final_prompt = (
            final_prompt
            + f"\n[Guidance] Use the provided images as references with an image-to-image transformation strength ≈ {s:.2f} (0=loose, 1=strict)."
        )

    result = _generate_and_store_image(
        parent_paths=resolved_parents,
        prompt=final_prompt,
        strength=strength,
        output_format=output_format,
        output_width=output_width,
        output_height=output_height,
        output_max_side=output_max_side,
        resize_mode=resize_mode,
    )

    return {
        "output_image_path": result["output_image_path"],
        "metadata_path": result["metadata_path"],
        "parents": result["parents"],
        "model_name": result["model_name"],
        "output_format": result["output_format"],
        "width": result["width"],
        "height": result["height"],
    }
