from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, Body, HTTPException, Query
from fastapi.responses import JSONResponse

from ..config import settings
from ..models.schemas import GenerateMixTwoRequest, GenerateMixTwoResponse
from ..services.gemini_image import generate_mixed_offspring, generate_mixed_offspring_v2

router = APIRouter()


@router.post("/api/generate/mix-two", response_model=GenerateMixTwoResponse, status_code=201)
def api_generate_mix_two(
    count: int | None = Query(None, ge=2, description="When body not provided, how many parents to sample"),
    body: GenerateMixTwoRequest | None = Body(default=None),
):
    """Backward-compatible endpoint with expanded options."""
    try:
        if body is None:
            result = generate_mixed_offspring(count=count or 2)
        else:
            result = generate_mixed_offspring_v2(
                parents=body.parents,
                count=body.count if body.count is not None else (count or 2),
                prompt=body.prompt,
                strength=body.strength,
                output_format=body.output_format,
                output_width=body.output_width,
                output_height=body.output_height,
                output_max_side=body.output_max_side,
                resize_mode=body.resize_mode,
            )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return JSONResponse(status_code=201, content=result)


@router.get("/api/offspring-images")
def api_list_offspring_images() -> dict:
    """List all images in offspring_images directory."""
    image_dir = Path(settings.offspring_dir)
    if not image_dir.exists():
        return {"images": []}

    images = []
    for path in sorted(image_dir.iterdir()):
        if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
            images.append({
                "filename": path.name,
                "url": f"/generated_images/{path.name}",
            })

    return {"images": images}
