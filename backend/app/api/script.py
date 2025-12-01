from fastapi import APIRouter, Body, Depends, HTTPException, Query

from ..models.scene import AudioMix
from ..models.script import Script
from ..services.script import (
    clone_script_definition,
    delete_script_definition,
    list_scripts,
    load_script_definition,
    play_script,
    resolve_script,
    save_script_definition,
    sanitize_script_id,
    stop_script,
)
from ..utils.permissions import require_metadata_write_enabled

router = APIRouter()


def _raw_script_payload(script: Script) -> dict:
    return script.model_dump(mode="json", by_alias=True)


def _resolve_script_or_error(script: Script):
    try:
        return resolve_script(script)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _build_script_from_payload(body: dict, script_id: str | None = None) -> Script:
    candidate_id = script_id or body.get("id")
    if not candidate_id:
        raise HTTPException(status_code=400, detail="script id 必須提供在 path 或 payload")
    try:
        safe_id = sanitize_script_id(candidate_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    payload = {**body, "id": safe_id}
    try:
        return Script.model_validate(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/scripts")
def api_list_scripts() -> dict:
    scripts = list_scripts()
    return {"scripts": scripts}


@router.get("/api/scripts/{script_id}")
def api_get_script(script_id: str, resolve: bool = Query(default=True)) -> dict:
    try:
        script = load_script_definition(script_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not resolve:
        return {"script": _raw_script_payload(script)}
    return {"script": _resolve_script_or_error(script).to_payload()}


@router.post("/api/scripts", status_code=201)
def api_create_script(
    body: dict = Body(...),
    resolve: bool = Query(default=True),
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    script = _build_script_from_payload(body)
    _resolve_script_or_error(script)  # 驗證引用
    saved = save_script_definition(script.model_dump(mode="json", by_alias=True))
    if not resolve:
        return {"script": _raw_script_payload(saved)}
    return {"script": _resolve_script_or_error(saved).to_payload()}


@router.put("/api/scripts/{script_id}")
def api_update_script(
    script_id: str,
    body: dict = Body(...),
    resolve: bool = Query(default=True),
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    script = _build_script_from_payload(body, script_id=script_id)
    _resolve_script_or_error(script)  # 驗證引用
    saved = save_script_definition(script.model_dump(mode="json", by_alias=True), script_id=script.id)
    if not resolve:
        return {"script": _raw_script_payload(saved)}
    return {"script": _resolve_script_or_error(saved).to_payload()}


@router.delete("/api/scripts/{script_id}")
def api_delete_script(
    script_id: str,
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    try:
        delete_script_definition(script_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "deleted", "script_id": sanitize_script_id(script_id)}


@router.post("/api/scripts/{script_id}/clone", status_code=201)
def api_clone_script(
    script_id: str,
    body: dict = Body(...),
    resolve: bool = Query(default=True),
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    new_id = body.get("new_id") or body.get("newId")
    if not new_id or not isinstance(new_id, str):
        raise HTTPException(status_code=400, detail="new_id 必須提供")
    try:
        script = clone_script_definition(script_id, new_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not resolve:
        return {"script": _raw_script_payload(script)}
    return {"script": _resolve_script_or_error(script).to_payload()}


@router.post("/api/scripts/{script_id}/play")
async def api_play_script(
    script_id: str,
    body: dict | None = Body(default=None),
) -> dict:
    try:
        script = load_script_definition(script_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    audio_override: AudioMix | None = None
    if body and isinstance(body, dict) and body.get("audio_override") is not None:
        try:
            audio_override = AudioMix.model_validate(body.get("audio_override"))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        resolved = await play_script(script, audio_override=audio_override)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "status": "queued",
        "script_id": script.id,
        "entry_count": len(resolved.entries),
        "audio_override": audio_override.model_dump(mode="json") if audio_override else None,
    }


@router.post("/api/scripts/{script_id}/stop")
def api_stop_script(script_id: str) -> dict:
    try:
        safe_id = sanitize_script_id(script_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    stopped = stop_script(safe_id)
    return {"status": "stopped" if stopped else "not_running", "script_id": safe_id}
