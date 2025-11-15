"""Realtime APIs handling live updates and websocket connections."""

from __future__ import annotations

import json

from fastapi import APIRouter, Body, HTTPException, Query, Response, WebSocket, WebSocketDisconnect

from ..models.schemas import SubtitleUpdateRequest
from ..services.captions import caption_manager
from ..services.realtime_bus import realtime_broadcaster
from ..services.screenshot_queue import screenshot_request_queue
from ..services.subtitles import subtitle_manager

router = APIRouter()


@router.get("/api/clients")
async def api_list_clients() -> dict:
    clients = await realtime_broadcaster.list_clients()
    return {"clients": clients}


@router.get("/api/subtitles")
async def api_get_subtitles(client: str | None = Query(default=None)) -> dict:
    subtitle = await subtitle_manager.get_subtitle(client_id=client)
    return {"subtitle": subtitle}


@router.post("/api/subtitles", status_code=202)
async def api_set_subtitles(body: SubtitleUpdateRequest, target_client_id: str | None = Query(default=None)) -> dict:
    try:
        subtitle = await subtitle_manager.set_subtitle(
            body.text,
            language=body.language,
            duration_seconds=body.duration_seconds,
            target_client_id=target_client_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await realtime_broadcaster.broadcast_subtitle(subtitle, target_client_id=target_client_id)
    return {"subtitle": subtitle}


@router.delete("/api/subtitles", status_code=204)
async def api_clear_subtitles(target_client_id: str | None = Query(default=None)) -> Response:
    await subtitle_manager.clear_subtitle(target_client_id=target_client_id)
    await realtime_broadcaster.broadcast_subtitle(None, target_client_id=target_client_id)
    return Response(status_code=204)


@router.get("/api/captions")
async def api_get_captions(client: str | None = Query(default=None)) -> dict:
    caption = await caption_manager.get_caption(client_id=client)
    return {"caption": caption}


@router.post("/api/captions", status_code=202)
async def api_set_captions(body: SubtitleUpdateRequest, target_client_id: str | None = Query(default=None)) -> dict:
    try:
        caption = await caption_manager.set_caption(
            body.text,
            language=body.language,
            duration_seconds=body.duration_seconds,
            target_client_id=target_client_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await realtime_broadcaster.broadcast_caption(caption, target_client_id=target_client_id)
    return {"caption": caption}


@router.delete("/api/captions", status_code=204)
async def api_clear_captions(target_client_id: str | None = Query(default=None)) -> Response:
    await caption_manager.clear_caption(target_client_id=target_client_id)
    await realtime_broadcaster.broadcast_caption(None, target_client_id=target_client_id)
    return Response(status_code=204)


@router.post("/api/screenshots/request", status_code=202)
async def api_create_screenshot_request(body: dict | None = Body(default=None)) -> dict:
    record = await screenshot_request_queue.create_request(metadata=body or {})
    return record


@router.get("/api/screenshots/{request_id}")
async def api_get_screenshot_request(request_id: str) -> dict:
    record = await screenshot_request_queue.get_request(request_id)
    if record is None:
        raise HTTPException(status_code=404, detail="screenshot request not found")
    return record


@router.post("/api/screenshots/{request_id}/fail", status_code=200)
async def api_fail_screenshot_request(request_id: str, body: dict | None = Body(default=None)) -> dict:
    message = ""
    client_id = None
    if body and isinstance(body, dict):
        message = str(body.get("error", ""))
        if body.get("client_id") is not None:
            client_id_raw = body.get("client_id")
            client_id = str(client_id_raw).strip() or None
    record = await screenshot_request_queue.mark_failed(
        request_id,
        message or "client reported failure",
        processed_by=client_id,
    )
    if record is None:
        raise HTTPException(status_code=404, detail="screenshot request not found")
    return record


@router.websocket("/ws/screenshots")
async def websocket_screenshots(websocket: WebSocket) -> None:
    await realtime_broadcaster.add_connection(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = message.get("type")
            if msg_type == "hello":
                client_id_raw = message.get("client_id")
                client_id = None
                if isinstance(client_id_raw, str):
                    client_id = client_id_raw.strip() or None
                await realtime_broadcaster.register_client(websocket, client_id)
                pending = await screenshot_request_queue.list_pending_messages(client_id)
                await realtime_broadcaster.send_messages(websocket, pending)
    except WebSocketDisconnect:
        await realtime_broadcaster.remove_connection(websocket)
    except Exception:
        await realtime_broadcaster.remove_connection(websocket)
