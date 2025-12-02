from fastapi import APIRouter, Body, Depends, HTTPException, Query

from ..models.scene import AudioMix, Scene
from ..services.scene import (
    clone_scene_definition,
    delete_scene_definition,
    list_scene_versions,
    list_scenes,
    load_scene_definition,
    play_scene,
    publish_scene,
    resolve_scene,
    rollback_scene,
    save_scene_definition,
    sanitize_scene_id,
)
from ..utils.permissions import ensure_metadata_write_enabled, require_metadata_write_enabled

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
def api_get_scene(scene_id: str, resolve: bool = Query(default=True), version: int | None = Query(default=None)) -> dict:
    try:
        scene = load_scene_definition(scene_id, version=version)
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
    expected_version: int | None = Query(default=None),
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    scene = _build_scene_from_payload(body)
    _resolve_scene_or_error(scene)  # 驗證引用
    try:
        saved = save_scene_definition(scene.model_dump(mode="json", by_alias=True), expected_version=expected_version)
    except ValueError as exc:
        message = str(exc)
        status_code = 409 if "版本不符" in message else 400
        raise HTTPException(status_code=status_code, detail=message) from exc
    if not resolve:
        return {"scene": _raw_scene_payload(saved)}
    return {"scene": _resolve_scene_or_error(saved).to_payload()}


@router.put("/api/scenes/{scene_id}")
def api_update_scene(
    scene_id: str,
    body: dict = Body(...),
    resolve: bool = Query(default=True),
    expected_version: int | None = Query(default=None),
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    scene = _build_scene_from_payload(body, scene_id=scene_id)
    _resolve_scene_or_error(scene)  # 驗證引用
    try:
        saved = save_scene_definition(
            scene.model_dump(mode="json", by_alias=True),
            scene_id=scene.id,
            expected_version=expected_version,
        )
    except ValueError as exc:
        message = str(exc)
        status_code = 409 if "版本不符" in message else 400
        raise HTTPException(status_code=status_code, detail=message) from exc
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
    allow_draft: bool = Query(default=False),
    version: int | None = Query(default=None),
) -> dict:
    if allow_draft:
        ensure_metadata_write_enabled("scene_play_draft")
    try:
        scene = load_scene_definition(scene_id, version=version)
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
        resolved = await play_scene(scene, audio_override=audio_override, allow_draft=allow_draft)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "status": "queued",
        "scene_id": scene.id,
        "version": scene.version,
        "targets": len(resolved.targets),
        "audio_override": audio_override.model_dump(mode="json") if audio_override else None,
    }


@router.get("/api/scenes/{scene_id}/versions")
def api_list_scene_versions(scene_id: str) -> dict:
    try:
        safe_id = sanitize_scene_id(scene_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    versions = list_scene_versions(safe_id)
    return {"scene_id": safe_id, "versions": versions}


@router.post("/api/scenes/{scene_id}/publish")
def api_publish_scene(
    scene_id: str,
    body: dict | None = Body(default=None),
    expected_version: int | None = Query(default=None),
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    publish_as = None
    if body and isinstance(body, dict):
        publish_as = body.get("publish_as") or body.get("publishAs")
    try:
        scene = publish_scene(scene_id, publish_as=publish_as, expected_version=expected_version)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409 if "版本不符" in str(exc) else 400, detail=str(exc)) from exc
    return {"scene": _raw_scene_payload(scene)}


@router.post("/api/scenes/{scene_id}/rollback")
def api_rollback_scene(
    scene_id: str,
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
        scene = rollback_scene(scene_id, int(target_version), publish_as=publish_as, expected_version=expected_version)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409 if "版本不符" in str(exc) else 400, detail=str(exc)) from exc
    return {"scene": _raw_scene_payload(scene)}
