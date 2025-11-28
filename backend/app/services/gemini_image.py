import base64
import os
from datetime import datetime, timezone
from io import BytesIO
from typing import List, Optional

from PIL import Image

from ..config import settings
from ..exceptions import ExternalServiceError, GenerationIOError
from ..utils.permissions import (
    ensure_asset_write_enabled,
    ensure_generation_enabled,
    ensure_metadata_write_enabled,
)
from ..utils.fs import ensure_dirs
from ..utils.metadata import write_metadata, validate_metadata_schema
from ..utils.gemini_client import get_gemini_client
from ..models.metadata import GeneratedImageMetadata
from .genes_pool import FilesystemParentSelector, ParentSelector
from .image_outputs import (
    DefaultImagePreprocessor,
    ImagePreprocessor,
    LocalOutputWriter,
    OutputWriter,
    _format_input_diagnostics,
)


class GeminiImageGenerator:
    def __init__(
        self,
        *,
        client=None,
        parent_selector: ParentSelector | None = None,
        image_preprocessor: ImagePreprocessor | None = None,
        output_writer: OutputWriter | None = None,
    ) -> None:
        self._client = client
        self._parent_selector = parent_selector or FilesystemParentSelector()
        self._image_preprocessor = image_preprocessor or DefaultImagePreprocessor()
        self._output_writer = output_writer or LocalOutputWriter()

    @property
    def client(self):
        if self._client is None:
            self._client = get_gemini_client()
        return self._client

    def generate(
        self,
        *,
        parents: Optional[List[str]] = None,
        count: Optional[int] = None,
        prompt: str,
        strength: Optional[float] = None,
        output_format: Optional[str] = None,
        output_width: Optional[int] = None,
        output_height: Optional[int] = None,
        output_max_side: Optional[int] = None,
        resize_mode: Optional[str] = None,
    ) -> dict:
        ensure_generation_enabled("image_generation")
        ensure_asset_write_enabled("image_generation_output")
        ensure_metadata_write_enabled("image_generation_metadata")
        try:
            ensure_dirs([settings.offspring_dir, settings.metadata_dir])
        except OSError as exc:
            raise GenerationIOError(
                "伺服器儲存空間異常，請稍後再試",
                log_message=f"Ensure dirs failed: {exc}",
            ) from exc

        parent_paths = self._parent_selector.select(parents=parents, count=count)
        if len(parent_paths) < 2:
            raise ValueError("父圖至少需要 2 張")

        images, input_details = self._image_preprocessor.prepare(parent_paths)
        generated_image = self._call_gemini(prompt, images, input_details)
        try:
            output_path, fmt, width, height = self._output_writer.write(
                generated_image,
                output_format=output_format,
                output_width=output_width,
                output_height=output_height,
                output_max_side=output_max_side,
                resize_mode=resize_mode,
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
            metadata = validate_metadata_schema(
                metadata,
                model=GeneratedImageMetadata,
                context="image_generation",
            )
            metadata_path = write_metadata(
                metadata, base_name=os.path.splitext(os.path.basename(output_path))[0]
            )
        except OSError as exc:
            raise GenerationIOError(
                "生成檔案時發生 I/O 錯誤，請稍後再試",
                log_message=f"Write output failed: {exc}",
            ) from exc

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
            raise ExternalServiceError(
                "外部影像生成服務呼叫失敗，請稍後再試",
                log_message=f"Gemini call failed: {e}{_format_input_diagnostics(input_details)}",
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
            raise ExternalServiceError(
                "外部影像生成服務回傳異常，請稍後再試",
                log_message=f"Failed to parse Gemini response: {e}{_format_input_diagnostics(input_details)}",
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
            raise ExternalServiceError(
                "外部影像生成服務回傳異常，請稍後再試",
                log_message=f"Unable to parse generated image: {e}{_format_input_diagnostics(input_details)}",
            ) from e


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
            "created_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "output_image": os.path.basename(output_path),
            "output_format": fmt,
            "output_size": {"width": width, "height": height},
        }


def generate_mixed_offspring(count: int = 2) -> dict:
    generator = GeminiImageGenerator()
    prompt = settings.fixed_prompt

    result = generator.generate(
        count=count,
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

    generator = GeminiImageGenerator()

    # Build prompt
    final_prompt = prompt.strip() if (prompt and prompt.strip()) else settings.fixed_prompt
    if strength is not None:
        # Hint-based control; true model-native parameter may be integrated later
        s = max(0.0, min(1.0, float(strength)))
        final_prompt = (
            final_prompt
            + f"\n[Guidance] Use the provided images as references with an image-to-image transformation strength ≈ {s:.2f} (0=loose, 1=strict)."
        )

    result = generator.generate(
        parents=parents,
        count=count,
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
