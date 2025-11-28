import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Type, Union

from pydantic import BaseModel, ValidationError

from ..config import settings

PathLike = Union[str, os.PathLike[str]]
logger = logging.getLogger(__name__)


def write_metadata(data: Dict[str, Any], base_name: str, base_dir: Optional[PathLike] = None) -> str:
    base_dir_path = Path(base_dir or settings.metadata_dir).resolve()
    base_dir_path.mkdir(parents=True, exist_ok=True)

    target_path = base_dir_path / f"{base_name}.json"
    resolved = target_path.resolve()

    if base_dir_path not in resolved.parents and resolved != base_dir_path:
        raise ValueError("非法 metadata 路徑：越界目錄")

    resolved.parent.mkdir(parents=True, exist_ok=True)
    with open(resolved, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return str(resolved)


def utc_now_iso_z() -> str:
    """Return current UTC time in ISO format with Z suffix."""
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def compute_sha256(path: PathLike, chunk_size: int = 65536) -> str:
    """Compute sha256 checksum for the given file path."""
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def validate_metadata_schema(
    data: Dict[str, Any],
    *,
    model: Optional[Type[BaseModel]] = None,
    context: Optional[str] = None,
    exclude_none: bool = False,
) -> Dict[str, Any]:
    """Validate/sanitize metadata payload with a Pydantic model.

    遵循「不中斷行為」原則：驗證失敗時只記 warning 並回傳原始資料。
    """
    if model is None:
        return data

    try:
        instance = model.model_validate(data)
        return instance.model_dump(mode="json", exclude_none=exclude_none)
    except ValidationError as exc:
        logger.warning("Metadata validation failed (%s): %s", context or model.__name__, exc)
        return data
    except Exception as exc:  # noqa: BLE001
        logger.error("Metadata validation error (%s): %s", context or model.__name__, exc, exc_info=True)
        return data
