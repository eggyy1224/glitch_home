from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import quote_plus

from ..config import settings
from ..models.iframe import IframeConfig, PanelConfig, ResolvedIframeConfig, ResolvedPanel, isoformat


_BASE_DIR = Path(settings.metadata_dir)
_BASE_DIR.mkdir(parents=True, exist_ok=True)
_GLOBAL_CONFIG_PATH = _BASE_DIR / "iframe_config.json"


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


def _config_path_for(client_id: Optional[str]) -> Path:
    if client_id:
        safe = _sanitize_client_id(client_id)
        return _BASE_DIR / f"iframe_config__{safe}.json"
    return _GLOBAL_CONFIG_PATH


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


def _validate_images(config: IframeConfig) -> None:
    offspring_dir = Path(settings.offspring_dir)
    for panel in config.panels:
        if panel.image:
            candidate = offspring_dir / panel.image
            if not candidate.is_file():
                raise ValueError(f"找不到指定的圖像檔案：{panel.image}")


def config_payload_for_response(config: IframeConfig, client_id: Optional[str] = None) -> Dict[str, object]:
    resolved = resolve_iframe_config(config, client_id)
    payload = resolved.to_payload()
    payload["raw"] = config.model_dump()
    if client_id:
        payload["target_client_id"] = client_id
    return payload
