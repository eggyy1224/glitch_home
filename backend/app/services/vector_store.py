from __future__ import annotations

"""ChromaDB integration for storing and searching embeddings.

We maintain two collections by default:
- images: embeddings for generated offspring images (basename as id)
- text_queries: optional cache/history for text query embeddings

All vectors are produced externally (Google GenAI); we pass them to Chroma
via `embeddings=` to avoid relying on an internal embedding function.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from functools import lru_cache

import chromadb
from chromadb.api.types import Documents, Embeddings, IDs, Metadatas

from ..config import settings
from ..utils.embeddings import (
    embed_text,
    embed_image,
    embed_image_as_text,
    caption_image,
)
import os


_client: chromadb.ClientAPI | None = None
_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}


def get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        Path(settings.chroma_db_path).mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=settings.chroma_db_path)
    return _client


def get_images_collection():
    client = get_client()
    # Set metadata to record the model used for sanity checks.
    # 嘗試加入 HNSW 相關提示（若 Chroma 版本不支援會被忽略，不影響功能）
    return client.get_or_create_collection(
        name=settings.chroma_collection_images,
        metadata={
            "embedding_model_image": settings.openai_embedding_model,
            # 以下鍵值僅作為提示，某些後端可能不採用
            "hnsw:space": "cosine",
            "hnsw:construction_ef": 200,
            "hnsw:search_ef": 50,
            "hnsw:M": 16,
        },
    )


def get_text_collection():
    client = get_client()
    return client.get_or_create_collection(
        name=settings.chroma_collection_text,
        metadata={
            "embedding_model_text": settings.openai_embedding_model,
        },
    )


def _offspring_path_from_basename(name: str) -> Path:
    return Path(settings.offspring_dir) / name


def index_offspring_image(basename: str, *, force: bool = False) -> Dict[str, Any]:
    """Compute embedding for a single offspring image and upsert into Chroma."""
    col = get_images_collection()
    image_path = _offspring_path_from_basename(basename)
    if not image_path.exists():
        raise FileNotFoundError(f"offspring image not found: {image_path}")

    # Use basename as id (unique in our dataset)
    doc_id = basename

    exists = col.get(ids=[doc_id])
    if not force and (exists and len(exists.get("ids", [])) > 0):
        return {"id": doc_id, "status": "exists"}

    # Prefer true image embeddings if a supported image model exists; otherwise caption->text embedding
    try:
        vec = embed_image(str(image_path))
    except Exception:
        # Fallback to captioning + text embedding
        # Optionally include a short hint from metadata
        hint = None
        meta_json = Path(settings.metadata_dir) / f"{image_path.stem}.json"
        if meta_json.exists():
            try:
                import json
                md = json.loads(meta_json.read_text(encoding="utf-8"))
                hint = md.get("prompt") or None
            except Exception:
                pass
        vec = embed_image_as_text(str(image_path), extra_hint=hint)

    # Prepare metadata by reading companion JSON if available
    meta: Dict[str, Any] = {"path": str(image_path)}
    meta_json = Path(settings.metadata_dir) / f"{image_path.stem}.json"
    if meta_json.exists():
        try:
            import json

            meta.update(json.loads(meta_json.read_text(encoding="utf-8")))
        except Exception:
            pass

    def _sanitize(value: Any) -> Any:
        # Chroma requires scalar types (str, int, float, bool, None)
        if value is None or isinstance(value, (str, int, float, bool)):
            return value
        try:
            import json as _json
            return _json.dumps(value, ensure_ascii=False)
        except Exception:
            return str(value)

    meta = {k: _sanitize(v) for k, v in meta.items()}

    col.upsert(
        ids=[doc_id],
        embeddings=[vec],
        metadatas=[meta],
        documents=None,
    )
    return {"id": doc_id, "status": "indexed", "dim": len(vec)}


def _iter_offspring_images(limit: Optional[int] = None) -> Optional[List[Path]]:
    """Return filtered offspring image paths in sorted order.

    None is returned when the offspring directory is missing so that callers can
    preserve their historical return structure (which skipped the results list).
    """

    image_dir = Path(settings.offspring_dir)
    if not image_dir.exists():
        return None

    files = sorted(
        p
        for p in image_dir.iterdir()
        if p.is_file() and p.suffix.lower() in _IMAGE_EXTENSIONS
    )

    if limit is not None:
        if limit <= 0:
            return []
        return files[:limit]

    return files


def _index_files(files: Iterable[Path], *, force: bool) -> Dict[str, Any]:
    """Index files while accumulating shared statistics and error handling."""

    indexed = 0
    skipped = 0
    errors = 0
    results: List[Dict[str, Any]] = []

    for item in files:
        path = Path(item)
        try:
            res = index_offspring_image(path.name, force=force)
            if res.get("status") == "indexed":
                indexed += 1
            else:
                skipped += 1
            results.append(res)
        except Exception as exc:  # noqa: BLE001
            errors += 1
            results.append({"id": path.name, "status": "error", "error": str(exc)})

    return {"indexed": indexed, "skipped": skipped, "errors": errors, "results": results}


def sweep_and_index_offspring(limit: Optional[int] = None, *, force: bool = False) -> Dict[str, Any]:
    """Index all offspring images found on disk."""
    files = _iter_offspring_images(limit=limit)
    if files is None:
        return {"indexed": 0, "skipped": 0, "errors": 0}

    return _index_files(files, force=force)


def index_offspring_batch(batch_size: int = 50, offset: int = 0, *, force: bool = False) -> Dict[str, Any]:
    """Index a batch of offspring images starting from offset.
    
    Args:
        batch_size: Number of images to index in this batch (default: 50)
        offset: Starting position (default: 0)
        force: Force re-indexing even if exists
    
    Returns:
        Dictionary with indexed, skipped, errors counts and results list
    """
    files = _iter_offspring_images()
    if files is None:
        return {
            "indexed": 0,
            "skipped": 0,
            "errors": 0,
            "results": [],
            "batch_info": {
                "batch_size": batch_size,
                "offset": offset,
                "total_files": 0,
                "next_offset": offset + batch_size,
            },
        }

    total_files = len(files)
    batch_files = files[offset:offset + batch_size]
    stats = _index_files(batch_files, force=force)

    stats["batch_info"] = {
        "batch_size": batch_size,
        "offset": offset,
        "total_files": total_files,
        "next_offset": offset + batch_size,
    }
    return stats


def search_images_by_text(query: str, top_k: int = 10) -> Dict[str, Any]:
    """Search the image collection with a text query using OpenAI embeddings."""
    # 用 OpenAI text-embedding-3-small 進行查詢
    vec = _cached_embed_text(query)
    col = get_images_collection()
    res = col.query(query_embeddings=[vec], n_results=top_k)
    # Standardise output
    out: List[Dict[str, Any]] = []
    ids = res.get("ids", [[]])[0] if res else []
    dists = res.get("distances", [[]])[0] if res else []
    metas = res.get("metadatas", [[]])[0] if res else []
    for i, doc_id in enumerate(ids or []):
        out.append({
            "id": doc_id,
            "distance": dists[i] if i < len(dists) else None,
            "metadata": metas[i] if i < len(metas) else None,
        })
    return {"results": out}


def search_images_by_image(image_path: str, top_k: int = 10) -> Dict[str, Any]:
    """搜尋類似圖像。
    
    優化邏輯：
    1. 如果搜尋的圖像已在資料庫中，直接從資料庫取得向量（不重複 embedding）
    2. 如果圖像不在資料庫中，才進行 embedding（發送 API 呼叫）
    """
    # Resolve flexible paths: absolute, relative, or just basename under offspring_dir
    path = image_path
    original_path = image_path  # 保存原始路徑作為回退選項
    
    if not os.path.isabs(path):
        # Try as given relative to project root
        abs_try = os.path.abspath(path)
        if os.path.isfile(abs_try):
            path = abs_try
        else:
            # Try under offspring_dir
            base = os.path.basename(path)
            cand1 = os.path.join(settings.offspring_dir, path)
            cand2 = os.path.join(settings.offspring_dir, base)
            if os.path.isfile(cand1):
                path = cand1
            elif os.path.isfile(cand2):
                path = cand2
            # 如果檔案不在 offspring_images 中，暫時不拋出錯誤，先檢查資料庫
    
    # 只在確實需要時才驗證檔案存在
    # （因為可能是已在資料庫中的圖像，不需要檔案存在）
    
    # ✨ 優化：檢查圖像是否已在資料庫中
    basename = os.path.basename(path)
    col = get_images_collection()
    
    # 先嘗試用完整的 basename 在資料庫中查找
    existing = col.get(ids=[basename], include=["embeddings"])
    
    if existing and len(existing.get("ids", [])) > 0:
        # ✓ 圖像已在資料庫中，直接取得其向量
        embeddings = existing.get("embeddings", [])
        # 檢查 embeddings 是否有效（不要用 if embeddings，會觸發 numpy 陣列的真值歧義）
        if embeddings is not None and len(embeddings) > 0 and embeddings[0] is not None:
            vec = embeddings[0]
            # 如果是 numpy 陣列，轉換為列表
            try:
                if hasattr(vec, 'tolist'):
                    vec = vec.tolist()
            except Exception:
                pass
        else:
            # 如果沒有向量（不應該發生），則降級到 embedding
            # 使用原始路徑或任何存在的路徑進行 embedding
            if os.path.isfile(path):
                vec = _cached_embed_image_for_search(path)
            else:
                # 如果現在檔案也不存在，使用 original_path 嘗試
                if os.path.isfile(original_path):
                    vec = _cached_embed_image_for_search(original_path)
                else:
                    raise FileNotFoundError(original_path)
    else:
        # ✗ 圖像不在資料庫中，進行 embedding
        # 需要確保檔案存在
        if not os.path.isfile(path):
            # 如果解析出的路徑不存在，嘗試原始路徑
            if os.path.isfile(original_path):
                path = original_path
            else:
                # 都不存在，拋出錯誤
                raise FileNotFoundError(f"檔案不存在: {original_path}")
        
        vec = _cached_embed_image_for_search(path)
    
    # 使用獲得的向量進行搜尋
    res = col.query(query_embeddings=[vec], n_results=top_k)
    out: List[Dict[str, Any]] = []
    ids = res.get("ids", [[]])[0] if res else []
    dists = res.get("distances", [[]])[0] if res else []
    metas = res.get("metadatas", [[]])[0] if res else []
    for i, doc_id in enumerate(ids or []):
        out.append({
            "id": doc_id,
            "distance": dists[i] if i < len(dists) else None,
            "metadata": metas[i] if i < len(metas) else None,
        })
    return {"results": out}


def _embed_image_for_search(image_path: str) -> List[float]:
    """為搜尋目的進行圖像 embedding。
    
    包含回退邏輯：主要方法失敗時回退到標題 + 文字 embedding。
    """
    try:
        vec = embed_image(image_path)
    except Exception:
        # Fallback: caption + text embedding
        hint = None
        meta_json = Path(settings.metadata_dir) / f"{Path(image_path).stem}.json"
        if meta_json.exists():
            try:
                import json
                md = json.loads(meta_json.read_text(encoding="utf-8"))
                hint = md.get("prompt") or None
            except Exception:
                pass
        vec = embed_image_as_text(image_path, extra_hint=hint)
    return vec


# ---- 輕量級快取：減少重複嵌入開銷 ----

@lru_cache(maxsize=2048)
def _cached_embed_text(q: str) -> List[float]:
    # 以規範化字串作為快取鍵
    key = (q or "").strip()
    if not key:
        raise ValueError("query must be non-empty")
    return embed_text(key)


@lru_cache(maxsize=512)
def _cached_embed_image_for_search(path: str) -> Tuple[float, ...]:
    # 基於絕對路徑做快取（若檔案更新需重開進程或改為加上 mtime）
    abs_path = str(Path(path).resolve())
    vec = _embed_image_for_search(abs_path)
    # lru_cache 需要可雜湊，轉 tuple
    return tuple(vec)
