from fastapi import APIRouter, HTTPException, Query

from ..services.iframe_timeline import (
    list_iframe_timelines,
    load_iframe_timeline_definition,
    resolve_iframe_timeline,
)

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
