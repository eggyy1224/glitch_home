"""Batch-convert metadata JSON files to use project-relative paths.

This removes hard-coded absolute paths (e.g., /Volumes/2024data/...) so the
project can be relocated without breaking metadata references.
"""

from __future__ import annotations

import json
import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _relativize_path(path_str: str) -> str:
    path = Path(path_str).expanduser()
    if not path.is_absolute():
        return os.path.normpath(str(path))
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except Exception:
        try:
            return os.path.relpath(str(path), str(PROJECT_ROOT))
        except Exception:
            return str(path)


def _transform(obj: object) -> tuple[object, bool]:
    """Recursively convert absolute paths to relative and drop absolute_path keys."""

    changed = False

    if isinstance(obj, dict):
        new_obj: dict = {}
        # Handle absolute_path specially to drop it but keep a relative fallback
        abs_value = obj.get("absolute_path")
        if "absolute_path" in obj:
            changed = True
            if "relative_path" not in obj and isinstance(abs_value, str):
                new_obj["relative_path"] = _relativize_path(abs_value)
        for key, value in obj.items():
            if key == "absolute_path":
                continue
            new_value, value_changed = _transform(value)
            if value_changed:
                changed = True
            new_obj[key] = new_value
        return new_obj, changed

    if isinstance(obj, list):
        new_list = []
        for item in obj:
            new_item, item_changed = _transform(item)
            if item_changed:
                changed = True
            new_list.append(new_item)
        return new_list, changed

    if isinstance(obj, str):
        if obj.startswith(str(PROJECT_ROOT)):
            rel = _relativize_path(obj)
            if rel != obj:
                return rel, True
        return obj, False

    return obj, False


def process_file(path: Path) -> bool:
    raw = path.read_text(encoding="utf-8")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return False

    transformed, changed = _transform(data)
    if not changed:
        return False

    path.write_text(json.dumps(transformed, ensure_ascii=False, indent=2), encoding="utf-8")
    return True


def main() -> None:
    meta_dir = PROJECT_ROOT / "backend" / "metadata"
    total = 0
    changed = 0
    for file in meta_dir.rglob("*.json"):
        total += 1
        if process_file(file):
            changed += 1
    print(f"Processed {total} files; updated {changed}")


if __name__ == "__main__":
    main()
