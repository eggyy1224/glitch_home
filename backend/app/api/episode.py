from fastapi import APIRouter, HTTPException, Query

from ..services.episode import list_episodes, load_episode_definition, resolve_episode

router = APIRouter()


@router.get("/api/episodes")
def api_list_episodes(client: str | None = Query(default=None)) -> dict:
    try:
        episodes = list_episodes(client)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"episodes": episodes}


@router.get("/api/episodes/{episode_id}")
def api_get_episode(episode_id: str) -> dict:
    try:
        episode = load_episode_definition(episode_id)
        resolved = resolve_episode(episode)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"episode": resolved.to_payload()}
