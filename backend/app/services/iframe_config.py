from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import parse_qs, quote_plus, urlparse

from ..config import settings
from ..models.iframe import IframeConfig, PanelConfig, ResolvedIframeConfig, ResolvedPanel, isoformat
from ..utils.permissions import ensure_metadata_write_enabled


_BASE_DIR = Path(settings.metadata_dir)
_BASE_DIR.mkdir(parents=True, exist_ok=True)
_GLOBAL_CONFIG_PATH = _BASE_DIR / "iframe_config.json"

_SNAPSHOT_BASE_DIR = _BASE_DIR / "snapshots" / "iframe_config"
_SNAPSHOT_BASE_DIR.mkdir(parents=True, exist_ok=True)
_GLOBAL_SNAPSHOT_KEY = "global"


_CLIENT_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


def _sanitize_client_id(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    candidate = value.strip()
    if not candidate:
        return None
    if not _CLIENT_ID_PATTERN.fullmatch(candidate):
        raise ValueError("target_client_id 僅允許字母、數字、底線、連字號")
    return candidate


def sanitize_client_id(value: Optional[str]) -> Optional[str]:
    """Public helper to validate client_id from external modules."""

    return _sanitize_client_id(value)


def _sanitize_snapshot_name(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("snapshot_name 必須為字串")
    candidate = value.strip()
    if not candidate:
        raise ValueError("snapshot_name 不可為空白")
    if not _CLIENT_ID_PATTERN.fullmatch(candidate):
        raise ValueError("snapshot_name 僅允許字母、數字、底線、連字號")
    return candidate


def sanitize_snapshot_name(value: str) -> str:
    """Expose snapshot name validation for other services."""

    return _sanitize_snapshot_name(value)


def _config_path_for(client_id: Optional[str]) -> Path:
    if client_id:
        safe = _sanitize_client_id(client_id)
        return _BASE_DIR / f"iframe_config__{safe}.json"
    return _GLOBAL_CONFIG_PATH


def _snapshot_dir_for(client_id: Optional[str]) -> Path:
    safe = _sanitize_client_id(client_id)
    key = safe or _GLOBAL_SNAPSHOT_KEY
    return _SNAPSHOT_BASE_DIR / key


def _snapshot_path_for(client_id: Optional[str], snapshot_name: str) -> Path:
    safe_snapshot = _sanitize_snapshot_name(snapshot_name)
    directory = _snapshot_dir_for(client_id)
    return directory / f"{safe_snapshot}.json"


def _current_snapshot_timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def _generate_snapshot_name(client_id: Optional[str], snapshot_name: Optional[str]) -> str:
    sanitized_client_id = _sanitize_client_id(client_id)
    safe_descriptor: Optional[str] = None
    if snapshot_name is not None:
        if not isinstance(snapshot_name, str):
            raise ValueError("snapshot_name 必須為字串")
        safe_descriptor = _sanitize_snapshot_name(snapshot_name)

    prefix = sanitized_client_id or _GLOBAL_SNAPSHOT_KEY
    timestamp = _current_snapshot_timestamp()
    parts = [prefix]
    if safe_descriptor:
        parts.append(safe_descriptor)
    parts.append(timestamp)
    base_name = "_".join(parts)

    candidate = base_name
    counter = 0
    while _snapshot_path_for(sanitized_client_id, candidate).exists():
        counter += 1
        candidate = f"{base_name}_{counter}"
    return candidate


def _default_config() -> IframeConfig:
    panels: List[PanelConfig] = [
        PanelConfig(id="left", image="offspring_20250929_114732_835.png"),
        PanelConfig(id="right", image="offspring_20250929_112621_888.png", params={"slide_mode": "true"}),
        PanelConfig(id="third", image="offspring_20250927_141336_787.png", params={"incubator": "true"}),
        PanelConfig(id="fourth", image="offspring_20251001_181913_443.png", params={"organic_mode": "true"}),
    ]
    return IframeConfig(layout="grid", gap=12, columns=2, panels=panels)


def _load_raw(client_id: Optional[str] = None) -> Dict[str, object] | None:
    path = _config_path_for(client_id)
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as fp:
            return json.load(fp)
    except Exception:
        return None


def load_iframe_config(client_id: Optional[str] = None) -> IframeConfig:
    sanitized_client_id = _sanitize_client_id(client_id)
    raw = _load_raw(sanitized_client_id)
    if raw is None:
        return _default_config()
    try:
        return IframeConfig(**raw)
    except Exception:
        return _default_config()


def save_iframe_config(payload: Dict[str, object]) -> tuple[IframeConfig, Optional[str]]:
    ensure_metadata_write_enabled("iframe_config")
    target_client_id = None
    if isinstance(payload, dict):
        raw_target = payload.get("target_client_id")
        if isinstance(raw_target, str):
            target_client_id = _sanitize_client_id(raw_target)

    config_payload = {k: v for k, v in payload.items() if k != "target_client_id"}
    config = IframeConfig(**config_payload)
    _validate_images(config)
    data = config.model_dump()

    path = _config_path_for(target_client_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fp:
        json.dump(data, fp, ensure_ascii=False, indent=2)
    return config, target_client_id


def save_iframe_config_snapshot(client_id: Optional[str], snapshot_name: Optional[str] = None) -> Dict[str, object]:
    ensure_metadata_write_enabled("iframe_config_snapshot")
    sanitized_client_id = _sanitize_client_id(client_id)
    safe_snapshot_name = _generate_snapshot_name(sanitized_client_id, snapshot_name)
    config = load_iframe_config(sanitized_client_id)
    data = config.model_dump()

    path = _snapshot_path_for(sanitized_client_id, safe_snapshot_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fp:
        json.dump(data, fp, ensure_ascii=False, indent=2)

    stats = path.stat()
    return {
        "client_id": sanitized_client_id,
        "name": safe_snapshot_name,
        "created_at": isoformat(stats.st_mtime),
        "size_bytes": stats.st_size,
    }


def list_iframe_config_snapshots(client_id: Optional[str]) -> Tuple[Optional[str], List[Dict[str, object]]]:
    sanitized_client_id = _sanitize_client_id(client_id)
    directory = _snapshot_dir_for(sanitized_client_id)
    if not directory.exists():
        return sanitized_client_id, []

    records: List[Dict[str, object]] = []
    items: List[Tuple[Path, float, int]] = []
    for candidate in directory.glob("*.json"):
        try:
            stats = candidate.stat()
        except OSError:
            continue
        items.append((candidate, stats.st_mtime, stats.st_size))

    for path, mtime, size in sorted(items, key=lambda item: item[1], reverse=True):
        records.append(
            {
                "name": path.stem,
                "created_at": isoformat(mtime),
                "size_bytes": size,
            },
        )

    return sanitized_client_id, records


def restore_iframe_config_snapshot(client_id: Optional[str], snapshot_name: str) -> tuple[IframeConfig, Optional[str]]:
    ensure_metadata_write_enabled("iframe_config_restore")
    config = load_iframe_config_snapshot_config(client_id, snapshot_name)
    sanitized_client_id = _sanitize_client_id(client_id)

    target_path = _config_path_for(sanitized_client_id)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    with target_path.open("w", encoding="utf-8") as fp:
        json.dump(config.model_dump(), fp, ensure_ascii=False, indent=2)

    return config, sanitized_client_id


def load_iframe_config_snapshot_config(client_id: Optional[str], snapshot_name: str) -> IframeConfig:
    """Load a snapshot without mutating current config files."""

    sanitized_client_id = _sanitize_client_id(client_id)
    safe_snapshot_name = _sanitize_snapshot_name(snapshot_name)
    path = _snapshot_path_for(sanitized_client_id, safe_snapshot_name)
    if not path.exists():
        raise FileNotFoundError("snapshot 不存在")

    with path.open("r", encoding="utf-8") as fp:
        raw = json.load(fp)

    config = IframeConfig(**raw)
    _validate_images(config)
    return config


def load_iframe_config_snapshot_payload(client_id: Optional[str], snapshot_name: str) -> dict:
    """載入指定 snapshot 的原始設定 payload。"""

    sanitized_client_id = _sanitize_client_id(client_id)
    safe_snapshot_name = _sanitize_snapshot_name(snapshot_name)
    path = _snapshot_path_for(sanitized_client_id, safe_snapshot_name)
    if not path.exists():
        raise FileNotFoundError("snapshot 不存在")

    with path.open("r", encoding="utf-8") as fp:
        raw = json.load(fp)

    config = IframeConfig(**raw)
    _validate_images(config)
    return raw


def get_iframe_snapshot_metadata(client_id: Optional[str], snapshot_name: str) -> dict:
    sanitized_client_id = _sanitize_client_id(client_id)
    safe_snapshot_name = _sanitize_snapshot_name(snapshot_name)
    path = _snapshot_path_for(sanitized_client_id, safe_snapshot_name)
    if not path.exists():
        raise FileNotFoundError("snapshot 不存在")
    stats = path.stat()
    return {
        "client_id": sanitized_client_id,
        "name": safe_snapshot_name,
        "created_at": isoformat(stats.st_mtime),
        "size_bytes": stats.st_size,
    }


def save_iframe_config_snapshot_payload(client_id: Optional[str], snapshot_name: str, payload: dict) -> dict:
    """覆寫/建立 snapshot 檔，回傳 metadata。"""
    ensure_metadata_write_enabled("iframe_config_snapshot_payload")
    if not isinstance(payload, dict):
        raise ValueError("payload 必須為 JSON 物件")
    sanitized_client_id = _sanitize_client_id(client_id)
    safe_snapshot_name = _sanitize_snapshot_name(snapshot_name)
    config = IframeConfig(**payload)
    _validate_images(config)

    path = _snapshot_path_for(sanitized_client_id, safe_snapshot_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fp:
        json.dump(config.model_dump(), fp, ensure_ascii=False, indent=2)

    stats = path.stat()
    return {
        "client_id": sanitized_client_id,
        "name": safe_snapshot_name,
        "created_at": isoformat(stats.st_mtime),
        "size_bytes": stats.st_size,
    }


def delete_iframe_config_snapshot(client_id: Optional[str], snapshot_name: str) -> None:
    ensure_metadata_write_enabled("iframe_config_snapshot_delete")
    sanitized_client_id = _sanitize_client_id(client_id)
    safe_snapshot_name = _sanitize_snapshot_name(snapshot_name)
    path = _snapshot_path_for(sanitized_client_id, safe_snapshot_name)
    if not path.exists():
        raise FileNotFoundError("snapshot 不存在")
    path.unlink()


def clone_iframe_config_snapshot(
    source_client_id: Optional[str],
    source_snapshot_name: str,
    target_client_id: Optional[str],
    target_snapshot_name: Optional[str] = None,
) -> dict:
    ensure_metadata_write_enabled("iframe_config_snapshot_clone")
    payload = load_iframe_config_snapshot_payload(source_client_id, source_snapshot_name)
    target_name = target_snapshot_name or source_snapshot_name
    return save_iframe_config_snapshot_payload(target_client_id, target_name, payload)


def resolve_iframe_config(config: IframeConfig, client_id: Optional[str] = None) -> ResolvedIframeConfig:
    base_url = "/"
    panels: List[ResolvedPanel] = []
    for idx, panel in enumerate(config.panels):
        final_src: Optional[str] = None
        if panel.url:
            final_src = panel.url
        elif panel.image:
            query_parts: List[str] = ["img=" + quote_plus(panel.image)]
            for key, value in panel.params.items():
                if value is None:
                    continue
                key_encoded = quote_plus(str(key))
                value_encoded = quote_plus(str(value))
                query_parts.append(f"{key_encoded}={value_encoded}")
            query = "&".join(query_parts)
            final_src = f"{base_url}?{query}" if query else base_url
        if not final_src:
            continue
        panels.append(
            ResolvedPanel(
                id=panel.id or f"panel_{idx+1}",
                src=final_src,
                ratio=panel.ratio,
                label=panel.label,
                image=panel.image,
                params=dict(panel.params),
                url=panel.url,
                col_span=panel.col_span,
                row_span=panel.row_span,
            ),
        )

    path = _config_path_for(client_id)
    updated_at = isoformat(path.stat().st_mtime) if path.exists() else None
    return ResolvedIframeConfig(
        layout=config.layout,
        gap=config.gap,
        columns=config.columns,
        panels=panels,
        updated_at=updated_at,
    )


def _extract_img_base(panel: PanelConfig) -> Optional[str]:
    if not panel.url:
        return None
    try:
        parsed = urlparse(panel.url)
        query = parse_qs(parsed.query)
        base = query.get("img_base", [None])[0]
        if base is None:
            return None
        trimmed = base.strip()
        return trimmed or None
    except Exception:
        return None


def _resolve_candidate_path(panel: PanelConfig) -> Optional[Path]:
    if not panel.image:
        return None

    def _clean_extra_prefix(prefix: str) -> Optional[Path]:
        candidate = Path(prefix)
        if candidate.is_absolute() or any(part in ("..", "") for part in candidate.parts):
            return None
        return candidate

    img_base = _extract_img_base(panel)
    base_dir = Path(settings.offspring_dir).resolve()
    extra_prefix: Path | None = None

    if img_base:
        normalized = img_base.strip()
        if normalized.startswith(("http://", "https://")):
            return None

        def strip_prefix(prefix: str) -> Optional[Path]:
            remainder = normalized[len(prefix) :].lstrip("/")
            return _clean_extra_prefix(remainder) if remainder else None

        if normalized.startswith("/nightwalk_assets"):
            if not settings.nightwalk_assets_dir:
                return None
            base_dir = Path(settings.nightwalk_assets_dir).resolve()
            extra_prefix = strip_prefix("/nightwalk_assets")
        elif normalized.startswith("/generated_images"):
            base_dir = Path(settings.offspring_dir).resolve()
            extra_prefix = strip_prefix("/generated_images")
        else:
            return None
        allowed_no_extra = {"/nightwalk_assets", "/nightwalk_assets/", "/generated_images", "/generated_images/"}
        if extra_prefix is None and normalized not in allowed_no_extra:
            raise ValueError("img_base 僅允許資產子路徑，不可包含 .. 或絕對路徑")

    candidate = base_dir
    if extra_prefix:
        candidate = candidate.joinpath(extra_prefix)
    candidate = candidate.joinpath(panel.image).resolve()
    try:
        if not candidate.is_relative_to(base_dir):
            raise ValueError("img_base 解析後超出允許的資產目錄")
    except AttributeError:
        base_str = str(base_dir)
        candidate_str = str(candidate)
        if not candidate_str.startswith(base_str.rstrip("/") + "/"):
            raise ValueError("img_base 解析後超出允許的資產目錄")
    return candidate


def _validate_images(config: IframeConfig) -> None:
    for panel in config.panels:
        if not panel.image:
            continue
        candidate = _resolve_candidate_path(panel)
        if candidate is None:
            continue
        if not candidate.is_file():
            raise ValueError(f"找不到指定的圖像檔案：{panel.image}")


def config_payload_for_response(config: IframeConfig, client_id: Optional[str] = None) -> Dict[str, object]:
    resolved = resolve_iframe_config(config, client_id)
    payload = resolved.to_payload()
    payload["raw"] = config.model_dump()
    if client_id:
        payload["target_client_id"] = client_id
    return payload
