"""Media-related API endpoints."""

from __future__ import annotations

import asyncio
import glob
import json
import mimetypes
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Body, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, JSONResponse
from fastapi import File, Form, UploadFile

from ..config import settings
from ..models.schemas import (
    AnalyzeAndSoundRequest,
    AnalyzeScreenshotRequest,
    GenerateMixTwoRequest,
    GenerateMixTwoResponse,
    GenerateSoundRequest,
    GenerateCollageVersionRequest,
    GenerateCollageVersionResponse,
    ImageSearchRequest,
    IndexBatchRequest,
    IndexOffspringRequest,
    IndexOneImageRequest,
    SoundPlayRequest,
    SpeakWithSubtitleRequest,
    TextSearchRequest,
    TTSRequest,
)
from ..services import vector_store
from ..services.gemini_image import generate_mixed_offspring, generate_mixed_offspring_v2
from ..services.image_analysis import analyze_screenshot
from ..services.kinship_index import kinship_index
from ..services.screenshot_requests import screenshot_requests_manager
from ..services.sound_effects import generate_sound_effect
from ..services.subtitles import subtitle_manager
from ..services.tts_openai import synthesize_speech_openai
from ..services.collage_version import generate_collage_version, task_manager

router = APIRouter()

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _format_iso(ts: float) -> str:
    try:
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    except Exception:
        return datetime.utcfromtimestamp(ts).isoformat() + "Z"


@router.post("/api/generate/mix-two", response_model=GenerateMixTwoResponse, status_code=201)
def api_generate_mix_two(
    count: int | None = Query(None, ge=2, description="When body not provided, how many parents to sample"),
    body: GenerateMixTwoRequest | None = Body(default=None),
):
    """Backward-compatible endpoint with expanded options."""
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
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return JSONResponse(status_code=201, content=result)


@router.post("/api/index/offspring")
def api_index_offspring(body: IndexOffspringRequest | None = Body(default=None)) -> dict:
    limit = body.limit if body else None
    force = body.force if body else False
    try:
        res = vector_store.sweep_and_index_offspring(limit=limit, force=force)
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return res


@router.post("/api/index/image")
def api_index_one_image(body: IndexOneImageRequest) -> dict:
    try:
        res = vector_store.index_offspring_image(body.basename, force=body.force)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return res


@router.post("/api/index/batch")
def api_index_batch(body: IndexBatchRequest) -> dict:
    """Index a batch of offspring images."""
    try:
        res = vector_store.index_offspring_batch(
            batch_size=body.batch_size,
            offset=body.offset,
            force=body.force,
        )
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return res


@router.post("/api/search/text")
def api_search_text(body: TextSearchRequest) -> dict:
    try:
        res = vector_store.search_images_by_text(body.query, top_k=body.top_k)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return res


@router.post("/api/search/image")
def api_search_image(body: ImageSearchRequest) -> dict:
    try:
        res = vector_store.search_images_by_image(body.image_path, top_k=body.top_k)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=f"圖像不存在或無法索引: {str(exc)}") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return res


@router.get("/api/sound-files")
def api_sound_files(
    with_metadata: bool = Query(
        False, description="Include metadata (if available) for each sound file."
    )
) -> dict:
    directory = Path(settings.generated_sounds_dir)
    if not directory.exists():
        return {"files": []}

    allowed_exts = {".mp3", ".wav", ".opus", ".ulaw", ".alaw", ".aac", ".flac"}
    metadata_dir = Path(settings.metadata_dir)
    files: list[dict] = []
    for path in sorted(directory.iterdir()):
        if not path.is_file() or path.suffix.lower() not in allowed_exts:
            continue
        stat = path.stat()
        entry: dict = {
            "filename": path.name,
            "url": f"/api/sound-files/{quote(path.name)}",
            "size": stat.st_size,
            "modified_at": _format_iso(stat.st_mtime),
        }
        if with_metadata:
            meta_candidates = [
                metadata_dir / f"{path.stem}.json",
                metadata_dir / f"{path.name}.json",
            ]
            for meta_path in meta_candidates:
                if not meta_path.exists():
                    continue
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        metadata = json.load(f)
                    if metadata.get("output_audio") == path.name:
                        entry["metadata"] = metadata
                        entry["metadata_path"] = str(meta_path)
                        break
                except Exception:
                    continue
        files.append(entry)

    return {"files": files}


@router.get("/api/sound-files/{filename}")
def api_sound_file(filename: str) -> FileResponse:
    safe_name = os.path.basename(filename)
    if not safe_name:
        raise HTTPException(status_code=400, detail="invalid filename")
    path = Path(settings.generated_sounds_dir) / safe_name
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="sound file not found")

    media_type, _ = mimetypes.guess_type(str(path))
    return FileResponse(path, media_type=media_type or "audio/mpeg", filename=path.name)


@router.post("/api/sound-play", status_code=202)
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


@router.post("/api/tts", status_code=201)
async def api_tts_generate(body: TTSRequest, request: Request) -> dict:
    try:
        result = await run_in_threadpool(
            synthesize_speech_openai,
            text=body.text,
            instructions=body.instructions,
            voice=body.voice,
            model=body.model,
            output_format=body.output_format,
            filename_base=body.filename_base,
            speed=body.speed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    safe_name = os.path.basename(result.get("filename"))
    url = str(request.url_for("api_sound_file", filename=safe_name))
    payload = {
        "tts": result,
        "url": url,
    }

    if body.auto_play:
        await screenshot_requests_manager.broadcast_sound_play(safe_name, url, body.target_client_id)
        payload["playback"] = {"status": "queued", "target_client_id": body.target_client_id}

    return payload


@router.post("/api/speak-with-subtitle", status_code=201)
async def api_speak_with_subtitle(body: SpeakWithSubtitleRequest, request: Request) -> dict:
    """Generate TTS audio and set subtitle simultaneously."""
    # Step 1: Generate TTS audio
    try:
        tts_result = await run_in_threadpool(
            synthesize_speech_openai,
            text=body.text,
            instructions=body.instructions,
            voice=body.voice,
            model=body.model,
            output_format=body.output_format,
            filename_base=body.filename_base,
            speed=body.speed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    safe_name = os.path.basename(tts_result.get("filename"))
    url = str(request.url_for("api_sound_file", filename=safe_name))
    
    # Step 2: Set subtitle (use subtitle_text if provided, otherwise use text)
    subtitle_text = body.subtitle_text if body.subtitle_text else body.text
    subtitle_result = None
    subtitle_error = None
    
    try:
        subtitle_result = await subtitle_manager.set_subtitle(
            subtitle_text,
            language=body.subtitle_language,
            duration_seconds=body.subtitle_duration_seconds,
            target_client_id=body.target_client_id,
        )
        await screenshot_requests_manager.broadcast_subtitle(
            subtitle_result, target_client_id=body.target_client_id
        )
    except ValueError as exc:
        subtitle_error = str(exc)
    except Exception as exc:  # noqa: BLE001
        subtitle_error = f"Subtitle error: {str(exc)}"
    
    # Step 3: Build response payload
    payload = {
        "tts": tts_result,
        "url": url,
    }
    
    if subtitle_result:
        payload["subtitle"] = subtitle_result
    elif subtitle_error:
        payload["subtitle_error"] = subtitle_error
    
    # Step 4: Auto-play if requested
    if body.auto_play:
        await screenshot_requests_manager.broadcast_sound_play(safe_name, url, body.target_client_id)
        payload["playback"] = {"status": "queued", "target_client_id": body.target_client_id}
    
    return payload


def _resolve_screenshot_path(path_str: str) -> Path | None:
    if not path_str:
        return None
    raw = Path(path_str)
    candidates: list[Path] = [raw]
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
    combined = " ".join(combined.split())

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


@router.post("/api/analyze-screenshot")
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


@router.post("/api/sound-effects")
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


@router.post("/api/screenshot/bundle")
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


@router.get("/api/kinship")
def api_kinship(
    img: str = Query(..., description="offspring 檔名（含副檔名）"),
    depth: int = Query(1, ge=-1, description="祖先追溯層數；-1 代表窮盡直到無父母"),
) -> dict:
    if not kinship_index.has_offspring(img):
        raise HTTPException(status_code=404, detail="image metadata not found")

    def exists_in_offspring(name: str) -> bool:
        path = os.path.join(settings.offspring_dir, name)
        return os.path.isfile(path)

    def filter_existing(names: set[str] | list[str]) -> list[str]:
        return sorted([n for n in names if exists_in_offspring(n)])

    parents = set(kinship_index.parents_of(img))
    children = set(kinship_index.children_of(img))
    siblings = set(kinship_index.siblings_of(img))

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

    ancestors: set[str] = set()
    ancestors_by_level: list[list[str]] = []
    if depth != 0:
        ancestors_by_level = kinship_index.ancestors_levels_of(img, depth)
        for idx, level_items in enumerate(ancestors_by_level, start=1):
            for name in level_items:
                ancestors.add(name)
                add_node(name, "parent" if idx == 1 else "ancestor", -idx)
                for parent_name in kinship_index.parents_of(name):
                    add_node(parent_name, "ancestor", -(idx + 1))
                    add_edge(parent_name, name)

    for sibling_name in siblings:
        add_node(sibling_name, "sibling", 0)
        parent_list = kinship_index.parents_of(sibling_name)
        for parent_name in parent_list:
            add_node(parent_name, "parent", -1)
            add_edge(parent_name, sibling_name)

    root_ancestors: list[str] = []
    if ancestors_by_level:
        last_level = set(ancestors_by_level[-1])
        roots = []
        for ancestor in last_level:
            parent_candidates = kinship_index.parents_of(ancestor)
            if not parent_candidates:
                roots.append(ancestor)
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
        "related_images": related,
        "parents": sorted(parents),
        "children": sorted(children),
        "siblings": sorted(siblings),
        "ancestors": filter_existing(ancestors),
        "ancestors_by_level": [filter_existing(set(level)) for level in ancestors_by_level],
        "root_ancestors": root_ancestors,
        "depth_used": depth,
        "lineage_graph": lineage_graph,
    }


@router.post("/api/kinship/rebuild")
def api_kinship_rebuild() -> dict:
    try:
        result = kinship_index.build_and_save()
        return result
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=f"Failed to rebuild index: {exc}") from exc


@router.get("/api/kinship/stats")
def api_kinship_stats() -> dict:
    try:
        return kinship_index.stats()
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {exc}") from exc


@router.get("/api/offspring-images")
def api_list_offspring_images() -> dict:
    """List all images in offspring_images directory."""
    image_dir = Path(settings.offspring_dir)
    if not image_dir.exists():
        return {"images": []}
    
    images = []
    for path in sorted(image_dir.iterdir()):
        if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
            images.append({
                "filename": path.name,
                "url": f"/generated_images/{path.name}",
            })
    
    return {"images": images}


@router.post("/api/generate-collage-version", response_model=GenerateCollageVersionResponse, status_code=202)
async def api_generate_collage_version(
    body: dict = Body(...),
) -> JSONResponse:
    """Generate collage version from multiple images by filename."""
    # Extract image_names and params from body
    image_names = body.get("image_names", [])
    params_dict = {k: v for k, v in body.items() if k != "image_names"}

    # Validate and create request model first so we can gate image-count rules by mode
    try:
        request_params = GenerateCollageVersionRequest(**params_dict)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"參數驗證失敗: {exc}") from exc

    # Validate images with awareness of mode/allow_self semantics
    if not image_names:
        raise HTTPException(status_code=400, detail="至少需要 1 張圖片")
    single_image_allowed = (request_params.mode == "rotate-90") or request_params.allow_self
    if len(image_names) < 2 and not single_image_allowed:
        # Keep message consistent with existing UI copy
        raise HTTPException(status_code=400, detail="至少需要 2 張圖片")
    
    # Resolve image paths
    image_paths = []
    for name in image_names:
        # Sanitize filename
        safe_name = os.path.basename(name)
        image_path = Path(settings.offspring_dir) / safe_name
        if not image_path.exists():
            raise HTTPException(status_code=404, detail=f"圖片不存在: {safe_name}")
        image_paths.append(str(image_path))
    
    # Create task
    task_id = task_manager.create_task()
    
    # Launch generation in the background without blocking the request worker
    async def run_generation_task() -> None:
        def progress_callback(progress: int, stage: str, message: str):
            task_manager.update_progress(task_id, progress, stage, message)
        
        try:
            result = await run_in_threadpool(
                generate_collage_version,
                image_paths,
                request_params.rows,
                request_params.cols,
                request_params.mode,
                request_params.base,
                request_params.allow_self,
                request_params.resize_w,
                request_params.pad_px,
                request_params.jitter_px,
                request_params.rotate_deg,
                request_params.format,
                request_params.quality,
                request_params.seed,
                request_params.return_map,
                progress_callback,
            )
            task_manager.complete_task(task_id, result)
        except ValueError as exc:
            task_manager.fail_task(task_id, str(exc))
        except Exception as exc:  # noqa: BLE001
            task_manager.fail_task(task_id, str(exc))

    asyncio.create_task(run_generation_task())
    
    # Return task_id immediately
    return JSONResponse(
        status_code=202,
        content={
            "task_id": task_id,
            "output_image_path": None,
            "metadata_path": None,
            "output_image": None,
            "parents": None,
            "output_format": None,
            "width": None,
            "height": None,
            "tile_mapping": None,
        }
    )


@router.get("/api/collage-version/{task_id}/progress")
async def api_get_collage_progress(task_id: str) -> dict:
    """Get progress of collage generation task."""
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任務不存在或已過期")
    
    response = {
        "task_id": task_id,
        "progress": task["progress"],
        "stage": task["stage"],
        "message": task["message"],
        "completed": task["completed"],
    }
    
    if task["completed"]:
        if task["error"]:
            response["error"] = task["error"]
        else:
            # Include result when completed
            result = task["result"]
            if result:
                response.update(result)
    
    return response
