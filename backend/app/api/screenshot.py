from __future__ import annotations

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from ..models.schemas import AnalyzeAndSoundRequest, AnalyzeScreenshotRequest, GenerateSoundRequest
from ..services.image_analysis import analyze_screenshot
from ..services.screenshot_queue import screenshot_request_queue
from ..services.sound_effects import generate_sound_effect
from .screenshot_helpers import build_auto_sound_prompt, resolve_image_and_snapshot

router = APIRouter()


@router.post("/api/analyze-screenshot")
async def api_analyze_screenshot(body: AnalyzeScreenshotRequest) -> dict:
    resolved_path, snapshot_record = await resolve_image_and_snapshot(body.image_path, body.request_id)

    analysis = await run_in_threadpool(analyze_screenshot, str(resolved_path), body.prompt)

    response: dict = {
        "image_path": str(resolved_path),
        "analysis": analysis,
    }

    if body.request_id:
        response["request_id"] = body.request_id
    if snapshot_record:
        response["request_metadata"] = {
            "status": snapshot_record.get("status"),
            "target_client_id": snapshot_record.get("target_client_id"),
            "processed_by": snapshot_record.get("processed_by"),
            "created_at": snapshot_record.get("created_at"),
            "updated_at": snapshot_record.get("updated_at"),
            "metadata": snapshot_record.get("metadata"),
        }

    return response


@router.post("/api/sound-effects")
async def api_generate_sound(body: GenerateSoundRequest) -> dict:
    resolved_path, snapshot_record = await resolve_image_and_snapshot(body.image_path, body.request_id)

    sound_result = await run_in_threadpool(
        generate_sound_effect,
        prompt=body.prompt,
        image_path=str(resolved_path),
        request_id=body.request_id,
        duration_seconds=body.duration_seconds,
        prompt_influence=body.prompt_influence,
        loop=body.loop,
        model_id=body.model_id,
        output_format=body.output_format,
    )

    response: dict = {
        "image_path": str(resolved_path),
        "sound": sound_result,
    }

    if body.request_id:
        updated = await screenshot_request_queue.attach_sound_effect(body.request_id, sound_result)
        response["request_id"] = body.request_id
        if updated:
            response["request_metadata"] = {
                "status": updated.get("status"),
                "target_client_id": updated.get("target_client_id"),
                "processed_by": updated.get("processed_by"),
                "sound_effect": updated.get("sound_effect"),
                "updated_at": updated.get("updated_at"),
            }

    return response


@router.post("/api/screenshot/bundle")
async def api_analyze_and_sound(body: AnalyzeAndSoundRequest) -> dict:
    resolved_path, snapshot_record = await resolve_image_and_snapshot(body.image_path, body.request_id)

    analysis = await run_in_threadpool(analyze_screenshot, str(resolved_path), body.prompt)

    if body.sound_prompt_override and body.sound_prompt_override.strip():
        sound_prompt = body.sound_prompt_override.strip()
    else:
        sound_prompt = build_auto_sound_prompt(analysis, body.sound_duration_seconds)

    sound_result = await run_in_threadpool(
        generate_sound_effect,
        prompt=sound_prompt,
        image_path=str(resolved_path),
        request_id=body.request_id,
        duration_seconds=body.sound_duration_seconds,
        prompt_influence=body.sound_prompt_influence,
        loop=body.sound_loop,
        model_id=body.sound_model_id,
        output_format=body.sound_output_format,
    )

    response: dict = {
        "image_path": str(resolved_path),
        "analysis": analysis,
        "sound": sound_result,
        "used_prompt": sound_prompt,
    }

    if body.request_id:
        updated = await screenshot_request_queue.attach_sound_effect(body.request_id, sound_result)
        response["request_id"] = body.request_id
        if updated:
            response["request_metadata"] = {
                "status": updated.get("status"),
                "target_client_id": updated.get("target_client_id"),
                "processed_by": updated.get("processed_by"),
                "sound_effect": updated.get("sound_effect"),
                "updated_at": updated.get("updated_at"),
            }

    return response
