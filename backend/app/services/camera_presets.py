import json
import os
from datetime import datetime
from typing import List, Dict, Any

from ..config import settings
from ..utils.fs import ensure_dirs


def _ensure_storage() -> None:
    directory = os.path.dirname(settings.camera_presets_file)
    if directory:
        ensure_dirs([directory])


def _load_all() -> List[Dict[str, Any]]:
    path = settings.camera_presets_file
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
    except Exception:
        pass
    return []


def _save_all(items: List[Dict[str, Any]]) -> None:
    _ensure_storage()
    tmp_path = settings.camera_presets_file + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, settings.camera_presets_file)


def list_camera_presets() -> List[Dict[str, Any]]:
    items = _load_all()
    return sorted(items, key=lambda item: item.get("name", "").lower())


def upsert_camera_preset(payload: Dict[str, Any]) -> Dict[str, Any]:
    name = str(payload.get("name", "")).strip()
    if not name:
        raise ValueError("preset name is required")
    if any(sep in name for sep in ("/", "\\", ":", "*", "?", "\"", "<", ">", "|")):
        raise ValueError("preset name contains invalid characters")

    presets = _load_all()
    now_iso = datetime.utcnow().isoformat() + "Z"
    payload = {
        "name": name,
        "position": payload["position"],
        "target": payload["target"],
        "updated_at": now_iso,
    }

    replaced = False
    for idx, item in enumerate(presets):
        if item.get("name") == payload["name"]:
            presets[idx] = payload
            replaced = True
            break
    if not replaced:
        presets.append(payload)

    _save_all(presets)
    return payload


def delete_camera_preset(name: str) -> bool:
    presets = _load_all()
    next_items = [item for item in presets if item.get("name") != name]
    if len(next_items) == len(presets):
        return False
    _save_all(next_items)
    return True
