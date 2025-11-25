from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel, Field

from ..services.client_queue import client_queue_manager, client_state_store

router = APIRouter()


class QueueCreateRequest(BaseModel):
    client_id: str = Field(..., description="目標 client id")
    type: str = Field(..., description="佇列類型 snapshot|timeline|episode")
    target_id: str = Field(..., description="要播放/執行的目標 id")
    eta: datetime | float | int | None = Field(default=None, description="預定時間（ISO 或秒數）")
    priority: int | None = Field(default=None, description="整數優先權，越高越早執行")
    retries: int | None = Field(default=0, ge=0, description="失敗時重試次數")
    payload: dict[str, Any] | None = Field(default=None, description="類型特定的額外參數")


class BatchIdsRequest(BaseModel):
    ids: List[str] | None = Field(default=None, description="可選，覆寫 path id 的批次清單")


class DelayRequest(BatchIdsRequest):
    delta_seconds: float | None = Field(default=None, description="延後秒數")
    eta: datetime | float | int | str | None = Field(default=None, description="新 ETA（ISO/秒數）")


class MoveRequest(BatchIdsRequest):
    priority: int | None = Field(default=None, description="新的優先權值")
    position: str | None = Field(default=None, description="front/back，快速插隊或放到尾端")


def _collect_ids(path_id: str, body_ids: Optional[List[str]]) -> List[str]:
    ids: List[str] = []
    if path_id:
        ids.append(path_id)
    if body_ids:
        ids.extend([raw for raw in body_ids if raw])
    return list(dict.fromkeys(ids))


@router.get("/api/clients/state")
async def api_get_client_state() -> dict:
    clients = await client_state_store.snapshot()
    return {"clients": clients}


@router.get("/api/clients/queue")
async def api_get_client_queue(
    client: str = Query(..., description="目標 client id"),
    status: str | None = Query(default=None, description="可選狀態過濾，逗號分隔"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict:
    try:
        queue = await client_queue_manager.list_queue(
            client,
            status_filter=status,
            page=page,
            limit=limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return queue


@router.post("/api/clients/queue", status_code=201)
async def api_enqueue_queue_item(body: QueueCreateRequest) -> dict:
    try:
        item = await client_queue_manager.enqueue(
            client_id=body.client_id,
            item_type=body.type,
            target_id=body.target_id,
            eta=body.eta,
            priority=body.priority,
            retries=body.retries,
            payload=body.payload,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"item": item}


@router.post("/api/clients/queue/{item_id}/cancel")
async def api_cancel_queue_item(
    item_id: str,
    body: BatchIdsRequest | None = Body(default=None),
) -> dict:
    ids = _collect_ids(item_id, body.ids if body else None)
    canceled = await client_queue_manager.cancel_items(ids)
    return {"canceled": canceled}


@router.post("/api/clients/queue/{item_id}/delay")
async def api_delay_queue_item(
    item_id: str,
    body: DelayRequest | None = Body(default=None),
) -> dict:
    ids = _collect_ids(item_id, body.ids if body else None)
    try:
        delayed = await client_queue_manager.delay_items(
            ids,
            delta_seconds=body.delta_seconds if body else None,
            eta=body.eta if body else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"delayed": delayed}


@router.post("/api/clients/queue/{item_id}/move")
async def api_move_queue_item(
    item_id: str,
    body: MoveRequest | None = Body(default=None),
) -> dict:
    ids = _collect_ids(item_id, body.ids if body else None)
    try:
        moved = await client_queue_manager.move_items(
            ids,
            priority=body.priority if body else None,
            position=body.position if body else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"moved": moved}
