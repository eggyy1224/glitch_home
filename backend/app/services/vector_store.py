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

import chromadb
from chromadb.api.types import Documents, Embeddings, IDs, Metadatas

from ..config import settings
from ..utils.embeddings import (
    embed_text,
    embed_image,
    embed_image_as_text,
    is_multimodal_model,
    caption_image,
)
import os


_client: chromadb.ClientAPI | None = None


def get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        Path(settings.chroma_db_path).mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=settings.chroma_db_path)
    return _client


def get_images_collection():
    client = get_client()
    # Set metadata to record the model used for sanity checks.
    return client.get_or_create_collection(
        name=settings.chroma_collection_images,
        metadata={
            "embedding_model_image": settings.google_image_embedding_model,
        },
    )


def get_text_collection():
    client = get_client()
    return client.get_or_create_collection(
        name=settings.chroma_collection_text,
        metadata={
            "embedding_model_text": settings.google_text_embedding_model,
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


def sweep_and_index_offspring(limit: Optional[int] = None, *, force: bool = False) -> Dict[str, Any]:
    """Index all offspring images found on disk."""
    image_dir = Path(settings.offspring_dir)
    if not image_dir.exists():
        return {"indexed": 0, "skipped": 0, "errors": 0}

    files = [p for p in image_dir.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg"}]
    files.sort()
    if limit is not None:
        files = files[:limit]

    indexed = 0
    skipped = 0
    errors = 0
    results: List[Dict[str, Any]] = []
    for p in files:
        try:
            res = index_offspring_image(p.name, force=force)
            if res["status"] == "indexed":
                indexed += 1
            else:
                skipped += 1
            results.append(res)
        except Exception as exc:  # noqa: BLE001
            errors += 1
            results.append({"id": p.name, "status": "error", "error": str(exc)})

    return {"indexed": indexed, "skipped": skipped, "errors": errors, "results": results}


def search_images_by_text(query: str, top_k: int = 10) -> Dict[str, Any]:
    """Search the image collection with a text query.

    - 若有啟用 direct image embedding 且 image 模型看起來是 multimodal，
      以該模型做文字嵌入（跨模態同空間）。
    - 否則使用 text-embedding-004。
    """
    if settings.enable_image_embedding and is_multimodal_model(settings.google_image_embedding_model):
        vec = embed_text(query, model=settings.google_image_embedding_model)
    else:
        vec = embed_text(query, model=settings.google_text_embedding_model)
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
    # Resolve flexible paths: absolute, relative, or just basename under offspring_dir
    path = image_path
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
    if not os.path.isfile(path):
        raise FileNotFoundError(path)

    try:
        vec = embed_image(path)
    except Exception:
        # Fallback: caption + text embedding
        hint = None
        meta_json = Path(settings.metadata_dir) / f"{Path(path).stem}.json"
        if meta_json.exists():
            try:
                import json
                md = json.loads(meta_json.read_text(encoding="utf-8"))
                hint = md.get("prompt") or None
            except Exception:
                pass
        vec = embed_image_as_text(path, extra_hint=hint)
    col = get_images_collection()
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
