import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, Union

from ..config import settings

PathLike = Union[str, os.PathLike[str]]


def write_metadata(data: Dict[str, Any], base_name: str) -> str:
    os.makedirs(settings.metadata_dir, exist_ok=True)
    path = os.path.join(settings.metadata_dir, f"{base_name}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return path


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

