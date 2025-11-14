"""Storage and configuration related API endpoints."""

from __future__ import annotations

import os

from fastapi import APIRouter, Body, File, Form, HTTPException, Query, UploadFile, Response

from ..models.schemas import CameraPreset, SaveCameraPresetRequest
from ..services.camera_presets import delete_camera_preset, list_camera_presets, upsert_camera_preset
from ..services.collage_config import (
    config_payload_for_response as collage_config_payload_for_response,
    load_collage_config,
    save_collage_config,
)
from ..services.iframe_config import (
    config_payload_for_response as iframe_config_payload_for_response,
    load_iframe_config,
    save_iframe_config,
    save_iframe_config_snapshot,
    list_iframe_config_snapshots,
    restore_iframe_config_snapshot,
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
    return iframe_config_payload_for_response(config, client)


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

    payload = iframe_config_payload_for_response(config, target_client_id)
    await screenshot_requests_manager.broadcast_iframe_config(payload, target_client_id=target_client_id)
    return payload


@router.post("/api/iframe-config/snapshot", status_code=201)
def api_snapshot_iframe_config(body: dict = Body(...)) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    snapshot_name = body.get("snapshot_name")
    client_id = body.get("client_id")
    if snapshot_name is not None and not isinstance(snapshot_name, str):
        raise HTTPException(status_code=400, detail="snapshot_name 必須為字串")
    # snapshot_name 可作為備註描述；實際檔名會加入 client 與時間戳
    if client_id is not None and not isinstance(client_id, str):
        raise HTTPException(status_code=400, detail="client_id 必須為字串")

    try:
        snapshot = save_iframe_config_snapshot(client_id, snapshot_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail="無法建立 snapshot") from exc

    client_value = snapshot.get("client_id")
    snapshot_payload = {
        "name": snapshot.get("name"),
        "created_at": snapshot.get("created_at"),
        "size_bytes": snapshot.get("size_bytes"),
    }
    return {"client_id": client_value, "snapshot": snapshot_payload}


@router.get("/api/iframe-config/snapshots")
def api_list_iframe_config_snapshots(client: str | None = Query(default=None)) -> dict:
    try:
        target_client_id, snapshots = list_iframe_config_snapshots(client)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"client_id": target_client_id, "snapshots": snapshots}


@router.post("/api/iframe-config/restore")
async def api_restore_iframe_config(body: dict = Body(...)) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    snapshot_name = body.get("snapshot_name")
    client_id = body.get("client_id")
    if not isinstance(snapshot_name, str):
        raise HTTPException(status_code=400, detail="snapshot_name 必須為字串")
    if client_id is not None and not isinstance(client_id, str):
        raise HTTPException(status_code=400, detail="client_id 必須為字串")

    try:
        config, target_client_id = restore_iframe_config_snapshot(client_id, snapshot_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail="無法恢復 snapshot") from exc

    payload = iframe_config_payload_for_response(config, target_client_id)
    await screenshot_requests_manager.broadcast_iframe_config(payload, target_client_id=target_client_id)
    return payload


@router.get("/api/collage-config")
def api_get_collage_config(client: str | None = Query(default=None)) -> dict:
    try:
        config, source, owner_client_id, path = load_collage_config(client)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return collage_config_payload_for_response(config, source, owner_client_id, path)


@router.put("/api/collage-config")
async def api_put_collage_config(body: dict = Body(...)) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    try:
        config, source, target_client_id, path = save_collage_config(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    payload = collage_config_payload_for_response(config, source, target_client_id, path)
    await screenshot_requests_manager.broadcast_collage_config(payload, target_client_id=target_client_id)
    return payload


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
