from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field, ValidationError

from ..services.client_queue import client_queue_manager
from ..services.schedule import (
    ScheduleQueueSpec,
    build_next_schedule_item,
    delete_schedule_definition,
    list_schedule_definitions,
    load_schedule_definition,
    plan_schedule_deploy,
    save_schedule_definition,
)

router = APIRouter()


class ScheduleDeployRequest(BaseModel):
    dry_run: bool = Field(default=False, description="只回傳計畫，不實際入列")
    stagger_seconds: float = Field(default=2.0, ge=0.0, description="同時間同 client 的錯峰秒數")
    skip_duplicates: bool = Field(default=True, description="避免重複入列相同 event")


def _spec_to_payload(spec: ScheduleQueueSpec) -> Dict[str, Any]:
    return {
        "schedule_id": spec.schedule_id,
        "event_id": spec.event_id,
        "client_id": spec.client_id,
        "type": spec.item_type,
        "target_id": spec.target_id,
        "eta": spec.eta.isoformat(),
        "occurs_at": spec.occurs_at.isoformat(),
        "schedule_key": spec.schedule_key,
    }


@router.get("/api/schedules")
def api_list_schedules() -> Dict[str, Any]:
    return {"schedules": list_schedule_definitions()}


@router.get("/api/schedules/{schedule_id}")
def api_get_schedule(schedule_id: str) -> Dict[str, Any]:
    try:
        schedule = load_schedule_definition(schedule_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="schedule not found")
    return {"schedule": schedule.model_dump(mode="json", by_alias=True)}


@router.put("/api/schedules/{schedule_id}")
def api_put_schedule(schedule_id: str, body: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    try:
        schedule = save_schedule_definition(body, schedule_id=schedule_id)
    except (ValueError, ValidationError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"schedule": schedule.model_dump(mode="json", by_alias=True)}


@router.delete("/api/schedules/{schedule_id}")
def api_delete_schedule(schedule_id: str) -> Dict[str, Any]:
    delete_schedule_definition(schedule_id)
    return {"status": "deleted", "schedule_id": schedule_id}


@router.post("/api/schedules/{schedule_id}/deploy")
async def api_deploy_schedule(
    schedule_id: str,
    body: ScheduleDeployRequest | None = Body(default=None),
) -> Dict[str, Any]:
    try:
        schedule = load_schedule_definition(schedule_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="schedule not found")
    request = body or ScheduleDeployRequest()
    specs, skipped = plan_schedule_deploy(
        schedule,
        stagger_seconds=request.stagger_seconds,
        now=datetime.now(timezone.utc),
    )
    planned = [_spec_to_payload(spec) for spec in specs]
    if request.dry_run:
        return {
            "schedule_id": schedule_id,
            "dry_run": True,
            "planned": planned,
            "skipped": [skip.__dict__ for skip in skipped],
        }

    created: List[Dict[str, Any]] = []
    skipped_payloads: List[Dict[str, Any]] = [skip.__dict__ for skip in skipped]
    for spec in specs:
        if request.skip_duplicates:
            has_dup = await client_queue_manager.has_schedule_key(spec.client_id, spec.schedule_key)
            if has_dup:
                skipped_payloads.append({"event_id": spec.event_id, "reason": "duplicate"})
                continue
        item = await client_queue_manager.enqueue(
            client_id=spec.client_id,
            item_type=spec.item_type,
            target_id=spec.target_id,
            eta=spec.eta,
            priority=None,
            retries=0,
            payload=spec.payload,
        )
        created.append({"event_id": spec.event_id, "queue_item": item})
    return {
        "schedule_id": schedule_id,
        "dry_run": False,
        "created": created,
        "skipped": skipped_payloads,
        "planned": planned,
    }


@router.post("/api/schedules/{schedule_id}/events/{event_id}/next")
async def api_schedule_next_event(schedule_id: str, event_id: str) -> Dict[str, Any]:
    spec = build_next_schedule_item(schedule_id, event_id)
    if spec is None:
        raise HTTPException(status_code=404, detail="schedule event not found or disabled")
    if await client_queue_manager.has_schedule_key(spec.client_id, spec.schedule_key):
        return {"status": "duplicate", "planned": _spec_to_payload(spec)}
    item = await client_queue_manager.enqueue(
        client_id=spec.client_id,
        item_type=spec.item_type,
        target_id=spec.target_id,
        eta=spec.eta,
        priority=None,
        retries=0,
        payload=spec.payload,
    )
    return {"status": "queued", "queue_item": item, "planned": _spec_to_payload(spec)}
