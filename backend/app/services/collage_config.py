from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, Optional, Tuple

from ..config import settings
from ..models.collage import CollageConfig
from ..models.iframe import isoformat

_BASE_DIR = Path(settings.metadata_dir)
_BASE_DIR.mkdir(parents=True, exist_ok=True)
_GLOBAL_CONFIG_PATH = _BASE_DIR / "collage_config.json"

_CLIENT_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


def _sanitize_client_id(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    candidate = value.strip()
    if not candidate:
        return None
    if not _CLIENT_ID_PATTERN.fullmatch(candidate):
        raise ValueError("target_client_id 僅允許字母、數字、底線與連字號")
    return candidate


def _config_path_for(client_id: Optional[str]) -> Path:
    if client_id:
        safe = _sanitize_client_id(client_id)
        return _BASE_DIR / f"collage_config__{safe}.json"
    return _GLOBAL_CONFIG_PATH


def _default_config() -> CollageConfig:
    return CollageConfig()


def _load_raw(client_id: Optional[str]) -> Dict[str, object] | None:
    if client_id:
        client_path = _config_path_for(client_id)
        if client_path.exists():
            with client_path.open("r", encoding="utf-8") as fp:
                return json.load(fp)
        return None
    if _GLOBAL_CONFIG_PATH.exists():
        with _GLOBAL_CONFIG_PATH.open("r", encoding="utf-8") as fp:
            return json.load(fp)
    return None


def load_collage_config(client_id: Optional[str] = None) -> Tuple[CollageConfig, str, Optional[str], Optional[Path]]:
    sanitized_client_id = _sanitize_client_id(client_id)
    source = "default"
    owner_id: Optional[str] = None
    config_path: Optional[Path] = None

    raw: Dict[str, object] | None = None
    if sanitized_client_id:
        raw = _load_raw(sanitized_client_id)
        if raw is not None:
            source = "client"
            owner_id = sanitized_client_id
            config_path = _config_path_for(sanitized_client_id)

    if raw is None:
        raw = _load_raw(None)
        if raw is not None:
            source = "global"
            owner_id = None
            config_path = _GLOBAL_CONFIG_PATH

    if raw is None:
        config = _default_config()
    else:
        config = CollageConfig(**raw)

    return config, source, owner_id, config_path


def save_collage_config(payload: Dict[str, object]) -> Tuple[CollageConfig, str, Optional[str], Path]:
    target_client_id = None
    if isinstance(payload, dict):
        raw_target = payload.get("target_client_id")
        if isinstance(raw_target, str):
            target_client_id = _sanitize_client_id(raw_target)

    config_payload = {k: v for k, v in payload.items() if k != "target_client_id"}
    config = CollageConfig(**config_payload)
    data = config.model_dump()

    path = _config_path_for(target_client_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fp:
        json.dump(data, fp, ensure_ascii=False, indent=2)

    source = "client" if target_client_id else "global"
    return config, source, target_client_id, path


def config_payload_for_response(
    config: CollageConfig,
    source: str,
    owner_client_id: Optional[str],
    path: Optional[Path],
) -> Dict[str, object]:
    payload: Dict[str, object] = {
        "config": config.model_dump(),
        "source": source,
    }
    if owner_client_id:
        payload["target_client_id"] = owner_client_id
    if path and path.exists():
        payload["updated_at"] = isoformat(path.stat().st_mtime)
    else:
        payload["updated_at"] = None
    return payload
