import base64
import os
import random
import time
from datetime import datetime
from io import BytesIO
from typing import Tuple, List

from PIL import Image

from ..config import settings
from ..utils.fs import ensure_dirs
from ..utils.metadata import write_metadata
from ..utils.gemini_client import get_gemini_client


def _pick_two_images_from_genes_pool() -> Tuple[str, str]:
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

    if len(all_candidates) < 2:
        raise ValueError("基因池總數不足 2 張圖像，請補圖或調整資料夾")

    return tuple(random.sample(all_candidates, 2))  # type: ignore[return-value]


def _read_image(path: str) -> Image.Image:
    return Image.open(path).convert("RGBA")


def generate_mixed_offspring() -> dict:
    ensure_dirs([settings.offspring_dir, settings.metadata_dir])

    parent_a, parent_b = _pick_two_images_from_genes_pool()

    client = get_gemini_client()

    # Prepare inputs per docs: text prompt + image parts
    prompt = settings.fixed_prompt

    img_a = Image.open(parent_a)
    img_b = Image.open(parent_b)

    response = client.models.generate_content(
        model=settings.model_name,
        contents=[prompt, img_a, img_b],
    )

    # Extract first inline image from response
    image_bytes: bytes | None = None
    for part in response.candidates[0].content.parts:
        if getattr(part, "inline_data", None) is not None:
            image_bytes = part.inline_data.data
            break

    if not image_bytes:
        # Some responses may put bytes under .inlineData (JS naming); the py SDK uses inline_data
        # Fallback: try .text for diagnostic
        texts = []
        for part in response.candidates[0].content.parts:
            if getattr(part, "text", None):
                texts.append(part.text)
        raise RuntimeError(f"Gemini 回傳未包含影像資料: {' '.join(texts) if texts else 'no text'}")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"offspring_{timestamp}_{int(time.time()*1000)%1000:03d}.png"
    output_path = os.path.join(settings.offspring_dir, filename)

    with open(output_path, "wb") as f:
        f.write(image_bytes)

    metadata = {
        "parents": [os.path.basename(parent_a), os.path.basename(parent_b)],
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


