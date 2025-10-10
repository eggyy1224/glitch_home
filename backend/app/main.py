from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import glob
import json
import os
from .config import settings
from .services.gemini_image import generate_mixed_offspring, generate_mixed_offspring_v2
from .services.camera_presets import (
    list_camera_presets,
    upsert_camera_preset,
    delete_camera_preset,
)
from .models.schemas import (
    GenerateMixTwoResponse,
    GenerateMixTwoRequest,
    CameraPreset,
    SaveCameraPresetRequest,
)


app = FastAPI(title="Image Loop Synthesizer Backend", version="0.1.0")

# 靜態掛載生成影像：/generated_images -> settings.offspring_dir
app.mount(
    "/generated_images",
    StaticFiles(directory=settings.offspring_dir),
    name="generated_images",
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/generate/mix-two", response_model=GenerateMixTwoResponse, status_code=201)
def api_generate_mix_two(
    count: int | None = Query(None, ge=2, description="When body not provided, how many parents to sample"),
    body: GenerateMixTwoRequest | None = Body(default=None),
):
    """Backward-compatible endpoint with expanded options.

    - If body is omitted, falls back to previous behavior using `count` query (default 2).
    - If body is provided, supports explicit parents, prompt, strength, output size/format.
    """
    try:
        if body is None:
            result = generate_mixed_offspring(count=count or 2)
        else:
            result = generate_mixed_offspring_v2(
                parents=body.parents,
                count=body.count if body.count is not None else (count or 2),
                prompt=body.prompt,
                strength=body.strength,
                output_format=body.output_format,
                output_width=body.output_width,
                output_height=body.output_height,
                output_max_side=body.output_max_side,
                resize_mode=body.resize_mode,
            )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return JSONResponse(status_code=201, content=result)


@app.get("/api/camera-presets", response_model=list[CameraPreset])
def api_list_camera_presets() -> list[CameraPreset]:
    presets = list_camera_presets()
    return presets


@app.post("/api/camera-presets", response_model=CameraPreset, status_code=201)
def api_save_camera_preset(body: SaveCameraPresetRequest) -> CameraPreset:
    try:
        saved = upsert_camera_preset(body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return saved


@app.delete("/api/camera-presets/{name}", status_code=204)
def api_delete_camera_preset(name: str) -> None:
    cleaned = name.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="name is required")
    if any(sep in cleaned for sep in ("/", "\\", ":", "*", "?", "\"", "<", ">", "|")):
        raise HTTPException(status_code=400, detail="invalid name")
    deleted = delete_camera_preset(cleaned)
    if not deleted:
        raise HTTPException(status_code=404, detail="preset not found")


def _load_all_metadata() -> dict:
    """讀取所有 metadata，回傳 {output_image: meta_dict}。"""
    mapping: dict[str, dict] = {}
    pattern = os.path.join(settings.metadata_dir, "*.json")
    for path in glob.glob(pattern):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            out = data.get("output_image")
            if out:
                mapping[out] = data
        except Exception:
            continue
    return mapping


@app.get("/api/kinship")
def api_kinship(
    img: str = Query(..., description="offspring 檔名（含副檔名）"),
    depth: int = Query(1, ge=-1, description="祖先追溯層數；-1 代表窮盡直到無父母"),
) -> dict:
    metas = _load_all_metadata()
    if img not in metas:
        raise HTTPException(status_code=404, detail="image metadata not found")

    def exists_in_offspring(name: str) -> bool:
        path = os.path.join(settings.offspring_dir, name)
        return os.path.isfile(path)

    def filter_existing(names: set[str] | list[str]) -> list[str]:
        return sorted([n for n in names if exists_in_offspring(n)])

    # 父母
    parents = set(metas[img].get("parents", []))

    # 子代：誰把我當作 parent
    children = {name for name, meta in metas.items() if img in meta.get("parents", [])}

    # 兄弟姊妹：共享任一父母
    siblings = set()
    my_parents = set(metas[img].get("parents", []))
    if my_parents:
        for name, meta in metas.items():
            if name == img:
                continue
            ps = set(meta.get("parents", []))
            if ps & my_parents:
                siblings.add(name)

    # 僅保留實際存在於 offspring_dir 的影像，避免前端 404
    parents = set(filter_existing(parents))
    children = set(filter_existing(children))
    siblings = set(filter_existing(siblings))
    related = sorted(parents | children | siblings)

    # 祖先（依 depth 追溯；-1 代表窮盡）
    ancestors: set[str] = set()
    ancestors_by_level: list[list[str]] = []
    if depth != 0:
        visited: set[str] = set([img])
        frontier: set[str] = set(parents)
        level: int = 1
        while frontier:
            level_items = sorted(frontier)
            ancestors_by_level.append(level_items)
            ancestors.update(frontier)
            visited.update(frontier)
            if depth != -1 and level >= depth:
                break
            next_frontier: set[str] = set()
            for name in frontier:
                ps = set(metas.get(name, {}).get("parents", []))
                ps = {p for p in ps if p not in visited}
                next_frontier.update(ps)
            frontier = next_frontier
            level += 1

    # 最上層（沒有父母或已窮盡）
    root_ancestors: list[str] = []
    if ancestors_by_level:
        last_level = set(ancestors_by_level[-1])
        roots = []
        for a in last_level:
            ps = metas.get(a, {}).get("parents", [])
            if not ps:
                roots.append(a)
        root_ancestors = filter_existing(roots)

    return {
        "original_image": img,
        "related_images": related,  # 向下相容
        "parents": sorted(parents),
        "children": sorted(children),
        "siblings": sorted(siblings),
        "ancestors": filter_existing(ancestors),
        "ancestors_by_level": [filter_existing(set(level)) for level in ancestors_by_level],
        "root_ancestors": root_ancestors,
        "depth_used": depth,
    }
