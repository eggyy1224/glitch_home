from fastapi import APIRouter, Body, Depends, HTTPException, Query

from ..models.schemas import TimelinePlayRequest, TimelineStopRequest
from ..models.iframe_timeline import IframeTimeline
from ..services.iframe_config import sanitize_client_id
from ..services.iframe_timeline import (
    clone_iframe_timeline_definition,
    delete_iframe_timeline_definition,
    list_iframe_timelines,
    list_iframe_timeline_versions,
    load_iframe_timeline_definition,
    publish_iframe_timeline,
    resolve_iframe_timeline,
    rollback_iframe_timeline,
    save_iframe_timeline_definition,
    sanitize_timeline_id,
)
from ..services.realtime_bus import realtime_broadcaster
from ..utils.permissions import ensure_metadata_write_enabled, require_metadata_write_enabled

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
def api_get_iframe_timeline(
    timeline_id: str, resolve: bool = Query(default=True), version: int | None = Query(default=None)
) -> dict:
    try:
        timeline = load_iframe_timeline_definition(timeline_id, version=version)
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
    allow_draft: bool = Query(default=False),
    version: int | None = Query(default=None),
) -> dict:
    if allow_draft:
        ensure_metadata_write_enabled("iframe_timeline_play_draft")
    try:
        if version is None:
            timeline = load_iframe_timeline_definition(timeline_id)
        else:
            timeline = load_iframe_timeline_definition(timeline_id, version=version)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    status = getattr(timeline, "status", None)
    if status is None and isinstance(timeline, dict):
        status = timeline.get("status")

    if not allow_draft and (status or "published") != "published":
        raise HTTPException(status_code=400, detail="僅允許播放已發布的 timeline，或設定 allow_draft=true")

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
def api_create_iframe_timeline(
    body: dict = Body(...),
    resolve: bool = Query(default=True),
    expected_version: int | None = Query(default=None),
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    try:
        candidate_id = body.get("id")
        if not candidate_id or not isinstance(candidate_id, str):
            raise ValueError("timeline id 必填")
        safe_id = sanitize_timeline_id(candidate_id)
        payload = {**body, "id": safe_id}
        timeline_model = IframeTimeline.model_validate(payload)
        resolve_iframe_timeline(timeline_model)
        timeline = save_iframe_timeline_definition(
            timeline_model.model_dump(mode="json", by_alias=True), expected_version=expected_version
        )
    except ValueError as exc:
        message = str(exc)
        status_code = 409 if "版本不符" in message else 400
        raise HTTPException(status_code=status_code, detail=message) from exc
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
    expected_version: int | None = Query(default=None),
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    try:
        safe_id = sanitize_timeline_id(timeline_id)
        payload = {**body, "id": safe_id}
        timeline_model = IframeTimeline.model_validate(payload)
        resolve_iframe_timeline(timeline_model)
        timeline = save_iframe_timeline_definition(
            timeline_model.model_dump(mode="json", by_alias=True),
            timeline_id=timeline_id,
            expected_version=expected_version,
        )
    except ValueError as exc:
        message = str(exc)
        status_code = 409 if "版本不符" in message else 400
        raise HTTPException(status_code=status_code, detail=message) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not resolve:
        return {"timeline": _raw_timeline_payload(timeline)}
    resolved = resolve_iframe_timeline(timeline)
    return {"timeline": resolved.to_payload()}


@router.delete("/api/iframe-timelines/{timeline_id}")
def api_delete_iframe_timeline(
    timeline_id: str,
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
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
    _: None = Depends(require_metadata_write_enabled),
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


@router.get("/api/iframe-timelines/{timeline_id}/versions")
def api_list_iframe_timeline_versions(timeline_id: str) -> dict:
    try:
        safe_id = sanitize_timeline_id(timeline_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    versions = list_iframe_timeline_versions(safe_id)
    return {"timeline_id": safe_id, "versions": versions}


@router.post("/api/iframe-timelines/{timeline_id}/publish")
def api_publish_iframe_timeline(
    timeline_id: str,
    body: dict | None = Body(default=None),
    expected_version: int | None = Query(default=None),
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    publish_as = None
    if body and isinstance(body, dict):
        publish_as = body.get("publish_as") or body.get("publishAs")
    try:
        timeline = publish_iframe_timeline(timeline_id, publish_as=publish_as, expected_version=expected_version)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409 if "版本不符" in str(exc) else 400, detail=str(exc)) from exc
    return {"timeline": _raw_timeline_payload(timeline)}


@router.post("/api/iframe-timelines/{timeline_id}/rollback")
def api_rollback_iframe_timeline(
    timeline_id: str,
    body: dict = Body(...),
    expected_version: int | None = Query(default=None),
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    target_version = body.get("version")
    if not target_version:
        raise HTTPException(status_code=400, detail="version 必須提供")
    publish_as = body.get("publish_as") or body.get("publishAs")
    try:
        timeline = rollback_iframe_timeline(
            timeline_id, int(target_version), publish_as=publish_as, expected_version=expected_version
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409 if "版本不符" in str(exc) else 400, detail=str(exc)) from exc
    return {"timeline": _raw_timeline_payload(timeline)}


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
