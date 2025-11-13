from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException

from ..models.schemas import (
    ImageSearchRequest,
    IndexBatchRequest,
    IndexOffspringRequest,
    IndexOneImageRequest,
    TextSearchRequest,
)
from ..services import vector_store

router = APIRouter()


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
        res = vector_store.search_images_by_text(
            body.query, 
            top_k=body.top_k,
            include_deprecated=body.include_deprecated,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return res


@router.post("/api/search/image")
def api_search_image(body: ImageSearchRequest) -> dict:
    try:
        res = vector_store.search_images_by_image(
            body.image_path, 
            top_k=body.top_k,
            include_deprecated=body.include_deprecated,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=f"圖像不存在或無法索引: {str(exc)}") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return res


@router.post("/api/index/mark-deprecated")
def api_mark_deprecated() -> dict:
    """批量標記所有 deprecated 圖片為 deprecated=True。
    
    掃描 offspring_images/deprecated/ 目錄，更新 ChromaDB 中對應圖片的 metadata。
    """
    try:
        res = vector_store.mark_deprecated_images()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return res
