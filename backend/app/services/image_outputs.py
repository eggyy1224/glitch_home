import os
import time
from datetime import datetime
from typing import List, Optional, Protocol, Tuple

from PIL import Image, ImageOps

from ..config import settings


def _format_input_diagnostics(inputs: List[dict]) -> str:
    details = ", ".join(
        f"{item['name']}[{item['dimensions']}, {item['file_size']}]" for item in inputs
    )
    return f" inputs=({len(inputs)} images); details=[{details}]"


class ImagePreprocessor(Protocol):
    def prepare(self, parent_paths: List[str]) -> Tuple[List[Image.Image], List[dict]]:
        """Load and normalize parent images."""


class OutputWriter(Protocol):
    def write(
        self,
        img: Image.Image,
        *,
        output_format: Optional[str],
        output_width: Optional[int],
        output_height: Optional[int],
        output_max_side: Optional[int],
        resize_mode: Optional[str],
        input_details: List[dict],
    ) -> Tuple[str, str, int, int]:
        """Resize if needed and persist the generated image."""


class DefaultImagePreprocessor:
    def prepare(self, parent_paths: List[str]) -> Tuple[List[Image.Image], List[dict]]:
        images: List[Image.Image] = []
        input_details: List[dict] = []
        for path in parent_paths:
            img = self._open_prepared_image(path)
            images.append(img)
            input_details.append(
                {
                    "path": path,
                    "name": os.path.basename(path),
                    "file_size": self._safe_size(path),
                    "dimensions": f"{img.width}x{img.height}",
                }
            )
        return images, input_details

    def _open_prepared_image(self, path: str) -> Image.Image:
        img = Image.open(path)
        img = ImageOps.exif_transpose(img)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        max_side = max(img.size)
        target = max(256, int(settings.image_size))
        if max_side > target:
            img.thumbnail((target, target), Image.Resampling.LANCZOS)
        return img

    def _safe_size(self, path: str) -> str:
        try:
            n = os.path.getsize(path)
        except Exception:
            return "?"
        units = [(1 << 30, "GB"), (1 << 20, "MB"), (1 << 10, "KB")]
        for div, name in units:
            if n >= div:
                return f"{n/div:.2f}{name}"
        return f"{n}B"


class LocalOutputWriter:
    def __init__(
        self,
        *,
        output_dir: Optional[str] = None,
        timestamp_factory=lambda: datetime.now(),
        filename_builder=None,
    ) -> None:
        self._output_dir = output_dir or settings.offspring_dir
        self._timestamp_factory = timestamp_factory
        self._filename_builder = filename_builder or self._default_filename_builder

    def write(
        self,
        img: Image.Image,
        *,
        output_format: Optional[str],
        output_width: Optional[int],
        output_height: Optional[int],
        output_max_side: Optional[int],
        resize_mode: Optional[str],
        input_details: List[dict],
    ) -> Tuple[str, str, int, int]:
        resized = self._resize_image(
            img,
            output_format=output_format,
            output_width=output_width,
            output_height=output_height,
            output_max_side=output_max_side,
            resize_mode=resize_mode,
        )
        return self._write_output(resized, output_format=output_format, input_details=input_details)

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
        output_path = os.path.join(self._output_dir, filename)

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

    def _default_filename_builder(self, fmt: str, timestamp: datetime) -> str:
        base = timestamp.strftime("%Y%m%d_%H%M%S")
        suffix = int(time.time() * 1000) % 1000
        return f"offspring_{base}_{suffix:03d}.{fmt}"


__all__ = [
    "ImagePreprocessor",
    "OutputWriter",
    "DefaultImagePreprocessor",
    "LocalOutputWriter",
]
