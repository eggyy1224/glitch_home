from fastapi import APIRouter, Body, Depends, HTTPException, Query

from ..models.scene import AudioMix, Scene
from ..services.scene import (
    clone_scene_definition,
    delete_scene_definition,
    list_scenes,
    load_scene_definition,
    play_scene,
    resolve_scene,
    save_scene_definition,
    sanitize_scene_id,
)
from ..utils.permissions import require_metadata_write_enabled

router = APIRouter()


def _raw_scene_payload(scene: Scene) -> dict:
    return scene.model_dump(mode="json", by_alias=True)


def _resolve_scene_or_error(scene: Scene):
    try:
        return resolve_scene(scene)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _build_scene_from_payload(body: dict, scene_id: str | None = None) -> Scene:
    candidate_id = scene_id or body.get("id")
    if not candidate_id:
        raise HTTPException(status_code=400, detail="scene id 必須提供在 path 或 payload")
    try:
        safe_id = sanitize_scene_id(candidate_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    payload = {**body, "id": safe_id}
    try:
        return Scene.model_validate(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/scenes")
def api_list_scenes() -> dict:
    entries = list_scenes()
    return {"scenes": entries}


@router.get("/api/scenes/{scene_id}")
def api_get_scene(scene_id: str, resolve: bool = Query(default=True)) -> dict:
    try:
        scene = load_scene_definition(scene_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not resolve:
        return {"scene": _raw_scene_payload(scene)}
    resolved = _resolve_scene_or_error(scene)
    return {"scene": resolved.to_payload()}


@router.post("/api/scenes", status_code=201)
def api_create_scene(
    body: dict = Body(...),
    resolve: bool = Query(default=True),
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    scene = _build_scene_from_payload(body)
    _resolve_scene_or_error(scene)  # 驗證引用
    saved = save_scene_definition(scene.model_dump(mode="json", by_alias=True))
    if not resolve:
        return {"scene": _raw_scene_payload(saved)}
    return {"scene": _resolve_scene_or_error(saved).to_payload()}


@router.put("/api/scenes/{scene_id}")
def api_update_scene(
    scene_id: str,
    body: dict = Body(...),
    resolve: bool = Query(default=True),
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    scene = _build_scene_from_payload(body, scene_id=scene_id)
    _resolve_scene_or_error(scene)  # 驗證引用
    saved = save_scene_definition(scene.model_dump(mode="json", by_alias=True), scene_id=scene.id)
    if not resolve:
        return {"scene": _raw_scene_payload(saved)}
    return {"scene": _resolve_scene_or_error(saved).to_payload()}


@router.delete("/api/scenes/{scene_id}")
def api_delete_scene(
    scene_id: str,
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    try:
        delete_scene_definition(scene_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "deleted", "scene_id": sanitize_scene_id(scene_id)}


@router.post("/api/scenes/{scene_id}/clone", status_code=201)
def api_clone_scene(
    scene_id: str,
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
        scene = clone_scene_definition(scene_id, new_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not resolve:
        return {"scene": _raw_scene_payload(scene)}
    return {"scene": _resolve_scene_or_error(scene).to_payload()}


@router.post("/api/scenes/{scene_id}/play")
async def api_play_scene(
    scene_id: str,
    body: dict | None = Body(default=None),
) -> dict:
    try:
        scene = load_scene_definition(scene_id)
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
        resolved = await play_scene(scene, audio_override=audio_override)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "status": "queued",
        "scene_id": scene.id,
        "targets": len(resolved.targets),
        "audio_override": audio_override.model_dump(mode="json") if audio_override else None,
    }
