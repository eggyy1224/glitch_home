from __future__ import annotations

import asyncio
import os
from pathlib import Path

from fastapi import APIRouter, Body, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from ..config import settings
from ..models.schemas import GenerateCollageVersionRequest, GenerateCollageVersionResponse
from ..services.collage_version import generate_collage_version, task_manager

router = APIRouter()


@router.post("/api/generate-collage-version", response_model=GenerateCollageVersionResponse, status_code=202)
async def api_generate_collage_version(
    body: dict = Body(...),
) -> JSONResponse:
    """Generate collage version from multiple images by filename."""
    image_names = body.get("image_names", [])
    params_dict = {k: v for k, v in body.items() if k != "image_names"}

    try:
        request_params = GenerateCollageVersionRequest(**params_dict)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"參數驗證失敗: {exc}") from exc

    if not image_names:
        raise HTTPException(status_code=400, detail="至少需要 1 張圖片")
    single_image_allowed = (request_params.mode == "rotate-90") or request_params.allow_self
    if len(image_names) < 2 and not single_image_allowed:
        raise HTTPException(status_code=400, detail="至少需要 2 張圖片")

    image_paths = []
    for name in image_names:
        safe_name = os.path.basename(name)
        image_path = Path(settings.offspring_dir) / safe_name
        if not image_path.exists():
            raise HTTPException(status_code=404, detail=f"圖片不存在: {safe_name}")
        image_paths.append(str(image_path))

    task_id = task_manager.create_task()

    async def run_generation_task() -> None:
        def progress_callback(progress: int, stage: str, message: str):
            task_manager.update_progress(task_id, progress, stage, message)

        try:
            result = await run_in_threadpool(
                generate_collage_version,
                image_paths,
                request_params.rows,
                request_params.cols,
                request_params.mode,
                request_params.base,
                request_params.allow_self,
                request_params.resize_w,
                request_params.pad_px,
                request_params.jitter_px,
                request_params.rotate_deg,
                request_params.format,
                request_params.quality,
                request_params.seed,
                request_params.return_map,
                progress_callback,
            )
            task_manager.complete_task(task_id, result)
        except ValueError as exc:
            task_manager.fail_task(task_id, str(exc))
        except Exception as exc:  # noqa: BLE001
            task_manager.fail_task(task_id, str(exc))

    asyncio.create_task(run_generation_task())

    return JSONResponse(
        status_code=202,
        content={
            "task_id": task_id,
            "output_image_path": None,
            "metadata_path": None,
            "output_image": None,
            "parents": None,
            "output_format": None,
            "width": None,
            "height": None,
            "tile_mapping": None,
        }
    )


@router.get("/api/collage-version/{task_id}/progress")
async def api_get_collage_progress(task_id: str) -> dict:
    """Get progress of collage generation task."""
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任務不存在或已過期")

    response = {
        "task_id": task_id,
        "progress": task["progress"],
        "stage": task["stage"],
        "message": task["message"],
        "completed": task["completed"],
    }

    if task["completed"]:
        if task["error"]:
            response["error"] = task["error"]
        else:
            result = task["result"]
            if result:
                response.update(result)

    return response
