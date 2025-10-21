from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import quote_plus

from ..config import settings
from ..models.iframe import IframeConfig, PanelConfig, ResolvedIframeConfig, ResolvedPanel, isoformat


_CONFIG_PATH = Path(settings.metadata_dir) / "iframe_config.json"
_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)


def _default_config() -> IframeConfig:
    panels: List[PanelConfig] = [
        PanelConfig(id="left", image="offspring_20250929_114732_835.png"),
        PanelConfig(id="right", image="offspring_20250929_112621_888.png", params={"slide_mode": "true"}),
        PanelConfig(id="third", image="offspring_20250927_141336_787.png", params={"incubator": "true"}),
        PanelConfig(id="fourth", image="offspring_20251001_181913_443.png", params={"organic_mode": "true"}),
    ]
    return IframeConfig(layout="grid", gap=12, columns=2, panels=panels)


def _load_raw() -> Dict[str, object] | None:
    if not _CONFIG_PATH.exists():
        return None
    try:
        with _CONFIG_PATH.open("r", encoding="utf-8") as fp:
            return json.load(fp)
    except Exception:
        return None


def load_iframe_config() -> IframeConfig:
    raw = _load_raw()
    if raw is None:
        return _default_config()
    try:
        return IframeConfig(**raw)
    except Exception:
        return _default_config()


def save_iframe_config(payload: Dict[str, object]) -> IframeConfig:
    config = IframeConfig(**payload)
    _validate_images(config)
    data = config.model_dump()
    with _CONFIG_PATH.open("w", encoding="utf-8") as fp:
        json.dump(data, fp, ensure_ascii=False, indent=2)
    return config


def resolve_iframe_config(config: IframeConfig) -> ResolvedIframeConfig:
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

    updated_at = isoformat(_CONFIG_PATH.stat().st_mtime) if _CONFIG_PATH.exists() else None
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


def config_payload_for_response(config: IframeConfig) -> Dict[str, object]:
    resolved = resolve_iframe_config(config)
    payload = resolved.to_payload()
    payload["raw"] = config.model_dump()
    return payload
