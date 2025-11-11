from __future__ import annotations

import json
import mimetypes
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


mimetypes.init()


def _resolve_path(env_key: str, default: Path) -> Path:
    """Resolve a path from env, allowing repo-relative fallbacks."""
    env_value = os.getenv(env_key)
    if not env_value:
        return default
    candidate = Path(env_value)
    if not candidate.is_absolute():
        candidate = (REPO_ROOT / candidate).resolve()
    return candidate


REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_PUBLIC_DIR = _resolve_path(
    "FRONTEND_PUBLIC_DIR",
    REPO_ROOT / "frontend" / "public",
)
BACKEND_DIR = REPO_ROOT / "backend"
METADATA_DIR = _resolve_path("METADATA_DIR", BACKEND_DIR / "metadata")
OFFSPRING_DIR = _resolve_path("OFFSPRING_DIR", BACKEND_DIR / "offspring_images")
GENERATED_SOUNDS_DIR = _resolve_path("GENERATED_SOUNDS_DIR", BACKEND_DIR / "generated_sounds")


@dataclass(frozen=True)
class AssetSource:
    """Configuration for a single asset group."""

    key: str
    root: Path
    public_prefix: str
    category: str
    extensions: Optional[Iterable[str]] = None
    allow_recursive: bool = True

    def normalized_extensions(self) -> Optional[set[str]]:
        if self.extensions is None:
            return None
        return {ext.lower() if ext.startswith(".") else f".{ext.lower()}" for ext in self.extensions}


class AssetLister:
    """Enumerate curated asset roots for MCP tools."""

    def __init__(self) -> None:
        self.sources: Dict[str, AssetSource] = {
            "videos": AssetSource(
                key="videos",
                root=FRONTEND_PUBLIC_DIR / "videos" / "圖像系譜學Video",
                public_prefix="/videos/圖像系譜學Video",
                category="video",
                extensions={"mp4", "mov", "m4v", "webm"},
                allow_recursive=False,
            ),
            "offspring_images": AssetSource(
                key="offspring_images",
                root=OFFSPRING_DIR,
                public_prefix="/generated_images",
                category="image",
                extensions={"png", "jpg", "jpeg", "webp"},
                allow_recursive=True,
            ),
            "generated_sounds": AssetSource(
                key="generated_sounds",
                root=GENERATED_SOUNDS_DIR,
                public_prefix="/generated_sounds",
                category="audio",
                extensions={"mp3", "wav", "aac", "ogg", "m4a"},
                allow_recursive=False,
            ),
        }

    def list_assets(
        self,
        source_key: str,
        limit: Optional[int] = 100,
        offset: int = 0,
        recursive: Optional[bool] = None,
        include_metadata: bool = True,
    ) -> List[Dict[str, Any]]:
        """Return ordered asset entries for the requested source."""
        if source_key not in self.sources:
            raise ValueError(f"Unknown asset source: {source_key}")

        source = self.sources[source_key]
        recursive = source.allow_recursive if recursive is None else recursive
        if recursive and not source.allow_recursive:
            recursive = False

        files = self._collect_files(source, recursive=recursive)
        if offset < 0:
            offset = 0
        sliced = files[offset:]
        if limit is not None and limit >= 0:
            sliced = sliced[:limit]

        return [self._describe(path, source, include_metadata) for path in sliced]

    def _collect_files(self, source: AssetSource, recursive: bool) -> List[Path]:
        root = source.root
        if not root.exists():
            return []

        iterator: Iterable[Path]
        iterator = root.rglob("*") if recursive else root.iterdir()

        allowed_exts = source.normalized_extensions()
        files: List[Path] = []
        for path in iterator:
            if not path.is_file():
                continue
            if allowed_exts and path.suffix.lower() not in allowed_exts:
                continue
            files.append(path)

        files.sort(key=lambda p: p.name.lower())
        return files

    def _describe(self, path: Path, source: AssetSource, include_metadata: bool) -> Dict[str, Any]:
        stat = path.stat()
        mime, _ = mimetypes.guess_type(path.name)
        relative_to_repo = self._relative_to_repo(path)
        relative_to_source = path.relative_to(source.root)
        public_url = self._build_public_url(source, relative_to_source)

        entry: Dict[str, Any] = {
            "name": path.name,
            "relative_path": relative_to_repo,
            "relative_to_source": relative_to_source.as_posix(),
            "public_url": public_url,
            "category": source.category,
            "size_bytes": stat.st_size,
            "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            "mime_type": mime or "application/octet-stream",
            "source": source.key,
        }

        metadata: Optional[Dict[str, Any]] = None
        if include_metadata:
            if source.category == "image":
                metadata = self._load_image_metadata(path)
            elif source.category in {"video", "audio"}:
                # TODO: Add video/audio derived metadata (duration, resolution, etc.)
                metadata = None

        entry["metadata"] = metadata
        return entry

    @staticmethod
    def _build_public_url(source: AssetSource, relative_to_source: Path) -> str:
        suffix = relative_to_source.as_posix()
        if suffix:
            return f"{source.public_prefix}/{suffix}"
        return source.public_prefix

    @staticmethod
    def _relative_to_repo(path: Path) -> str:
        try:
            return path.relative_to(REPO_ROOT).as_posix()
        except ValueError:
            return str(path)

    def _load_image_metadata(self, image_path: Path) -> Optional[Dict[str, Any]]:
        candidate = METADATA_DIR / f"{image_path.stem}.json"
        if not candidate.exists():
            return None
        try:
            return json.loads(candidate.read_text())
        except Exception as exc:  # noqa: BLE001
            return {
                "error": f"Failed to read metadata: {exc}",
                "metadata_path": candidate.as_posix(),
            }

