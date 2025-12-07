from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from ..config import settings
from ..exceptions import ExternalServiceError, GenerationIOError
from ..models.schemas import GenerateMixTwoRequest, GenerateMixTwoResponse
from ..services.gemini_image import generate_mixed_offspring, generate_mixed_offspring_v2
from ..services.image_cache import image_cache
from ..utils.permissions import require_generation_enabled

router = APIRouter()
logger = logging.getLogger(__name__)
GENERIC_ERROR_MESSAGE = "伺服器發生非預期錯誤，請稍後再試"


@router.post("/api/generate/mix-two", response_model=GenerateMixTwoResponse, status_code=201)
def api_generate_mix_two(
    count: int | None = Query(None, ge=2, description="When body not provided, how many parents to sample"),
    body: GenerateMixTwoRequest | None = Body(default=None),
    _: None = Depends(require_generation_enabled),
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
        
        # Optimistically update cache
        if "output_image_path" in result:
            # We only need the filename
            import os
            filename = os.path.basename(result["output_image_path"])
            image_cache.add_image(filename)

    except ValueError as exc:
        logger.info("mix-two 驗證失敗：%s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ExternalServiceError as exc:
        logger.error("mix-two 外部服務錯誤：%s", exc.log_message, exc_info=True)
        raise HTTPException(status_code=502, detail=exc.user_message) from exc
    except GenerationIOError as exc:
        logger.error("mix-two I/O 錯誤：%s", exc.log_message, exc_info=True)
        raise HTTPException(status_code=503, detail=exc.user_message) from exc
    except Exception as exc:  # noqa: BLE001 - surface as 500
        logger.exception("mix-two 發生非預期錯誤")
        raise HTTPException(status_code=500, detail=GENERIC_ERROR_MESSAGE) from exc

    return JSONResponse(status_code=201, content=result)


@router.get("/api/offspring-images")
def api_list_offspring_images() -> dict:
    """List all images in offspring_images directory using cached service."""
    return {"images": image_cache.get_images()}
