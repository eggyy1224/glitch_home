from fastapi import APIRouter, Body, HTTPException, Query

from ..models.schemas import TimelinePlayRequest, TimelineStopRequest
from ..services.iframe_config import sanitize_client_id
from ..services.iframe_timeline import (
    list_iframe_timelines,
    load_iframe_timeline_definition,
    resolve_iframe_timeline,
    sanitize_timeline_id,
)
from ..services.realtime_bus import realtime_broadcaster

router = APIRouter()


@router.get("/api/iframe-timelines")
def api_list_iframe_timelines(client: str | None = Query(default=None)) -> dict:
    try:
        timelines = list_iframe_timelines(client)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"timelines": timelines}


@router.get("/api/iframe-timelines/{timeline_id}")
def api_get_iframe_timeline(timeline_id: str) -> dict:
    try:
        timeline = load_iframe_timeline_definition(timeline_id)
        resolved = resolve_iframe_timeline(timeline)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"timeline": resolved.to_payload()}


@router.post("/api/iframe-timelines/{timeline_id}/play")
async def api_play_iframe_timeline(
    timeline_id: str,
    body: TimelinePlayRequest | None = Body(default=None),
    target_client_id: str | None = Query(default=None),
) -> dict:
    try:
        timeline = load_iframe_timeline_definition(timeline_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    request_payload = body or TimelinePlayRequest()
    explicit_target = target_client_id or request_payload.target_client_id
    try:
        resolved_target = sanitize_client_id(explicit_target) or sanitize_client_id(timeline.client_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not resolved_target:
        raise HTTPException(status_code=400, detail="timeline 缺少 client_id，請在 body 或 query 指定 target_client_id")

    options: dict[str, object] = {
        "autoPlay": request_payload.auto_play,
        "forceIframeMode": request_payload.force_iframe_mode,
    }
    if request_payload.start_step is not None:
        options["startStep"] = max(0, int(request_payload.start_step))
    if request_payload.loop_override is not None:
        options["loop"] = bool(request_payload.loop_override)
    if request_payload.command_id:
        options["commandId"] = request_payload.command_id

    await realtime_broadcaster.broadcast_timeline_control(
        action="play",
        timeline_id=timeline.id,
        target_client_id=resolved_target,
        options=options,
    )
    return {
        "status": "queued",
        "timeline_id": timeline.id,
        "target_client_id": resolved_target,
        "options": options,
    }


@router.post("/api/iframe-timelines/stop")
async def api_stop_iframe_timeline(
    body: TimelineStopRequest | None = Body(default=None),
    target_client_id: str | None = Query(default=None),
) -> dict:
    payload = body or TimelineStopRequest()
    try:
        resolved_target = sanitize_client_id(target_client_id or payload.target_client_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not resolved_target:
        raise HTTPException(status_code=400, detail="target_client_id 必須提供")

    resolved_timeline_id = None
    if payload.timeline_id:
        try:
            resolved_timeline_id = sanitize_timeline_id(payload.timeline_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    options: dict[str, object] = {"releaseControl": payload.release_control}
    if payload.command_id:
        options["commandId"] = payload.command_id

    await realtime_broadcaster.broadcast_timeline_control(
        action="stop",
        timeline_id=resolved_timeline_id,
        target_client_id=resolved_target,
        options=options,
    )
    return {
        "status": "queued",
        "timeline_id": resolved_timeline_id,
        "target_client_id": resolved_target,
        "options": options,
    }
