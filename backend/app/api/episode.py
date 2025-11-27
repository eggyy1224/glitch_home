from typing import Dict, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator

from ..models.episode import Episode
from ..services.episode import (
    delete_episode_definition,
    list_episodes,
    load_episode_definition,
    play_episode,
    resolve_episode,
    save_episode_definition,
    sanitize_episode_id,
)
from ..utils.permissions import require_metadata_write_enabled

router = APIRouter()


class EpisodePlayRequest(BaseModel):
    target_client_map: Dict[str, str] = Field(
        default_factory=dict,
        description="可選：指定 timeline_id -> target_client_id 的覆寫對應",
    )
    auto_play: Optional[bool] = Field(default=None, description="覆寫所有 track 的 autoPlay 設定")
    force_iframe_mode: Optional[bool] = Field(
        default=None,
        description="覆寫所有 track 的 forceIframeMode；預設沿用 track 或 True",
    )
    command_id_prefix: Optional[str] = Field(default=None, description="可選：為每條指令附加共用前綴，用於去重")

    @model_validator(mode="after")
    def _normalize_fields(self) -> "EpisodePlayRequest":
        cleaned_map: Dict[str, str] = {}
        for key, value in (self.target_client_map or {}).items():
            if not isinstance(key, str) or not isinstance(value, str):
                continue
            key_clean = key.strip()
            value_clean = value.strip()
            if key_clean and value_clean:
                cleaned_map[key_clean] = value_clean
        self.target_client_map = cleaned_map

        if self.command_id_prefix:
            prefix = self.command_id_prefix.strip()
            self.command_id_prefix = prefix or None
        return self


def _raw_episode_payload(episode: Episode) -> dict:
    return episode.model_dump(mode="json", by_alias=True)


@router.get("/api/episodes")
def api_list_episodes() -> dict:
    episodes = list_episodes()
    return {"episodes": episodes}


@router.get("/api/episodes/{episode_id}")
def api_get_episode(episode_id: str, resolve: bool = Query(default=True)) -> dict:
    try:
        episode = load_episode_definition(episode_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not resolve:
        return {"episode": _raw_episode_payload(episode)}

    try:
        resolved = resolve_episode(episode)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"episode": resolved.to_payload()}


@router.post("/api/episodes", status_code=201)
def api_create_episode(
    body: dict = Body(...),
    resolve: bool = Query(default=True),
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    try:
        raw_id = body.get("id")
        if not raw_id or not isinstance(raw_id, str):
            raise ValueError("episode id 必填")
        safe_id = sanitize_episode_id(raw_id)
        payload = {**body, "id": safe_id}
        episode = Episode.model_validate(payload)
        resolved = resolve_episode(episode)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    episode = save_episode_definition(episode.model_dump(mode="json", by_alias=True))

    if not resolve:
        return {"episode": _raw_episode_payload(episode)}
    return {"episode": resolved.to_payload()}


@router.put("/api/episodes/{episode_id}")
def api_update_episode(
    episode_id: str,
    body: dict = Body(...),
    resolve: bool = Query(default=True),
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    try:
        # 確認檔案存在，避免 PUT 意外新建
        load_episode_definition(episode_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        safe_id = sanitize_episode_id(episode_id)
        payload = {**body, "id": safe_id}
        episode = Episode.model_validate(payload)
        resolved = resolve_episode(episode)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    episode = save_episode_definition(episode.model_dump(mode="json", by_alias=True), episode_id=episode_id)

    if not resolve:
        return {"episode": _raw_episode_payload(episode)}
    return {"episode": resolved.to_payload()}


@router.delete("/api/episodes/{episode_id}")
def api_delete_episode(
    episode_id: str,
    _: None = Depends(require_metadata_write_enabled),
) -> dict:
    try:
        delete_episode_definition(episode_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "deleted", "episode_id": sanitize_episode_id(episode_id)}


@router.post("/api/episodes/{episode_id}/clone", status_code=201)
def api_clone_episode(
    episode_id: str,
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
        source = load_episode_definition(episode_id)
        clean_id = sanitize_episode_id(new_id)
        payload = source.model_dump(mode="json", by_alias=True)
        payload["id"] = clean_id
        episode = Episode.model_validate(payload)
        resolved = resolve_episode(episode)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    episode = save_episode_definition(episode.model_dump(mode="json", by_alias=True))

    if not resolve:
        return {"episode": _raw_episode_payload(episode)}
    return {"episode": resolved.to_payload()}


@router.post("/api/episodes/{episode_id}/play")
async def api_play_episode(
    episode_id: str,
    body: EpisodePlayRequest | None = Body(default=None),
) -> dict:
    try:
        episode = load_episode_definition(episode_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    payload = body or EpisodePlayRequest()
    # 若未指定 prefix，使用 episode id + 當前時間戳，避免後續播放因 commandId 相同被前端去重忽略
    if payload.command_id_prefix:
        command_prefix = payload.command_id_prefix
    else:
        from time import time

        command_prefix = f"episode:{episode.id}:{int(time() * 1000)}"

    try:
        resolved = await play_episode(
            episode,
            target_client_map=payload.target_client_map,
            auto_play_override=payload.auto_play,
            force_iframe_mode=payload.force_iframe_mode,
            command_id_prefix=command_prefix,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "status": "queued",
        "episode_id": episode.id,
        "tracks": [track.to_payload() for track in resolved.tracks],
    }
