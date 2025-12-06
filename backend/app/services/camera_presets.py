import json
import os
from datetime import datetime, timezone
from typing import List, Dict, Any

from ..config import settings
from ..utils.fs import ensure_dirs
from ..utils.permissions import ensure_metadata_write_enabled

DEFAULT_SCOPE = "kinship"


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


def _normalize_scope(scope: Any) -> str | None:
    if scope is None:
        return None
    value = str(scope).strip()
    return value or None


def _matches_scope(item: Dict[str, Any], scope: str | None) -> bool:
    normalized_scope = _normalize_scope(scope)
    if normalized_scope is None:
        return True
    item_scope = _normalize_scope(item.get("scope"))
    if item_scope is None:
        return normalized_scope == DEFAULT_SCOPE
    return item_scope == normalized_scope


def _scope_equals_for_write(scope_a: Any, scope_b: Any) -> bool:
    """Match scopes for mutation while treating missing scope as the default scope."""
    norm_a = _normalize_scope(scope_a)
    norm_b = _normalize_scope(scope_b)
    if norm_a == norm_b:
        return True
    if (norm_a is None and norm_b == DEFAULT_SCOPE) or (norm_b is None and norm_a == DEFAULT_SCOPE):
        return True
    return False


def list_camera_presets(scope: str | None = None) -> List[Dict[str, Any]]:
    items = [item for item in _load_all() if _matches_scope(item, scope)]
    return sorted(items, key=lambda item: item.get("name", "").lower())


def upsert_camera_preset(payload: Dict[str, Any], scope: str | None = None) -> Dict[str, Any]:
    ensure_metadata_write_enabled("camera_presets")
    name = str(payload.get("name", "")).strip()
    if not name:
        raise ValueError("preset name is required")
    if any(sep in name for sep in ("/", "\\", ":", "*", "?", "\"", "<", ">", "|")):
        raise ValueError("preset name contains invalid characters")
    scope_value = _normalize_scope(payload.get("scope") or scope)

    presets = _load_all()
    now_iso = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    payload = {
        "name": name,
        "position": payload["position"],
        "target": payload["target"],
        "updated_at": now_iso,
    }
    if scope_value:
        payload["scope"] = scope_value

    replaced = False
    for idx, item in enumerate(presets):
        if item.get("name") != payload["name"]:
            continue
        if not _scope_equals_for_write(scope_value, item.get("scope")):
            continue
        presets[idx] = payload
        replaced = True
        break
    if not replaced:
        presets.append(payload)

    _save_all(presets)
    return payload


def delete_camera_preset(name: str, scope: str | None = None) -> bool:
    ensure_metadata_write_enabled("camera_presets")
    presets = _load_all()
    normalized_scope = _normalize_scope(scope)
    next_items: list[dict[str, Any]] = []
    for item in presets:
        if item.get("name") != name:
            next_items.append(item)
            continue

        if not _scope_equals_for_write(normalized_scope, item.get("scope")):
            next_items.append(item)

    if len(next_items) == len(presets):
        return False
    _save_all(next_items)
    return True
