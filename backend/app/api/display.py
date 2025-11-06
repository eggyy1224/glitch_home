"""Display state management API for admin console."""

from __future__ import annotations

import re
from typing import Any, Optional

from fastapi import APIRouter, Body, HTTPException, Path, Query
from fastapi.responses import Response

from ..models.display_state import (
    CollageConfigRequest,
    DisplayStatePayload,
    DisplayStateResponse,
    DisplayStateUpdateRequest,
)
from ..services.display_state import display_state_manager

router = APIRouter()

_CLIENT_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


def _sanitize_client_id(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    if not _CLIENT_ID_PATTERN.fullmatch(cleaned):
        raise HTTPException(status_code=400, detail="client_id 僅允許字母、數字、底線與連字號")
    return cleaned


async def _build_response(client_id: Optional[str]) -> DisplayStateResponse:
    snapshot = await display_state_manager.get_state(client_id)
    state = snapshot.get("state")
    if isinstance(state, DisplayStatePayload):
        state_payload = state
    elif state is None:
        state_payload = None
    else:
        state_payload = DisplayStatePayload(**state)
    return DisplayStateResponse(
        client_id=snapshot.get("client_id"),
        state=state_payload,
        updated_at=snapshot.get("updated_at"),
        expires_at=snapshot.get("expires_at"),
    )


@router.get("/api/display", response_model=DisplayStateResponse)
async def api_get_display_state(client: Optional[str] = Query(default=None)) -> DisplayStateResponse:
    client_id = _sanitize_client_id(client)
    return await _build_response(client_id)


@router.post("/api/display", response_model=DisplayStateResponse)
async def api_set_display_state(
    body: DisplayStateUpdateRequest = Body(...),
    target_client: Optional[str] = Query(default=None, alias="target_client_id"),
) -> DisplayStateResponse:
    target_client_id = _sanitize_client_id(target_client)
    payload = DisplayStatePayload(**body.model_dump(exclude={"expires_in"}))
    result = await display_state_manager.set_state(target_client_id, payload, expires_in=body.expires_in)
    return DisplayStateResponse(
        client_id=result.get("client_id"),
        state=result.get("state"),
        updated_at=result.get("updated_at"),
        expires_at=result.get("expires_at"),
    )


@router.delete("/api/display", response_class=Response)
async def api_clear_display_state(client: Optional[str] = Query(default=None)) -> Response:
    client_id = _sanitize_client_id(client)
    await display_state_manager.clear_state(client_id)
    return Response(status_code=204)


@router.get(
    "/api/clients/{client_id}/display",
    response_model=DisplayStateResponse,
)
async def api_get_client_display_state(client_id: str = Path(..., min_length=1)) -> DisplayStateResponse:
    cleaned = _sanitize_client_id(client_id)
    return await _build_response(cleaned)


@router.post(
    "/api/clients/{client_id}/display",
    response_model=DisplayStateResponse,
)
async def api_set_client_display_state(
    client_id: str = Path(..., min_length=1),
    body: DisplayStateUpdateRequest = Body(...),
) -> DisplayStateResponse:
    cleaned = _sanitize_client_id(client_id)
    payload = DisplayStatePayload(**body.model_dump(exclude={"expires_in"}))
    result = await display_state_manager.set_state(cleaned, payload, expires_in=body.expires_in)
    return DisplayStateResponse(
        client_id=result.get("client_id"),
        state=result.get("state"),
        updated_at=result.get("updated_at"),
        expires_at=result.get("expires_at"),
    )


@router.delete(
    "/api/clients/{client_id}/display",
    response_class=Response,
)
async def api_clear_client_display_state(client_id: str = Path(..., min_length=1)) -> Response:
    cleaned = _sanitize_client_id(client_id)
    await display_state_manager.clear_state(cleaned)
    return Response(status_code=204)


@router.post(
    "/api/clients/{client_id}/collage",
    response_model=DisplayStateResponse,
)
async def api_set_client_collage(
    client_id: str = Path(..., min_length=1),
    body: CollageConfigRequest = Body(...),
) -> DisplayStateResponse:
    cleaned = _sanitize_client_id(client_id)
    params: dict[str, Any] = {
        "images": body.images,
        "rows": body.rows,
        "cols": body.cols,
        "mix": body.mix,
    }
    if body.shuffle_seed is not None:
        params["shuffle_seed"] = body.shuffle_seed
    if body.stage_width is not None:
        params["stage_width"] = body.stage_width
    if body.stage_height is not None:
        params["stage_height"] = body.stage_height
    if body.params:
        params.update(body.params)

    payload = DisplayStatePayload(mode="collage", params=params)
    result = await display_state_manager.set_state(cleaned, payload, expires_in=None)
    return DisplayStateResponse(
        client_id=result.get("client_id"),
        state=result.get("state"),
        updated_at=result.get("updated_at"),
        expires_at=result.get("expires_at"),
    )
