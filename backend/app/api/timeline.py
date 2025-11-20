from fastapi import APIRouter, Body, HTTPException, Query

from ..models.schemas import TimelinePlayRequest, TimelineStopRequest
from ..models.iframe_timeline import IframeTimeline
from ..services.iframe_config import sanitize_client_id
from ..services.iframe_timeline import (
    clone_iframe_timeline_definition,
    delete_iframe_timeline_definition,
    list_iframe_timelines,
    load_iframe_timeline_definition,
    resolve_iframe_timeline,
    save_iframe_timeline_definition,
    sanitize_timeline_id,
)
from ..services.realtime_bus import realtime_broadcaster

router = APIRouter()


def _raw_timeline_payload(timeline: IframeTimeline) -> dict:
    raw = timeline.model_dump(mode="json", by_alias=True)
    if timeline.client_id and not raw.get("clientId"):
        raw["clientId"] = timeline.client_id
    return raw


@router.get("/api/iframe-timelines")
def api_list_iframe_timelines(client: str | None = Query(default=None)) -> dict:
    try:
        timelines = list_iframe_timelines(client)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"timelines": timelines}


@router.get("/api/iframe-timelines/{timeline_id}")
def api_get_iframe_timeline(timeline_id: str, resolve: bool = Query(default=True)) -> dict:
    try:
        timeline = load_iframe_timeline_definition(timeline_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not resolve:
        return {"timeline": _raw_timeline_payload(timeline)}
    resolved = resolve_iframe_timeline(timeline)
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


@router.post("/api/iframe-timelines", status_code=201)
def api_create_iframe_timeline(body: dict = Body(...), resolve: bool = Query(default=True)) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    try:
        timeline = save_iframe_timeline_definition(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not resolve:
        return {"timeline": _raw_timeline_payload(timeline)}
    resolved = resolve_iframe_timeline(timeline)
    return {"timeline": resolved.to_payload()}


@router.put("/api/iframe-timelines/{timeline_id}")
def api_update_iframe_timeline(
    timeline_id: str,
    body: dict = Body(...),
    resolve: bool = Query(default=True),
) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    try:
        timeline = save_iframe_timeline_definition(body, timeline_id=timeline_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not resolve:
        return {"timeline": _raw_timeline_payload(timeline)}
    resolved = resolve_iframe_timeline(timeline)
    return {"timeline": resolved.to_payload()}


@router.delete("/api/iframe-timelines/{timeline_id}")
def api_delete_iframe_timeline(timeline_id: str) -> dict:
    try:
        delete_iframe_timeline_definition(timeline_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "deleted", "timeline_id": sanitize_timeline_id(timeline_id)}


@router.post("/api/iframe-timelines/{timeline_id}/clone", status_code=201)
def api_clone_iframe_timeline(
    timeline_id: str,
    body: dict = Body(...),
    resolve: bool = Query(default=True),
) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    new_id = body.get("new_id") or body.get("newId")
    if not new_id or not isinstance(new_id, str):
        raise HTTPException(status_code=400, detail="new_id 必須提供")
    target_client = body.get("target_client_id") or body.get("targetClientId")
    try:
        timeline = clone_iframe_timeline_definition(timeline_id, new_id, target_client)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not resolve:
        return {"timeline": _raw_timeline_payload(timeline)}
    resolved = resolve_iframe_timeline(timeline)
    return {"timeline": resolved.to_payload()}


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
