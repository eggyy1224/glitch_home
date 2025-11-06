"""Storage and configuration related API endpoints."""

from __future__ import annotations

import os

from fastapi import APIRouter, Body, File, Form, HTTPException, Query, UploadFile, Response

from ..models.schemas import CameraPreset, SaveCameraPresetRequest
from ..services.camera_presets import delete_camera_preset, list_camera_presets, upsert_camera_preset
from ..services.iframe_config import (
    config_payload_for_response,
    load_iframe_config,
    save_iframe_config,
)
from ..services.screenshot_requests import screenshot_requests_manager
from ..services.screenshots import save_screenshot

router = APIRouter()


@router.get("/api/iframe-config")
def api_get_iframe_config(client: str | None = Query(default=None)) -> dict:
    try:
        config = load_iframe_config(client)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return config_payload_for_response(config, client)


@router.get("/api/container-layout")
def api_get_container_layout(client: str | None = Query(default=None)) -> dict:
    """Alias for iframe-config，方便新的控制台語意。"""
    return api_get_iframe_config(client)


@router.put("/api/iframe-config")
async def api_put_iframe_config(body: dict = Body(...)) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    try:
        config, target_client_id = save_iframe_config(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    payload = config_payload_for_response(config, target_client_id)
    await screenshot_requests_manager.broadcast_iframe_config(payload, target_client_id=target_client_id)
    await screenshot_requests_manager.broadcast_container_layout(payload, target_client_id=target_client_id)
    return payload


@router.put("/api/container-layout")
async def api_put_container_layout(body: dict = Body(...)) -> dict:
    """Alias for iframe-config 更新，維持新命名語意。"""
    return await api_put_iframe_config(body)


@router.get("/api/camera-presets", response_model=list[CameraPreset])
def api_list_camera_presets() -> list[CameraPreset]:
    presets = list_camera_presets()
    return presets


@router.post("/api/camera-presets", response_model=CameraPreset, status_code=201)
def api_save_camera_preset(body: SaveCameraPresetRequest) -> CameraPreset:
    try:
        saved = upsert_camera_preset(body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return saved


@router.delete("/api/camera-presets/{name}", status_code=204)
def api_delete_camera_preset(name: str) -> Response:
    cleaned = name.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="name is required")
    if any(sep in cleaned for sep in ("/", "\\", ":", "*", "?", '"', "<", ">", "|")):
        raise HTTPException(status_code=400, detail="invalid name")
    deleted = delete_camera_preset(cleaned)
    if not deleted:
        raise HTTPException(status_code=404, detail="preset not found")
    return Response(status_code=204)


@router.post("/api/screenshots", status_code=201)
async def api_upload_screenshot(
    request_id: str | None = Form(default=None),
    client_id: str | None = Form(default=None),
    file: UploadFile = File(...),
) -> dict:
    try:
        saved = save_screenshot(file)
    except ValueError as exc:
        if request_id:
            await screenshot_requests_manager.mark_failed(request_id, str(exc), processed_by=client_id)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface as 500
        if request_id:
            await screenshot_requests_manager.mark_failed(
                request_id,
                "failed to save screenshot",
                processed_by=client_id,
            )
        raise HTTPException(status_code=500, detail="failed to save screenshot") from exc

    record = None
    if request_id:
        record = await screenshot_requests_manager.mark_completed(
            request_id,
            saved,
            processed_by=client_id,
        )
        if record is None:
            try:
                os.remove(saved["absolute_path"])
            except OSError:
                pass
            raise HTTPException(status_code=404, detail="screenshot request not found")

    return {
        "filename": saved["filename"],
        "original_filename": saved["original_filename"],
        "absolute_path": saved["absolute_path"],
        "relative_path": saved.get("relative_path"),
        "request_id": request_id,
        "status": record["status"] if record else None,
        "processed_by": record.get("processed_by") if record else client_id,
    }
