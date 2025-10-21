from fastapi import FastAPI, HTTPException, Query, Body, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import glob
import json
import os
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import quote
import mimetypes
from .config import settings
from .services.gemini_image import generate_mixed_offspring, generate_mixed_offspring_v2
from .services.image_analysis import analyze_screenshot
from .services.sound_effects import generate_sound_effect
from .services.camera_presets import (
    list_camera_presets,
    upsert_camera_preset,
    delete_camera_preset,
)
from .services.screenshots import save_screenshot
from .services.screenshot_requests import screenshot_requests_manager
from .services.iframe_config import (
    config_payload_for_response,
    load_iframe_config,
    save_iframe_config,
)
from .services import vector_store
from .models.schemas import (
    GenerateMixTwoResponse,
    GenerateMixTwoRequest,
    CameraPreset,
    SaveCameraPresetRequest,
    AnalyzeScreenshotRequest,
    GenerateSoundRequest,
    AnalyzeAndSoundRequest,
    IndexOffspringRequest,
    IndexOneImageRequest,
    TextSearchRequest,
    ImageSearchRequest,
    IndexBatchRequest,
    SoundPlayRequest,
)


app = FastAPI(title="Image Loop Synthesizer Backend", version="0.1.0")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

Path(settings.generated_sounds_dir).mkdir(parents=True, exist_ok=True)

# 靜態掛載生成影像：/generated_images -> settings.offspring_dir
app.mount(
    "/generated_images",
    StaticFiles(directory=settings.offspring_dir),
    name="generated_images",
)

app.mount(
    "/generated_sounds",
    StaticFiles(directory=settings.generated_sounds_dir),
    name="generated_sounds",
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/iframe-config")
def api_get_iframe_config() -> dict:
    config = load_iframe_config()
    return config_payload_for_response(config)


@app.put("/api/iframe-config")
async def api_put_iframe_config(body: dict = Body(...)) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="payload 必須為 JSON 物件")
    try:
        config = save_iframe_config(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    payload = config_payload_for_response(config)
    await screenshot_requests_manager.broadcast_iframe_config(payload)
    return payload


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


# --- Embeddings / Vector store endpoints ---


def _format_iso(ts: float) -> str:
    try:
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    except Exception:
        return datetime.utcfromtimestamp(ts).isoformat() + "Z"


@app.post("/api/index/offspring")
def api_index_offspring(body: IndexOffspringRequest | None = Body(default=None)) -> dict:
    limit = body.limit if body else None
    force = body.force if body else False
    try:
        res = vector_store.sweep_and_index_offspring(limit=limit, force=force)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return res


@app.get("/api/sound-files")
def api_sound_files() -> dict:
    directory = Path(settings.generated_sounds_dir)
    if not directory.exists():
        return {"files": []}

    allowed_exts = {".mp3", ".wav", ".opus", ".ulaw", ".alaw"}
    files: list[dict] = []
    for path in sorted(directory.iterdir()):
        if not path.is_file():
            continue
        if path.suffix.lower() not in allowed_exts:
            continue
        stat = path.stat()
        files.append(
            {
                "filename": path.name,
                "url": f"/api/sound-files/{quote(path.name)}",
                "size": stat.st_size,
                "modified_at": _format_iso(stat.st_mtime),
            }
        )

    return {"files": files}


@app.get("/api/sound-files/{filename}")
def api_sound_file(filename: str) -> FileResponse:
    safe_name = os.path.basename(filename)
    if not safe_name:
        raise HTTPException(status_code=400, detail="invalid filename")
    path = Path(settings.generated_sounds_dir) / safe_name
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="sound file not found")

    media_type, _ = mimetypes.guess_type(str(path))
    return FileResponse(path, media_type=media_type or "audio/mpeg", filename=path.name)


@app.post("/api/sound-play", status_code=202)
async def api_sound_play(body: SoundPlayRequest, request: Request) -> dict:
    safe_name = os.path.basename(body.filename)
    if not safe_name:
        raise HTTPException(status_code=400, detail="invalid filename")
    path = Path(settings.generated_sounds_dir) / safe_name
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="sound file not found")

    url = str(request.url_for("api_sound_file", filename=safe_name))
    await screenshot_requests_manager.broadcast_sound_play(safe_name, url, body.target_client_id)

    return {"status": "queued", "filename": safe_name, "url": url}


@app.post("/api/index/image")
def api_index_one_image(body: IndexOneImageRequest) -> dict:
    try:
        res = vector_store.index_offspring_image(body.basename, force=body.force)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return res


@app.post("/api/index/batch")
def api_index_batch(body: IndexBatchRequest) -> dict:
    """Index a batch of offspring images.
    
    批量索引圖像，按生成順序從指定位置開始。
    
    Query params:
    - batch_size: 每次索引的圖像數量 (default: 50)
    - offset: 起始位置，0-based (default: 0)
    - force: 強制重新索引 (default: false)
    """
    try:
        res = vector_store.index_offspring_batch(
            batch_size=body.batch_size,
            offset=body.offset,
            force=body.force
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return res


@app.post("/api/search/text")
def api_search_text(body: TextSearchRequest) -> dict:
    try:
        res = vector_store.search_images_by_text(body.query, top_k=body.top_k)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return res


@app.post("/api/search/image")
def api_search_image(body: ImageSearchRequest) -> dict:
    try:
        res = vector_store.search_images_by_image(body.image_path, top_k=body.top_k)
    except FileNotFoundError as exc:
        # 返回 400 而非 404，讓前端知道應該使用回退路徑
        raise HTTPException(status_code=400, detail=f"圖像不存在或無法索引: {str(exc)}")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return res


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


@app.post("/api/screenshots", status_code=201)
async def api_upload_screenshot(
    request_id: str | None = Form(default=None),
    client_id: str | None = Form(default=None),
    file: UploadFile = File(...),
) -> dict:
    try:
        saved = save_screenshot(file)
    except ValueError as exc:
        if request_id:
            await screenshot_requests_manager.mark_failed(request_id, str(exc), processed_by=client_id)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # noqa: BLE001 - surface as 500
        if request_id:
            await screenshot_requests_manager.mark_failed(
                request_id,
                "failed to save screenshot",
                processed_by=client_id,
            )
        raise HTTPException(status_code=500, detail="failed to save screenshot") from exc

    record = None
    if request_id:
        record = await screenshot_requests_manager.mark_completed(
            request_id,
            saved,
            processed_by=client_id,
        )
        if record is None:
            try:
                os.remove(saved["absolute_path"])
            except OSError:
                pass
            raise HTTPException(status_code=404, detail="screenshot request not found")

    return {
        "filename": saved["filename"],
        "original_filename": saved["original_filename"],  # 新增：返回原始檔案名稱
        "absolute_path": saved["absolute_path"],
        "relative_path": saved.get("relative_path"),
        "request_id": request_id,
        "status": record["status"] if record else None,
        "processed_by": record.get("processed_by") if record else client_id,
    }


@app.post("/api/screenshots/request", status_code=202)
async def api_create_screenshot_request(body: dict | None = Body(default=None)) -> dict:
    record = await screenshot_requests_manager.create_request(metadata=body or {})
    return record


@app.get("/api/screenshots/{request_id}")
async def api_get_screenshot_request(request_id: str) -> dict:
    record = await screenshot_requests_manager.get_request(request_id)
    if record is None:
        raise HTTPException(status_code=404, detail="screenshot request not found")
    return record


@app.post("/api/screenshots/{request_id}/fail", status_code=200)
async def api_fail_screenshot_request(request_id: str, body: dict | None = Body(default=None)) -> dict:
    message = ""
    client_id = None
    if body and isinstance(body, dict):
        message = str(body.get("error", ""))
        if body.get("client_id") is not None:
            client_id_raw = body.get("client_id")
            client_id = str(client_id_raw).strip() or None
    record = await screenshot_requests_manager.mark_failed(
        request_id,
        message or "client reported failure",
        processed_by=client_id,
    )
    if record is None:
        raise HTTPException(status_code=404, detail="screenshot request not found")
    return record


@app.websocket("/ws/screenshots")
async def websocket_screenshots(websocket: WebSocket) -> None:
    await screenshot_requests_manager.add_connection(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = message.get("type")
            if msg_type == "hello":
                client_id_raw = message.get("client_id")
                client_id = None
                if isinstance(client_id_raw, str):
                    client_id = client_id_raw.strip() or None
                await screenshot_requests_manager.register_client(websocket, client_id)
    except WebSocketDisconnect:
        await screenshot_requests_manager.remove_connection(websocket)
    except Exception:
        await screenshot_requests_manager.remove_connection(websocket)


def _resolve_screenshot_path(path_str: str) -> Path | None:
    if not path_str:
        return None
    raw = Path(path_str)
    candidates: list[Path] = []
    candidates.append(raw)
    if not raw.is_absolute():
        candidates.append(PROJECT_ROOT / raw)
        candidates.append(Path(settings.screenshot_dir) / raw)
        candidates.append(Path(settings.screenshot_dir) / raw.name)
    seen: set[Path] = set()
    for candidate in candidates:
        if not candidate:
            continue
        try:
            candidate_resolved = candidate.resolve()
        except Exception:
            continue
        if candidate_resolved in seen:
            continue
        seen.add(candidate_resolved)
        if candidate_resolved.is_file():
            return candidate_resolved
    return None


async def _resolve_image_and_snapshot(
    image_path: str | None,
    request_id: str | None,
) -> tuple[Path, dict | None]:
    resolved_path: Path | None = None
    snapshot_record: dict | None = None

    if image_path:
        resolved_path = _resolve_screenshot_path(image_path)
        if resolved_path is None:
            raise HTTPException(status_code=404, detail="指定的影像檔案不存在")
    elif request_id:
        snapshot_record = await screenshot_requests_manager.get_request(request_id)
        if snapshot_record is None:
            raise HTTPException(status_code=404, detail="screenshot request not found")
        result = snapshot_record.get("result") or {}
        candidate_path = result.get("absolute_path") or result.get("relative_path")
        if not candidate_path:
            raise HTTPException(status_code=409, detail="截圖尚未完成或缺少檔案資訊")
        resolved_path = _resolve_screenshot_path(candidate_path)
        if resolved_path is None:
            raise HTTPException(status_code=404, detail="截圖檔案不存在或已被移除")
    else:
        raise HTTPException(status_code=400, detail="image_path 或 request_id 必須提供")

    return resolved_path, snapshot_record


def _build_auto_sound_prompt(analysis: dict, duration: float) -> str:
    summary = (analysis.get("summary") or "").strip()
    segments = analysis.get("segments") or []

    pieces: list[str] = []
    if summary:
        pieces.append(summary.replace("\n", " ").strip())
    for seg in segments:
        if isinstance(seg, str):
            cleaned = seg.replace("\n", " ").strip()
            if cleaned:
                pieces.append(cleaned)

    if not pieces:
        raise HTTPException(status_code=500, detail="分析結果缺少文字，無法自動產生音效描述")

    combined = " ".join(pieces)
    combined = " ".join(combined.split())  # collapse whitespace

    max_details_len = 320
    if len(combined) > max_details_len:
        combined = combined[:max_details_len].rsplit(" ", 1)[0] + "..."

    prefix = (
        "Create an immersive {duration:.1f}-second soundscape inspired by this scene. "
        "Focus on atmosphere, motion, focal elements, and spatial depth. Details: "
    ).format(duration=duration)

    prompt = prefix + combined
    if len(prompt) > 440:
        overflow = len(prompt) - 440
        trim_target = max(10, len(combined) - overflow - 3)
        combined_trim_raw = combined[:trim_target]
        if " " in combined_trim_raw:
            combined_trim_raw = combined_trim_raw.rsplit(" ", 1)[0]
        combined_trimmed = combined_trim_raw + "..."
        prompt = prefix + combined_trimmed

    return prompt


@app.post("/api/analyze-screenshot")
async def api_analyze_screenshot(body: AnalyzeScreenshotRequest) -> dict:
    resolved_path, snapshot_record = await _resolve_image_and_snapshot(body.image_path, body.request_id)

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


@app.post("/api/sound-effects")
async def api_generate_sound(body: GenerateSoundRequest) -> dict:
    resolved_path, snapshot_record = await _resolve_image_and_snapshot(body.image_path, body.request_id)

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
        updated = await screenshot_requests_manager.attach_sound_effect(body.request_id, sound_result)
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


@app.post("/api/screenshot/bundle")
async def api_analyze_and_sound(body: AnalyzeAndSoundRequest) -> dict:
    resolved_path, snapshot_record = await _resolve_image_and_snapshot(body.image_path, body.request_id)

    analysis = await run_in_threadpool(analyze_screenshot, str(resolved_path), body.prompt)

    if body.sound_prompt_override and body.sound_prompt_override.strip():
        sound_prompt = body.sound_prompt_override.strip()
    else:
        sound_prompt = _build_auto_sound_prompt(analysis, body.sound_duration_seconds)

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
        updated = await screenshot_requests_manager.attach_sound_effect(body.request_id, sound_result)
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

    graph_nodes: dict[str, dict] = {}
    graph_edges: set[tuple[str, str]] = set()

    priority_order = {
        "original": 0,
        "parent": 1,
        "child": 1,
        "sibling": 2,
        "ancestor": 3,
    }

    def add_node(name: str, kind: str, level: int) -> None:
        if not exists_in_offspring(name):
            return
        current = graph_nodes.get(name)
        if current is None:
            graph_nodes[name] = {"name": name, "kind": kind, "level": level}
            return
        if level < current["level"]:
            current["level"] = level
        if priority_order.get(kind, 99) < priority_order.get(current["kind"], 99):
            current["kind"] = kind

    def add_edge(source: str, target: str) -> None:
        if not exists_in_offspring(source) or not exists_in_offspring(target):
            return
        graph_edges.add((source, target))

    add_node(img, "original", 0)

    for parent_name in parents:
        add_node(parent_name, "parent", -1)
        add_edge(parent_name, img)

    for child_name in children:
        add_node(child_name, "child", 1)
        add_edge(img, child_name)

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
            for name in frontier:
                add_node(name, "parent" if level == 1 else "ancestor", -level)
                parent_list = metas.get(name, {}).get("parents", [])
                for parent_name in parent_list:
                    add_node(parent_name, "ancestor", -(level + 1))
                    add_edge(parent_name, name)
            if depth != -1 and level >= depth:
                break
            next_frontier: set[str] = set()
            for name in frontier:
                ps = set(metas.get(name, {}).get("parents", []))
                ps = {p for p in ps if p not in visited}
                next_frontier.update(ps)
            frontier = next_frontier
            level += 1

    # 補齊兄弟姊妹及其父母邊
    for sibling_name in siblings:
        add_node(sibling_name, "sibling", 0)
        parent_list = metas.get(sibling_name, {}).get("parents", [])
        for parent_name in parent_list:
            add_node(parent_name, "parent", -1)
            add_edge(parent_name, sibling_name)

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

    lineage_graph = {
        "nodes": sorted(
            graph_nodes.values(),
            key=lambda item: (item["level"], item["name"]),
        ),
        "edges": [
            {"source": source, "target": target} for source, target in sorted(graph_edges)
        ],
    }

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
        "lineage_graph": lineage_graph,
    }
